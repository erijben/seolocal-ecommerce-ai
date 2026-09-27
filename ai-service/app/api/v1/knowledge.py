from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    Query,
    status,
    File,
    Form,
    UploadFile,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.knowledge_document import KnowledgeDocument

from app.core.config import get_settings
from app.rag.indexing import (
    KnowledgeIndexingError,
    KnowledgeIndexingService,
)

from app.api.dependencies.auth import require_tenant
from app.core.database import get_db_session
from app.models.tenant import Tenant
from app.rag.search import SemanticSearchService
from app.schemas.rag import (
    KnowledgeDocumentIndexResponse,
    KnowledgeDocumentDeleteResponse,
    KnowledgeDocumentListResponse,
    KnowledgeDocumentSummaryResponse,
    KnowledgeSearchHitResponse,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
)


router = APIRouter(
    prefix="/knowledge",
    tags=["Knowledge Base"],
)


@router.post(
    "/search",
    response_model=KnowledgeSearchResponse,
    summary="Search the tenant knowledge base semantically",
)
async def search_knowledge_base(
    payload: KnowledgeSearchRequest,
    request: Request,
    tenant: Annotated[
        Tenant,
        Depends(require_tenant),
    ],
    session: Annotated[
        AsyncSession,
        Depends(get_db_session),
    ],
) -> KnowledgeSearchResponse:
    request_id = request.state.request_id

    result = await SemanticSearchService().search(
        session=session,
        tenant_id=tenant.id,
        query=payload.query,
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
                    or "semantic_search_unavailable"
                ),
                "message": (
                    "Semantic knowledge search is "
                    "temporarily unavailable."
                ),
            },
            headers={
                "X-Request-ID": request_id,
            },
        )

    return KnowledgeSearchResponse(
        status=result.status,
        hits=[
            KnowledgeSearchHitResponse(
                chunk_id=hit.chunk_id,
                document_id=hit.document_id,
                document_title=hit.document_title,
                chunk_index=hit.chunk_index,
                page_number=hit.page_number,
                content=hit.content,
                score=hit.score,
                distance=hit.distance,
            )
            for hit in result.hits
        ],
        provider=result.provider,
        model=result.model,
        error_code=None,
    )


#le tenant vient uniquement de la clé API ;
#le client ne peut pas choisir un tenant_id dans le formulaire ;
#la lecture est plafonnée à la limite configurée plus un octet ;
#le fichier est fermé même si la lecture échoue ;
#la signature PDF reste vérifiée par PdfExtractor ;
#les erreurs internes sont traduites sans exposer de stack trace ;
#les vecteurs et le contenu complet ne sont pas renvoyés.
  
@router.post(
    "/documents",
    response_model=KnowledgeDocumentIndexResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and index a tenant PDF document",
)
async def upload_knowledge_document(
    request: Request,
    file: Annotated[
        UploadFile,
        File(description="PDF document to index"),
    ],
    title: Annotated[
        str,
        Form(min_length=1, max_length=255),
    ],
    tenant: Annotated[
        Tenant,
        Depends(require_tenant),
    ],
    session: Annotated[
        AsyncSession,
        Depends(get_db_session),
    ],
    external_id: Annotated[
        str | None,
        Form(max_length=255),
    ] = None,
) -> KnowledgeDocumentIndexResponse:
    request_id = request.state.request_id

    settings = get_settings()

    try:
        pdf_bytes = await file.read(
            settings.rag_max_upload_bytes + 1
        )
    finally:
        await file.close()

    if len(pdf_bytes) > settings.rag_max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail={
                "code": "file_too_large",
                "message": (
                    "The PDF document exceeds the "
                    "configured upload limit."
                ),
            },
            headers={
                "X-Request-ID": request_id,
            },
        )

    normalized_external_id = (
        external_id.strip()
        if external_id is not None
        else None
    )

    if normalized_external_id == "":
        normalized_external_id = None

    try:
        result = await KnowledgeIndexingService().index_pdf(
            session=session,
            tenant_id=tenant.id,
            title=title,
            original_filename=(
                file.filename or "document.pdf"
            ),
            pdf_bytes=pdf_bytes,
            external_id=normalized_external_id,
            metadata={
                "uploaded_via": "api",
            },
            request_id=request_id,
        )

    except KnowledgeIndexingError as exception:
        error_code = exception.error_code

        if error_code in {
            "duplicate_document",
            "duplicate_external_id",
            "document_conflict",
        }:
            http_status = status.HTTP_409_CONFLICT
            message = (
                "This document is already indexed "
                "or conflicts with an existing document."
            )

        elif error_code.startswith("embedding_"):
            http_status = (
                status.HTTP_503_SERVICE_UNAVAILABLE
            )
            message = (
                "The embedding service is "
                "temporarily unavailable."
            )

        else:
            http_status = (
                status.HTTP_422_UNPROCESSABLE_CONTENT
            )
            message = (
                "The PDF document could not be indexed."
            )

        raise HTTPException(
            status_code=http_status,
            detail={
                "code": error_code,
                "message": message,
            },
            headers={
                "X-Request-ID": request_id,
            },
        ) from exception

    return KnowledgeDocumentIndexResponse(
        document_id=result.document_id,
        status="ready",
        chunks_count=result.chunks_count,
        pages_count=result.pages_count,
        provider=result.provider,
        model=result.model,
    )


@router.get(
    "/documents",
    response_model=KnowledgeDocumentListResponse,
    summary="List the authenticated tenant documents",
)
async def list_knowledge_documents(
    tenant: Annotated[
        Tenant,
        Depends(require_tenant),
    ],
    session: Annotated[
        AsyncSession,
        Depends(get_db_session),
    ],
    limit: Annotated[
        int,
        Query(ge=1, le=100),
    ] = 50,
    offset: Annotated[
        int,
        Query(ge=0),
    ] = 0,
) -> KnowledgeDocumentListResponse:
    total = await session.scalar(
        select(func.count())
        .select_from(KnowledgeDocument)
        .where(
            KnowledgeDocument.tenant_id == tenant.id
        )
    )

    documents = list(
        (
            await session.scalars(
                select(KnowledgeDocument)
                .where(
                    KnowledgeDocument.tenant_id
                    == tenant.id
                )
                .order_by(
                    KnowledgeDocument.created_at.desc()
                )
                .offset(offset)
                .limit(limit)
            )
        ).all()
    )

    return KnowledgeDocumentListResponse(
        documents=[
            KnowledgeDocumentSummaryResponse(
                document_id=document.id,
                external_id=document.external_id,
                title=document.title,
                original_filename=(
                    document.original_filename
                ),
                checksum_sha256=document.checksum_sha256,
                status=document.status,
                chunks_count=document.chunks_count,
                embedding_model=document.embedding_model,
                embedding_dimensions=(
                    document.embedding_dimensions
                ),
                error_message=document.error_message,
                indexed_at=document.indexed_at,
                created_at=document.created_at,
                updated_at=document.updated_at,
            )
            for document in documents
        ],
        total=int(total or 0),
    )

@router.delete(
    "/documents/{document_id}",
    response_model=KnowledgeDocumentDeleteResponse,
    summary="Delete a tenant knowledge document",
)
async def delete_knowledge_document(
    document_id: UUID,
    request: Request,
    tenant: Annotated[
        Tenant,
        Depends(require_tenant),
    ],
    session: Annotated[
        AsyncSession,
        Depends(get_db_session),
    ],
) -> KnowledgeDocumentDeleteResponse:
    request_id = request.state.request_id

    document = await session.scalar(
        select(KnowledgeDocument).where(
            KnowledgeDocument.id == document_id,
            KnowledgeDocument.tenant_id == tenant.id,
        )
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "document_not_found",
                "message": "Knowledge document not found.",
            },
            headers={
                "X-Request-ID": request_id,
            },
        )

    await session.delete(document)
    await session.commit()

    return KnowledgeDocumentDeleteResponse(
        document_id=document_id,
        status="deleted",
    )
