# LLM Router

A semantic query routing system that uses **embeddings** and **FAISS** to dynamically dispatch incoming queries to the optimal LLM backend — **Azure OpenAI (GPT-4o)** or **Google Gemini** — based on query intent, cost, and latency characteristics.

Deployed as an **Azure Functions** microservice with a lightweight frontend UI.

---

## Why LLM Router?

Different queries are better served by different models. Routing blindly to a single large model wastes cost and adds latency for simple queries, while routing everything to a cheaper model degrades quality on complex ones.

LLM Router solves this by semantically classifying each query at inference time and dispatching to the best model for that query type — without the caller needing to know or care which model responds.

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design.

```
Query → Embedding → FAISS Classifier → Route Decision → LLM Service → Response
```

---

## Project Structure

```
llm-router/
├── classify_function.py      # FAISS-based query classifier
├── function_app.py           # Azure Functions entry point / HTTP trigger
├── faiss_index/              # Serialized FAISS vector index
├── services/                 # LLM backend service wrappers
│   ├── openai_service.py     # Azure OpenAI (GPT-4o) integration
│   └── gemini_service.py     # Google Gemini API integration
├── ui/                       # Frontend query interface
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── host.json                 # Azure Functions host config
├── local.settings.json       # Local development settings (not tracked)
├── requirements.txt
└── __init__.py
```

---

## How It Works

1. **Incoming query** hits the Azure Functions HTTP trigger (`function_app.py`)
2. The query is **embedded** using a sentence-transformer model
3. The embedding is compared against the **FAISS index** of labeled example queries
4. The **nearest-neighbor classification** determines query intent (complex reasoning, factual lookup, creative, code, etc.)
5. The router dispatches to the appropriate **LLM service** (`openai_service.py` or `gemini_service.py`)
6. The response is returned to the caller

---

## Tech Stack

| Component | Technology |
|---|---|
| Routing Logic | Python, FAISS, sentence-transformers |
| Deployment | Azure Functions (HTTP trigger) |
| LLM Backends | Azure OpenAI (GPT-4o), Google Gemini API |
| Frontend | JavaScript, HTML, CSS |
| Index Storage | FAISS flat index (serialized to disk) |

---

## Getting Started

### Prerequisites

- Python 3.10+
- Azure Functions Core Tools
- Azure OpenAI resource with GPT-4o deployment
- Google Gemini API key

### Installation

```bash
git clone https://github.com/veeravn/llm-router.git
cd llm-router
pip install -r requirements.txt
```

### Configuration

Create a `local.settings.json` (not tracked in git):

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "AZURE_OPENAI_API_KEY": "<your-key>",
    "AZURE_OPENAI_ENDPOINT": "https://<your-resource>.openai.azure.com/",
    "AZURE_OPENAI_DEPLOYMENT": "gpt-4o",
    "GEMINI_API_KEY": "<your-key>"
  }
}
```

### Run Locally

```bash
func start
```

The HTTP trigger will be available at `http://localhost:7071/api/route`.

### Query the Router

```bash
curl -X POST http://localhost:7071/api/route \
  -H "Content-Type: application/json" \
  -d '{"query": "Explain the difference between TCP and UDP"}'
```

**Response:**
```json
{
  "model_used": "gpt-4o",
  "response": "...",
  "routing_reason": "complex_reasoning"
}
```

---

## Routing Logic

The FAISS index is built from labeled example queries representing different intent categories:

| Category | Routed To | Rationale |
|---|---|---|
| Complex reasoning / code | Azure OpenAI GPT-4o | Higher accuracy, better instruction following |
| Factual lookup / summarization | Gemini | Faster, lower cost for straightforward queries |
| Creative / open-ended | Azure OpenAI GPT-4o | Better generation quality |

To retrain the index with new examples, update the labeled dataset and re-run the embedding + indexing pipeline.

---

## Deployment

Deploy to Azure Functions:

```bash
func azure functionapp publish <your-function-app-name>
```

---

## Security

- Never commit `local.settings.json` or API keys to version control
- Use Azure Key Vault or Function App settings for production secrets
- The `.gitignore` excludes credential files by default

---

## Future Improvements

- Add latency-aware routing (fallback on timeout)
- Support additional backends (Anthropic Claude, Cohere)
- Persist routing decisions and model latency metrics for observability
- A/B testing framework for routing policy evaluation
