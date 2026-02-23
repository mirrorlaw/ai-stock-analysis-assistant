from dotenv import load_dotenv
import os
from openai import OpenAI

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

client = OpenAI(api_key=api_key)

try:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello"}],
        max_tokens=5
    )
    print("SUCCESS: API Key is working. Response:", response.choices[0].message.content)
except Exception as e:
    print(f"FAILURE: {e}")
