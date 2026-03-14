import os
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-3-opus-20240229")
DOC_INDEX_PATH = "faiss_index/docs.index"
DOC_METADATA_PATH = "faiss_index/docs_meta.json"
# Predefined categories (you can customize these)
CATEGORIES = ["code", "legal", "finance", "chat"]

# FAISS index path
CATEGORY_INDEX_PATH = "faiss_index/category.index"
