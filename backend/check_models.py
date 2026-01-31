import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("No GEMINI_API_KEY found.")
    exit(1)

client = genai.Client(api_key=api_key)

try:
    print("Listing models...")
    # The SDK might have different method names for listing models depending on version
    # Trying common patterns
    if hasattr(client, 'models'):
        if hasattr(client.models, 'list_models'):
            for m in client.models.list_models():
                print(f" - {m.name}")
        else:
            print("client.models has no list_models")
            print(dir(client.models))
    else:
        print("client has no models attribute")
        
except Exception as e:
    print(f"Error listing models: {e}")

# Try a direct generation test with a known safe model
try:
    print("\nTesting generation with 'gemini-1.5-flash'...")
    response = client.models.generate_content(
        model="gemini-1.5-flash",
        contents="Hello"
    )
    print("Success:", response.text)
except Exception as e:
    print(f"Generation failed: {e}")
