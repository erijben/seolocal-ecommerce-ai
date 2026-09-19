from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import (
    JSONB,
    UUID as PostgreSQLUUID,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


if TYPE_CHECKING:
    from app.models.knowledge_chunk import KnowledgeChunk
    from app.models.tenant import Tenant


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"
    __table_args__ = (
        CheckConstraint(
            "status IN "
            "('pending', 'processing', 'ready', 'failed', 'inactive')",
            name="ck_knowledge_documents_status",
        ),
        CheckConstraint(
            "source_type IN ('pdf', 'text', 'url')",
            name="ck_knowledge_documents_source_type",
        ),
        CheckConstraint(
            "chunks_count >= 0",
            name="ck_knowledge_documents_chunks_count",
        ),
        UniqueConstraint(
            "tenant_id",
            "external_id",
            name="uq_knowledge_documents_tenant_external_id",
        ),
        UniqueConstraint(
            "tenant_id",
            "checksum_sha256",
            name="uq_knowledge_documents_tenant_checksum",
        ),
        UniqueConstraint(
            "id",
            "tenant_id",
            name="uq_knowledge_documents_id_tenant",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    tenant_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_id: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    original_filename: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    source_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pdf",
        server_default="pdf",
    )
    source_uri: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    mime_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    checksum_sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        server_default="pending",
        index=True,
    )
    chunks_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    embedding_model: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    embedding_dimensions: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    metadata_json: Mapped[dict[str, object]] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    indexed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    tenant: Mapped["Tenant"] = relationship(
        back_populates="knowledge_documents",
    )
    chunks: Mapped[list["KnowledgeChunk"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="KnowledgeChunk.chunk_index",
    )