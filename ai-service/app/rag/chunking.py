#Ce découpeur :normalise Unicode et espaces ;
#privilégie paragraphes puis phrases ;
#évite de couper au milieu des mots ;
#ajoute un chevauchement ;
#ne supprime jamais un petit passage final ;
#génère un hash déterministe pour chaque passage ;
#ne dépend d’aucune bibliothèque lourde.

import hashlib
import re
import unicodedata
from dataclasses import dataclass

from app.core.config import Settings, get_settings


@dataclass(frozen=True)
class TextChunk:
    index: int
    content: str
    content_hash: str
    char_count: int


class TextChunker:
    def __init__(
        self,
        settings: Settings | None = None,
    ) -> None:
        self.settings = settings or get_settings()

        if (
            self.settings.rag_chunk_overlap_chars
            >= self.settings.rag_chunk_size_chars
        ):
            raise ValueError(
                "RAG chunk overlap must be smaller "
                "than the chunk size."
            )

        if (
            self.settings.rag_min_chunk_size_chars
            > self.settings.rag_chunk_size_chars
        ):
            raise ValueError(
                "RAG minimum chunk size cannot exceed "
                "the chunk size."
            )

    def split(self, raw_text: str) -> list[TextChunk]:
        normalized_text = self.normalize(raw_text)

        if not normalized_text:
            return []

        units = self._build_semantic_units(
            normalized_text
        )
        raw_chunks = self._pack_units(units)
        raw_chunks = self._merge_small_final_chunk(
            raw_chunks
        )

        return [
            TextChunk(
                index=index,
                content=content,
                content_hash=hashlib.sha256(
                    content.encode("utf-8")
                ).hexdigest(),
                char_count=len(content),
            )
            for index, content in enumerate(raw_chunks)
        ]

    @staticmethod
    def normalize(raw_text: str) -> str:
        text = unicodedata.normalize(
            "NFKC",
            raw_text or "",
        )
        text = text.replace("\r\n", "\n")
        text = text.replace("\r", "\n")

        normalized_lines = [
            re.sub(r"[ \t]+", " ", line).strip()
            for line in text.split("\n")
        ]

        text = "\n".join(normalized_lines)
        text = re.sub(r"\n{3,}", "\n\n", text)

        return text.strip()

    def _build_semantic_units(
        self,
        text: str,
    ) -> list[str]:
        paragraphs = [
            paragraph.strip()
            for paragraph in re.split(r"\n{2,}", text)
            if paragraph.strip()
        ]

        units: list[str] = []

        for paragraph in paragraphs:
            if (
                len(paragraph)
                <= self.settings.rag_chunk_size_chars
            ):
                units.append(paragraph)
                continue

            units.extend(
                self._split_long_text(paragraph)
            )

        return units

    def _split_long_text(
        self,
        text: str,
    ) -> list[str]:
        sentences = [
            sentence.strip()
            for sentence in re.split(
                r"(?<=[.!?…])\s+",
                text,
            )
            if sentence.strip()
        ]

        parts: list[str] = []
        current = ""

        for sentence in sentences:
            if (
                len(sentence)
                > self.settings.rag_chunk_size_chars
            ):
                if current:
                    parts.append(current)
                    current = ""

                parts.extend(
                    self._split_by_words(sentence)
                )
                continue

            candidate = (
                sentence
                if not current
                else f"{current} {sentence}"
            )

            if (
                len(candidate)
                <= self.settings.rag_chunk_size_chars
            ):
                current = candidate
            else:
                parts.append(current)
                current = sentence

        if current:
            parts.append(current)

        return parts

    

    def _split_by_words(
        self,
        text: str,
    ) -> list[str]:
        parts: list[str] = []
        current = ""
        maximum_size = (
            self.settings.rag_chunk_size_chars
        )

        for original_word in text.split():
            word = original_word

            if len(word) > maximum_size:
                if current:
                    parts.append(current)
                    current = ""

                while len(word) > maximum_size:
                    parts.append(
                        word[:maximum_size]
                    )
                    word = word[maximum_size:]

                current = word
                continue

            candidate = (
                word
                if not current
                else f"{current} {word}"
            )

            if len(candidate) <= maximum_size:
                current = candidate
            else:
                if current:
                    parts.append(current)

                current = word

        if current:
            parts.append(current)

        return parts

    def _pack_units(
        self,
        units: list[str],
    ) -> list[str]:
        chunks: list[str] = []
        current = ""

        for unit in units:
            candidate = (
                unit
                if not current
                else f"{current}\n\n{unit}"
            )

            if (
                len(candidate)
                <= self.settings.rag_chunk_size_chars
            ):
                current = candidate
                continue

            if current:
                chunks.append(current)

            allowed_overlap = max(
                0,
                self.settings.rag_chunk_size_chars
                - len(unit)
                - 2,
            )
            overlap = self._overlap_tail(
                current,
                min(
                    self.settings.rag_chunk_overlap_chars,
                    allowed_overlap,
                ),
            )

            current = (
                f"{overlap}\n\n{unit}"
                if overlap
                else unit
            )

        if current:
            chunks.append(current)

        return chunks

    @staticmethod
    def _overlap_tail(
        text: str,
        maximum_length: int,
    ) -> str:
        if not text or maximum_length <= 0:
            return ""

        tail = text[-maximum_length:]

        if len(text) > maximum_length:
            first_space = tail.find(" ")

            if first_space >= 0:
                tail = tail[first_space + 1:]

        return tail.strip()

    def _merge_small_final_chunk(
        self,
        chunks: list[str],
    ) -> list[str]:
        if len(chunks) < 2:
            return chunks

        final_chunk = chunks[-1]

        if (
            len(final_chunk)
            >= self.settings.rag_min_chunk_size_chars
        ):
            return chunks

        previous_chunk = chunks[-2]
        merged = f"{previous_chunk}\n\n{final_chunk}"

        if (
            len(merged)
            <= self.settings.rag_chunk_size_chars
        ):
            return [
                *chunks[:-2],
                merged,
            ]

        return chunks