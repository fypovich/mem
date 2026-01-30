import io
import numpy as np
import cv2
from rembg import remove, new_session
from PIL import Image

class AIService:
    @staticmethod
    def remove_background(input_bytes: bytes) -> bytes:
        try:
            # Создаем сессию внутри функции, чтобы избежать конфликтов процессов
            session = new_session("isnet-general-use")
            
            # ВАЖНО: alpha_matting=False для стабильности
            # Включите True только если настроите OMP_NUM_THREADS и добавите памяти
            return remove(
                input_bytes, 
                session=session,
                alpha_matting=False 
            )
        except Exception as e:
            print(f"AI Error: {e}")
            raise RuntimeError(f"Background removal failed: {e}")

    @staticmethod
    def add_outline(input_bytes: bytes, color: tuple = (255, 255, 255), thickness: int = 15) -> bytes:
        """Добавляет обводку (Stroke)"""
        try:
            image = Image.open(io.BytesIO(input_bytes)).convert("RGBA")
            img_np = np.array(image)

            alpha = img_np[:, :, 3]
            # Если картинка пустая
            if np.max(alpha) == 0: return input_bytes

            # Морфологическое расширение
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (thickness, thickness))
            dilated_alpha = cv2.dilate(alpha, kernel, iterations=1)
            
            # Создание слоя обводки
            outline_layer = np.zeros_like(img_np)
            outline_layer[:] = color + (255,)
            outline_layer[:, :, 3] = dilated_alpha

            # Склеиваем
            outline_pil = Image.fromarray(outline_layer)
            original_pil = Image.fromarray(img_np)
            
            final_img = Image.alpha_composite(outline_pil, original_pil)

            output = io.BytesIO()
            final_img.save(output, format="PNG")
            return output.getvalue()
        except Exception as e:
            print(f"Outline Error: {e}")
            raise e