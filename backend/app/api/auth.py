from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi.security import OAuth2PasswordRequestForm

from app.core.database import get_db
from app.core.security import create_access_token, verify_password, get_password_hash, create_password_reset_token, verify_password_reset_token, ACCESS_TOKEN_EXPIRE_MINUTES
from app.models.models import User
from app.schemas import Token, UserResponse, UserCreate, PasswordResetRequest, PasswordResetConfirm
from app.utils.avatar_gen import generate_default_avatar, generate_default_header

router = APIRouter()

@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_db)
):
    # Поиск пользователя по username или email
    query = select(User).where((User.username == form_data.username) | (User.email == form_data.username))
    result = await db.execute(query)
    user = result.scalars().first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@router.post("/register", response_model=Token)
async def register_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    # 1. Проверка на существование username
    q_user = select(User).where(User.username == user_data.username)
    res_user = await db.execute(q_user)
    if res_user.scalars().first():
        raise HTTPException(status_code=400, detail="Username already taken")

    # 2. Проверка на существование email
    q_email = select(User).where(User.email == user_data.email)
    res_email = await db.execute(q_email)
    if res_email.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # 3. Создание пользователя
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # 3.1 Генерация дефолтных аватара и шапки (DiceBear)
    try:
        avatar_url = await generate_default_avatar(str(new_user.id), new_user.username)
        header_url = await generate_default_header(str(new_user.id), new_user.username)
        new_user.avatar_url = avatar_url
        new_user.header_url = header_url
        await db.commit()
        await db.refresh(new_user)
    except Exception as e:
        print(f"Avatar/header generation failed: {e}")

    # 4. Автоматический логин (выдача токена)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(new_user.id)}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer", "user": new_user}

@router.post("/forgot-password")
async def forgot_password(
    request: PasswordResetRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Генерация ссылки на сброс пароля.
    В РЕАЛЬНОСТИ: Отправляет email.
    ЗДЕСЬ: Выводит ссылку в консоль сервера (docker logs).
    """
    # 1. Ищем пользователя
    query = select(User).where(User.email == request.email)
    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        # В целях безопасности лучше отвечать 200 даже если юзера нет, но для дебага скажем правду
        raise HTTPException(status_code=404, detail="User with this email not found")

    # 2. Генерируем токен
    reset_token = create_password_reset_token(email=user.email)
    
    # 3. "Отправляем" email (в консоль)
    # Ссылка ведет на фронтенд
    reset_link = f"http://localhost:3000/reset-password?token={reset_token}"
    print(f"\n\n=========================================")
    print(f"PASSWORD RESET LINK FOR {user.email}:")
    print(f"{reset_link}")
    print(f"=========================================\n\n")

    return {"message": "Password reset link generated (check server logs)"}

@router.post("/reset-password")
async def reset_password(
    request: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db)
):
    """Сброс пароля по токену"""
    # 1. Валидируем токен
    email = verify_password_reset_token(request.token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    # 2. Ищем юзера
    query = select(User).where(User.email == email)
    result = await db.execute(query)
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 3. Обновляем пароль
    user.hashed_password = get_password_hash(request.new_password)
    await db.commit()

    return {"message": "Password updated successfully"}