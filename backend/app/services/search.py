import meilisearch
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
        # (Эти команды выполняются при создании сервиса. Если Meili недоступен, тут будет ошибка)
        
        # 1. Мемы: ищем по заголовку, описанию, тегам и персонажам
        self.index_memes.update_searchable_attributes([
            'title', 
            'description', 
            'tags', 
            'subject'
        ])
        # Фильтры: добавляем 'status', чтобы искать только одобренные
        self.index_memes.update_filterable_attributes(['tags', 'subject', 'user_id', 'status'])
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
        """Параллельный поиск по всем индексам"""
        
        # Если запрос пустой, возвращаем просто свежие мемы (если нужно)
        if not query:
             # Пример: вернуть последние одобренные мемы
             try:
                 memes = self.index_memes.search('', {
                     'limit': limit, 
                     'filter': 'status = approved',
                     'sort': ['created_at:desc']
                 })
                 return {
                    "memes": memes.get('hits', []),
                    "users": [],
                    "tags": []
                }
             except:
                 return {"memes": [], "users": [], "tags": []}

        # Основной поиск
        memes = self.index_memes.search(query, {
            'limit': limit,
            'filter': 'status = approved' # 🔥 Ищем только одобренные
        })
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