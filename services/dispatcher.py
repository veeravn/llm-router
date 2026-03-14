# dispatcher.py
import requests
from .model_registry import MODEL_REGISTRY

def dispatch(prompt: str, category: str):
    model_info = MODEL_REGISTRY[category]
    endpoint = model_info["endpoint"]
    headers = model_info.get("headers", {})
    payload = model_info["payload_formatter"](prompt)

    response = requests.post(endpoint, headers=headers, json=payload)
    response.raise_for_status()
    return response.json()
