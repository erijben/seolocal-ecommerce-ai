from typing import Literal

from pydantic import BaseModel, Field


ReportType = Literal[
    "sales_report",
    "stock_recommendation",
    "customer_analysis",
    "marketing_recommendation",
]

ReportPeriod = Literal[
    "daily",
    "weekly",
    "monthly",
    "yearly",
]

ReportActionCode = Literal[
    "PRIORITIZE_RESTOCK",
    "FOLLOW_ORDER_STATUSES",
    "ANALYZE_CANCELLATIONS",
    "RETAIN_IMPORTANT_CUSTOMERS",
]

ReportRecommendationStatus = Literal["ok", "error"]


class ReportRecommendationRequest(BaseModel):
    report_type: ReportType
    period: ReportPeriod
    context: str = Field(
        min_length=1,
        max_length=30000,
    )


class ReportRecommendationResponse(BaseModel):
    status: ReportRecommendationStatus
    action_codes: list[ReportActionCode] = Field(
        default_factory=list,
        min_length=0,
        max_length=3,
    )
    llm_provider: str
    llm_model: str
    error_code: str | None = None