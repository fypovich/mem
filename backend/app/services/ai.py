import io
import numpy as np
import cv2
from PIL import Image

class AIService:
    @staticmethod
    def remove_background(input_bytes: bytes) -> bytes:
        """
        Удаление фона с использованием BiRefNet (SOTA качество) + очистка краев.
        """
        try:
            # ЛЕНИВЫЙ ИМПОРТ для предотвращения краша воркера (OpenMP issue)
            from rembg import remove, new_session
            
            # ИСПОЛЬЗУЕМ BiRefNet (birefnet-general)
            # Это самая мощная модель на данный момент в библиотеке rembg.
            # Если будет падать по памяти - можно попробовать 'u2net' (классика) или 'isnet-general-use'
            model_name = "birefnet-general" 
            
            session = new_session(model_name)
            
            # 1. Генерация маски
            # alpha_matting=True может крашить воркер на слабых машинах, 
            # поэтому используем False, но улучшаем качество через OpenCV ниже.
            result_bytes = remove(
                input_bytes, 
                session=session,
                alpha_matting=False, 
                post_process_mask=True # Включаем встроенный пост-процессинг rembg
            )

            # 2. Продвинутая очистка краев (Anti-Halo)
            # Часто остается тонкая каймой старого фона. Убираем её.
            img = Image.open(io.BytesIO(result_bytes)).convert("RGBA")
            img_np = np.array(img)
            
            # Выделяем альфа-канал
            alpha = img_np[:, :, 3]
            
            if np.max(alpha) > 0:
                # А. Эрозия (сужение маски) на 1 пиксель, чтобы срезать "грязные" края
                # Используем маленькое ядро
                kernel = np.ones((3, 3), np.uint8)
                alpha = cv2.erode(alpha, kernel, iterations=1)
                
                # Б. Сглаживание (Gaussian Blur), чтобы края были мягкими, а не пиксельными
                alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
                
                # Применяем улучшенную альфу обратно
                img_np[:, :, 3] = alpha
            
            # 3. Возврат результата
            final_img = Image.fromarray(img_np)
            output = io.BytesIO()
            final_img.save(output, format="PNG")
            return output.getvalue()

        except Exception as e:
            print(f"AI Error: {e}")
            # В случае ошибки пробуем самую легкую модель как фоллбек
            try:
                from rembg import remove, new_session
                return remove(input_bytes, session=new_session("u2netp"))
            except:
                raise RuntimeError(f"Background removal failed: {e}")

    @staticmethod
    def add_outline(input_bytes: bytes, color: tuple = (255, 255, 255), thickness: int = 15) -> bytes:
        """Добавляет обводку (Stroke) вокруг объекта"""
        try:
            image = Image.open(io.BytesIO(input_bytes)).convert("RGBA")
            img_np = np.array(image)

            alpha = img_np[:, :, 3]
            if np.max(alpha) == 0: return input_bytes

            # Морфологическое расширение маски для создания контура
            # cv2.MORPH_ELLIPSE дает более округлый и естественный контур
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (thickness, thickness))
            dilated_alpha = cv2.dilate(alpha, kernel, iterations=1)
            
            # Создаем слой цвета
            outline_layer = np.zeros_like(img_np)
            outline_layer[:] = color + (255,) # R, G, B, A (Full opaque)
            
            # В слой цвета кладем расширенную маску
            outline_layer[:, :, 3] = dilated_alpha 

            # Собираем бутерброд: Снизу обводка, Сверху оригинал
            outline_pil = Image.fromarray(outline_layer)
            original_pil = Image.fromarray(img_np)
            
            # alpha_composite корректно обрабатывает полупрозрачность
            final_img = Image.alpha_composite(outline_pil, original_pil)

            output = io.BytesIO()
            final_img.save(output, format="PNG")
            return output.getvalue()
        except Exception as e:
            print(f"Outline Error: {e}")
            raise e