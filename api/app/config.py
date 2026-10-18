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


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from the environment
