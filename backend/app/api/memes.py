import uuid
import os
import shutil
import aiofiles
import aiofiles.os # Для асинхронного удаления
import random # Для перемешивания
import sqlalchemy as sa
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, exists, desc, and_, or_, extract, case, update
from sqlalchemy.orm import selectinload, aliased

from app.core.database import get_db
from app.models.models import (
    Meme, User, Like, Comment, Tag,
    meme_tags, Notification, NotificationType, follows, Report, Block
)
from app.schemas import MemeResponse, CommentCreate, CommentResponse, MemeUpdate, ReportCreate
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.core import security
from app.services.media import MediaProcessor
from app.core.celery_app import celery_app
from app.api.deps import get_current_user, get_optional_current_user 
from app.utils.notifier import send_notification
from app.core.redis import redis_client # Импортируем наш async клиент

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)

import json as json_lib

POPULAR_CONTENT_CACHE_KEY = "popular_content"
POPULAR_CONTENT_TTL = 600  # 10 минут

@router.get("/popular-content")
async def get_popular_content(db: AsyncSession = Depends(get_db)):
    # Пробуем получить из кэша
    cached = await redis_client.get(POPULAR_CONTENT_CACHE_KEY)
    if cached:
        return json_lib.loads(cached)

    week_ago = datetime.utcnow() - timedelta(days=7)

    # Топ 5 тегов за 7 дней (по количеству лайков на мемах с этим тегом)
    tags_stmt = (
        select(Tag.name, func.count(Like.meme_id.distinct()).label("count"))
        .join(meme_tags, meme_tags.c.tag_id == Tag.id)
        .join(Like, Like.meme_id == meme_tags.c.meme_id)
        .where(Like.created_at >= week_ago)
        .group_by(Tag.id, Tag.name)
        .order_by(desc("count"))
        .limit(5)
    )
    tags_res = await db.execute(tags_stmt)
    tags = [{"name": row[0], "count": row[1]} for row in tags_res.all()]

    # Топ 5 пользователей за 7 дней (по количеству лайков на их мемах)
    top_users_stmt = (
        select(
            User.username,
            User.avatar_url,
            User.full_name,
            func.count(Like.meme_id).label("likes_count")
        )
        .join(Meme, Meme.user_id == User.id)
        .join(Like, Like.meme_id == Meme.id)
        .where(Like.created_at >= week_ago)
        .group_by(User.id, User.username, User.avatar_url, User.full_name)
        .order_by(desc("likes_count"))
        .limit(5)
    )
    top_users_res = await db.execute(top_users_stmt)
    top_users = [
        {"username": row[0], "avatar_url": row[1], "full_name": row[2], "likes_count": row[3]}
        for row in top_users_res.all()
    ]

    result = {"tags": tags, "top_users": top_users}

    # Кэшируем на 10 минут
    await redis_client.set(POPULAR_CONTENT_CACHE_KEY, json_lib.dumps(result), ex=POPULAR_CONTENT_TTL)

    return result

@router.post("/upload", response_model=MemeResponse)
async def upload_meme(
    title: str = Form(...),
    description: str = Form(None),
    tags: str = Form(None),
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
    tag_list = [] 

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
        status=status
    )
    new_meme.tags = db_tags
    
    db.add(new_meme)
    await db.commit()
    await db.refresh(new_meme)

    if is_final_video:
        # Worker сам запустит индексацию после обработки
        celery_app.send_task("app.worker.process_meme_task", args=[file_id, raw_path, audio_path])
    elif status == "approved":
        # Если это картинка, запускаем индексацию через Celery сразу
        celery_app.send_task("app.worker.index_meme_task", args=[{
            "id": str(new_meme.id),
            "title": new_meme.title,
            "description": new_meme.description,
            "thumbnail_url": new_meme.thumbnail_url,
            "media_url": new_meme.media_url,
            "views_count": new_meme.views_count,
            "shares_count": new_meme.shares_count, # <-- ДОБАВЛЕНО
            "width": new_meme.width,               # <-- ДОБАВЛЕНО
            "height": new_meme.height,             # <-- ДОБАВЛЕНО
            "duration": new_meme.duration,         # <-- ДОБАВЛЕНО
            "status": new_meme.status,             # <-- ВАЖНО: Добавлено поле status
            "tags": tag_list,
            "author_username": current_user.username 
        }])
        
        # Уведомления для картинок
        try:
            stmt = (
                select(User)
                .join(follows, follows.c.follower_id == User.id)
                .where(follows.c.followed_id == current_user.id)
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
        .options(selectinload(Meme.user), selectinload(Meme.tags))
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
    sort: str = "new",
    period: str = "all",
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    MyLike = aliased(Like)

    is_liked = sa.literal(False)
    if current_user:
        is_liked = exists().where((MyLike.meme_id == Meme.id) & (MyLike.user_id == current_user.id))

    query = (
        select(
            Meme,
            is_liked.label("is_liked")
        )
        .options(
            selectinload(Meme.user),
            selectinload(Meme.tags)
        )
        .where(Meme.status == "approved")
    )

    if current_user:
        blocked_users_query = select(Block.blocked_id).where(Block.blocker_id == current_user.id)
        query = query.where(Meme.user_id.not_in(blocked_users_query))

    if username:
        query = query.join(User, Meme.user_id == User.id).where(User.username == username)
    if tag:
        query = query.join(Meme.tags).where(Tag.name == tag)
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
        query = query.order_by(desc(Meme.likes_count), desc(Meme.views_count))
    elif sort == "smart":
        age_in_hours = (extract('epoch', func.now() - Meme.created_at) / 3600)
        gravity_score = (Meme.likes_count + 1) / func.power((age_in_hours + 2), 1.5)
        query = query.order_by(desc(gravity_score))
    else:
        query = query.order_by(Meme.created_at.desc())

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    memes_with_stats = []
    for row in rows:
        meme = row[0]
        meme.is_liked = row[1]
        memes_with_stats.append(meme)

    return memes_with_stats


@router.get("/random", response_model=MemeResponse)
async def get_random_meme(db: AsyncSession = Depends(get_db)):
    # Получаем общее количество одобренных мемов
    count = await db.scalar(select(func.count()).select_from(Meme).where(Meme.status == "approved"))
    if count == 0:
        raise HTTPException(status_code=404, detail="No memes found")
    
    # Берем случайный сдвиг (offset)
    random_offset = random.randint(0, count - 1)
    
    query = (
        select(Meme)
        .options(selectinload(Meme.user), selectinload(Meme.tags))
        .where(Meme.status == "approved")
        .offset(random_offset)
        .limit(1)
    )
    res = await db.execute(query)
    return res.scalars().first()

@router.get("/{meme_id}", response_model=MemeResponse)
async def read_meme(
    meme_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    try:
        await redis_client.incr(f"meme:views:{meme_id}")
    except Exception as e:
        print(f"Redis views error: {e}")

    MyLike = aliased(Like)

    is_liked = sa.literal(False)
    if current_user:
        is_liked = exists().where((MyLike.meme_id == Meme.id) & (MyLike.user_id == current_user.id))

    query = (
        select(
            Meme,
            is_liked.label("is_liked")
        )
        .options(selectinload(Meme.user), selectinload(Meme.tags))
        .where(Meme.id == meme_id)
    )

    res = await db.execute(query)
    row = res.first()

    if not row:
        raise HTTPException(status_code=404, detail="Meme not found")

    meme = row[0]
    meme.is_liked = row[1]
    return meme


@router.post("/{meme_id}/like")
async def like_meme(
    meme_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    res = await db.execute(
        select(Meme).options(selectinload(Meme.user)).where(Meme.id == meme_id)
    )
    meme = res.scalars().first()
    if not meme: raise HTTPException(404, "Meme not found")

    query = select(Like).where((Like.user_id == current_user.id) & (Like.meme_id == meme_id))
    existing_like = (await db.execute(query)).scalars().first()

    if existing_like:
        await db.delete(existing_like)
        meme.likes_count = max(0, meme.likes_count - 1)
        if meme.user_id != current_user.id:
            await db.execute(
                sa.delete(Notification).where(
                    (Notification.sender_id == current_user.id) &
                    (Notification.meme_id == meme.id) &
                    (Notification.type == NotificationType.LIKE)
                )
            )
        action = "unliked"
    else:
        new_like = Like(user_id=current_user.id, meme_id=meme_id)
        db.add(new_like)
        meme.likes_count = meme.likes_count + 1
        action = "liked"

        if meme.user_id != current_user.id:
            if getattr(meme.user, 'notify_on_like', True):
                existing_notif = await db.scalar(
                    select(Notification).where(
                        (Notification.sender_id == current_user.id) &
                        (Notification.user_id == meme.user_id) &
                        (Notification.meme_id == meme.id) &
                        (Notification.type == NotificationType.LIKE)
                    )
                )
                if not existing_notif:
                    await send_notification(
                        db=db,
                        user_id=meme.user_id,
                        sender_id=current_user.id,
                        type=NotificationType.LIKE,
                        meme_id=meme.id,
                        sender=current_user,
                        meme=meme
                    )

    await db.commit()
    return {"action": action, "likes_count": meme.likes_count}


@router.post("/{meme_id}/comments", response_model=CommentResponse)
async def create_comment(
    meme_id: uuid.UUID, 
    comment: CommentCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    if len(comment.text) > 500:
        raise HTTPException(status_code=400, detail="Комментарий не может быть длиннее 500 символов")

    res = await db.execute(
        select(Meme).options(selectinload(Meme.user)).where(Meme.id == meme_id)
    )
    meme = res.scalars().first()
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
    meme.comments_count = meme.comments_count + 1

    if meme.user_id != current_user.id:
        meme_owner = await db.get(User, meme.user_id)
        if getattr(meme.user, 'notify_on_comment', True):
             await send_notification(
                db=db,
                user_id=meme.user_id,
                sender_id=current_user.id,
                type=NotificationType.COMMENT,
                meme_id=meme.id,
                text=comment.text[:50], 
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

    MyLike = aliased(Like)
    is_liked = exists().where((MyLike.meme_id == Meme.id) & (MyLike.user_id == current_user.id)) if current_user else sa.literal(False)

    query = (
        select(
            Meme,
            is_liked.label("is_liked")
        )
        .options(
            selectinload(Meme.user),
            selectinload(Meme.tags)
        )
        .where(Meme.id != meme_id)
        .where(Meme.status == "approved")
    )

    conditions = []
    if tag_ids:
        conditions.append(Meme.tags.any(Tag.id.in_(tag_ids)))

    if conditions:
        query = query.where(or_(*conditions))
    else:
        query = query.order_by(desc(Meme.likes_count))

    query = query.limit(limit * 5)

    result = await db.execute(query)
    rows = result.all()

    memes_with_stats = []
    for row in rows:
        meme = row[0]
        meme.is_liked = row[1]
        memes_with_stats.append(meme)

    if len(memes_with_stats) > limit:
        return random.sample(memes_with_stats, limit)
    else:
        random.shuffle(memes_with_stats)
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

    # 3. ОПТИМИЗАЦИЯ: Асинхронное удаление файлов
    try:
        if meme.media_url:
            filename = meme.media_url.split("/")[-1]
            file_path = os.path.join(UPLOAD_DIR, filename)
            if await aiofiles.os.path.exists(file_path):
                await aiofiles.os.remove(file_path)
        
        if meme.thumbnail_url:
            filename = meme.thumbnail_url.split("/")[-1]
            file_path = os.path.join(UPLOAD_DIR, filename)
            if await aiofiles.os.path.exists(file_path):
                await aiofiles.os.remove(file_path)
    except Exception as e:
        print(f"Error deleting files: {e}")

    # 4. ОПТИМИЗАЦИЯ: Удаление из индекса через Celery
    try:
        celery_app.send_task("app.worker.delete_index_task", args=[str(meme.id)])
    except Exception as e:
        print(f"Meilisearch delete schedule error: {e}")

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
    
    # ОПТИМИЗАЦИЯ: Обновление индекса через Celery
    current_tags_list = [t.name for t in meme.tags]

    try:
        celery_app.send_task("app.worker.index_meme_task", args=[{
            "id": str(meme.id),
            "title": meme.title,
            "description": meme.description,
            "thumbnail_url": meme.thumbnail_url,
            "media_url": meme.media_url,
            "views_count": meme.views_count,
            "shares_count": meme.shares_count, # <-- ДОБАВЛЕНО
            "width": meme.width,               # <-- ДОБАВЛЕНО
            "height": meme.height,             # <-- ДОБАВЛЕНО
            "duration": meme.duration,         # <-- ДОБАВЛЕНО
            "status": meme.status,             # <-- ВАЖНО: Добавлено поле status
            "tags": current_tags_list,
        "author_username": meme.user.username if meme.user else "unknown" 
        }])
    except Exception as e:
        print(f"Meili update schedule error: {e}")

    final_query = (
        select(Meme)
        .options(selectinload(Meme.user), selectinload(Meme.tags))
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

@router.post("/{meme_id}/share")
async def share_meme_counter(
    meme_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """Инкрементирует счетчик шеров и обновляет поиск (Исправлено)"""
    
    # 1. Обновляем в БД с защитой от NULL
    # func.coalesce превращает NULL в 0 перед сложением
    stmt = (
        update(Meme)
        .where(Meme.id == meme_id)
        .values(shares_count=func.coalesce(Meme.shares_count, 0) + 1)
        .execution_options(synchronize_session=False)
        .returning(Meme.shares_count) # Сразу возвращаем новое значение
    )
    
    result = await db.execute(stmt)
    new_count = result.scalar() or 1
    await db.commit()
    
    print(f"📈 Meme {meme_id} shared! New count: {new_count}")
    
    # 2. Обновляем индекс MeiliSearch
    updated_meme = await db.scalar(
        select(Meme)
        .options(selectinload(Meme.tags))
        .options(selectinload(Meme.user))
        .where(Meme.id == meme_id)
    )
    
    if updated_meme:
        try:
            current_tags_list = [t.name for t in updated_meme.tags]
            
            # Отправляем задачу с обновленным количеством
            celery_app.send_task("app.worker.index_meme_task", args=[{
                "id": str(updated_meme.id),
                "title": updated_meme.title,
                "description": updated_meme.description,
                "thumbnail_url": updated_meme.thumbnail_url,
                "media_url": updated_meme.media_url,
                "views_count": updated_meme.views_count,
                "shares_count": new_count, # <-- Передаем точное новое число
                "width": updated_meme.width,
                "height": updated_meme.height,
                "duration": updated_meme.duration,
                "status": updated_meme.status,
                "tags": current_tags_list,
                "author_username": updated_meme.user.username if updated_meme.user else "unknown" 
            }])
        except Exception as e:
            print(f"Error scheduling search update for share: {e}")
    
    return {"status": "ok", "count": new_count}