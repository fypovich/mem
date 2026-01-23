from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core import security
from app.models.models import User
from pydantic import BaseModel, EmailStr

router = APIRouter()

# Схемы для валидации данных (можно вынести в schemas.py, но для краткости тут)
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

@router.post("/register", response_model=Token)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    # 1. Проверяем, не занят ли email/username
    query = select(User).where((User.email == user_in.email) | (User.username == user_in.username))
    result = await db.execute(query)
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Username or Email already registered")

    # 2. Создаем пользователя с ЗАХЕШИРОВАННЫМ паролем
    new_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password) # <-- ХЕШИРУЕМ!
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # 3. Сразу выдаем токен, чтобы человек вошел автоматически
    access_token = security.create_access_token(
        data={"sub": str(new_user.id)}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_db)
):
    # OAuth2PasswordRequestForm ожидает поля username и password
    # Мы ищем пользователя по username
    query = select(User).where(User.username == form_data.username)
    result = await db.execute(query)
    user = result.scalars().first()
    
    # Проверяем пароль
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Генерируем токен
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}