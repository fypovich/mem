import uuid
import os
import shutil
import aiofiles
import sqlalchemy as sa
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, exists, desc, and_, or_, extract, case
from sqlalchemy.orm import selectinload, aliased

from app.core.database import get_db
# Импортируем все модели, включая SubjectCategory и follows
from app.models.models import (
    Meme, User, Like, Comment, Tag, Subject, 
    meme_tags, Notification, NotificationType, follows, SubjectCategory, Report, Block
)
from app.schemas import MemeResponse, CommentCreate, CommentResponse, MemeUpdate, ReportCreate
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.core import security
from app.services.media import MediaProcessor
from app.services.search import get_search_service
from app.worker import process_meme_task
from app.core.celery_app import celery_app  # <--- ВАЖНО: Добавьте этот импорт
from app.api.deps import get_current_user
from app.utils.notifier import send_notification

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
    file_id = str(uuid.uuid4())
    ext = file.filename.split('.')[-1].lower()
    
    is_image_input = ext in ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']
    
    is_final_video = True
    if is_image_input and not audio_file:
        is_final_video = False

    raw_filename = f"raw_{file_id}.{ext}"
    final_filename = f"{file_id}.mp4" if is_final_video else f"{file_id}.{ext}"
    thumbnail_filename = f"{file_id}_thumb.jpg"

    raw_path = os.path.join(UPLOAD_DIR, raw_filename)
    final_path = os.path.join(UPLOAD_DIR, final_filename)
    thumbnail_path = os.path.join(UPLOAD_DIR, thumbnail_filename)

    async with aiofiles.open(raw_path, 'wb') as f:
        await f.write(await file.read())

    audio_path = None
    if audio_file:
        audio_ext = audio_file.filename.split('.')[-1]
        audio_path = os.path.join(UPLOAD_DIR, f"audio_{file_id}.{audio_ext}")
        async with aiofiles.open(audio_path, 'wb') as f:
            await f.write(await audio_file.read())

    duration, width, height = 0.0, 0, 0
    has_audio = False
    status = "processing"
    media_url = f"/static/{final_filename}"
    thumbnail_url = "/static/processing_placeholder.jpg"

    if not is_final_video:
        shutil.copy(raw_path, final_path)
        shutil.copy(final_path, thumbnail_path)
        try:
            processor = MediaProcessor(final_path)
            _, width, height = processor.get_metadata()
        except: pass
        
        status = "approved"
        thumbnail_url = f"/static/{thumbnail_filename}"
        
        if os.path.exists(raw_path): os.remove(raw_path)

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

    db_subject = None
    if subject:
        clean_name = subject.strip()
        slug = clean_name.lower().replace(" ", "_")
        res = await db.execute(select(Subject).where(Subject.slug == slug))
        db_subject = res.scalars().first()
        if not db_subject:
            db_subject = Subject(name=clean_name, slug=slug, category="person")
            db.add(db_subject)
            await db.flush()

    new_meme = Meme(
        id=uuid.UUID(file_id),
        title=title, 
        description=description,
        media_url=media_url,
        thumbnail_url=thumbnail_url,
        duration=duration, 
        width=width, 
        height=height,
        has_audio=has_audio,
        user_id=current_user.id, 
        status=status,
        subject_id=db_subject.id if db_subject else None
    )
    new_meme.tags = db_tags
    
    db.add(new_meme)
    await db.commit()
    # --- ВАЖНО: Обновляем объект, чтобы подгрузить поля для уведомлений ---
    await db.refresh(new_meme) 

    if is_final_video:
        celery_app.send_task("app.worker.process_meme_task", args=[file_id, raw_path, audio_path])

    if status == "approved":
        try:
            search = get_search_service()
            if search:
                search.add_meme({
                    "id": str(new_meme.id),
                    "title": new_meme.title,
                    "description": new_meme.description,
                    "thumbnail_url": new_meme.thumbnail_url,
                    "media_url": new_meme.media_url,
                    "views_count": new_meme.views_count
                })
        except Exception: pass

    # --- УВЕДОМЛЕНИЯ (Теперь работают для ВСЕХ типов и без ошибок Greenlet) ---
    try:
        stmt = (
            select(User)
            .join(Follow, Follow.follower_id == User.id)
            .where(Follow.followed_id == current_user.id)
        )
        followers_res = await db.execute(stmt)
        followers = followers_res.scalars().all()
        
        for follower in followers:
            if getattr(follower, 'notify_on_new_meme', True):
                await send_notification(
                    db=db,
                    user_id=follower.id,
                    sender_id=current_user.id,
                    type=NotificationType.NEW_MEME, 
                    meme_id=new_meme.id,
                    sender=current_user,
                    meme=new_meme
                )
    except Exception as e:
        print(f"Notification error: {e}")

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
    category: Optional[str] = None, 
    sort: str = "new",              
    period: str = "all",            
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user) 
):
    LikeStats = aliased(Like)
    CommentStats = aliased(Comment)
    MyLike = aliased(Like)

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
        .options(
            selectinload(Meme.user),
            selectinload(Meme.tags),    
            selectinload(Meme.subject) 
        )
        .where(Meme.status == "approved")
    )
    
    # Блокировки
    if current_user:
        blocked_users_query = select(Block.blocked_id).where(Block.blocker_id == current_user.id)
        query = query.where(Meme.user_id.not_in(blocked_users_query))

    if username:
        query = query.join(User, Meme.user_id == User.id).where(User.username == username)
    if tag:
        query = query.join(Meme.tags).where(Tag.name == tag)
    if subject:
        query = query.join(Meme.subject).where(Subject.slug == subject)
    if category:
        if category in [e.value for e in SubjectCategory]:
             query = query.join(Meme.subject).where(Subject.category == category)
    if liked_by:
        uid_res = await db.execute(select(User.id).where(User.username == liked_by))
        uid = uid_res.scalar_one_or_none()
        if not uid: return [] 
        query = query.join(Like, Meme.id == Like.meme_id).where(Like.user_id == uid)

    if period == "week":
        week_ago = datetime.utcnow() - timedelta(days=7)
        query = query.where(Meme.created_at >= week_ago)
    elif period == "month":
        month_ago = datetime.utcnow() - timedelta(days=30)
        query = query.where(Meme.created_at >= month_ago)

    if sort == "popular":
        query = query.order_by(desc("likes_count"), desc(Meme.views_count))
    elif sort == "smart":
        age_in_hours = (extract('epoch', func.now() - Meme.created_at) / 3600)
        gravity_score = (likes_count + 1) / func.power((age_in_hours + 2), 1.5)
        query = query.order_by(desc(gravity_score))
    else:
        query = query.order_by(Meme.created_at.desc())

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
        sa.update(Meme).where(Meme.id == meme_id).values(views_count=Meme.views_count + 1)
    )
    await db.commit()

    LikeStats = aliased(Like)
    CommentStats = aliased(Comment)
    MyLike = aliased(Like)

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
        
        if meme.user_id != current_user.id:
            # Проверяем настройки уведомлений владельца (используем getattr для безопасности)
            meme_owner = await db.get(User, meme.user_id)
            if getattr(meme.user, 'notify_on_like', True):
                await send_notification(
                    db=db,
                    user_id=meme.user_id, # Кому (автор мема)
                    sender_id=current_user.id, # От кого
                    type=NotificationType.LIKE,
                    meme_id=meme.id,
                    sender=current_user,
                    meme=meme
                )

    await db.commit()
    count = await db.scalar(select(func.count()).select_from(Like).where(Like.meme_id == meme_id))
    return {"action": action, "likes_count": count}


@router.post("/{meme_id}/comments", response_model=CommentResponse)
async def create_comment(
    meme_id: uuid.UUID, 
    comment: CommentCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    if len(comment.text) > 500:
        raise HTTPException(status_code=400, detail="Комментарий не может быть длиннее 500 символов")

    meme = await db.get(Meme, meme_id)
    if not meme: raise HTTPException(404, "Meme not found")

    if comment.parent_id:
        parent = await db.get(Comment, comment.parent_id)
        if not parent:
            raise HTTPException(404, "Parent comment not found")

    new_comm = Comment(
        text=comment.text, 
        user_id=current_user.id, 
        meme_id=meme_id,
        parent_id=comment.parent_id 
    )
    db.add(new_comm)
    
    if meme.user_id != current_user.id:
        # Проверяем настройки уведомлений владельца
        meme_owner = await db.get(User, meme.user_id)
        if getattr(meme.user, 'notify_on_comment', True):
             await send_notification(
                db=db,
                user_id=meme.user_id,
                sender_id=current_user.id,
                type=NotificationType.COMMENT,
                meme_id=meme.id,
                text=comment.text[:50], # Обрезаем текст
                sender=current_user,
                meme=meme
            )
    
    await db.commit()
    
    res = await db.execute(
        select(Comment).options(selectinload(Comment.user)).where(Comment.id == new_comm.id)
    )
    return res.scalars().first()


@router.get("/{meme_id}/comments", response_model=List[CommentResponse])
async def get_comments(
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
    return result.scalars().all()


@router.get("/{meme_id}/status")
async def check_meme_status(
    meme_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    is_liked = await db.scalar(
        select(exists().where((Like.meme_id == meme_id) & (Like.user_id == current_user.id)))
    )
    meme = await db.get(Meme, meme_id)
    status = meme.status if meme else "not_found"
    
    return {"is_liked": is_liked, "status": status}


@router.get("/{meme_id}/similar", response_model=List[MemeResponse])
async def get_similar_memes(
    meme_id: uuid.UUID,
    limit: int = 12,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    current_meme_query = (
        select(Meme)
        .options(selectinload(Meme.tags))
        .where(Meme.id == meme_id)
    )
    res = await db.execute(current_meme_query)
    current_meme = res.scalars().first()
    
    if not current_meme:
        return []

    tag_ids = [t.id for t in current_meme.tags]
    subject_id = current_meme.subject_id

    LikeStats = aliased(Like)
    CommentStats = aliased(Comment)
    MyLike = aliased(Like)

    likes_count = select(func.count(LikeStats.user_id)).where(LikeStats.meme_id == Meme.id).scalar_subquery()
    comments_count = select(func.count(CommentStats.id)).where(CommentStats.meme_id == Meme.id).scalar_subquery()
    is_liked = exists().where((MyLike.meme_id == Meme.id) & (MyLike.user_id == current_user.id)) if current_user else sa.literal(False)

    query = (
        select(
            Meme, 
            likes_count.label("likes_count"),
            comments_count.label("comments_count"),
            is_liked.label("is_liked")
        )
        .options(
            selectinload(Meme.user),
            selectinload(Meme.tags),    
            selectinload(Meme.subject) 
        )
        .where(Meme.id != meme_id) 
        .where(Meme.status == "approved")
    )

    conditions = []
    if subject_id:
        conditions.append(Meme.subject_id == subject_id)
    
    if tag_ids:
        conditions.append(Meme.tags.any(Tag.id.in_(tag_ids)))

    if conditions:
        query = query.where(or_(*conditions))
    else:
        query = query.order_by(desc("likes_count"))

    query = query.order_by(func.random()).limit(limit)

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

@router.delete("/{meme_id}", status_code=204)
async def delete_meme(
    meme_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meme = await db.get(Meme, meme_id)
    if not meme:
        raise HTTPException(status_code=404, detail="Meme not found")
    
    if meme.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not authorized to delete this meme")

    try:
        if meme.media_url:
            filename = meme.media_url.split("/")[-1]
            file_path = os.path.join(UPLOAD_DIR, filename)
            if os.path.exists(file_path):
                os.remove(file_path)
        
        if meme.thumbnail_url:
            filename = meme.thumbnail_url.split("/")[-1]
            file_path = os.path.join(UPLOAD_DIR, filename)
            if os.path.exists(file_path):
                os.remove(file_path)
    except Exception as e:
        print(f"Error deleting files: {e}")

    try:
        search = get_search_service()
        if search:
            search.index_memes.delete_document(str(meme.id))
    except Exception as e:
        print(f"Meilisearch delete error: {e}")

    await db.execute(sa.delete(Notification).where(Notification.meme_id == meme_id))
    await db.execute(sa.delete(Like).where(Like.meme_id == meme_id))
    await db.execute(sa.delete(Comment).where(Comment.meme_id == meme_id))
    await db.execute(sa.delete(meme_tags).where(meme_tags.c.meme_id == meme_id))
    await db.execute(sa.delete(Report).where(Report.meme_id == meme_id))

    await db.delete(meme)
    await db.commit()
    
    return None


@router.put("/{meme_id}", response_model=MemeResponse)
async def update_meme(
    meme_id: uuid.UUID,
    meme_update: MemeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Meme).options(selectinload(Meme.tags)).where(Meme.id == meme_id)
    result = await db.execute(query)
    meme = result.scalars().first()

    if not meme:
        raise HTTPException(status_code=404, detail="Meme not found")
    
    if meme.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not authorized to edit this meme")

    if meme_update.title is not None:
        meme.title = meme_update.title
    
    if meme_update.description is not None:
        meme.description = meme_update.description

    if meme_update.tags is not None:
        tag_list_names = [t.strip().lower().replace("#", "") for t in meme_update.tags.split(",") if t.strip()]
        new_tags = []
        
        for t_name in tag_list_names:
            tag_query = select(Tag).where(Tag.name == t_name)
            tag_res = await db.execute(tag_query)
            tag = tag_res.scalars().first()
            
            if not tag:
                tag = Tag(name=t_name)
                db.add(tag)
                await db.flush()
            
            new_tags.append(tag)
        
        meme.tags = new_tags

    await db.commit()
    
    try:
        search = get_search_service()
        if search:
            search.add_meme({
                "id": str(meme.id),
                "title": meme.title,
                "description": meme.description,
                "thumbnail_url": meme.thumbnail_url,
                "media_url": meme.media_url,
                "views_count": meme.views_count
            })
    except Exception as e:
        print(f"Meili update error: {e}")

    final_query = (
        select(Meme)
        .options(selectinload(Meme.user), selectinload(Meme.tags), selectinload(Meme.subject))
        .where(Meme.id == meme.id)
    )
    final_res = await db.execute(final_query)
    return final_res.scalars().first()

@router.post("/{meme_id}/report", status_code=201)
async def report_meme(
    meme_id: uuid.UUID,
    report_data: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meme = await db.get(Meme, meme_id)
    if not meme: raise HTTPException(404, "Meme not found")

    new_report = Report(
        reporter_id=current_user.id,
        meme_id=meme_id,
        reason=report_data.reason,
        description=report_data.description
    )
    db.add(new_report)
    await db.commit()
    
    return {"message": "Report submitted"}