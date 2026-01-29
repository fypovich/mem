from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from sqlalchemy import select
from app.core.config import settings
from app.core.security import verify_password
from app.core.database import engine
from app.models.models import User, Meme, Tag, Subject, Report, SearchTerm, Comment

# --- Настройка аутентификации ---
class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = form.get("username")
        password = form.get("password")

        from sqlalchemy.ext.asyncio import AsyncSession
        from sqlalchemy.orm import sessionmaker
        
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with async_session() as session:
            stmt = select(User).where(User.username == username)
            res = await session.execute(stmt)
            user = res.scalars().first()

        if user and verify_password(password, user.hashed_password):
            request.session.update({"token": str(user.id)})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return "token" in request.session

authentication_backend = AdminAuth(secret_key=settings.SECRET_KEY)

# --- Модели админки ---

class UserAdmin(ModelView, model=User):
    column_list = [User.id, User.username, User.email, User.is_superuser, User.created_at]
    column_searchable_list = [User.username, User.email]
    icon = "fa-solid fa-user"
    name = "User"
    name_plural = "Users"
    can_create = False
    can_delete = True

class MemeAdmin(ModelView, model=Meme):
    column_list = [Meme.id, Meme.title, Meme.status, Meme.views_count, Meme.created_at]
    column_sortable_list = [Meme.created_at, Meme.views_count]
    column_searchable_list = [Meme.title]
    # Временно убрали фильтры, чтобы починить ошибку 'parameter_name'
    # column_filters = [Meme.status, Meme.has_audio] 
    icon = "fa-solid fa-image"
    name = "Meme"
    name_plural = "Memes"

class ReportAdmin(ModelView, model=Report):
    column_list = [Report.id, Report.reason, Report.description, Report.created_at]
    icon = "fa-solid fa-flag"
    # УБРАЛИ list_template="list.html", так как файла нет

class SearchTermAdmin(ModelView, model=SearchTerm):
    column_list = [SearchTerm.term, SearchTerm.count, SearchTerm.last_searched_at]
    column_sortable_list = [SearchTerm.count]
    icon = "fa-solid fa-magnifying-glass"

class SubjectAdmin(ModelView, model=Subject):
    column_list = [Subject.name, Subject.slug, Subject.category]
    icon = "fa-solid fa-star"

class TagAdmin(ModelView, model=Tag):
    column_list = [Tag.name]
    icon = "fa-solid fa-tag"

# --- Функция подключения ---
def setup_admin(app):
    admin = Admin(app, engine, authentication_backend=authentication_backend, title="Meme Admin")
    admin.add_view(UserAdmin)
    admin.add_view(MemeAdmin)
    admin.add_view(ReportAdmin)
    admin.add_view(SearchTermAdmin)
    admin.add_view(SubjectAdmin)
    admin.add_view(TagAdmin)