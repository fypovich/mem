import meilisearch
from app.core.config import settings

class SearchService:
    def __init__(self):
        self.client = meilisearch.Client(settings.MEILI_HOST, settings.MEILI_MASTER_KEY)
        # Создаем индексы (если их нет)
        self.index_memes = self.client.index('memes')
        self.index_users = self.client.index('users')
        self.index_tags = self.client.index('tags')
        
        # Настройка отображения и фильтров
        self.index_memes.update_searchable_attributes(['title', 'description'])
        self.index_users.update_searchable_attributes(['username', 'full_name'])
        self.index_tags.update_searchable_attributes(['name'])

    def add_meme(self, meme_data: dict):
        self.index_memes.add_documents([meme_data])

    def add_user(self, user_data: dict):
        self.index_users.add_documents([user_data])

    def add_tag(self, tag_data: dict):
        self.index_tags.add_documents([tag_data])

    def search_multi(self, query: str, limit: int = 10):
        """Параллельный поиск по всем индексам"""
        memes = self.index_memes.search(query, {'limit': limit})
        users = self.index_users.search(query, {'limit': limit})
        tags = self.index_tags.search(query, {'limit': limit})
        
        return {
            "memes": memes.get('hits', []),
            "users": users.get('hits', []),
            "tags": tags.get('hits', []),
            "subjects": [] # Пока пропустим, логика та же
        }

# Глобальный инстанс
search_service = None

def get_search_service():
    global search_service
    if not search_service:
        try:
            search_service = SearchService()
        except Exception as e:
            print(f"Meilisearch connection failed: {e}")
            return None
    return search_service