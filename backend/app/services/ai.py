import io
import numpy as np
import cv2
from PIL import Image

class AIService:
    @staticmethod
    def remove_background(input_bytes: bytes) -> bytes:
        """
        Удаление фона с использованием BiRefNet (SOTA качество).
        Включает оптимизацию памяти (ресайз) и очистку краев.
        """
        try:
            # ЛЕНИВЫЙ ИМПОРТ (чтобы не грузить память при старте воркера)
            from rembg import remove, new_session
            
            # Используем BiRefNet (лучшее качество)
            model_name = "birefnet-general" 
            session = new_session(model_name)
            
            # --- ОПТИМИЗАЦИЯ ПАМЯТИ ---
            img_pil = Image.open(io.BytesIO(input_bytes))
            
            # Если картинка огромная, уменьшаем её. 
            # 1500px достаточно для любого стикера.
            # Это снизит потребление RAM в 4-5 раз.
            max_dim = 1500
            if max(img_pil.size) > max_dim:
                img_pil.thumbnail((max_dim, max_dim), Image.LANCZOS)
                # Сохраняем уменьшенную версию в буфер для rembg
                buf = io.BytesIO()
                img_pil.save(buf, format="PNG")
                input_bytes = buf.getvalue()
            # --------------------------

            # 1. Генерация маски
            # alpha_matting=False ОБЯЗАТЕЛЬНО на 16GB RAM с BiRefNet
            result_bytes = remove(
                input_bytes, 
                session=session,
                alpha_matting=False, 
                post_process_mask=True
            )

            # 2. Продвинутая очистка краев (Anti-Halo) через OpenCV
            img = Image.open(io.BytesIO(result_bytes)).convert("RGBA")
            img_np = np.array(img)
            
            alpha = img_np[:, :, 3]
            
            if np.max(alpha) > 0:
                # Мягкая очистка "мусора" по краям
                # Erode (1px) убирает кайму
                kernel = np.ones((3, 3), np.uint8)
                alpha = cv2.erode(alpha, kernel, iterations=1)
                
                # Blur делает край мягким, скрывая пикселизацию
                alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
                
                img_np[:, :, 3] = alpha
            
            # 3. Возврат результата
            final_img = Image.fromarray(img_np)
            output = io.BytesIO()
            final_img.save(output, format="PNG")
            return output.getvalue()

        except Exception as e:
            print(f"AI Error: {e}")
            # Фоллбек на легкую модель, если BiRefNet все же упадет
            try:
                from rembg import remove, new_session
                print("Falling back to u2netp due to error...")
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