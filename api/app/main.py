from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import applications, cv, me, postings
from app.services.llm import LlmInvalidOutputError, LlmNotConfiguredError, LlmUnavailableError
from app.services.quota import QuotaExceededError

app = FastAPI(title="Offerpath API")

# Allow the Next.js frontend (a different origin/port) to call this API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    # Lets the browser read Retry-After on 429/503, to show "try again in N s".
    expose_headers=["Retry-After"],
)

app.include_router(applications.router)
app.include_router(cv.router)
app.include_router(postings.router)
app.include_router(me.router)


# AI failures -> clear HTTP answers, so every AI endpoint behaves the same way.
@app.exception_handler(QuotaExceededError)
def quota_exceeded(_: Request, error: QuotaExceededError) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "detail": f"You reached today's limit of {error.limit} AI requests. "
            "Try again tomorrow, or use your own chat (copy the prompt)."
        },
    )


@app.exception_handler(LlmNotConfiguredError)
def llm_not_configured(_: Request, __: LlmNotConfiguredError) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"detail": "AI is not configured on this server. Use your own chat instead."},
    )


@app.exception_handler(LlmUnavailableError)
def llm_unavailable(_: Request, error: LlmUnavailableError) -> JSONResponse:
    wait = f" in {error.retry_after} s" if error.retry_after else " shortly"
    headers = {"Retry-After": str(error.retry_after)} if error.retry_after else None
    return JSONResponse(
        status_code=503,
        content={"detail": f"The AI service is busy. Try again{wait}."},
        headers=headers,
    )


@app.exception_handler(LlmInvalidOutputError)
def llm_invalid_output(_: Request, __: LlmInvalidOutputError) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"detail": "The AI returned an unusable answer twice. Please try again."},
    )


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness check used by Docker and the hosting platform."""
    return {"status": "ok"}
