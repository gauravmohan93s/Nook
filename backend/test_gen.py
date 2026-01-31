import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

try:
    print("Testing 'gemini-2.0-flash'...")
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents="Hello"
    )
    print("Success:", response.text)
except Exception as e:
    print(f"Error: {e}")
