from youtube_transcript_api import YouTubeTranscriptApi
try:
    print("Trying .fetch('gBhPrbKjpaI')...")
    # It might be an instance method?
    # No, it's usually static.
    # But dir() showed it on the class.
    # 'fetch'
    # 'list'
    pass
except:
    pass
    
import inspect
print(inspect.getmembers(YouTubeTranscriptApi, predicate=inspect.isfunction))
print(inspect.getmembers(YouTubeTranscriptApi, predicate=inspect.ismethod))
