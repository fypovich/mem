import io
from rembg import remove, new_session
from PIL import Image
import numpy as np
import cv2

# Сессия для BiRefNet или U2Net
# u2net - стандарт, u2net_human_seg - для людей, isnet-general-use - отличная альтернатива
model_name = "u2net" 
rembg_session = new_session(model_name)

class AIService:
    @staticmethod
    def remove_background(input_bytes: bytes) -> bytes:
        try:
            output_bytes = remove(input_bytes, session=rembg_session)
            return output_bytes
        except Exception as e:
            print(f"AI Error: {e}")
            raise RuntimeError(f"Background removal failed: {e}")

    @staticmethod
    def add_outline(input_bytes: bytes, color: tuple = (255, 255, 255), thickness: int = 15) -> bytes:
        """
        Качественная обводка через морфологию OpenCV
        """
        # 1. PIL -> Numpy
        image = Image.open(io.BytesIO(input_bytes)).convert("RGBA")
        img_np = np.array(image)

        # 2. Извлекаем Alpha-канал
        alpha = img_np[:, :, 3]
        
        # Если картинка пустая (прозрачная), возвращаем как есть
        if np.max(alpha) == 0:
            return input_bytes

        # 3. Расширяем маску (Dilate)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (thickness, thickness))
        dilated_alpha = cv2.dilate(alpha, kernel, iterations=1)
        
        # 4. Создаем слой обводки
        outline_layer = np.zeros_like(img_np)
        outline_layer[:] = color + (255,) # Заливаем цветом
        outline_layer[:, :, 3] = dilated_alpha # Применяем расширенную альфу

        # 5. Складываем (Оригинал поверх Обводки)
        outline_pil = Image.fromarray(outline_layer)
        original_pil = Image.fromarray(img_np)
        
        # Делаем финальный композит
        final_img = Image.alpha_composite(outline_pil, original_pil)

        # 6. Возвращаем байты
        output = io.BytesIO()
        final_img.save(output, format="PNG")
        return output.getvalue()