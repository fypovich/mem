import os
import shutil
import ffmpeg

class MediaProcessor:
    def __init__(self, path: str):
        self.path = path
        self.probe = None

    def _get_probe(self):
        """Ленивая загрузка метаданных через ffprobe"""
        if not self.probe:
            try:
                self.probe = ffmpeg.probe(self.path)
            except ffmpeg.Error as e:
                print(f"FFmpeg probe error: {e.stderr.decode() if e.stderr else str(e)}")
                return None
        return self.probe

    def get_metadata(self):
        """Возвращает (duration, width, height)"""
        probe = self._get_probe()
        if not probe:
            return 0.0, 0, 0
        
        # Ищем видео-поток
        video_stream = next((s for s in probe['streams'] if s['codec_type'] == 'video'), None)
        if not video_stream:
            # Если видеопотока нет (например, это картинка без контейнера), возвращаем нули
            return 0.0, 0, 0
            
        try:
            # 1. Ширина и Высота
            width = int(video_stream.get('width', 0))
            height = int(video_stream.get('height', 0))

            # 2. Длительность (может быть в стриме или в формате)
            duration = float(video_stream.get('duration', 0.0))
            if duration == 0.0:
                duration = float(probe['format'].get('duration', 0.0))

            return duration, width, height
        except Exception as e:
            print(f"Metadata parsing error: {e}")
            return 0.0, 0, 0

    def has_audio_stream(self) -> bool:
        """Проверяет, есть ли в файле аудиодорожка"""
        probe = self._get_probe()
        if not probe:
            return False
        
        # Ищем поток с типом 'audio'
        audio_stream = next((s for s in probe['streams'] if s['codec_type'] == 'audio'), None)
        return audio_stream is not None

    def generate_thumbnail(self, output_path: str):
        """Создает превью (кадр) из видео или копирует картинку"""
        try:
            # Если это видео (есть duration), берем кадр
            duration, _, _ = self.get_metadata()
            
            if duration > 0:
                (
                    ffmpeg
                    .input(self.path, ss=0.1) # Берем кадр с 0.1 секунды
                    .filter('scale', 400, -1) # Ресайз до ширины 400px (высота авто)
                    .output(output_path, vframes=1)
                    .overwrite_output()
                    .run(capture_stdout=True, capture_stderr=True)
                )
            else:
                # Если это картинка, просто копируем (можно добавить ресайз, если нужно)
                shutil.copy(self.path, output_path)
                
        except ffmpeg.Error as e:
            print(f"Thumbnail generation error: {e.stderr.decode() if e.stderr else str(e)}")
            # Fallback: если не вышло, пробуем просто скопировать файл, вдруг это картинка
            try:
                shutil.copy(self.path, output_path)
            except:
                pass

    def process_video_with_audio(self, audio_path: str, output_path: str):
        """Склеивает текущий файл (видео/картинку) с аудиофайлом"""
        try:
            input_video = ffmpeg.input(self.path)
            input_audio = ffmpeg.input(audio_path)
            
            # Используем stream_loop -1 для картинок, чтобы они длились столько же, сколько аудио
            # shortest=True обрежет видео по длине самого короткого потока (аудио)
            
            (
                ffmpeg
                .output(
                    input_video, 
                    input_audio, 
                    output_path, 
                    vcodec='libx264', 
                    acodec='aac', 
                    shortest=None, 
                    **{'tune': 'stillimage', 'pix_fmt': 'yuv420p'} # Оптимизация для статики
                )
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
        except ffmpeg.Error as e:
            raise RuntimeError(f"FFmpeg merge error: {e.stderr.decode() if e.stderr else str(e)}")