import io
import numpy as np
import cv2
from PIL import Image

class AIService:
    @staticmethod
    def remove_background(input_bytes: bytes) -> bytes:
        """
        Удаление фона с использованием rembg.
        ВАЖНО: Импорты внутри метода для избежания конфликтов OpenMP в Celery.
        """
        try:
            # ЛЕНИВЫЙ ИМПОРТ (критично для Celery worker)
            from rembg import remove, new_session
            
            # Создаем сессию локально
            session = new_session("isnet-general-use")
            
            # 1. Удаляем фон БЕЗ alpha_matting (он вызывает SIGSEGV/Crash в Celery)
            result_bytes = remove(
                input_bytes, 
                session=session,
                alpha_matting=False # ВЫКЛЮЧЕНО для стабильности
            )

            # 2. Пост-обработка краев (сглаживание) через OpenCV
            # Это замена alpha_matting, но безопасная
            img = Image.open(io.BytesIO(result_bytes)).convert("RGBA")
            img_np = np.array(img)
            
            # Выделяем альфа-канал
            alpha = img_np[:, :, 3]
            
            # Если изображение не пустое
            if np.max(alpha) > 0:
                # Мягкое размытие альфа-канала для сглаживания "лесенки"
                alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
                img_np[:, :, 3] = alpha
            
            # Возвращаем результат
            final_img = Image.fromarray(img_np)
            output = io.BytesIO()
            final_img.save(output, format="PNG")
            return output.getvalue()

        except Exception as e:
            print(f"AI Error: {e}")
            # В случае любой ошибки возвращаем исходник (или пустоту), чтобы не ронять воркер
            raise RuntimeError(f"Background removal failed: {e}")

    @staticmethod
    def add_outline(input_bytes: bytes, color: tuple = (255, 255, 255), thickness: int = 15) -> bytes:
        """Добавляет обводку (Stroke) вокруг объекта"""
        try:
            image = Image.open(io.BytesIO(input_bytes)).convert("RGBA")
            img_np = np.array(image)

            alpha = img_np[:, :, 3]
            if np.max(alpha) == 0: return input_bytes

            # Морфологическое расширение маски
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (thickness, thickness))
            dilated_alpha = cv2.dilate(alpha, kernel, iterations=1)
            
            # Создание слоя обводки
            outline_layer = np.zeros_like(img_np)
            outline_layer[:] = color + (255,) # Заливаем цветом
            outline_layer[:, :, 3] = dilated_alpha # Применяем расширенную маску

            # Наложение: Сначала обводка, сверху оригинал
            outline_pil = Image.fromarray(outline_layer)
            original_pil = Image.fromarray(img_np)
            
            final_img = Image.alpha_composite(outline_pil, original_pil)

            output = io.BytesIO()
            final_img.save(output, format="PNG")
            return output.getvalue()
        except Exception as e:
            print(f"Outline Error: {e}")
            raise e