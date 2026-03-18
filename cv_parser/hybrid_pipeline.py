"""Hybrid CV parsing pipeline orchestration."""

from __future__ import annotations

import csv
import logging
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

try:  # spaCy is optional at runtime
    import spacy
    from spacy.language import Language
    from spacy.tokens import Doc, Span
except ImportError:  # pragma: no cover - optional dependency
    spacy = None  # type: ignore
    Language = None  # type: ignore
    Doc = None  # type: ignore
    Span = None  # type: ignore
    LOGGER = logging.getLogger(__name__)
    LOGGER.warning("spaCy import failed; hybrid pipeline will operate in OCR-only mode")

from .types import LayoutBlock, RuleMatch, SectionSpan

LOGGER = logging.getLogger(__name__)


if spacy is not None:  # Real spaCy pipeline available
    from .constants import ENTITY_LABELS
    from .conflict_resolver import resolve
    from .layout_ingest import LayoutIngestor
    from .pack_json import pack_document
    from .postprocessing import normalise_value
    from .rules import RuleEngine
    from .section_segmenter import SectionSegmenter

    Span.set_extension("section", default=None, force=True)
    Span.set_extension("page", default=None, force=True)
    Span.set_extension("confidence", default=None, force=True)

    class HybridCVParser:
        available = True

        def __init__(
            self,
            model_path: str,
            esco_csv: Optional[Path] = None,
            prefer_docling: bool = True,
        ) -> None:
            self.nlp = spacy.load(model_path)
            self.ingestor = LayoutIngestor(prefer_docling=prefer_docling)
            self.segmenter = SectionSegmenter()
            self.rule_engine = RuleEngine()
            if esco_csv:
                self._ensure_skill_ruler(esco_csv)

        # ------------------------------------------------------------------
        # Public API
        # ------------------------------------------------------------------
        def parse_path(self, path: Path) -> dict:
            blocks = self.ingestor.load(path)
            sections = self.segmenter.segment(blocks)
            doc, section_map = self._build_doc(sections)

            rule_spans = self._seed_rules(doc, sections, section_map)
            doc = self.nlp(doc)
            final_spans = resolve(doc, rule_spans)
            self._annotate_sections(final_spans, section_map)

            extras = {
                "source_path": str(path),
                "num_sections": len(sections),
                "num_blocks": len(blocks),
            }
            return pack_document(doc, sections, final_spans, extras=extras)

        def parse_text(self, text: str) -> dict:
            temp = Path("/tmp/plain_resume.txt")
            temp.write_text(text, encoding="utf-8")
            try:
                return self.parse_path(temp)
            finally:
                try:
                    temp.unlink()
                except FileNotFoundError:
                    pass

        # ------------------------------------------------------------------
        # Internal helpers
        # ------------------------------------------------------------------
        def _build_doc(self, sections: List[SectionSpan]) -> Tuple[Doc, List[Tuple[int, int, SectionSpan]]]:
            parts: List[str] = []
            offset = 0
            section_map: List[Tuple[int, int, SectionSpan]] = []
            for section in sections:
                text = section.text.strip()
                if not text:
                    continue
                section.char_start = offset
                parts.append(text)
                offset += len(text)
                section.char_end = offset
                section_map.append((section.char_start, section.char_end, section))
                parts.append("\n\n")
                offset += 2
            if parts and parts[-1] == "\n\n":
                parts.pop()
                offset -= 2
            doc_text = "".join(parts)
            doc = self.nlp.make_doc(doc_text)
            return doc, section_map

        def _seed_rules(self, doc: Doc, sections: List[SectionSpan], section_map: List[Tuple[int, int, SectionSpan]]) -> List[Span]:
            spans: List[Span] = []
            for section in sections:
                matches: Iterable[RuleMatch] = self.rule_engine.run(section, section.char_start)
                for match in matches:
                    span = doc.char_span(match.start, match.end, label=match.label, alignment_mode="contract")
                    if not span:
                        continue
                    span._.confidence = match.confidence
                    spans.append(span)
            return spans

        def _annotate_sections(self, spans: Iterable[Span], section_map: List[Tuple[int, int, SectionSpan]]) -> None:
            for span in spans:
                for start, end, section in section_map:
                    if start <= span.start_char < end:
                        span._.section = section.label
                        span._.page = section.blocks[0].page if section.blocks else None
                        break

        def _ensure_skill_ruler(self, esco_csv: Path) -> None:
            try:
                from spacy.pipeline import EntityRuler
            except Exception:  # pragma: no cover
                LOGGER.warning("spaCy EntityRuler unavailable; skipping ESCO gazetteer")
                return

            if "esco_skills" in self.nlp.pipe_names:
                return

            ruler = EntityRuler(self.nlp, name="esco_skills", overwrite_ents=False)
            patterns = []
            with esco_csv.open("r", encoding="utf-8", newline="") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get("conceptType", "").lower() not in {"skill", "competence", "knowledge", "ability"}:
                        continue
                    label = row.get("preferredLabel", "")
                    if label:
                        patterns.append({"label": "SKILL", "pattern": label.strip()})
                    for synonym in row.get("altLabels", "").split("|"):
                        synonym = synonym.strip()
                        if synonym:
                            patterns.append({"label": "SKILL", "pattern": synonym})
            ruler.add_patterns(patterns)
            self.nlp.add_pipe(ruler, before="ner")


    def ensure_components(nlp: Language) -> None:
        missing = [label for label in ENTITY_LABELS if label not in nlp.get_pipe("ner").labels]
        if missing:
            LOGGER.warning("NER model missing expected labels: %s", ", ".join(missing))
else:  # spaCy missing – provide lightweight stub

    class HybridCVParser:  # type: ignore[override]
        available = False

        def __init__(
            self,
            model_path: str | None = None,
            esco_csv: Optional[Path] = None,
            prefer_docling: bool = True,
        ) -> None:
            self.model_path = model_path
            self.esco_csv = esco_csv
            self.prefer_docling = prefer_docling
            LOGGER.warning(
                "spaCy not available; HybridCVParser disabled (model=%s)",
                model_path,
            )

        def _fallback_payload(self, raw_text: str) -> Dict[str, object]:
            LOGGER.debug("Hybrid parser unavailable; returning OCR-only payload")
            return {
                "raw_text": raw_text,
                "sections": [],
                "entities": {},
                "experience": [],
                "education": [],
                "skills": [],
                "languages": [],
                "diagnostics": {
                    "hybrid_used": False,
                    "engine": "ocr",
                    "crashed": False,
                },
            }

        def parse_path(self, path: Path) -> Dict[str, object]:
            LOGGER.debug("Hybrid parser unavailable; skipping spaCy parse for %s", path)
            raw_text = ""
            try:
                raw_text = path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                raw_text = ""
            return self._fallback_payload(raw_text)

        def parse_text(self, text: str) -> Dict[str, object]:
            return self._fallback_payload(text)

    def ensure_components(_nlp: object) -> None:
        raise RuntimeError("spaCy not available; cannot ensure pipeline components")
