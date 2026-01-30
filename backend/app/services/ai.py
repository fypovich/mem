import io
import numpy as np
import cv2
from rembg import remove, new_session
from PIL import Image

# Создаем сессию один раз (u2net - универсальная модель)
rembg_session = new_session("u2net")

class AIService:
    @staticmethod
    def remove_background(input_bytes: bytes) -> bytes:
        try:
            return remove(input_bytes, session=rembg_session)
        except Exception as e:
            print(f"AI Error: {e}")
            raise RuntimeError(f"Background removal failed: {e}")

    @staticmethod
    def add_outline(input_bytes: bytes, color: tuple = (255, 255, 255), thickness: int = 15) -> bytes:
        """Добавляет обводку вокруг объекта с прозрачным фоном"""
        try:
            image = Image.open(io.BytesIO(input_bytes)).convert("RGBA")
            img_np = np.array(image)

            # Получаем маску (альфа-канал)
            alpha = img_np[:, :, 3]
            if np.max(alpha) == 0: return input_bytes # Если пусто, возвращаем как есть

            # Расширяем маску (Dilate)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (thickness, thickness))
            dilated_alpha = cv2.dilate(alpha, kernel, iterations=1)
            
            # Создаем слой обводки
            outline_layer = np.zeros_like(img_np)
            outline_layer[:] = color + (255,)
            outline_layer[:, :, 3] = dilated_alpha

            # Накладываем оригинал поверх обводки
            outline_pil = Image.fromarray(outline_layer)
            original_pil = Image.fromarray(img_np)
            final_img = Image.alpha_composite(outline_pil, original_pil)

            output = io.BytesIO()
            final_img.save(output, format="PNG")
            return output.getvalue()
        except Exception as e:
            print(f"Outline Error: {e}")
            raise e