from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi.security import OAuth2PasswordRequestForm

from app.core.database import get_db
from app.core.security import create_access_token, verify_password, get_password_hash, ACCESS_TOKEN_EXPIRE_MINUTES
from app.models.models import User
from app.schemas import Token, UserResponse, UserCreate

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

    # 4. Автоматический логин (выдача токена)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(new_user.id)}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer", "user": new_user}