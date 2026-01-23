import uuid
import os
import aiofiles
import sqlalchemy as sa
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, exists, delete
from sqlalchemy.orm import selectinload, aliased

from app.core.database import get_db
from app.models.models import Meme, User, Like, Comment, Tag, Subject, meme_tags, Notification, NotificationType, follows # <-- Добавил follows
from app.schemas import MemeResponse, CommentCreate, CommentResponse
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.core import security
from app.services.media import MediaProcessor

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)

async def get_optional_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    try:
        if not token: return None
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None: return None
        
        query = select(User).where(User.id == uuid.UUID(user_id))
        result = await db.execute(query)
        return result.scalars().first()
    except:
        return None

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    query = select(User).where(User.id == uuid.UUID(user_id))
    result = await db.execute(query)
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user

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
    # 1. Генерация имен
    file_ext = file.filename.split(".")[-1]
    file_id = str(uuid.uuid4())
    raw_filename = f"raw_{file_id}.{file_ext}"
    final_filename = f"{file_id}.mp4"
    thumbnail_name = f"{file_id}_thumb.jpg"
    
    raw_path = os.path.join(UPLOAD_DIR, raw_filename)
    final_path = os.path.join(UPLOAD_DIR, final_filename)
    thumbnail_path = os.path.join(UPLOAD_DIR, thumbnail_name)

    # 2. Сохраняем основной файл
    async with aiofiles.open(raw_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)

    # 3. Обработка Медиа
    processor = MediaProcessor(raw_path)
    
    if audio_file:
        audio_ext = audio_file.filename.split(".")[-1]
        audio_filename = f"audio_{file_id}.{audio_ext}"
        audio_path = os.path.join(UPLOAD_DIR, audio_filename)
        
        async with aiofiles.open(audio_path, 'wb') as out_audio:
            audio_content = await audio_file.read()
            await out_audio.write(audio_content)
            
        try:
            processor.process_video_with_audio(audio_path, final_path)
            processor = MediaProcessor(final_path)
            os.remove(audio_path)
            os.remove(raw_path) 
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"FFmpeg error: {str(e)}")
    else:
        os.rename(raw_path, final_path)
        processor = MediaProcessor(final_path)

    # 4. Генерируем превью
    try:
        duration, width, height = processor.get_metadata()
        processor.generate_thumbnail(thumbnail_path)
    except Exception as e:
        if os.path.exists(final_path): os.remove(final_path)
        raise HTTPException(status_code=400, detail=f"Processing error: {str(e)}")

    # 5. Обработка Тегов и Персонажа
    db_tags = []
    if tags:
        tag_list = [t.strip().replace("#", "").lower() for t in tags.split(",") if t.strip()]
        for tag_name in tag_list:
            query = select(Tag).where(Tag.name == tag_name)
            res = await db.execute(query)
            tag_obj = res.scalars().first()
            if not tag_obj:
                tag_obj = Tag(name=tag_name)
                db.add(tag_obj)
                await db.flush()
            db_tags.append(tag_obj)

    db_subject = None
    if subject:
        slug = subject.strip().lower().replace(" ", "_")
        query = select(Subject).where(Subject.slug == slug)
        res = await db.execute(query)
        db_subject = res.scalars().first()
        if not db_subject:
            db_subject = Subject(name=subject.strip(), slug=slug, category="person")
            db.add(db_subject)
            await db.flush()

    # 6. Сохраняем мем
    media_url = f"/static/{final_filename}"
    thumbnail_url = f"/static/{thumbnail_name}"

    new_meme = Meme(
        title=title,
        description=description,
        media_url=media_url,
        thumbnail_url=thumbnail_url,
        duration=duration,
        width=width,
        height=height,
        user_id=current_user.id,
        status="pending",
        subject_id=db_subject.id if db_subject else None
    )
    
    # Привязываем теги
    new_meme.tags = db_tags
    
    db.add(new_meme)
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
    
    # --- ИСПРАВЛЕНИЕ ТУТ ---
    # Вместо db.refresh используем явный запрос с eager loading (подгрузкой)
    # Это предотвращает ошибку MissingGreenlet, так как данные загружаются сразу.
    query = (
        select(Meme)
        .options(
            selectinload(Meme.user),
            selectinload(Meme.tags),
            selectinload(Meme.subject)
        )
        .where(Meme.id == new_meme.id)
    )
    result = await db.execute(query)
    final_meme = result.scalars().first()
    
    # Статистику можно оставить по нулям (это новый мем)
    return final_meme

# --- Остальные методы (без изменений) ---

@router.post("/{meme_id}/comments", response_model=CommentResponse)
async def create_comment(
    meme_id: uuid.UUID,
    comment: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meme = await db.get(Meme, meme_id)
    if not meme:
        raise HTTPException(status_code=404, detail="Meme not found")

    new_comment = Comment(
        text=comment.text,
        user_id=current_user.id,
        meme_id=meme_id
    )
    
    db.add(new_comment)
    
    # --- УВЕДОМЛЕНИЕ О КОММЕНТАРИИ ---
    if meme.user_id != current_user.id:
        notif = Notification(
            user_id=meme.user_id,
            sender_id=current_user.id,
            type=NotificationType.COMMENT,
            meme_id=meme.id,
            text=comment.text[:50] # Сохраняем начало коммента
        )
        db.add(notif)
    # ---------------------------------

    await db.commit()
    await db.refresh(new_comment)
    
    query = select(Comment).options(selectinload(Comment.user)).where(Comment.id == new_comment.id)
    result = await db.execute(query)
    final_comment = result.scalars().first()
    
    return final_comment

@router.get("/{meme_id}/comments", response_model=List[CommentResponse])
async def read_comments(
    meme_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Comment)
        .where(Comment.meme_id == meme_id)
        .options(selectinload(Comment.user))
        .order_by(Comment.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    
    result = await db.execute(query)
    comments = result.scalars().all()
    return comments


@router.get("/", response_model=List[MemeResponse])
async def read_memes(
    skip: int = 0,
    limit: int = 20,
    username: Optional[str] = None, 
    liked_by: Optional[str] = None,
    tag: Optional[str] = None,      # <-- НОВЫЙ ФИЛЬТР
    subject: Optional[str] = None,  # <-- НОВЫЙ ФИЛЬТР (slug персонажа)
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user) 
):
    LikeStats = aliased(Like)
    CommentStats = aliased(Comment)
    MyLike = aliased(Like)

    # Подзапросы статистики
    likes_subquery = (
        select(func.count(LikeStats.user_id))
        .where(LikeStats.meme_id == Meme.id)
        .scalar_subquery()
    )

    comments_subquery = (
        select(func.count(CommentStats.id))
        .where(CommentStats.meme_id == Meme.id)
        .scalar_subquery()
    )

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
        .order_by(Meme.created_at.desc())
    )
    
    # --- ФИЛЬТРЫ ---
    
    # 1. По автору
    if username:
        query = query.join(User, Meme.user_id == User.id).where(User.username == username)
    
    # 2. По лайкам
    if liked_by:
        user_stmt = select(User.id).where(User.username == liked_by)
        user_res = await db.execute(user_stmt)
        target_user_id = user_res.scalar_one_or_none()
        
        if target_user_id:
            query = query.join(Like, Meme.id == Like.meme_id).where(Like.user_id == target_user_id)
        else:
            return []

    # 3. По ТЕГУ (ищем по имени)
    if tag:
        # Join-им таблицу тегов через таблицу связей (meme_tags настроен в relationship)
        query = query.join(Meme.tags).where(Tag.name == tag)

    # 4. По ПЕРСОНАЖУ (ищем по slug)
    if subject:
        query = query.join(Meme.subject).where(Subject.slug == subject)

    # Пагинация и выполнение
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    rows = result.all()
    
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
    await db.execute(
        sa.update(Meme)
        .where(Meme.id == meme_id)
        .values(views_count=Meme.views_count + 1)
    )
    await db.commit()

    LikeStats = aliased(Like)
    CommentStats = aliased(Comment)
    MyLike = aliased(Like)

    likes_subquery = (
        select(func.count(LikeStats.user_id))
        .where(LikeStats.meme_id == Meme.id)
        .scalar_subquery()
    )
    
    comments_subquery = (
        select(func.count(CommentStats.id))
        .where(CommentStats.meme_id == Meme.id)
        .scalar_subquery()
    )

    if current_user:
        is_liked_subquery = (
            exists()
            .where((MyLike.meme_id == Meme.id) & (MyLike.user_id == current_user.id))
        )
    else:
        is_liked_subquery = sa.literal(False)

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
        .where(Meme.id == meme_id)
    )
    
    result = await db.execute(query)
    row = result.first()
    
    if row is None:
        raise HTTPException(status_code=404, detail="Meme not found")
        
    meme, likes, comments, liked = row
    meme.likes_count = likes
    meme.comments_count = comments
    meme.is_liked = liked
    
    return meme

@router.post("/{meme_id}/like")
async def like_meme(
    meme_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meme = await db.get(Meme, meme_id)
    if not meme:
        raise HTTPException(status_code=404, detail="Meme not found")

    query = select(Like).where(
        (Like.user_id == current_user.id) & (Like.meme_id == meme_id)
    )
    result = await db.execute(query)
    existing_like = result.scalars().first()

    if existing_like:
        await db.delete(existing_like)
        action = "unliked"
    else:
        new_like = Like(user_id=current_user.id, meme_id=meme_id)
        db.add(new_like)
        action = "liked"
        
        # --- УВЕДОМЛЕНИЕ О ЛАЙКЕ ---
        # Не уведомляем, если лайкаем свой мем
        if meme.user_id != current_user.id:
            # Проверка, чтобы не спамить (опционально можно добавить проверку на существование такого же уведомления)
            notif = Notification(
                user_id=meme.user_id,
                sender_id=current_user.id,
                type=NotificationType.LIKE,
                meme_id=meme.id
            )
            db.add(notif)
        # --------------------------

    await db.commit()
    
    count_query = select(func.count()).select_from(Like).where(Like.meme_id == meme_id)
    count_result = await db.execute(count_query)
    likes_count = count_result.scalar()

    return {"action": action, "likes_count": likes_count}

@router.get("/{meme_id}/status")
async def check_meme_status(
    meme_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    is_liked = await db.scalar(
        select(exists().where((Like.meme_id == meme_id) & (Like.user_id == current_user.id)))
    )
    return {"is_liked": is_liked}