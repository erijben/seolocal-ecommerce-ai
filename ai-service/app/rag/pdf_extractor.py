#Ce composant :
#travaille en mémoire sans écrire le PDF sur disque ;
#contrôle taille, signature et nombre de pages ;
#refuse les PDF chiffrés ;
#conserve les vrais numéros de page ;
#calcule un checksum déterministe ;
#refuse silencieusement aucune page en erreur ;
#détecte les scans sans texte exploitable.

import hashlib
from dataclasses import dataclass
from io import BytesIO

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from app.core.config import Settings, get_settings
from app.rag.chunking import TextChunker


@dataclass(frozen=True)
class ExtractedPage:
    page_number: int
    text: str
    char_count: int


@dataclass(frozen=True)
class ExtractedPdf:
    checksum_sha256: str
    pages_count: int
    extracted_pages_count: int
    char_count: int
    pages: tuple[ExtractedPage, ...]


class PdfExtractionError(Exception):
    def __init__(self, error_code: str) -> None:
        self.error_code = error_code
        super().__init__(error_code)


class PdfExtractor:
    def __init__(
        self,
        settings: Settings | None = None,
    ) -> None:
        self.settings = settings or get_settings()

    def extract(self, pdf_bytes: bytes) -> ExtractedPdf:
        if not pdf_bytes:
            raise PdfExtractionError("empty_file")

        if (
            len(pdf_bytes)
            > self.settings.rag_max_upload_bytes
        ):
            raise PdfExtractionError("file_too_large")

        if b"%PDF-" not in pdf_bytes[:1024]:
            raise PdfExtractionError("invalid_pdf_signature")

        try:
            reader = PdfReader(
                BytesIO(pdf_bytes),
                strict=False,
            )
        except PdfReadError as exception:
            raise PdfExtractionError(
                "invalid_pdf"
            ) from exception

        if reader.is_encrypted:
            raise PdfExtractionError("encrypted_pdf")

        pages_count = len(reader.pages)

        if pages_count == 0:
            raise PdfExtractionError("empty_pdf")

        if pages_count > self.settings.rag_max_pdf_pages:
            raise PdfExtractionError("too_many_pages")

        extracted_pages: list[ExtractedPage] = []

        for page_index, page in enumerate(
            reader.pages,
            start=1,
        ):
            try:
                raw_text = page.extract_text() or ""
            except Exception as exception:
                raise PdfExtractionError(
                    "page_extraction_failed"
                ) from exception

            normalized_text = TextChunker.normalize(
                raw_text
            )

            if not normalized_text:
                continue

            extracted_pages.append(
                ExtractedPage(
                    page_number=page_index,
                    text=normalized_text,
                    char_count=len(normalized_text),
                )
            )

        total_char_count = sum(
            page.char_count
            for page in extracted_pages
        )

        if (
            total_char_count
            < self.settings.rag_min_extracted_chars
        ):
            raise PdfExtractionError(
                "insufficient_extractable_text"
            )

        return ExtractedPdf(
            checksum_sha256=hashlib.sha256(
                pdf_bytes
            ).hexdigest(),
            pages_count=pages_count,
            extracted_pages_count=len(extracted_pages),
            char_count=total_char_count,
            pages=tuple(extracted_pages),
        )