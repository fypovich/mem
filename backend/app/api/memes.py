import uuid
import os
import aiofiles
import sqlalchemy as sa
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, exists, desc, and_, or_
from sqlalchemy.orm import selectinload, aliased

from app.core.database import get_db
# Импортируем все необходимые модели
from app.models.models import (
    Meme, User, Like, Comment, Tag, Subject, 
    meme_tags, Notification, NotificationType, follows, SubjectCategory
)
from app.schemas import MemeResponse, CommentCreate, CommentResponse
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.core import security
from app.services.media import MediaProcessor
from app.services.search import get_search_service

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)

# --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ АВТОРИЗАЦИИ ---

async def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: AsyncSession = Depends(get_db)
) -> User:
    if not token: raise HTTPException(401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        user_id = payload.get("sub")
    except: raise HTTPException(401, detail="Invalid token")
    
    res = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = res.scalars().first()
    if not user: raise HTTPException(401, detail="User not found")
    return user

async def get_optional_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    try:
        if not token: return None
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id: return None
        res = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        return res.scalars().first()
    except: return None


# --- ЭНДПОИНТЫ ---

@router.get("/popular-content")
async def get_popular_content(db: AsyncSession = Depends(get_db)):
    """Возвращает топ тегов и персонажей для сайдбара"""
    # Топ 5 тегов
    tags_stmt = (
        select(Tag.name, func.count(meme_tags.c.meme_id).label("count"))
        .join(meme_tags)
        .group_by(Tag.id, Tag.name)
        .order_by(desc("count"))
        .limit(5)
    )
    tags_res = await db.execute(tags_stmt)
    tags = [{"name": row[0], "count": row[1]} for row in tags_res.all()]

    # Топ 5 персонажей
    subjects_stmt = (
        select(Subject.name, Subject.slug, func.count(Meme.id).label("count"))
        .join(Meme)
        .group_by(Subject.id, Subject.name, Subject.slug)
        .order_by(desc("count"))
        .limit(5)
    )
    subjects_res = await db.execute(subjects_stmt)
    subjects = [{"name": row[0], "slug": row[1], "count": row[2]} for row in subjects_res.all()]

    return {"tags": tags, "subjects": subjects}


@router.post("/upload", response_model=MemeResponse)
async def upload_meme(
    title: str = Form(...),
    description: str = Form(None),
    tags: str = Form(None),
    subject: str = Form(None),
    file: UploadFile = File(...),
    audio_file: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Загрузка мема, обработка видео, создание тегов/персонажей, индексация и уведомления"""
    file_id = str(uuid.uuid4())
    # Определяем расширение
    ext = file.filename.split('.')[-1].lower()
    raw_path = os.path.join(UPLOAD_DIR, f"raw_{file_id}.{ext}")
    final_path = os.path.join(UPLOAD_DIR, f"{file_id}.mp4")
    thumbnail_path = os.path.join(UPLOAD_DIR, f"{file_id}_thumb.jpg")

    # Сохраняем исходник
    async with aiofiles.open(raw_path, 'wb') as f:
        await f.write(await file.read())

    processor = MediaProcessor(raw_path)
    
    try:
        # Обработка видео/аудио
        if audio_file:
            audio_ext = audio_file.filename.split('.')[-1]
            audio_path = os.path.join(UPLOAD_DIR, f"audio_{file_id}.{audio_ext}")
            async with aiofiles.open(audio_path, 'wb') as f:
                await f.write(await audio_file.read())
            processor.process_video_with_audio(audio_path, final_path)
            processor = MediaProcessor(final_path) # Переключаемся на новый файл
            if os.path.exists(audio_path): os.remove(audio_path)
            if os.path.exists(raw_path): os.remove(raw_path)
        else:
            # Просто конвертируем/перемещаем
            if ext in ['mp4', 'mov', 'webm']:
                 os.rename(raw_path, final_path)
                 processor = MediaProcessor(final_path)
            else:
                 os.rename(raw_path, final_path)
                 processor = MediaProcessor(final_path)

        duration, width, height = processor.get_metadata()
        processor.generate_thumbnail(thumbnail_path)
    except Exception as e:
        # Чистим за собой
        if os.path.exists(final_path): os.remove(final_path)
        if os.path.exists(thumbnail_path): os.remove(thumbnail_path)
        if os.path.exists(raw_path): os.remove(raw_path)
        raise HTTPException(500, detail=f"Media processing error: {str(e)}")

    # Обработка Тегов
    db_tags = []
    if tags:
        tag_list = [t.strip().lower().replace("#", "") for t in tags.split(",") if t.strip()]
        for t_name in tag_list:
            res = await db.execute(select(Tag).where(Tag.name == t_name))
            tag = res.scalars().first()
            if not tag:
                tag = Tag(name=t_name)
                db.add(tag)
                await db.flush()
            db_tags.append(tag)

    # Обработка Персонажа (Subject)
    db_subject = None
    if subject:
        clean_name = subject.strip()
        slug = clean_name.lower().replace(" ", "_")
        res = await db.execute(select(Subject).where(Subject.slug == slug))
        db_subject = res.scalars().first()
        if not db_subject:
            # По умолчанию категория PERSON, можно расширить логику определения
            db_subject = Subject(name=clean_name, slug=slug, category="person")
            db.add(db_subject)
            await db.flush()

    # Создание записи в БД
    new_meme = Meme(
        title=title,
        description=description,
        media_url=f"/static/{file_id}.mp4",
        thumbnail_url=f"/static/{file_id}_thumb.jpg",
        duration=duration,
        width=width,
        height=height,
        user_id=current_user.id,
        status="approved", # Сразу одобряем для MVP
        subject_id=db_subject.id if db_subject else None
    )
    # Привязываем теги перед первым коммитом
    # (SQLAlchemy сам разберется с Many-to-Many при db.add)
    new_meme.tags = db_tags
    
    db.add(new_meme)
    await db.commit()

    # 1. Индексация в Meilisearch
    try:
        search = get_search_service()
        if search:
            search.add_meme({
                "id": str(new_meme.id),
                "title": new_meme.title,
                "description": new_meme.description,
                "thumbnail_url": new_meme.thumbnail_url,
                "views_count": new_meme.views_count
            })
    except Exception as e:
        print(f"Meilisearch indexing warning: {e}")

    # 2. Уведомления подписчикам
    # Находим всех, кто подписан на current_user (followers)
    followers_stmt = select(follows.c.follower_id).where(follows.c.followed_id == current_user.id)
    followers_res = await db.execute(followers_stmt)
    follower_ids = followers_res.scalars().all()
    
    for fid in follower_ids:
        notif = Notification(
            user_id=fid,                # Получатель (подписчик)
            sender_id=current_user.id,  # Автор
            type=NotificationType.NEW_MEME,
            meme_id=new_meme.id
        )
        db.add(notif)
    
    await db.commit()

    # ВАЖНО: Делаем SELECT заново с подгрузкой связей, 
    # вместо db.refresh(), который сбрасывает связи в асинхронном режиме
    res = await db.execute(
        select(Meme)
        .options(selectinload(Meme.user), selectinload(Meme.tags), selectinload(Meme.subject))
        .where(Meme.id == new_meme.id)
    )
    return res.scalars().first()


@router.get("/", response_model=List[MemeResponse])
async def read_memes(
    skip: int = 0,
    limit: int = 20,
    username: Optional[str] = None, 
    liked_by: Optional[str] = None,
    tag: Optional[str] = None,
    subject: Optional[str] = None,
    # Новые фильтры
    category: Optional[str] = None, # 'game', 'movie', 'person'
    sort: str = "new",              # "new", "popular"
    period: str = "all",            # "week", "month", "all"
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user) 
):
    """Получение списка мемов с фильтрацией, сортировкой и статистикой"""
    
    # Алиасы для подзапросов, чтобы не путать таблицы
    LikeStats = aliased(Like)
    CommentStats = aliased(Comment)
    MyLike = aliased(Like)

    # Подзапрос: Количество лайков
    likes_subquery = (
        select(func.count(LikeStats.user_id))
        .where(LikeStats.meme_id == Meme.id)
        .scalar_subquery()
    )

    # Подзапрос: Количество комментариев
    comments_subquery = (
        select(func.count(CommentStats.id))
        .where(CommentStats.meme_id == Meme.id)
        .scalar_subquery()
    )

    # Подзапрос: Лайкнул ли текущий юзер?
    if current_user:
        is_liked_subquery = (
            exists()
            .where((MyLike.meme_id == Meme.id) & (MyLike.user_id == current_user.id))
        )
    else:
        is_liked_subquery = sa.literal(False)

    # Основной запрос
    query = (
        select(
            Meme, 
            likes_subquery.label("likes_count"),
            comments_subquery.label("comments_count"),
            is_liked_subquery.label("is_liked")
        )
        .options(
            selectinload(Meme.user),
            selectinload(Meme.tags),    
            selectinload(Meme.subject) 
        )
    )
    
    # --- ФИЛЬТРЫ ---
    
    # 1. По автору
    if username:
        query = query.join(User, Meme.user_id == User.id).where(User.username == username)
    
    # 2. По лайкам (избранное) - ИСПРАВЛЕННАЯ ЛОГИКА
    if liked_by:
        # Находим ID пользователя
        user_res = await db.execute(select(User.id).where(User.username == liked_by))
        uid = user_res.scalar_one_or_none()
        if not uid: return [] # Если пользователя нет, возвращаем пустой список
        # Джойним таблицу лайков
        query = query.join(Like, Meme.id == Like.meme_id).where(Like.user_id == uid)

    # 3. По тегу
    if tag:
        query = query.join(Meme.tags).where(Tag.name == tag)

    # 4. По персонажу
    if subject:
        query = query.join(Meme.subject).where(Subject.slug == subject)

    # 5. По категории (Games, Movies, etc.)
    if category:
        # Проверяем, есть ли такая категория в Enum
        if category in [e.value for e in SubjectCategory]:
             query = query.join(Meme.subject).where(Subject.category == category)

    # 6. По периоду (для трендов)
    if period == "week":
        week_ago = datetime.utcnow() - timedelta(days=7)
        query = query.where(Meme.created_at >= week_ago)
    elif period == "month":
        month_ago = datetime.utcnow() - timedelta(days=30)
        query = query.where(Meme.created_at >= month_ago)

    # --- СОРТИРОВКА ---
    if sort == "popular":
        # Сортируем по просмотрам и лайкам (комбинированный вес)
        query = query.order_by(desc("likes_count"), desc(Meme.views_count))
    else:
        # По умолчанию - новые
        query = query.order_by(Meme.created_at.desc())

    # Пагинация
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    rows = result.all()
    
    # Сборка ответа (Pydantic не умеет мапить кортежи (Meme, int, int, bool) напрямую)
    memes_with_stats = []
    for row in rows:
        meme = row[0]
        meme.likes_count = row[1]
        meme.comments_count = row[2]
        meme.is_liked = row[3]
        memes_with_stats.append(meme)
        
    return memes_with_stats


@router.get("/{meme_id}", response_model=MemeResponse)
async def read_meme(
    meme_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Получение одного мема + инкремент просмотров"""
    
    # Инкремент просмотров (атомарно)
    await db.execute(
        sa.update(Meme).where(Meme.id == meme_id).values(views_count=Meme.views_count + 1)
    )
    await db.commit()

    # Запрос данных (аналогичный read_memes, но для одного ID)
    LikeStats = aliased(Like)
    CommentStats = aliased(Comment)
    MyLike = aliased(Like)

    # Подзапросы
    likes_count = select(func.count(LikeStats.user_id)).where(LikeStats.meme_id == Meme.id).scalar_subquery()
    comments_count = select(func.count(CommentStats.id)).where(CommentStats.meme_id == Meme.id).scalar_subquery()
    is_liked = sa.literal(False)
    if current_user:
        is_liked = exists().where((MyLike.meme_id == Meme.id) & (MyLike.user_id == current_user.id))

    query = (
        select(
            Meme,
            likes_count.label("likes_count"),
            comments_count.label("comments_count"),
            is_liked.label("is_liked")
        )
        .options(selectinload(Meme.user), selectinload(Meme.tags), selectinload(Meme.subject))
        .where(Meme.id == meme_id)
    )

    res = await db.execute(query)
    row = res.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Meme not found")

    meme = row[0]
    meme.likes_count = row[1]
    meme.comments_count = row[2]
    meme.is_liked = row[3]
    return meme


@router.post("/{meme_id}/like")
async def like_meme(
    meme_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Лайк/Дизлайк + Уведомление"""
    meme = await db.get(Meme, meme_id)
    if not meme: raise HTTPException(404, "Meme not found")

    query = select(Like).where((Like.user_id == current_user.id) & (Like.meme_id == meme_id))
    existing_like = (await db.execute(query)).scalars().first()

    if existing_like:
        await db.delete(existing_like)
        action = "unliked"
    else:
        new_like = Like(user_id=current_user.id, meme_id=meme_id)
        db.add(new_like)
        action = "liked"
        
        # --- УВЕДОМЛЕНИЕ ---
        if meme.user_id != current_user.id:
            notif = Notification(
                user_id=meme.user_id,
                sender_id=current_user.id,
                type=NotificationType.LIKE,
                meme_id=meme.id
            )
            db.add(notif)

    await db.commit()
    
    # Возвращаем актуальное кол-во лайков
    count = await db.scalar(select(func.count()).select_from(Like).where(Like.meme_id == meme_id))
    return {"action": action, "likes_count": count}


@router.post("/{meme_id}/comments", response_model=CommentResponse)
async def create_comment(
    meme_id: uuid.UUID,
    comment_data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Добавление комментария + Уведомление"""
    meme = await db.get(Meme, meme_id)
    if not meme: raise HTTPException(404, "Meme not found")

    new_comment = Comment(
        user_id=current_user.id,
        meme_id=meme_id,
        text=comment_data.text
    )
    db.add(new_comment)
    
    # --- УВЕДОМЛЕНИЕ ---
    if meme.user_id != current_user.id:
        notif = Notification(
            user_id=meme.user_id,
            sender_id=current_user.id,
            type=NotificationType.COMMENT,
            meme_id=meme.id,
            text=new_comment.text[:50]
        )
        db.add(notif)

    await db.commit()
    
    # Подгружаем юзера для ответа
    res = await db.execute(
        select(Comment).options(selectinload(Comment.user)).where(Comment.id == new_comment.id)
    )
    return res.scalars().first()


@router.get("/{meme_id}/comments", response_model=List[CommentResponse])
async def get_comments(
    meme_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Получение списка комментариев"""
    query = (
        select(Comment)
        .where(Comment.meme_id == meme_id)
        .options(selectinload(Comment.user))
        .order_by(Comment.created_at.desc()) # Свежие сверху
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{meme_id}/status")
async def check_meme_status(
    meme_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Проверка лайка без накрутки просмотров"""
    is_liked = await db.scalar(
        select(exists().where((Like.meme_id == meme_id) & (Like.user_id == current_user.id)))
    )
    return {"is_liked": is_liked}