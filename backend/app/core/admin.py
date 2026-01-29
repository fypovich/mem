from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from starlette.responses import RedirectResponse
from sqlalchemy import select
from app.core.config import settings
from app.core.security import verify_password, create_access_token
from app.core.database import engine
from app.models.models import User, Meme, Tag, Subject, Report, Comment, SearchTerm, Block, Notification

# --- 1. АВТОРИЗАЦИЯ В АДМИНКУ ---
class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = form.get("username")
        password = form.get("password")

        # Простая проверка через БД (можно усложнить)
        async with session_maker() as session:
            stmt = select(User).where(User.username == username)
            res = await session.execute(stmt)
            user = res.scalars().first()

        if user and verify_password(password, user.hashed_password):
            # Проверяем, админ ли это (предполагаем, что is_superuser есть или проверяем по ID/email)
            # Для начала пускаем всех авторизованных, но лучше добавить поле is_superuser в User
            request.session.update({"token": f"admin_{user.id}"})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        token = request.session.get("token")
        return bool(token)

authentication_backend = AdminAuth(secret_key=settings.SECRET_KEY)

# Нам нужен SessionMaker для проверки пароля внутри AdminAuth (так как engine синхронный для воркера, но тут нужен асинхронный для запросов, 
# НО SQLAdmin работает с engine напрямую. Для логина сделаем отдельный хак или используем синхронный запрос, 
# но проще всего использовать engine из database.py который AsyncEngine.
# SQLAdmin поддерживает AsyncEngine.

from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# --- 2. НАСТРОЙКА МОДЕЛЕЙ (VIEWS) ---

class UserAdmin(ModelView, model=User):
    column_list = [User.id, User.username, User.email, User.is_superuser, User.created_at]
    column_searchable_list = [User.username, User.email]
    column_sortable_list = [User.created_at]
    icon = "fa-solid fa-user"
    name = "User"
    name_plural = "Users"
    can_create = False # Создаем юзеров только через регистрацию
    can_delete = True

class MemeAdmin(ModelView, model=Meme):
    column_list = [Meme.id, Meme.title, Meme.status, Meme.views_count, Meme.created_at, Meme.user]
    column_searchable_list = [Meme.title, Meme.description]
    column_sortable_list = [Meme.created_at, Meme.views_count]
    column_filters = [Meme.status, Meme.has_audio]
    icon = "fa-solid fa-image"
    
    # Делаем превью картинки в списке!
    column_formatters = {
        Meme.thumbnail_url: lambda m, a: f'<img src="{m.thumbnail_url}" width="50">'
    }

class ReportAdmin(ModelView, model=Report):
    column_list = [Report.id, Report.reason, Report.meme, Report.reporter, Report.created_at]
    icon = "fa-solid fa-flag"
    list_template = "list.html" # Используем стандартный шаблон

class SubjectAdmin(ModelView, model=Subject):
    column_list = [Subject.id, Subject.name, Subject.slug, Subject.category]
    form_columns = [Subject.name, Subject.slug, Subject.category, Subject.image_url]
    icon = "fa-solid fa-star"

class TagAdmin(ModelView, model=Tag):
    column_list = [Tag.id, Tag.name]
    column_searchable_list = [Tag.name]
    icon = "fa-solid fa-tag"

class SearchTermAdmin(ModelView, model=SearchTerm):
    column_list = [SearchTerm.term, SearchTerm.count, SearchTerm.last_searched_at]
    column_sortable_list = [SearchTerm.count, SearchTerm.last_searched_at]
    icon = "fa-solid fa-magnifying-glass"
    can_create = False
    can_edit = False 

# --- 3. ФУНКЦИЯ ПОДКЛЮЧЕНИЯ ---
def setup_admin(app):
    admin = Admin(app, engine, authentication_backend=authentication_backend, title="MemeGiphy Admin")
    admin.add_view(UserAdmin)
    admin.add_view(MemeAdmin)
    admin.add_view(ReportAdmin)
    admin.add_view(SubjectAdmin)
    admin.add_view(TagAdmin)
    admin.add_view(SearchTermAdmin)
    # Можно добавить CommentAdmin, BlockAdmin и т.д.