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
            # Fallback для GIF/WebP
            if duration == 0.0:
                nb_frames = int(video_stream.get('nb_frames', 0))
                if nb_frames > 1: duration = 1.0 

            return duration, width, height
        except Exception:
            return 0.0, 0, 0

    def has_audio_stream(self) -> bool:
        probe = self._get_probe()
        if not probe: return False
        return next((s for s in probe['streams'] if s['codec_type'] == 'audio'), None) is not None

    def generate_thumbnail(self, output_path: str):
        try:
            duration, _, _ = self.get_metadata()
            if duration > 0:
                (
                    ffmpeg
                    .input(self.path, ss=0.1)
                    .filter('scale', 400, -1)
                    .output(output_path, vframes=1)
                    .overwrite_output()
                    .run(capture_stdout=True, capture_stderr=True)
                )
            else:
                shutil.copy(self.path, output_path)
        except Exception:
            try: shutil.copy(self.path, output_path)
            except: pass

    # --- НОВЫЙ МЕТОД ДЛЯ КОНВЕРТАЦИИ ---
    def convert_to_mp4(self, output_path: str):
        """Принудительная конвертация в H.264 (web compatible)"""
        try:
            (
                ffmpeg
                .input(self.path)
                .output(
                    output_path, 
                    vcodec='libx264', 
                    acodec='aac', 
                    movflags='faststart', # Важно для потокового видео в браузере
                    pix_fmt='yuv420p'     # Важно для совместимости с Chrome/Safari
                )
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
        except ffmpeg.Error as e:
            raise RuntimeError(f"FFmpeg convert error: {e.stderr.decode() if e.stderr else str(e)}")

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
                    **{'tune': 'stillimage', 'pix_fmt': 'yuv420p', 'movflags': 'faststart'}
                )
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
        except ffmpeg.Error as e:
            raise RuntimeError(f"FFmpeg merge error: {e.stderr.decode() if e.stderr else str(e)}")