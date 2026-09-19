from typing import Annotated
from uuid import uuid4


from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Response,
    status,
)
from app.api.dependencies.auth import require_tenant
from app.models.tenant import Tenant
from app.schemas.reports import (
    ReportRecommendationRequest,
    ReportRecommendationResponse,
)
from app.services.report_recommendation_service import (
    ReportRecommendationService,
)


router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
)


@router.post(
    "/recommendations",
    response_model=ReportRecommendationResponse,
    summary="Select report recommendation actions",
)
async def select_report_recommendations(
    payload: ReportRecommendationRequest,
    tenant: Annotated[
        Tenant,
        Depends(require_tenant),
    ],
    response: Response,
    request_id: Annotated[
        str | None,
        Header(alias="X-Request-ID"),
    ] = None,
) -> ReportRecommendationResponse:
    del tenant

    resolved_request_id = request_id or str(uuid4())
    response.headers["X-Request-ID"] = resolved_request_id
    result = await ReportRecommendationService().select_actions(
        report_type=payload.report_type,
        period=payload.period,
        context=payload.context,
        request_id=resolved_request_id,
    )

    if result.status != "ok":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": (
                    result.error_code
                    or "report_recommendation_failed"
                ),
                "message": (
                    "The AI engine could not generate "
                    "report recommendations."
                ),
            },
            headers={
                "X-Request-ID": resolved_request_id,
            },
        )

    return ReportRecommendationResponse(
        status="ok",
        action_codes=result.action_codes,
        llm_provider=result.llm_provider,
        llm_model=result.llm_model,
        error_code=None,
    )