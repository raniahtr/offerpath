"""Who is calling? Verifies the login token on each request and returns the user's id.

The frontend signs users in with the identity provider and sends the short-lived token it
receives as `Authorization: Bearer <token>`. We check the signature against the provider's
public keys (JWKS), plus expiry, issuer and audience. The API never sees passwords.
"""

import logging
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

# auto_error=False: we raise our own 401 (with the WWW-Authenticate header the spec asks for)
# instead of FastAPI's default 403 when the header is missing.
_bearer = HTTPBearer(auto_error=False)

logger = logging.getLogger(__name__)


@lru_cache
def get_jwks_client() -> jwt.PyJWKClient:
    # Caches the public keys in memory, and refetches when a token names an unknown key id
    # (the provider rotated its keys), so normal requests make no extra network call.
    # timeout: fail fast (503) rather than hold a request for PyJWT's default 30 s.
    return jwt.PyJWKClient(get_settings().auth_jwks_url, cache_keys=True, lifespan=3600, timeout=5)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> str:
    """FastAPI dependency: the verified user id (the token's `sub` claim), or 401."""
    if credentials is None:
        raise _unauthorized("Not signed in")

    settings = get_settings()
    token = credentials.credentials
    try:
        signing_key = get_jwks_client().get_signing_key_from_jwt(token)
    except jwt.PyJWKClientConnectionError as error:
        # The provider is unreachable: our problem, not the caller's, so not a 401.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sign-in service unavailable, try again shortly",
        ) from error
    except jwt.PyJWTError as error:
        logger.warning("Rejected token: %s", error)
        raise _unauthorized("Invalid token") from error

    try:
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=settings.auth_algorithms,
            issuer=settings.auth_issuer,
            audience=settings.auth_audience,
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.ExpiredSignatureError as error:
        raise _unauthorized("Token expired") from error
    except jwt.PyJWTError as error:
        # Never echo the reason (bad signature, wrong issuer...) in detail: it helps attackers.
        # Log it instead, for us. PyJWT's messages describe the claim, never the token itself.
        logger.warning("Rejected token: %s", error)
        raise _unauthorized("Invalid token") from error

    user_id = claims["sub"]
    if not isinstance(user_id, str) or not user_id:
        raise _unauthorized("Invalid token")
    return user_id


CurrentUserId = Annotated[str, Depends(current_user_id)]
