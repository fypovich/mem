import io
from rembg import remove, new_session
from PIL import Image
import numpy as np
import cv2

# Создаем сессию один раз при старте (чтобы не грузить модель каждый раз)
# u2net - стандартная модель, для людей можно использовать u2net_human_seg
model_name = "u2net" 
rembg_session = new_session(model_name)

class AIService:
    @staticmethod
    def remove_background(input_bytes: bytes) -> bytes:
        """
        Удаляет фон с изображения.
        Возвращает байты PNG изображения.
        """
        try:
            output_bytes = remove(input_bytes, session=rembg_session)
            return output_bytes
        except Exception as e:
            print(f"AI Error: {e}")
            raise RuntimeError(f"Background removal failed: {e}")

    @staticmethod
    def add_outline(input_bytes: bytes, color: tuple = (255, 255, 255), thickness: int = 10) -> bytes:
        """
        Добавляет обводку (stroke) вокруг объекта на прозрачном фоне.
        """
        # Конвертируем байты в numpy array для OpenCV
        image = Image.open(io.BytesIO(input_bytes)).convert("RGBA")
        img_np = np.array(image)

        # Выделяем альфа-канал
        alpha = img_np[:, :, 3]

        # Создаем ядро для диляции (расширения)
        kernel = np.ones((thickness, thickness), np.uint8)
        
        # Расширяем альфа-канал
        dilated_alpha = cv2.dilate(alpha, kernel, iterations=1)
        
        # Создаем слой обводки
        outline_layer = np.zeros_like(img_np)
        outline_layer[:, :, 0] = color[0] # R
        outline_layer[:, :, 1] = color[1] # G
        outline_layer[:, :, 2] = color[2] # B
        outline_layer[:, :, 3] = dilated_alpha # Alpha

        # Конвертируем обратно в PIL
        outline_img = Image.fromarray(outline_layer)
        original_img = Image.fromarray(img_np)

        # Накладываем оригинал поверх обводки
        final_img = Image.alpha_composite(outline_img, original_img)

        # Возвращаем байты
        output = io.BytesIO()
        final_img.save(output, format="PNG")
        return output.getvalue()