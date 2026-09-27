import unittest

from app.schemas.llm import LlmResult
from app.services.report_recommendation_service import (
    ReportRecommendationService,
)


CODES = (
    "PRIORITIZE_RESTOCK",
    "FOLLOW_ORDER_STATUSES",
    "ANALYZE_CANCELLATIONS",
    "RETAIN_IMPORTANT_CUSTOMERS",
)


class FakeManager:
    def __init__(self, result: LlmResult) -> None:
        self.result = result

    async def chat(self, messages, *, purpose, request_id=None):
        return self.result


def provider_result(
    content: str | None,
    *,
    status: str = "ok",
    error_code: str | None = None,
) -> LlmResult:
    return LlmResult(
        status=status,
        provider="ollama_cloud",
        model="gpt-oss:20b",
        content=content,
        error_code=error_code,
        latency_ms=1,
    )


class ReportRecommendationServiceTest(
    unittest.IsolatedAsyncioTestCase
):
    async def test_three_distinct_allowed_codes_are_accepted(self) -> None:
        result = await self.select(
            "\n\n" + "\n".join(CODES[:3]) + "\n\n"
        )

        self.assertEqual("ok", result.status)
        self.assertEqual(list(CODES[:3]), result.action_codes)

    async def test_code_order_is_preserved(self) -> None:
        expected = [CODES[2], CODES[0], CODES[3]]

        result = await self.select("\n".join(expected))

        self.assertEqual(expected, result.action_codes)

    async def test_two_codes_are_rejected(self) -> None:
        await self.assert_rejected("\n".join(CODES[:2]))

    async def test_four_codes_are_rejected(self) -> None:
        await self.assert_rejected("\n".join(CODES))

    async def test_unknown_code_is_rejected(self) -> None:
        await self.assert_rejected(
            "\n".join([CODES[0], "INVENT_REVENUE", CODES[1]])
        )

    async def test_duplicate_code_is_rejected(self) -> None:
        await self.assert_rejected(
            "\n".join([CODES[0], CODES[0], CODES[1]])
        )

    async def test_surrounding_text_is_rejected(self) -> None:
        await self.assert_rejected(
            "Voici les priorités :\n"
            + "\n".join(CODES[:3])
            + "\nFin des priorités."
        )

    async def test_bulleted_codes_are_rejected(self) -> None:
        await self.assert_rejected(
            "\n".join(f"- {code}" for code in CODES[:3])
        )

    async def test_empty_response_is_rejected(self) -> None:
        result = await self.select("")

        self.assertEqual("error", result.status)
        self.assertEqual([], result.action_codes)
        self.assertEqual(
            "report_generation_failed",
            result.error_code,
        )

    async def test_whitespace_response_is_rejected(self) -> None:
        await self.assert_rejected("   \n \n")

    async def test_provider_error_is_propagated(self) -> None:
        result = await self.select(
            None,
            status="error",
            error_code="provider_timeout",
        )

        self.assertEqual("error", result.status)
        self.assertEqual([], result.action_codes)
        self.assertEqual("provider_timeout", result.error_code)

    async def assert_rejected(self, content: str) -> None:
        result = await self.select(content)

        self.assertEqual("error", result.status)
        self.assertEqual([], result.action_codes)
        self.assertEqual(
            "invalid_report_action_codes",
            result.error_code,
        )

    async def select(
        self,
        content: str | None,
        *,
        status: str = "ok",
        error_code: str | None = None,
    ):
        service = ReportRecommendationService(
            FakeManager(
                provider_result(
                    content,
                    status=status,
                    error_code=error_code,
                )
            )
        )
        return await service.select_actions(
            report_type="sales_report",
            period="monthly",
            context="Contexte commercial vérifié.",
            request_id="report-test",
        )


if __name__ == "__main__":
    unittest.main()
