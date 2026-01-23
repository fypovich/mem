import ffmpeg
import os

class MediaProcessor:
    def __init__(self, input_path: str):
        self.input_path = input_path
        
    def get_metadata(self):
        """Возвращает (duration, width, height)"""
        try:
            probe = ffmpeg.probe(self.input_path)
            video_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'video'), None)
            
            duration = float(probe['format']['duration'])
            width = int(video_stream['width']) if video_stream else 0
            height = int(video_stream['height']) if video_stream else 0
            
            return duration, width, height
        except Exception as e:
            print(f"Error probing file: {e}")
            return 0.0, 0, 0

    def generate_thumbnail(self, output_path: str):
        """Создает превью"""
        try:
            (
                ffmpeg
                .input(self.input_path, ss=0.1)
                .filter('scale', 720, -1) 
                .output(output_path, vframes=1)
                .overwrite_output()
                .run(quiet=True)
            )
        except Exception as e:
            print(f"Thumbnail error: {e}")
            raise e

    def process_video_with_audio(self, audio_path: str, output_path: str):
        """
        Создает видео строго по длительности аудиодорожки.
        Аудио НЕ зацикливается.
        Видео/Картинка подгоняется под длину аудио.
        Гарантирует четные размеры (divisible by 2).
        """
        try:
            # 1. Анализируем файлы
            probe_input = ffmpeg.probe(self.input_path)
            probe_audio = ffmpeg.probe(audio_path)
            
            # Получаем точную длительность аудио
            audio_duration = float(probe_audio['format']['duration'])
            
            # Проверяем формат, чтобы понять, картинка это или видео
            fmt_name = probe_input['format']['format_name']
            is_static_image = False
            if 'image2' in fmt_name or 'png' in fmt_name or 'jpeg' in fmt_name or 'webp' in fmt_name:
                 is_static_image = True
            # GIF считаем видео-потоком для ffmpeg, но его тоже можно лупить

            # 2. Подготовка ВИДЕО потока
            if is_static_image:
                # Картинка: растягиваем её на всю длину аудио (-loop 1)
                video_part = ffmpeg.input(self.input_path, loop=1)
            else:
                # Видео/GIF: 
                # stream_loop -1 заставляет видео повторяться бесконечно.
                video_part = ffmpeg.input(self.input_path, stream_loop=-1)

            # 3. Подготовка АУДИО потока
            audio_part = ffmpeg.input(audio_path)

            # --- ВАЖНЫЙ ФИКС ДЛЯ ОШИБОК FFMPEG ---
            # Фильтр scale заставляет размеры быть четными (trunc(x/2)*2).
            # Это обязательно для libx264 (yuv420p).
            video_stream = video_part['v'].filter('scale', 'trunc(iw/2)*2', 'trunc(ih/2)*2')

            # 4. Сборка
            (
                ffmpeg
                .output(
                    video_stream, 
                    audio_part['a'], 
                    output_path, 
                    vcodec='libx264', 
                    acodec='aac', 
                    # Обрезаем видео ровно по длине аудио
                    t=audio_duration,
                    pix_fmt='yuv420p', 
                    shortest=None 
                )
                .overwrite_output()
                .run(quiet=True)
            )
            
        except Exception as e:
            print(f"Merge error: {e}")
            raise e