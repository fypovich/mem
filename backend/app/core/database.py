from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

# Создаем асинхронный движок
engine = create_async_engine(settings.DATABASE_URL, echo=True)

# Фабрика сессий
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

# Базовый класс для моделей
class Base(DeclarativeBase):
    pass

# Dependency (Зависимость для инъекции сессии в роуты)
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session