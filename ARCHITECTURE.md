# LLM Router — Architecture

## Overview

LLM Router is a **semantic dispatch layer** for multi-model LLM inference. It intercepts queries at the API boundary, classifies intent using embedding-based nearest-neighbor search, and routes to the most appropriate backend model — optimizing for quality, cost, and latency without requiring callers to manage model selection.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client / UI                                │
│                   (Browser  ·  REST Client)                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │  HTTP POST /api/route
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Azure Functions                                 │
│                     function_app.py                                 │
│                                                                     │
│   1. Receive query                                                  │
│   2. Validate & sanitize input                                      │
│   3. Forward to classifier                                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Semantic Classifier                              │
│                   classify_function.py                              │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  1. Embed query                                             │  │
│   │     sentence-transformers → dense vector (384d)            │  │
│   │                                                             │  │
│   │  2. FAISS nearest-neighbor search                          │  │
│   │     faiss_index/ → top-k similar labeled examples          │  │
│   │                                                             │  │
│   │  3. Majority-vote classification                           │  │
│   │     → intent label (complex / factual / creative / code)   │  │
│   └─────────────────────────────────────────────────────────────┘  │
└──────────────┬───────────────────────────┬──────────────────────────┘
               │                           │
     complex / creative              factual / summarization
     code generation                 simple Q&A
               │                           │
               ▼                           ▼
┌──────────────────────────┐   ┌──────────────────────────────────────┐
│   Azure OpenAI Service   │   │         Gemini Service               │
│   openai_service.py      │   │         gemini_service.py            │
│                          │   │                                      │
│   Model: GPT-4o          │   │   Model: Gemini Pro                  │
│   Endpoint: Azure        │   │   API: Google AI Studio              │
│   Strengths:             │   │   Strengths:                         │
│   · Complex reasoning    │   │   · Fast factual retrieval           │
│   · Code generation      │   │   · Cost-efficient                   │
│   · Instruction follow   │   │   · Low latency                      │
└──────────────┬───────────┘   └────────────────┬─────────────────────┘
               │                                │
               └────────────────┬───────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Unified Response     │
                    │  {                    │
                    │    model_used,        │
                    │    response,          │
                    │    routing_reason     │
                    │  }                    │
                    └───────────┬───────────┘
                                │
                                ▼
                           Client / UI
```

---

## Component Breakdown

### 1. Azure Functions Entry Point (`function_app.py`)

The HTTP trigger is the single entry point for all routing requests. It handles:
- Request parsing and input validation
- Invoking the classifier
- Selecting and calling the appropriate LLM service
- Returning a unified response envelope

**Why Azure Functions?** Serverless deployment means zero infrastructure management, automatic scaling, and pay-per-invocation cost — well suited for an inference routing layer with variable traffic.

---

### 2. Semantic Classifier (`classify_function.py`)

The core routing intelligence. Two-stage process:

**Stage 1 — Embedding**
The incoming query is converted to a dense vector using a sentence-transformer model. This captures semantic meaning rather than relying on keyword matching, so "write a Python function to sort a list" and "help me code a binary search" are recognized as the same intent type.

**Stage 2 — FAISS Nearest-Neighbor Search**
The query embedding is compared against a pre-built FAISS flat index of labeled example queries. The top-k nearest neighbors are retrieved, and the plurality label becomes the routing decision.

```
query string
    → sentence-transformer
    → 384-dim embedding
    → FAISS.search(k=5)
    → [label_1, label_2, label_3, label_4, label_5]
    → majority vote
    → routing_intent
```

**Why FAISS?** It provides sub-millisecond nearest-neighbor search even at scale, adding negligible latency overhead to the overall routing decision.

---

### 3. FAISS Index (`faiss_index/`)

A serialized flat index built offline from a labeled set of example queries. Each query category is represented by multiple embedding examples to provide robust classification boundaries.

To update the routing behavior, add new labeled examples and rebuild the index — no model retraining required.

---

### 4. LLM Services (`services/`)

Thin wrappers around each backend API. Each service handles:
- API authentication
- Request formatting for that provider's API contract
- Response normalization back to the unified format

This abstraction means adding a new backend (e.g. Anthropic Claude) requires only a new service file and a routing rule — the rest of the system is unchanged.

---

### 5. Frontend UI (`ui/`)

A lightweight browser interface for querying the router directly. Implemented in vanilla JavaScript — no framework dependencies — calling the Azure Functions endpoint and rendering model responses with routing metadata visible to the user.

---

## Data Flow

```
1. Client sends POST {"query": "..."} to /api/route
2. function_app.py receives and validates
3. classify_function.py embeds the query
4. FAISS returns top-5 nearest labeled examples
5. Majority vote determines intent category
6. Router selects backend service based on intent → cost → latency priority
7. LLM service sends request to provider API
8. Response normalized to unified schema
9. {"model_used": "...", "response": "...", "routing_reason": "..."} returned
```

---

## Routing Decision Matrix

| Intent | Primary Model | Fallback | Reasoning |
|---|---|---|---|
| Complex reasoning | GPT-4o | Gemini Pro | GPT-4o consistently outperforms on multi-step reasoning |
| Code generation | GPT-4o | GPT-4o | No fallback — code quality is non-negotiable |
| Factual lookup | Gemini Pro | GPT-4o | Gemini is faster and cheaper for straightforward retrieval |
| Summarization | Gemini Pro | GPT-4o | Latency-sensitive; Gemini handles well |
| Creative writing | GPT-4o | Gemini Pro | GPT-4o produces higher quality open-ended generation |

---

## Latency Profile

| Step | Typical Latency |
|---|---|
| Input validation | < 1ms |
| Embedding (sentence-transformer) | ~15–30ms |
| FAISS search (k=5) | < 1ms |
| LLM API call (GPT-4o) | 800ms – 3s |
| LLM API call (Gemini) | 400ms – 1.5s |
| **Total (routed to Gemini)** | **~450ms – 1.6s** |
| **Total (routed to GPT-4o)** | **~850ms – 3.1s** |

The routing overhead (embedding + FAISS) adds less than 35ms — negligible relative to LLM API latency.

---

## Scalability

Azure Functions scales horizontally on demand. The FAISS index is loaded into memory at cold start and reused across warm invocations. For high-throughput deployments, the index can be moved to a shared cache (Redis) to eliminate per-instance cold start loading.

---

## Security

- API keys stored in Azure Function App settings (not in code)
- `local.settings.json` excluded from version control via `.gitignore`
- No query content is logged or persisted by default
- HTTPS enforced by Azure Functions runtime

---

## Future Architecture Considerations

- **Latency-aware routing**: measure rolling p95 latency per backend and factor into routing decisions dynamically
- **Feedback loop**: capture user ratings and use them to refine routing boundaries over time
- **Observability**: emit routing decisions, model latencies, and token counts to Application Insights for dashboarding
- **Multi-region**: deploy function apps in multiple Azure regions for lower global latency
- **Streaming responses**: pipe LLM streaming tokens directly to the client rather than buffering the full response
