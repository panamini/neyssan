from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional

from pydantic import ValidationError

from .extraction_schema import ResumeExtraction


class AnnotationParserError(RuntimeError):
    def __init__(self, code: str, *, details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(code)
        self.code = code
        self.details = details or {}


FENCED_JSON_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def _coerce_json_object(raw: Any) -> Dict[str, Any]:
    if raw is None:
        raise AnnotationParserError("document_annotation_missing")

    if isinstance(raw, dict):
        return raw

    if hasattr(raw, "model_dump"):
        dumped = raw.model_dump()
        if isinstance(dumped, dict):
            return dumped

    if hasattr(raw, "dict"):
        dumped = raw.dict()
        if isinstance(dumped, dict):
            return dumped

    if isinstance(raw, str):
        candidate = raw.strip()
        if not candidate:
            raise AnnotationParserError("document_annotation_empty")
        fenced = FENCED_JSON_RE.search(candidate)
        if fenced:
            candidate = fenced.group(1).strip()
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError as exc:
            raise AnnotationParserError("document_annotation_invalid_json") from exc
        if not isinstance(parsed, dict):
            raise AnnotationParserError("document_annotation_not_object")
        return parsed

    raise AnnotationParserError(f"document_annotation_unsupported_type:{type(raw).__name__}")


def parse_document_annotation(raw: Any) -> ResumeExtraction:
    payload = _coerce_json_object(raw)
    try:
        return ResumeExtraction.model_validate(payload)
    except ValidationError as exc:
        raise AnnotationParserError(
            "document_annotation_schema_mismatch",
            details={
                "validationErrors": exc.errors(include_url=False),
                "payloadKeys": sorted(payload.keys()),
            },
        ) from exc
