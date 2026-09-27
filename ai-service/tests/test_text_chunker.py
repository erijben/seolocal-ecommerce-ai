import hashlib
import unittest

from app.core.config import Settings
from app.rag.chunking import TextChunker
from app.rag.indexing import KnowledgeIndexingService
from app.rag.pdf_extractor import ExtractedPage


class FakeEmbeddingProvider:
    name = "fake"


class TextChunkerTest(unittest.TestCase):
    def settings(self, **overrides) -> Settings:
        defaults = {
            "rag_chunk_size_chars": 200,
            "rag_chunk_overlap_chars": 40,
            "rag_min_chunk_size_chars": 20,
        }
        defaults.update(overrides)
        return Settings(_env_file=None, **defaults)

    def chunker(self, **overrides) -> TextChunker:
        return TextChunker(self.settings(**overrides))

    def test_short_text_produces_one_chunk(self) -> None:
        chunks = self.chunker().split("Short useful text.")

        self.assertEqual(1, len(chunks))
        self.assertEqual(0, chunks[0].index)
        self.assertEqual("Short useful text.", chunks[0].content)
        self.assertEqual(len(chunks[0].content), chunks[0].char_count)

    def test_long_text_produces_ordered_bounded_chunks(self) -> None:
        text = " ".join(f"word{index}" for index in range(120))

        chunks = self.chunker().split(text)

        self.assertGreater(len(chunks), 1)
        self.assertEqual(list(range(len(chunks))), [c.index for c in chunks])
        self.assertTrue(all(c.content for c in chunks))
        self.assertTrue(all(c.char_count <= 200 for c in chunks))

    def test_overlap_is_applied_without_exceeding_maximum(self) -> None:
        first_paragraph = " ".join(["alpha"] * 25)
        second_paragraph = " ".join(["beta"] * 20)

        chunks = self.chunker().split(
            first_paragraph + "\n\n" + second_paragraph
        )

        self.assertEqual(2, len(chunks))
        self.assertTrue(chunks[1].content.startswith("alpha"))
        self.assertIn("\n\nbeta", chunks[1].content)
        self.assertLessEqual(chunks[1].char_count, 200)

    def test_hashes_and_indexes_are_deterministic(self) -> None:
        text = "Deterministic paragraph. " * 30

        first = self.chunker().split(text)
        second = self.chunker().split(text)

        self.assertEqual(first, second)
        for chunk in first:
            self.assertEqual(
                hashlib.sha256(chunk.content.encode("utf-8")).hexdigest(),
                chunk.content_hash,
            )

    def test_different_content_has_different_hash(self) -> None:
        first = self.chunker().split("First content")[0]
        second = self.chunker().split("Second content")[0]

        self.assertNotEqual(first.content_hash, second.content_hash)

    def test_empty_and_whitespace_text_produce_no_chunks(self) -> None:
        self.assertEqual([], self.chunker().split(""))
        self.assertEqual([], self.chunker().split(" \t\r\n "))

    def test_normalization_preserves_paragraphs_and_normalizes_unicode(self) -> None:
        normalized = TextChunker.normalize(
            "  Fullwidth: ＡＢＣ\t test  \r\n\r\n\r\n Next   line  "
        )

        self.assertEqual(
            "Fullwidth: ABC test\n\nNext line",
            normalized,
        )

    def test_invalid_overlap_and_minimum_sizes_are_rejected(self) -> None:
        with self.assertRaises(ValueError):
            self.chunker(rag_chunk_overlap_chars=200)

        with self.assertRaises(ValueError):
            self.chunker(rag_min_chunk_size_chars=201)

    def test_pages_stay_separate_and_keep_page_metadata(self) -> None:
        settings = self.settings()
        service = KnowledgeIndexingService(
            settings=settings,
            embedding_provider=FakeEmbeddingProvider(),
        )
        pages = (
            ExtractedPage(1, "First page", 10),
            ExtractedPage(3, "Third page", 10),
        )

        chunks = service._prepare_chunks(pages)

        self.assertEqual([0, 1], [chunk.index for chunk in chunks])
        self.assertEqual([1, 3], [chunk.page_number for chunk in chunks])
        self.assertEqual(
            ["First page", "Third page"],
            [chunk.content for chunk in chunks],
        )


if __name__ == "__main__":
    unittest.main()
