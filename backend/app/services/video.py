import os
from moviepy.editor import VideoFileClip, TextClip, CompositeVideoClip, vfx
from moviepy.audio.io.AudioFileClip import AudioFileClip
import uuid

# Эффекты (фильтры)
def apply_filter(clip, filter_name):
    if filter_name == "black_white":
        return clip.fx(vfx.blackwhite)
    elif filter_name == "saturate":
        return clip.fx(vfx.colorx, 1.5) # Rainbow-ish (насыщенность)
    elif filter_name == "painting":
        return clip.fx(vfx.painting, saturation=1.6, black=0.006)
    elif filter_name == "invert":
        return clip.fx(vfx.invert_colors)
    # Для VHS/Glitch нужны более сложные шейдеры, пока оставим базовые
    return clip

async def process_video_task(
    file_path: str,
    output_path: str,
    trim_start: float = None,
    trim_end: float = None,
    crop: dict = None, # {x, y, w, h}
    remove_audio: bool = False,
    new_audio_path: str = None,
    text_overlay: dict = None, # {text, fontsize, color, x, y}
    filter_name: str = None
):
    try:
        clip = VideoFileClip(file_path)

        # 1. Тримминг (Обрезка длины)
        if trim_start is not None and trim_end is not None:
            clip = clip.subclip(trim_start, trim_end)

        # 2. Кроп (Обрезка кадра)
        if crop:
            clip = clip.crop(
                x1=crop['x'], 
                y1=crop['y'], 
                width=crop['w'], 
                height=crop['h']
            )

        # 3. Аудио
        if remove_audio:
            clip = clip.without_audio()
        elif new_audio_path:
            new_audio = AudioFileClip(new_audio_path)
            # Обрезаем аудио под длину видео, если нужно
            if new_audio.duration > clip.duration:
                new_audio = new_audio.subclip(0, clip.duration)
            clip = clip.set_audio(new_audio)

        # 4. Фильтры
        if filter_name:
            clip = apply_filter(clip, filter_name)

        # 5. Текст
        if text_overlay and text_overlay.get('text'):
            # Внимание: ImageMagick должен быть настроен в Dockerfile (у тебя это сделано)
            txt_clip = (TextClip(
                text_overlay['text'], 
                fontsize=text_overlay.get('fontsize', 50), 
                color=text_overlay.get('color', 'white'),
                font='DejaVu-Sans-Bold' # Используем шрифт, который точно есть в контейнере
            )
            .set_position((text_overlay.get('x', 'center'), text_overlay.get('y', 'bottom')))
            .set_duration(clip.duration))
            
            clip = CompositeVideoClip([clip, txt_clip])

        # Сохранение
        # preset='ultrafast' для скорости, но файл может быть больше
        clip.write_videofile(
            output_path, 
            codec='libx264', 
            audio_codec='aac',
            preset='ultrafast', 
            fps=24
        )

        clip.close()
        return output_path

    except Exception as e:
        print(f"Error processing video: {e}")
        if os.path.exists(output_path):
            os.remove(output_path)
        raise e