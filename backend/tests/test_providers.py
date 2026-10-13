import pytest

from app.llm.providers import _gemini_error


class FakeRateLimit(Exception):
    status_code = 429


class FakeOverloaded(Exception):
    def __init__(self) -> None:
        super().__init__("high demand")
        self.code = 503


@pytest.mark.parametrize(
    ("error", "benched", "retryable"),
    [
        (FakeRateLimit(), True, False),  # Interactions API style (status_code)
        (FakeOverloaded(), True, False),  # classic SDK style (code)
        (TimeoutError(), True, False),  # timed out: bench, move on
        (ConnectionResetError(), False, True),  # no status: transient
    ],
)
def test_gemini_errors_map_to_failover(error, benched, retryable):
    mapped = _gemini_error("gemini/test", error)
    assert bool(mapped.bench_seconds) is benched
    assert mapped.retryable is retryable


async def test_router_enforces_wall_clock_deadline(monkeypatch):
    import asyncio

    from pydantic import BaseModel

    from app.core.errors import LlmUnavailableError
    from app.llm import router

    class Slow:
        name, model = "slow", "slow-model"

        async def generate_json(self, *args, **kwargs):
            await asyncio.sleep(10)

    class Answer(BaseModel):
        ok: bool

    monkeypatch.setattr(router.settings, "llm_timeout_seconds", 0.05)
    monkeypatch.setattr(router, "_providers", [Slow()])
    router._benched_until.clear()
    try:
        await router.generate(Answer, system="s", user="u")
        raise AssertionError("expected failover error")
    except LlmUnavailableError as e:
        assert "exceeded" in e.detail
    finally:
        router._benched_until.clear()
        router._providers = None
