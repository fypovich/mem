from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
# ИМПОРТИРУЕМ ВСЕ 3 РОУТЕРА
from app.api import memes, auth, users, notifications 

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# --- CORS ---
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Раздаем статику
app.mount("/static", StaticFiles(directory="uploads"), name="static")

# 2. ПОДКЛЮЧАЕМ РОУТЕРЫ
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"]) # <--- ЭТОЙ СТРОКИ НЕ ХВАТАЛО
app.include_router(memes.router, prefix="/api/v1/memes", tags=["memes"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])

@app.get("/")
async def root():
    return {"message": "MemeGiphy API is running", "version": "0.1.0"}