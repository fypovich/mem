import io
import numpy as np
import cv2
from PIL import Image

class AIService:
    @staticmethod
    def remove_background(input_bytes: bytes) -> bytes:
        """
        Удаление фона с использованием BiRefNet (SOTA качество).
        Включает жесткую оптимизацию памяти для ноутбуков с 16GB RAM.
        """
        try:
            # Ленивый импорт для безопасности процессов Celery
            from rembg import remove, new_session
            
            # --- ВЫБОР МОДЕЛИ ---
            # birefnet-general - Лучшая детализация (SOTA).
            # Если вдруг упадет, поменяйте на 'u2net' (классика)
            model_name = "birefnet-general" 
            
            session = new_session(model_name)
            
            # --- 1. ПРЕДВАРИТЕЛЬНАЯ ОБРАБОТКА (Оптимизация RAM) ---
            img_pil = Image.open(io.BytesIO(input_bytes))
            
            # Для стикеров больше 1024px не нужно. 
            # Это кардинально снижает потребление памяти и спасает от вылетов.
            max_dim = 1024
            original_size = img_pil.size
            
            if max(img_pil.size) > max_dim:
                # Используем LANCZOS для качественного уменьшения
                img_pil.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
                
                # Сохраняем уменьшенную версию для обработки
                buf = io.BytesIO()
                img_pil.save(buf, format="PNG")
                input_bytes = buf.getvalue()

            # --- 2. ГЕНЕРАЦИЯ МАСКИ ---
            # alpha_matting=False - для BiRefNet это нормально, она и так точная.
            # Включение True на CPU может завесить систему.
            result_bytes = remove(
                input_bytes, 
                session=session,
                alpha_matting=False, 
                post_process_mask=True
            )

            # --- 3. POST-PROCESSING (Мягкая очистка) ---
            img = Image.open(io.BytesIO(result_bytes)).convert("RGBA")
            img_np = np.array(img)
            
            alpha = img_np[:, :, 3]
            
            if np.max(alpha) > 0:
                # BiRefNet дает четкие края, поэтому эрозия (обрезание краев) 
                # может съесть детали. Делаем только мягкое сглаживание.
                
                # Если хотите подрезать "грязные" края, раскомментируйте эти 2 строки:
                # kernel = np.ones((3, 3), np.uint8)
                # alpha = cv2.erode(alpha, kernel, iterations=1)
                
                # Сглаживание (анти-алиасинг) краев
                alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
                
                img_np[:, :, 3] = alpha
            
            final_img = Image.fromarray(img_np)

            # (Опционально) Если нужно вернуть к исходному размеру (не рекомендуется для качества)
            # final_img = final_img.resize(original_size, Image.Resampling.LANCZOS)

            output = io.BytesIO()
            final_img.save(output, format="PNG")
            return output.getvalue()

        except Exception as e:
            print(f"AI Error: {e}")
            # Аварийный фоллбек на самую легкую модель
            try:
                print("Switching to lightweight model u2netp...")
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
            # Если пусто, возвращаем как есть
            if np.max(alpha) == 0: return input_bytes

            # 1. Создаем ядро для расширения
            # Используем ELLIPSE для более круглых краев обводки
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (thickness, thickness))
            
            # 2. Расширяем маску (Dilate)
            dilated_alpha = cv2.dilate(alpha, kernel, iterations=1)
            
            # 3. Дополнительно сглаживаем саму обводку, чтобы не было пикселей
            dilated_alpha = cv2.GaussianBlur(dilated_alpha, (5, 5), 0)

            # 4. Создаем слой обводки
            outline_layer = np.zeros_like(img_np)
            outline_layer[:] = color + (255,) # Цвет обводки
            outline_layer[:, :, 3] = dilated_alpha # Применяем маску

            # 5. Накладываем оригинал ПОВЕРХ обводки
            outline_pil = Image.fromarray(outline_layer)
            original_pil = Image.fromarray(img_np)
            
            final_img = Image.alpha_composite(outline_pil, original_pil)

            output = io.BytesIO()
            final_img.save(output, format="PNG")
            return output.getvalue()
        except Exception as e:
            print(f"Outline Error: {e}")
            raise e