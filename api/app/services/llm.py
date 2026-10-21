"""Structured LLM calls through any OpenAI-compatible chat API (Groq by default).

Every answer must parse into a Pydantic schema. An invalid answer is retried once with the
validation error, then rejected. Nothing here logs prompts or answers: they contain CVs.
"""

import logging
from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

import httpx2
import openai
from pydantic import BaseModel, ValidationError

from app.config import get_settings

logger = logging.getLogger(__name__)


class LlmNotConfiguredError(Exception):
    """No API key: AI features are switched off on this server."""


class LlmUnavailableError(Exception):
    """Provider busy (rate limit), down or unreachable. Not the user's fault: try later."""

    def __init__(self, retry_after: int | None = None) -> None:
        super().__init__("LLM provider unavailable")
        self.retry_after = retry_after


class LlmInvalidOutputError(Exception):
    """The answer still didn't match the schema after one retry."""


@dataclass(frozen=True)
class Completion:
    text: str
    input_tokens: int
    output_tokens: int


class LlmClient(Protocol):
    model: str

    def complete(self, messages: list[dict[str, str]], schema: type[BaseModel]) -> Completion: ...


class OpenAICompatibleClient:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        reasoning_effort: str | None,
        max_retries: int = 2,
        http_client: httpx2.Client | None = None,  # tests pass a fake transport
    ) -> None:
        # max_retries: the SDK itself waits and retries on 429/5xx, honouring Retry-After.
        self._client = openai.OpenAI(
            base_url=base_url,
            api_key=api_key,
            timeout=60,
            max_retries=max_retries,
            http_client=http_client,
        )
        self.model = model
        self._extra = {"reasoning_effort": reasoning_effort} if reasoning_effort else {}

    def complete(self, messages: list[dict[str, str]], schema: type[BaseModel]) -> Completion:
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=messages,  # type: ignore[arg-type]  # plain role/content dicts
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": schema.__name__,
                        "strict": True,
                        "schema": schema.model_json_schema(),
                    },
                },
                extra_body=self._extra,
            )
        except openai.RateLimitError as error:
            raise LlmUnavailableError(_retry_after(error.response)) from error
        except (openai.APIConnectionError, openai.InternalServerError) as error:
            raise LlmUnavailableError() from error
        except openai.APIStatusError as error:
            # 401 (bad key), 400 (schema rejected)...: our configuration, so log it for us.
            logger.error("LLM provider rejected the request: HTTP %s", error.status_code)
            raise LlmUnavailableError() from error

        usage = response.usage
        return Completion(
            text=response.choices[0].message.content or "",
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
        )


def _retry_after(response: object) -> int | None:
    value = getattr(response, "headers", {}).get("retry-after")
    try:
        return max(1, round(float(value))) if value else None
    except ValueError:
        return None


@lru_cache
def _default_client() -> OpenAICompatibleClient:
    settings = get_settings()
    return OpenAICompatibleClient(
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key,
        model=settings.llm_model,
        reasoning_effort=settings.llm_reasoning_effort or None,
    )


def get_llm_client() -> LlmClient:
    """FastAPI dependency (tests override it with a fake, so they never call a real API)."""
    if not get_settings().llm_api_key:
        raise LlmNotConfiguredError()
    return _default_client()


def generate[T: BaseModel](
    client: LlmClient,
    *,
    system: str,
    user: str,
    schema: type[T],
    on_call: Callable[[Completion], None],
) -> T:
    """Ask for a `schema`-shaped answer; retry once on invalid output. `on_call` sees every
    provider call (also failed ones), so usage limits count what was really consumed."""
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    for attempt in range(2):
        completion = client.complete(messages, schema)
        on_call(completion)
        try:
            return schema.model_validate_json(completion.text)
        except ValidationError as error:
            if attempt == 1:
                raise LlmInvalidOutputError() from error
            # Show the model its own answer and what was wrong with it (no CV text in errors).
            problems = "; ".join(
                f"{'.'.join(map(str, e['loc'])) or 'answer'}: {e['msg']}" for e in error.errors()
            )
            messages += [
                {"role": "assistant", "content": completion.text},
                {
                    "role": "user",
                    "content": f"That answer was invalid ({problems}). "
                    "Reply again with only a JSON object that matches the schema.",
                },
            ]
    raise AssertionError("unreachable")
