import azure.functions as func
from classify_function import app as classify_app

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

@app.route(route="classify", auth_level=func.AuthLevel.ANONYMOUS, methods=["POST"])
def classify_post(req: func.HttpRequest) -> func.HttpResponse:
    return classify_app(req)