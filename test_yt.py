from youtube_transcript_api import YouTubeTranscriptApi
print(dir(YouTubeTranscriptApi))
try:
    print(YouTubeTranscriptApi.get_transcript("gBhPrbKjpaI", languages=['en']))
    print("Success")
except Exception as e:
    print(f"Error: {e}")
