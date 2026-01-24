import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
print(f"API Key found: {bool(api_key)}")

if not api_key:
    print("SKIPPING: No API Key")
    exit(1)

try:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.0-flash", 
        contents="Say 'Hello, GenAI is working!' in 5 words."
    )
    print(f"SUCCESS: {response.text}")
except Exception as e:
    print(f"FAILURE: {e}")
