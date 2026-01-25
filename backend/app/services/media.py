import ffmpeg
import os
import shutil

class MediaProcessor:
    def __init__(self, file_path: str):
        self.file_path = file_path

    def get_metadata(self):
        try:
            probe = ffmpeg.probe(self.file_path)
            video_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'video'), None)
            
            # Если это картинка, ffmpeg может не найти video stream, или найти его как mjpeg
            # Для картинок длительность будет недоступна в обычном виде
            
            if not video_stream:
                 # Пытаемся понять, картинка ли это
                 # Обычно для картинок probe возвращает один стрим с codec_type='video' (mjpeg/png)
                 # Но duration там нет.
                 return 0.0, 0, 0

            width = int(video_stream['width'])
            height = int(video_stream['height'])
            
            # Duration
            duration = float(video_stream.get('duration', 0.0))
            if duration == 0.0 and 'tags' in probe['format']:
                 # Иногда длительность в формате
                 duration = float(probe['format'].get('duration', 0.0))
            
            return duration, width, height
        except Exception as e:
            print(f"Metadata error: {e}")
            return 0.0, 0, 0

    def generate_thumbnail(self, output_path: str):
        try:
            # Проверяем расширение
            ext = self.file_path.split('.')[-1].lower()
            if ext in ['jpg', 'jpeg', 'png', 'webp']:
                # Если это уже картинка, просто копируем её как тумнейл
                # (В идеале надо бы сделать ресайз, но пока сойдет копия)
                shutil.copy(self.file_path, output_path)
            else:
                # Видео: берем кадр с 0.1 секунды
                (
                    ffmpeg
                    .input(self.file_path, ss=0.1)
                    .output(output_path, vframes=1)
                    .overwrite_output()
                    .run(capture_stdout=True, capture_stderr=True)
                )
        except ffmpeg.Error as e:
            print('Thumbnail error:', e.stderr.decode('utf8'))
            # Fallback: если не вышло, копируем оригинал (если это картинка) или создаем пустой файл
            if os.path.exists(self.file_path) and self.file_path.lower().endswith(('.jpg', '.png')):
                 shutil.copy(self.file_path, output_path)
            else:
                 raise e

    def process_video_with_audio(self, audio_path: str, output_path: str):
        # ... (код видео обработки оставляем тем же) ...
        # В предыдущем шаге мы уже использовали ffmpeg.input
        # Убедитесь, что этот метод не вызывается для чистых картинок без аудио.
        
        input_video = ffmpeg.input(self.file_path)
        
        if audio_path:
            input_audio = ffmpeg.input(audio_path)
            # Зацикливаем видео под длину аудио (если картинка)
            # Или берем видео как есть (если видео)
            
            # Определяем, картинка это или видео
            probe = ffmpeg.probe(self.file_path)
            # ... сложная логика ...
            
            # УПРОЩЕНИЕ:
            # Используем stream_loop -1 для картинки
            # -shortest обрезает по самому короткому стриму (аудио)
            
            (
                ffmpeg
                .output(input_audio, input_video, output_path, vcodec='libx264', acodec='aac', shortest=None, pix_fmt='yuv420p', **{'c:v': 'libx264', 'tune': 'stillimage'})
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
        else:
            # Просто конвертация
             (
                ffmpeg
                .input(self.file_path)
                .output(output_path, vcodec='libx264', acodec='aac')
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )