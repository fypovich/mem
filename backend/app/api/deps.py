from typing import Optional  # <--- ДОБАВЛЕН ЭТОТ ИМПОРТ
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.core.config import settings
from app.core.database import get_db
from app.models.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/token")

async def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        sub: str = payload.get("sub")
        if sub is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    try:
        user_uuid = uuid.UUID(sub)
        query = select(User).where(User.id == user_uuid)
    except ValueError:
        query = select(User).where(User.username == sub)

    result = await db.execute(query)
    user = result.scalars().first()
    
    if user is None:
        raise credentials_exception
        
    return user

async def get_optional_current_user(
    token: str = Depends(OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/token", auto_error=False)),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:  # Теперь Optional будет работать
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        sub: str = payload.get("sub")
        if not sub:
            return None
            
        try:
            user_uuid = uuid.UUID(sub)
            query = select(User).where(User.id == user_uuid)
        except ValueError:
            query = select(User).where(User.username == sub)
            
        result = await db.execute(query)
        return result.scalars().first()
    except JWTError:
        return None