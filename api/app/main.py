from fastapi import FastAPI

app = FastAPI(title="Offerpath API")


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness check used by Docker and the hosting platform."""
    return {"status": "ok"}
