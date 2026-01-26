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
                # Добавляем count_frames=None, чтобы ffprobe посчитал кадры (важно для WebP)
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
            return 0.0, 0, 0
            
        try:
            width = int(video_stream.get('width', 0))
            height = int(video_stream.get('height', 0))

            # Попытка 1: Длительность из потока или контейнера
            duration = float(video_stream.get('duration', 0.0))
            if duration == 0.0:
                duration = float(probe['format'].get('duration', 0.0))

            # Попытка 2: Для WebP/GIF иногда duration=0, но есть nb_frames
            if duration == 0.0:
                nb_frames = int(video_stream.get('nb_frames', 0))
                # Если кадров больше 1, это анимация. Ставим фиктивную длительность.
                if nb_frames > 1:
                    duration = 1.0 

            return duration, width, height
        except Exception as e:
            print(f"Metadata parsing error: {e}")
            return 0.0, 0, 0

    def has_audio_stream(self) -> bool:
        """Проверяет, есть ли в файле аудиодорожка"""
        probe = self._get_probe()
        if not probe:
            return False
        
        audio_stream = next((s for s in probe['streams'] if s['codec_type'] == 'audio'), None)
        return audio_stream is not None

    def generate_thumbnail(self, output_path: str):
        """Создает превью"""
        try:
            duration, _, _ = self.get_metadata()
            
            if duration > 0:
                # Для видео/гиф берем кадр
                (
                    ffmpeg
                    .input(self.path, ss=0.1)
                    .filter('scale', 400, -1)
                    .output(output_path, vframes=1)
                    .overwrite_output()
                    .run(capture_stdout=True, capture_stderr=True)
                )
            else:
                # Для статики просто копируем
                shutil.copy(self.path, output_path)
                
        except Exception as e:
            print(f"Thumbnail error, fallback to copy: {e}")
            try:
                shutil.copy(self.path, output_path)
            except:
                pass

    def process_video_with_audio(self, audio_path: str, output_path: str):
        try:
            input_video = ffmpeg.input(self.path)
            input_audio = ffmpeg.input(audio_path)
            
            (
                ffmpeg
                .output(
                    input_video, 
                    input_audio, 
                    output_path, 
                    vcodec='libx264', 
                    acodec='aac', 
                    shortest=None, 
                    **{'tune': 'stillimage', 'pix_fmt': 'yuv420p'}
                )
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
        except ffmpeg.Error as e:
            raise RuntimeError(f"FFmpeg merge error: {e.stderr.decode() if e.stderr else str(e)}")