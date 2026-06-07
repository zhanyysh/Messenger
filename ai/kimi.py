import os
from dotenv import load_dotenv
import requests, base64

load_dotenv()

invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
stream = False

def read_b64(path):
  with open(path, "rb") as f:
    return base64.b64encode(f.read()).decode()

headers = {
  "Authorization": f"Bearer {os.getenv('NVIDIA_API_KEY')}",
  "Accept": "text/event-stream" if stream else "application/json"
}

payload = {
  "model": "moonshotai/kimi-k2.6",
  "messages": [{"role":"user","content":"Do you see what files and dirs i have in my project? If so, list them."}],
  "max_tokens": 16384,
  "temperature": 1.00,
  "top_p": 1.00,
  "stream": stream,
  
}

response = requests.post(invoke_url, headers=headers, json=payload, stream=stream)
if stream:
    for line in response.iter_lines():
        if line:
            print(line.decode("utf-8"))
else:
    print(response.json())