from typing import Annotated
from app.schemas.assistant import (
    AssistantGenerationRequest,
    AssistantGenerationResponse,
)
from app.services.assistant_generation_service import (
    AssistantGenerationService,
)
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_tenant
from app.core.database import get_db_session
from app.models.tenant import Tenant
from app.rag.answering import RagAnswerService
from app.schemas.rag import (
    RagAnswerResponse,
    RagCitationResponse,
    RagQuestionRequest,
)


router = APIRouter(
    prefix="/assistant",
    tags=["AI Assistant"],
)


@router.post(
    "/ask",
    response_model=RagAnswerResponse,
    summary="Answer a question using the tenant knowledge base",
)
async def ask_rag_assistant(
    payload: RagQuestionRequest,
    request: Request,
    tenant: Annotated[
        Tenant,
        Depends(require_tenant),
    ],
    session: Annotated[
        AsyncSession,
        Depends(get_db_session),
    ],
) -> RagAnswerResponse:
    request_id = request.state.request_id

    result = await RagAnswerService().answer(
        session=session,
        tenant_id=tenant.id,
        question=payload.question,
        top_k=payload.top_k,
        min_score=payload.min_score,
        request_id=request_id,
    )

    if result.status == "error":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": (
                    result.error_code
                    or "rag_assistant_unavailable"
                ),
                "message": (
                    "The AI assistant is temporarily unavailable."
                ),
            },
            headers={
                "X-Request-ID": request_id,
            },
        )

    return RagAnswerResponse(
        status=result.status,
        answer=result.answer,
        citations=[
            RagCitationResponse(
                source_number=citation.source_number,
                document_id=citation.document_id,
                document_title=citation.document_title,
                page_number=citation.page_number,
                chunk_index=citation.chunk_index,
                score=citation.score,
            )
            for citation in result.citations
        ],
        retrieval_provider=result.retrieval_provider,
        retrieval_model=result.retrieval_model,
        llm_provider=result.llm_provider,
        llm_model=result.llm_model,
        error_code=result.error_code,
    )


@router.post(
    "/generate",
    response_model=AssistantGenerationResponse,
    summary="Generate an answer from verified business context",
)


async def generate_assistant_answer(
    payload: AssistantGenerationRequest,
    request: Request,
    tenant: Annotated[
        Tenant,
        Depends(require_tenant),
    ],
) -> AssistantGenerationResponse:
    request_id = request.state.request_id

    result = await AssistantGenerationService().generate(
        question=payload.question,
        context=payload.context,
        intent=payload.intent,
        request_id=request_id,
    )

    if result.status == "error":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": (
                    result.error_code
                    or "assistant_generation_unavailable"
                ),
                "message": (
                    "The AI generation service is temporarily "
                    "unavailable."
                ),
            },
            headers={
                "X-Request-ID": request_id,
            },
        )

    return AssistantGenerationResponse(
        status=result.status,
        answer=result.answer,
        llm_provider=result.llm_provider,
        llm_model=result.llm_model,
        error_code=result.error_code,
    )
