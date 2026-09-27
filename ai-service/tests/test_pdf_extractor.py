import hashlib
from io import BytesIO
import unittest

from pypdf import PdfWriter

from app.core.config import Settings
from app.rag.pdf_extractor import (
    PdfExtractionError,
    PdfExtractor,
)


def text_pdf(page_texts: list[str | None]) -> bytes:
    page_object_numbers: list[tuple[int, int]] = []
    next_object = 3

    for _ in page_texts:
        page_object_numbers.append(
            (next_object, next_object + 1)
        )
        next_object += 2

    font_object_number = next_object
    kids = " ".join(
        f"{page_number} 0 R"
        for page_number, _ in page_object_numbers
    )
    objects: list[bytes] = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        (
            f"<< /Type /Pages /Kids [{kids}] "
            f"/Count {len(page_texts)} >>"
        ).encode("ascii"),
    ]

    for text, (page_number, content_number) in zip(
        page_texts,
        page_object_numbers,
        strict=True,
    ):
        del page_number, content_number
        objects.append(
            (
                "<< /Type /Page /Parent 2 0 R "
                "/MediaBox [0 0 612 792] "
                "/Resources << /Font << "
                f"/F1 {font_object_number} 0 R "
                ">> >> /Contents "
                f"{len(objects) + 2} 0 R >>"
            ).encode("ascii")
        )
        escaped = (
            (text or "")
            .replace("\\", "\\\\")
            .replace("(", "\\(")
            .replace(")", "\\)")
        )
        stream = (
            f"BT /F1 12 Tf 72 720 Td ({escaped}) Tj ET"
            if text
            else ""
        ).encode("latin-1")
        objects.append(
            b"<< /Length "
            + str(len(stream)).encode("ascii")
            + b" >>\nstream\n"
            + stream
            + b"\nendstream"
        )

    objects.append(
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    )

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]

    for object_number, body in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{object_number} 0 obj\n".encode("ascii"))
        pdf.extend(body)
        pdf.extend(b"\nendobj\n")

    xref_offset = len(pdf)
    pdf.extend(
        f"xref\n0 {len(objects) + 1}\n".encode("ascii")
    )
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        (
            f"trailer\n<< /Size {len(objects) + 1} "
            "/Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        ).encode("ascii")
    )

    return bytes(pdf)


def encrypted_pdf() -> bytes:
    output = BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.encrypt("secret")
    writer.write(output)
    return output.getvalue()


def blank_pdf() -> bytes:
    output = BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.write(output)
    return output.getvalue()


class PdfExtractorTest(unittest.TestCase):
    def settings(self, **overrides) -> Settings:
        return Settings(
            _env_file=None,
            rag_min_extracted_chars=1,
            **overrides,
        )

    def assert_error(
        self,
        expected_code: str,
        pdf_bytes: bytes,
        settings: Settings | None = None,
    ) -> None:
        with self.assertRaises(PdfExtractionError) as context:
            PdfExtractor(settings or self.settings()).extract(pdf_bytes)

        self.assertEqual(expected_code, context.exception.error_code)

    def test_valid_pdf_extracts_normalized_text_and_checksum(self) -> None:
        pdf_bytes = text_pdf(["Hello     world"])

        result = PdfExtractor(self.settings()).extract(pdf_bytes)

        self.assertEqual(1, result.pages_count)
        self.assertEqual(1, result.extracted_pages_count)
        self.assertEqual("Hello world", result.pages[0].text)
        self.assertEqual(1, result.pages[0].page_number)
        self.assertEqual(len("Hello world"), result.char_count)
        self.assertEqual(
            hashlib.sha256(pdf_bytes).hexdigest(),
            result.checksum_sha256,
        )

    def test_multipage_pdf_preserves_original_page_numbers(self) -> None:
        pdf_bytes = text_pdf([
            "First page text",
            None,
            "Third page text",
        ])

        result = PdfExtractor(self.settings()).extract(pdf_bytes)

        self.assertEqual(3, result.pages_count)
        self.assertEqual(2, result.extracted_pages_count)
        self.assertEqual([1, 3], [page.page_number for page in result.pages])
        self.assertEqual(
            ["First page text", "Third page text"],
            [page.text for page in result.pages],
        )

    def test_corrupted_pdf_is_rejected(self) -> None:
        self.assert_error("invalid_pdf", b"%PDF-1.4\nbroken")

    def test_non_pdf_file_is_rejected(self) -> None:
        self.assert_error(
            "invalid_pdf_signature",
            b"This is not a PDF file.",
        )

    def test_encrypted_pdf_is_rejected(self) -> None:
        self.assert_error("encrypted_pdf", encrypted_pdf())

    def test_pdf_without_extractable_text_is_rejected(self) -> None:
        self.assert_error(
            "insufficient_extractable_text",
            blank_pdf(),
        )

    def test_upload_size_limit_is_enforced(self) -> None:
        oversized = text_pdf(["Text"]) + (b"x" * 2048)
        self.assert_error(
            "file_too_large",
            oversized,
            self.settings(rag_max_upload_bytes=1024),
        )

    def test_page_count_limit_is_enforced(self) -> None:
        self.assert_error(
            "too_many_pages",
            text_pdf(["Page one", "Page two"]),
            self.settings(rag_max_pdf_pages=1),
        )


if __name__ == "__main__":
    unittest.main()
