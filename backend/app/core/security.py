from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.models import User
import uuid

# Секретный ключ. В продакшене вынесите в .env
SECRET_KEY = "super-secret-key-change-me-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
RESET_PASSWORD_EXPIRE_MINUTES = 15

# Настройка хеширования
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет, совпадает ли введенный пароль с хешем в БД"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Хеширует пароль"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Генерирует токен доступа (JWT)"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_password_reset_token(email: str) -> str:
    """Генерирует токен для сброса пароля"""
    expire = datetime.now(timezone.utc) + timedelta(minutes=RESET_PASSWORD_EXPIRE_MINUTES)
    to_encode = {"sub": email, "type": "password_reset", "exp": expire}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password_reset_token(token: str) -> Optional[str]:
    """Проверяет токен сброса и возвращает email"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "password_reset":
            return None
        email: str = payload.get("sub")
        return email
    except JWTError:
        return None
    
async def get_current_user_ws(token: str) -> Optional[User]:
    """
    Получает пользователя по токену для WebSocket.
    Пытается найти пользователя по username (так как обычно в sub лежит username).
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub: str = payload.get("sub") # Может быть username или id
        if sub is None:
            return None
    except JWTError:
        return None

    async with AsyncSessionLocal() as db:
        # Пробуем найти по username
        query = select(User).where(User.username == sub)
        result = await db.execute(query)
        user = result.scalars().first()
        
        # Если не нашли по username, возможно в токене лежит ID (UUID)
        if not user:
            try:
                # Проверяем, является ли sub валидным UUID
                user_uuid = uuid.UUID(sub)
                query = select(User).where(User.id == user_uuid)
                result = await db.execute(query)
                user = result.scalars().first()
            except ValueError:
                pass # sub не является UUID

        return user