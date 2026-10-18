"""The real provider client, against a fake HTTP server (httpx2 MockTransport): checks what
we send and how provider errors are mapped. No network involved."""

import json

import httpx2
import pytest

from app.schemas.fit import FitResult
from app.services.llm import LlmUnavailableError, OpenAICompatibleClient
from tests.fake_data import FIT_JSON


def _client(handler, reasoning_effort: str | None = "low") -> OpenAICompatibleClient:
    return OpenAICompatibleClient(
        base_url="https://llm.test/v1",
        api_key="test-key",
        model="test-model",
        reasoning_effort=reasoning_effort,
        max_retries=0,
        http_client=httpx2.Client(transport=httpx2.MockTransport(handler)),
    )


def _ok(request: httpx2.Request) -> httpx2.Response:
    return httpx2.Response(
        200,
        json={
            "id": "x",
            "object": "chat.completion",
            "created": 0,
            "model": "test-model",
            "choices": [
                {
                    "index": 0,
                    "finish_reason": "stop",
                    "message": {"role": "assistant", "content": FIT_JSON},
                }
            ],
            "usage": {"prompt_tokens": 300, "completion_tokens": 60, "total_tokens": 360},
        },
    )


def test_request_asks_for_strict_schema_json() -> None:
    sent: list[dict] = []

    def handler(request: httpx2.Request) -> httpx2.Response:
        sent.append(json.loads(request.content))
        return _ok(request)

    completion = _client(handler).complete([{"role": "user", "content": "hi"}], FitResult)

    body = sent[0]
    assert body["model"] == "test-model"
    assert body["reasoning_effort"] == "low"
    assert body["response_format"]["type"] == "json_schema"
    assert body["response_format"]["json_schema"]["strict"] is True
    schema = body["response_format"]["json_schema"]["schema"]
    assert schema["additionalProperties"] is False
    assert (completion.input_tokens, completion.output_tokens) == (300, 60)
    assert FitResult.model_validate_json(completion.text).score == 72


def test_reasoning_effort_can_be_left_out() -> None:
    sent: list[dict] = []

    def handler(request: httpx2.Request) -> httpx2.Response:
        sent.append(json.loads(request.content))
        return _ok(request)

    _client(handler, reasoning_effort=None).complete([{"role": "user", "content": "hi"}], FitResult)

    assert "reasoning_effort" not in sent[0]


@pytest.mark.parametrize(
    ("status", "headers", "retry_after"),
    [(429, {"retry-after": "7"}, 7), (429, {}, None), (500, {}, None), (401, {}, None)],
)
def test_provider_errors_become_unavailable(
    status: int, headers: dict[str, str], retry_after: int | None
) -> None:
    client = _client(lambda r: httpx2.Response(status, headers=headers, json={"error": {}}))

    with pytest.raises(LlmUnavailableError) as error:
        client.complete([{"role": "user", "content": "hi"}], FitResult)
    assert error.value.retry_after == retry_after


def test_unreachable_provider_is_unavailable() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        raise httpx2.ConnectError("down", request=request)

    with pytest.raises(LlmUnavailableError):
        _client(handler).complete([{"role": "user", "content": "hi"}], FitResult)
