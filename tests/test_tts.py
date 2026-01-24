from gtts import gTTS
import io

try:
    text = "Audio test successful."
    tts = gTTS(text, lang='en')
    buffer = io.BytesIO()
    tts.write_to_fp(buffer)
    size = buffer.tell()
    print(f"SUCCESS: Generated {size} bytes of audio.")
except Exception as e:
    print(f"FAILURE: {e}")
