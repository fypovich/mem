from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    # Добавляем значения по умолчанию, чтобы не падало при отсутствии .env
    PROJECT_NAME: str = "MemeHUB"
    API_V1_STR: str = "/api/v1"
    
    # Для Docker обычно 'db', для локального запуска 'localhost'
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "memedb")

    # Собираем URL. Если переменная DATABASE_URL задана явно - используем её.
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_SERVER}:{POSTGRES_PORT}/{POSTGRES_DB}"
    )

    SECRET_KEY: str = os.getenv("SECRET_KEY", "super_secret_key_123")
    ALGORITHM: str = "HS256"
    
    # Meilisearch
    MEILI_HOST: str = os.getenv("MEILI_HOST", "http://localhost:7700")
    MEILI_MASTER_KEY: str = os.getenv("MEILI_MASTER_KEY", "masterKey123")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()