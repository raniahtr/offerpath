from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import applications

app = FastAPI(title="Offerpath API")

# Allow the Next.js frontend (a different origin/port) to call this API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(applications.router)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness check used by Docker and the hosting platform."""
    return {"status": "ok"}
