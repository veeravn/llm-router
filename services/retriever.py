# llm_selector/retriever.py

import json
import faiss
import numpy as np
from .embeddings import get_embedding
from services.env import DOC_INDEX_PATH, DOC_METADATA_PATH


def retrieve_docs(prompt: str, top_k=3):
    """
    Retrieve top_k documents most relevant to the given prompt using FAISS.
    Returns a list of text snippets.
    """
    try:
        # Load FAISS index
        index = faiss.read_index(DOC_INDEX_PATH)

        # Load metadata for doc id to text mapping
        with open(DOC_METADATA_PATH, "r") as f:
            metadata = json.load(f)

        # Embed the prompt
        prompt_vec = get_embedding(prompt)
        prompt_vec /= np.linalg.norm(prompt_vec)

        # Search index
        D, I = index.search(np.array([prompt_vec]), k=top_k)

        # Get actual text content for each doc id
        return [metadata.get(str(i), f"[Unknown Doc {i}]") for i in I[0]]

    except Exception as e:
        print("[Retriever Error]", str(e))
        return []
