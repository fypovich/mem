import meilisearch
from app.core.config import settings

class SearchService:
    def __init__(self):
        self.client = meilisearch.Client(settings.MEILI_HOST, settings.MEILI_MASTER_KEY)
        
        # Индексы
        self.index_memes = self.client.index('memes')
        self.index_users = self.client.index('users')
        self.index_tags = self.client.index('tags')
        
        # --- НАСТРОЙКИ ПОИСКА ---
        
        # 1. Мемы: ищем по заголовку, описанию, тегам и персонажам
        self.index_memes.update_searchable_attributes([
            'title', 
            'description', 
            'tags', 
            'subject'
        ])
        # Фильтры для фасетного поиска
        self.index_memes.update_filterable_attributes(['tags', 'subject', 'user_id'])
        # Сортировка (по просмотрам, лайкам)
        self.index_memes.update_sortable_attributes(['views_count'])

        # 2. Пользователи: ищем по никнейму и имени
        self.index_users.update_searchable_attributes(['username', 'full_name'])
        
        # 3. Теги: ищем по имени
        self.index_tags.update_searchable_attributes(['name'])

    def add_meme(self, meme_data: dict):
        self.index_memes.add_documents([meme_data])

    def add_user(self, user_data: dict):
        self.index_users.add_documents([user_data])

    def add_tag(self, tag_data: dict):
        self.index_tags.add_documents([tag_data])

    def search_multi(self, query: str, limit: int = 20):
        """Параллельный поиск по всем индексам"""
        memes = self.index_memes.search(query, {'limit': limit})
        users = self.index_users.search(query, {'limit': limit})
        tags = self.index_tags.search(query, {'limit': limit})
        
        return {
            "memes": memes.get('hits', []),
            "users": users.get('hits', []),
            "tags": tags.get('hits', [])
        }

# Глобальный инстанс
_search_service = None

def get_search_service():
    global _search_service
    if not _search_service:
        try:
            _search_service = SearchService()
        except Exception as e:
            print(f"Meilisearch connection failed: {e}")
            return None
    return _search_service