import os
from moviepy.editor import VideoFileClip, TextClip, CompositeVideoClip, vfx
from moviepy.audio.io.AudioFileClip import AudioFileClip
import uuid

class VideoEditorService:
    def __init__(self, output_dir="uploads"):
        self.output_dir = output_dir
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

    def _apply_filter(self, clip, filter_name):
        """Применение фильтров к видео"""
        if not filter_name or filter_name == "No Filter":
            return clip
        
        if filter_name == "Black & White":
            return clip.fx(vfx.blackwhite)
        elif filter_name == "Rainbow":
            # Увеличение насыщенности (симуляция)
            return clip.fx(vfx.colorx, 1.5)
        elif filter_name == "Rumble":
            # Эффект "живописи" или дрожания (симуляция через painting для простоты)
            return clip.fx(vfx.painting, saturation=1.4, black=0.006)
        elif filter_name == "VHS":
            # Повышение контраста и гаммы для "старого" вида
            return clip.fx(vfx.lum_contrast, lum=0, contrast=1.5).fx(vfx.gamma_corr, gamma=1.2)
        elif filter_name == "Groovy":
            # Инверсия цветов
            return clip.fx(vfx.invert_colors)
        
        return clip

    def process_video(
        self,
        input_path: str,
        output_filename: str,
        trim_start: float = None,
        trim_end: float = None,
        crop: dict = None, # {x, y, width, height}
        remove_audio: bool = False,
        new_audio_path: str = None,
        text_config: dict = None, # {text, size, color, x, y}
        filter_name: str = None
    ) -> str:
        try:
            clip = VideoFileClip(input_path)
            
            # 1. Тримминг (Обрезка по времени)
            if trim_start is not None and trim_end is not None:
                # Проверки на границы
                start = max(0, trim_start)
                end = min(clip.duration, trim_end)
                if start < end:
                    clip = clip.subclip(start, end)

            # 2. Кроп (Обрезка кадра)
            if crop:
                # moviepy crop принимает x1, y1, width, height
                clip = clip.crop(
                    x1=crop.get('x', 0),
                    y1=crop.get('y', 0),
                    width=crop.get('width'),
                    height=crop.get('height')
                )

            # 3. Аудио (Удаление или Замена)
            if remove_audio:
                clip = clip.without_audio()
            elif new_audio_path and os.path.exists(new_audio_path):
                new_audio = AudioFileClip(new_audio_path)
                # Если новое аудио короче видео, можно зациклить или обрезать, 
                # но для простоты обрежем/оставим как есть.
                # Обычно обрезают аудио под длину видео:
                if new_audio.duration > clip.duration:
                    new_audio = new_audio.subclip(0, clip.duration)
                
                # Если нужно зациклить аудио, если оно короче видео (опционально)
                # else: ...
                
                clip = clip.set_audio(new_audio)

            # 4. Фильтры
            clip = self._apply_filter(clip, filter_name)

            # 5. Текст
            if text_config and text_config.get('text'):
                txt_clip = (TextClip(
                    text_config['text'],
                    fontsize=float(text_config.get('size', 50)),
                    color=text_config.get('color', 'white'),
                    font='DejaVu-Sans-Bold', # Шрифт, доступный в Docker-образе
                    stroke_color='black',
                    stroke_width=2
                )
                .set_position((float(text_config.get('x', 0.5)), float(text_config.get('y', 0.8))), relative=True)
                .set_duration(clip.duration))
                
                clip = CompositeVideoClip([clip, txt_clip])

            # 6. Сохранение
            output_path = os.path.join(self.output_dir, output_filename)
            
            # Используем пресет ultrafast для скорости в редакторе
            clip.write_videofile(
                output_path,
                codec='libx264',
                audio_codec='aac',
                preset='ultrafast',
                fps=24,
                threads=4,
                logger=None # Отключаем лог в консоль, чтобы не мусорить в воркере
            )
            
            clip.close()
            return output_path

        except Exception as e:
            print(f"VideoEditorService Error: {e}")
            raise e