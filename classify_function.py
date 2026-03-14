# llm_selector/classify_function.py

from azure.functions import HttpRequest, HttpResponse
import logging
import json
from services.classifier import classify_prompt
from services.dispatcher import dispatch
from services.retriever import retrieve_docs

def app(req: HttpRequest) -> HttpResponse:
    """
    Azure Function entry point (Python v2 model).
    Accepts POST requests with a JSON payload containing 'prompt'.
    Classifies the prompt, performs optional retrieval, and dispatches to the best LLM.
    """
    try:
        body = req.get_json()
        prompt = body.get("prompt")
        if not prompt:
            return HttpResponse("Missing 'prompt' in request", status_code=400)

        # Step 1: classify prompt
        category = classify_prompt(prompt)

        # Step 2 (optional): retrieve supporting documents
        docs = retrieve_docs(prompt)
        if docs:
            prompt = "\n".join(docs) + "\n" + prompt

        # Step 3: dispatch to appropriate model
        response = dispatch(prompt, category)

        return HttpResponse(
            json.dumps({
                "category": category,
                "response": response
            }),
            mimetype="application/json",
            status_code=200
        )

    except Exception as e:
        logging.exception("Error handling prompt classification")
        return HttpResponse(
            json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )
