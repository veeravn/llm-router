# model_registry.py
from services.env import CLAUDE_API_KEY, GEMINI_API_KEY, CLAUDE_MODEL, AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT


MODEL_REGISTRY = {
    "code": {
        "name": "CodeLLaMA",
        "endpoint": "http://localhost:8001/generate"
    },
    "chat": {
        "name": "GPT-4.1",
        "endpoint": AZURE_OPENAI_ENDPOINT,
        "headers": {
            "Authorization": F"Bearer {AZURE_OPENAI_API_KEY}"
        },
        "payload_formatter": lambda prompt: {
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7
        }
    },
    "legal": {
        "name": "Claude 3",
        "endpoint": "https://api.anthropic.com/v1/messages",
        "headers": {
            "x-api-key": CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01"
        },
        "payload_formatter": lambda prompt: {
            "model": CLAUDE_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 1000
        }
    },
    "finance": {
        "name": "Gemini",
        "endpoint": f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={GEMINI_API_KEY}",
        "payload_formatter": lambda prompt: {
            "contents": [{"parts": [{"text": prompt}]}]
        }
    }
}
