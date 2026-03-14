# llm_selector/embeddings.py

from openai import AzureOpenAI
import numpy as np
from services.env import AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT

# Configure your Azure OpenAI client
client = AzureOpenAI(
    api_key=AZURE_OPENAI_API_KEY,
    api_version="2023-12-01-preview",
    azure_endpoint=AZURE_OPENAI_ENDPOINT
)

def get_embedding(text: str) -> np.ndarray:
    """
    Get the embedding for a given text using Azure OpenAI's embedding model.
    Returns a NumPy float32 vector.
    """
    response = client.embeddings.create(
        input=[text],
        model="text-embedding-3-small"  # You can use "text-embedding-3-large" for higher quality
    )
    return np.array(response.data[0].embedding, dtype=np.float32)
