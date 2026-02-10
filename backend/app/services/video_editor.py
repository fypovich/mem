import os
from moviepy.editor import VideoFileClip, TextClip, CompositeVideoClip
from moviepy.audio.io.AudioFileClip import AudioFileClip


class VideoEditorService:

    def __init__(self, output_dir="uploads"):
        self.output_dir = output_dir
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

    def process_video(
        self,
        input_path: str,
        output_filename: str,
        trim_start: float = None,
        trim_end: float = None,
        crop: dict = None,
        remove_audio: bool = False,
        new_audio_path: str = None,
        text_config: dict = None,
    ) -> str:
        clip = None
        try:
            print(f"🎬 START PROCESSING video: {input_path}")
            clip = VideoFileClip(input_path)

            # 1. Trimming
            if trim_start is not None and trim_end is not None:
                start = max(0, trim_start)
                end = min(clip.duration, trim_end)
                if start < end:
                    clip = clip.subclip(start, end)

            # 2. Cropping
            if crop:
                clip = clip.crop(
                    x1=crop.get('x', 0),
                    y1=crop.get('y', 0),
                    width=crop.get('width'),
                    height=crop.get('height')
                )

            # 3. Audio
            if remove_audio:
                clip = clip.without_audio()
            elif new_audio_path and os.path.exists(new_audio_path):
                new_audio = AudioFileClip(new_audio_path)
                if new_audio.duration > clip.duration:
                    new_audio = new_audio.subclip(0, clip.duration)
                clip = clip.set_audio(new_audio)

            # 4. Text
            if text_config and text_config.get('text'):
                fontsize = max(12, float(text_config.get('size', 50)))
                txt_clip = TextClip(
                    text_config['text'],
                    fontsize=fontsize,
                    color=text_config.get('color', 'white'),
                    font='DejaVu-Sans-Bold',
                    stroke_color='black',
                    stroke_width=max(1, int(fontsize / 25))
                )
                tx = float(text_config.get('x', 0.5)) * clip.w - txt_clip.w / 2
                ty = float(text_config.get('y', 0.8)) * clip.h - txt_clip.h / 2
                txt_clip = txt_clip.set_position((tx, ty)).set_duration(clip.duration)
                clip = CompositeVideoClip([clip, txt_clip])

            # 5. Save
            output_path = os.path.join(self.output_dir, output_filename)

            clip.write_videofile(
                output_path,
                codec='libx264',
                audio_codec='aac',
                preset='ultrafast',
                fps=24,
                threads=4,
                logger='bar',
            )

            print(f"✅ DONE: {output_path}")
            return output_path

        except Exception as e:
            print(f"❌ VideoEditorService Error: {e}")
            raise e
        finally:
            if clip:
                try:
                    clip.close()
                except:
                    pass
