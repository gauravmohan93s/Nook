from youtube_transcript_api import YouTubeTranscriptApi
try:
    print("Trying .list_transcripts('gBhPrbKjpaI')...")
    ts = YouTubeTranscriptApi.list_transcripts('gBhPrbKjpaI')
    print("Success list_transcripts")
except AttributeError:
    print("Failed list_transcripts")

try:
    print("Trying .get_transcript('gBhPrbKjpaI')...")
    ts = YouTubeTranscriptApi.get_transcript('gBhPrbKjpaI')
    print("Success get_transcript")
except AttributeError:
    print("Failed get_transcript")
