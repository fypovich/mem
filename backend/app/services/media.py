import os
import shutil
import ffmpeg

class MediaProcessor:
    def __init__(self, path: str):
        self.path = path
        self.probe = None

    def _get_probe(self):
        if not self.probe:
            try:
                self.probe = ffmpeg.probe(self.path)
            except ffmpeg.Error as e:
                print(f"FFmpeg probe error: {e.stderr.decode() if e.stderr else str(e)}")
                return None
        return self.probe

    def get_metadata(self):
        probe = self._get_probe()
        if not probe: return 0.0, 0, 0
        
        video_stream = next((s for s in probe['streams'] if s['codec_type'] == 'video'), None)
        if not video_stream: return 0.0, 0, 0
            
        try:
            width = int(video_stream.get('width', 0))
            height = int(video_stream.get('height', 0))
            duration = float(video_stream.get('duration', 0.0))
            if duration == 0.0:
                duration = float(probe['format'].get('duration', 0.0))
            
            # Fallback для GIF/WebP, если метаданные неточные
            if duration == 0.0:
                nb_frames = int(video_stream.get('nb_frames', 0))
                if nb_frames > 1:
                    duration = 1.0 
            
            return duration, width, height
        except Exception as e:
            print(f"Error parsing metadata: {e}")
            return 0.0, 0, 0

    def has_audio_stream(self):
        probe = self._get_probe()
        if not probe: return False
        return any(s['codec_type'] == 'audio' for s in probe['streams'])

    def generate_thumbnail(self, output_path: str):
        try:
            (
                ffmpeg
                .input(self.path, ss=0)
                .filter('scale', 320, -1)
                .output(output_path, vframes=1)
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
        except ffmpeg.Error as e:
            print(f"Thumbnail error: {e.stderr.decode() if e.stderr else str(e)}")
            if self.path.lower().endswith(('.jpg', '.png', '.jpeg')):
                shutil.copy(self.path, output_path)

    def convert_to_mp4(self, output_path: str):
        """Конвертирует видео или GIF в MP4 с исправлением размеров."""
        try:
            (
                ffmpeg
                .input(self.path)
                .output(
                    output_path, 
                    vcodec='libx264', 
                    acodec='aac', 
                    movflags='faststart',
                    pix_fmt='yuv420p',
                    # Округляем размеры до четных (требование H.264)
                    vf='scale=trunc(iw/2)*2:trunc(ih/2)*2'
                )
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
        except ffmpeg.Error as e:
            raise RuntimeError(f"FFmpeg convert error: {e.stderr.decode() if e.stderr else str(e)}")

    def process_video_with_audio(self, audio_path: str, output_path: str):
        """Склеивает Картинку/Видео с Аудио, игнорируя лишние потоки."""
        try:
            # loop=1 зацикливает картинку. Обязательно нужен shortest=True ниже!
            input_video = ffmpeg.input(self.path, loop=1) 
            input_audio = ffmpeg.input(audio_path)
            
            (
                ffmpeg
                .output(
                    input_video['v'], # БЕРЕМ ТОЛЬКО ВИДЕОПОТОК (игнорируем обложки из mp3)
                    input_audio['a'], # БЕРЕМ ТОЛЬКО АУДИОПОТОК
                    output_path, 
                    vcodec='libx264', 
                    acodec='aac', 
                    # 🔥 ВАЖНО: shortest=True добавляет флаг -shortest. 
                    # Это остановит запись, когда закончится аудио.
                    shortest=True, 
                    tune='stillimage', 
                    pix_fmt='yuv420p', 
                    movflags='faststart',
                    vf='scale=trunc(iw/2)*2:trunc(ih/2)*2'
                )
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
        except ffmpeg.Error as e:
            raise RuntimeError(f"FFmpeg merge error: {e.stderr.decode() if e.stderr else str(e)}")