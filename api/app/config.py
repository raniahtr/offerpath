from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """App configuration, read from environment variables (names are case-insensitive)."""

    database_url: str
    # JSON list in the env, e.g. CORS_ORIGINS='["http://localhost:3000"]'
    cors_origins: list[str] = ["http://localhost:3000"]

    # Login tokens (JWTs) come from an external identity provider (Neon Auth today).
    # These are standard OpenID Connect values, so switching provider means changing env vars,
    # not code. The JWKS URL publishes the provider's *public* keys: not a secret.
    auth_jwks_url: str
    auth_issuer: str
    auth_audience: str
    # Algorithms accepted for token signatures. Never include "none" or HMAC (HS256) here:
    # with public-key verification, those would let anyone forge tokens.
    auth_algorithms: list[str] = ["EdDSA", "RS256", "ES256"]

    # LLM: any OpenAI-compatible chat API. Default is Groq's free tier; for local, offline
    # development Ollama works too (LLM_BASE_URL=http://host.docker.internal:11434/v1).
    # Empty key = AI features answer 503 "not configured"; everything else keeps working.
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_api_key: str = ""
    llm_model: str = "openai/gpt-oss-120b"
    # Reasoning models "think" before answering; "low" keeps that short (fewer tokens).
    # Empty for models that don't support the parameter.
    llm_reasoning_effort: str = "low"
    # Paid-for (or rate-limited) calls per user per rolling 24 h. Cache hits are free.
    llm_daily_limit_per_user: int = 20


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from the environment
