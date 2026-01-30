import io
import numpy as np
import cv2
from rembg import remove, new_session
from PIL import Image

# Используем сессию U2Net (стандартная, надежная)
# Если нужна BiRefNet, она требует загрузки другой модели, пока оставим u2net для стабильности
rembg_session = new_session("u2net")

class AIService:
    @staticmethod
    def remove_background(input_bytes: bytes) -> bytes:
        """Удаляет фон, возвращает PNG bytes"""
        try:
            return remove(input_bytes, session=rembg_session)
        except Exception as e:
            print(f"AI Error: {e}")
            raise RuntimeError(f"BG Removal failed: {e}")

    @staticmethod
    def add_outline(input_bytes: bytes, color: tuple = (255, 255, 255), thickness: int = 10) -> bytes:
        """Добавляет обводку (Stroke) вокруг объекта"""
        try:
            # 1. Загрузка в PIL -> Numpy
            img = Image.open(io.BytesIO(input_bytes)).convert("RGBA")
            img_np = np.array(img)

            # 2. Выделение альфа-канала
            alpha = img_np[:, :, 3]
            
            # Если изображение пустое, возвращаем как есть
            if np.max(alpha) == 0:
                return input_bytes

            # 3. Создаем ядро для расширения (Stroke Width)
            kernel_size = max(3, thickness)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
            
            # 4. Расширяем маску (Dilate)
            dilated_alpha = cv2.dilate(alpha, kernel, iterations=1)
            
            # 5. Создаем слой обводки (цвета)
            outline_layer = np.zeros_like(img_np)
            outline_layer[:] = color + (255,) # Заливка цветом (R, G, B, A)
            outline_layer[:, :, 3] = dilated_alpha # Применяем расширенную маску

            # 6. Композитинг: Кладем оригинал ПОВЕРХ обводки
            # Конвертируем обратно в PIL для качественного смешивания
            outline_pil = Image.fromarray(outline_layer)
            original_pil = Image.fromarray(img_np)
            
            final_img = Image.alpha_composite(outline_pil, original_pil)

            # 7. Возврат байтов
            output = io.BytesIO()
            final_img.save(output, format="PNG")
            return output.getvalue()
            
        except Exception as e:
            print(f"Outline Error: {e}")
            raise RuntimeError(f"Outline failed: {e}")