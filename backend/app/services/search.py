import meilisearch
import re
from app.core.config import settings

class SearchService:
    def __init__(self):
        # Подключение к MeiliSearch
        self.client = meilisearch.Client(settings.MEILI_HOST, settings.MEILI_MASTER_KEY)
        
        # Индексы
        self.index_memes = self.client.index('memes')
        self.index_users = self.client.index('users')
        self.index_tags = self.client.index('tags')
        
        # --- НАСТРОЙКИ ИНДЕКСОВ ---
        self._setup_indexes()

    def _setup_indexes(self):
        # 1. Мемы: ищем по заголовку, описанию, тегам
        self.index_memes.update_searchable_attributes([
            'title',
            'description',
            'tags',
            'author_username'
        ])

        # Фильтры
        self.index_memes.update_filterable_attributes([
            'tags',
            'user_id',
            'status',
            'author_username'
        ])
        
        # Сортировка
        self.index_memes.update_sortable_attributes(['views_count', 'shares_count', 'created_at'])

        # 2. Пользователи
        self.index_users.update_searchable_attributes(['username', 'full_name'])
        
        # 3. Теги
        self.index_tags.update_searchable_attributes(['name'])

    def add_meme(self, meme_data: dict):
        self.index_memes.add_documents([meme_data])

    def add_user(self, user_data: dict):
        self.index_users.add_documents([user_data])

    def add_tag(self, tag_data: dict):
        self.index_tags.add_documents([tag_data])
        
    def delete_document(self, index_name: str, doc_id: str):
        try:
            self.client.index(index_name).delete_document(doc_id)
        except Exception as e:
            print(f"Error deleting document from {index_name}: {e}")

    def search_multi(self, query: str, limit: int = 20):
        """Параллельный поиск по всем индексам с поддержкой @username"""
        
        filter_conditions = ["status = approved"]
        clean_query = query if query else ""

        # --- 1. ПАРСИНГ @USERNAME ---
        # Ищем паттерн @word (например @admin)
        username_match = re.search(r'@([\w\d_]+)', clean_query)
        
        if username_match:
            target_username = username_match.group(1)
            # Добавляем фильтр по автору
            filter_conditions.append(f"author_username = '{target_username}'")
            
            # Удаляем @username из текстового запроса, чтобы не мешал искать по смыслу
            clean_query = clean_query.replace(f"@{target_username}", "").strip()

        # --- 2. ПАРАМЕТРЫ ПОИСКА ---
        search_params = {
            'limit': limit,
            'filter': " AND ".join(filter_conditions),
            'sort': ['created_at:desc'] # Сортируем по новизне (или shares_count:desc)
        }

        # Если запрос пустой (например, был только @admin или вообще ""), MeiliSearch требует ''
        # Если есть фильтр author_username, он вернет все мемы этого автора.
        q = clean_query if clean_query else ""

        try:
            # Основной поиск по мемам
            memes_results = self.index_memes.search(q, search_params)
            memes_hits = memes_results.get('hits', [])
            
            # Если это был поиск только по мемам конкретного юзера,
            # нет смысла искать юзеров и теги по пустому запросу.
            if username_match and not clean_query:
                users_hits = []
                tags_hits = []
            else:
                # Поиск юзеров и тегов только если есть текстовый запрос
                if q:
                    users_hits = self.index_users.search(q, {'limit': limit}).get('hits', [])
                    tags_hits = self.index_tags.search(q, {'limit': limit}).get('hits', [])
                else:
                    # Если вообще пустой запрос (меню бота), возвращаем просто свежие мемы
                    users_hits = []
                    tags_hits = []

            return {
                "memes": memes_hits,
                "users": users_hits,
                "tags": tags_hits
            }

        except Exception as e:
            print(f"Search error: {e}")
            return {"memes": [], "users": [], "tags": []}

# Глобальный инстанс
_search_service = None

def get_search_service():
    global _search_service
    
    # Если соединение уже установлено - возвращаем его
    if _search_service:
        return _search_service
        
    # Если нет (или было разорвано) - пробуем создать заново
    try:
        _search_service = SearchService()
        print("✅ Connected to MeiliSearch successfully")
    except Exception as e:
        # Логируем ошибку, но возвращаем None, чтобы приложение не падало
        # Воркер попробует подключиться снова при следующей задаче
        print(f"⚠️ MeiliSearch connection failed (will retry): {e}")
        return None
        
    return _search_service