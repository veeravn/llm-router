# llm_selector/classifier.py

import faiss
import numpy as np
from .embeddings import get_embedding
from .env import CATEGORIES, CATEGORY_INDEX_PATH

def build_category_index():
    """
    Generate and store a FAISS index of category embeddings.
    Run this once during setup.
    """
    # Generate embeddings for each category label
    category_embeddings = [get_embedding(c) for c in CATEGORIES]

    # Normalize for cosine similarity
    category_mat = np.array(category_embeddings).astype("float32")
    faiss.normalize_L2(category_mat)

    dim = category_mat.shape[1]
    index = faiss.IndexFlatIP(dim)  # Inner product = cosine sim with normalized vectors
    index.add(category_mat)

    # Save index
    faiss.write_index(index, CATEGORY_INDEX_PATH)
    return index

def load_category_index():
    """
    Load the prebuilt FAISS category index from disk.
    """
    return faiss.read_index(CATEGORY_INDEX_PATH)

def classify_prompt(prompt: str) -> str:
    """
    Classify a given prompt into one of the predefined categories
    using zero-shot embedding similarity.
    """
    # Embed and normalize the prompt
    embedding = get_embedding(prompt).astype("float32")
    embedding /= np.linalg.norm(embedding)

    # Load index and search
    index = load_category_index()
    D, I = index.search(np.array([embedding]), k=1)

    return CATEGORIES[I[0][0]]
