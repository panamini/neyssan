from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import requests

from .extraction_schema import build_document_annotation_format
from .prompt import DOCUMENT_ANNOTATION_PROMPT


@dataclass
class OCRAnnotationResult:
    pages: List[Dict[str, Any]]
    page_count: int
    diagnostics: Dict[str, Any]
    annotation_raw: Any
    response_payload: Dict[str, Any]


def _import_mistral():
    from mistralai.sdk import Mistral

    return Mistral


@lru_cache(maxsize=4)
def _client_for_key(api_key: str):
    mistral_cls = _import_mistral()
    return mistral_cls(api_key=api_key, timeout_ms=120_000)


def _safe_filename(name: Optional[str], fallback: str = "upload.pdf") -> str:
    if name and name.strip():
        return name.strip()
    return fallback


def _document_name_from_url(url: str) -> Optional[str]:
    try:
        path = urlparse(url).path or ""
    except Exception:
        return None
    candidate = path.rstrip("/").rsplit("/", 1)[-1]
    return candidate or None


def _to_plain_data(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): _to_plain_data(raw) for key, raw in value.items()}
    if isinstance(value, (list, tuple)):
        return [_to_plain_data(item) for item in value]
    if hasattr(value, "model_dump"):
        try:
            return _to_plain_data(value.model_dump())
        except Exception:
            pass
    if hasattr(value, "dict"):
        try:
            return _to_plain_data(value.dict())
        except Exception:
            pass
    if hasattr(value, "__dict__"):
        try:
            raw = {key: inner for key, inner in vars(value).items() if not key.startswith("_")}
            return _to_plain_data(raw)
        except Exception:
            pass
    return value


def _post_ocr_request(*, api_key: str, payload: Dict[str, Any], timeout_ms: int = 120_000) -> Dict[str, Any]:
    response = requests.post(
        "https://api.mistral.ai/v1/ocr",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json=payload,
        timeout=timeout_ms / 1000,
    )
    response.raise_for_status()
    parsed = response.json()
    if not isinstance(parsed, dict):
        raise RuntimeError("mistral_ocr_response_not_object")
    return parsed


def _collect_pages(plain_payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    pages: List[Dict[str, Any]] = []
    for page in plain_payload.get("pages") or []:
        if not isinstance(page, dict):
            continue
        markdown = page.get("markdown", "") or ""
        index = page.get("index", len(pages))
        pages.append({"index": int(index), "markdown": markdown})
    return pages


def _extract_page_count(pages: List[Dict[str, Any]], plain_payload: Dict[str, Any]) -> int:
    usage_payload = plain_payload.get("usage_info")
    if isinstance(usage_payload, dict):
        pages_processed = usage_payload.get("pages_processed")
        if isinstance(pages_processed, int) and pages_processed >= 0:
            return pages_processed
    return len(pages)


def _extract_document_annotation(plain_payload: Dict[str, Any]) -> Any:
    candidates = [
        plain_payload.get("document_annotation"),
        plain_payload.get("documentAnnotation"),
    ]
    for candidate in candidates:
        if candidate is not None:
            return candidate
    return None


def _base_diagnostics(pages: List[Dict[str, Any]], plain_payload: Dict[str, Any]) -> Dict[str, Any]:
    page_count = _extract_page_count(pages, plain_payload)
    total_chars = sum(len((page.get("markdown") or "")) for page in pages)
    model_name = plain_payload.get("model")
    diagnostics = {
        "model": model_name,
        "pages": page_count,
        "page_count": page_count,
        "ocr_chars": total_chars,
        "annotation_mode": "json_schema",
        "annotation_prompt_mode": "short_global_prompt_with_field_descriptions",
    }
    usage_info = plain_payload.get("usage_info")
    doc_size_bytes = usage_info.get("doc_size_bytes") if isinstance(usage_info, dict) else None
    if isinstance(doc_size_bytes, int) and doc_size_bytes > 0:
        diagnostics["doc_size_bytes"] = doc_size_bytes
    return diagnostics


def run_annotated_ocr_from_bytes(
    *,
    file_name: Optional[str],
    content_type: Optional[str],
    data: bytes,
    api_key: str,
    model_name: Optional[str],
) -> OCRAnnotationResult:
    if not data:
        raise RuntimeError("empty file payload")

    client = _client_for_key(api_key)
    normalized_name = _safe_filename(file_name)
    document_annotation_format = build_document_annotation_format()
    file_id: Optional[str] = None

    try:
        upload = client.files.upload(
            file={
                "file_name": normalized_name,
                "content": data,
                "content_type": content_type,
            },
            purpose="ocr",
        )
        file_id = getattr(upload, "id", None)
        if not file_id:
            raise RuntimeError("mistral_upload_missing_file_id")
        plain_payload = _post_ocr_request(
            api_key=api_key,
            payload={
                "model": model_name,
                "document": {"type": "file", "file_id": file_id},
                "document_annotation_prompt": DOCUMENT_ANNOTATION_PROMPT,
                "document_annotation_format": document_annotation_format,
                "include_image_base64": False,
            },
        )
        pages = _collect_pages(plain_payload)
        diagnostics = _base_diagnostics(pages, plain_payload)
        diagnostics["document_name"] = normalized_name
        return OCRAnnotationResult(
            pages=pages,
            page_count=diagnostics["page_count"],
            diagnostics=diagnostics,
            annotation_raw=_extract_document_annotation(plain_payload),
            response_payload=plain_payload,
        )
    finally:
        if file_id:
            try:
                client.files.delete(file_id=file_id)
            except Exception:
                pass


def run_annotated_ocr_from_url(
    *,
    url: str,
    api_key: str,
    model_name: Optional[str],
) -> OCRAnnotationResult:
    client = _client_for_key(api_key)
    document_name = _document_name_from_url(url)
    document_annotation_format = build_document_annotation_format()
    plain_payload = _post_ocr_request(
        api_key=api_key,
        payload={
            "model": model_name,
            "document": {"type": "document_url", "document_url": url},
            "document_annotation_prompt": DOCUMENT_ANNOTATION_PROMPT,
            "document_annotation_format": document_annotation_format,
            "include_image_base64": False,
        },
    )
    pages = _collect_pages(plain_payload)
    diagnostics = _base_diagnostics(pages, plain_payload)
    diagnostics["document_name"] = document_name
    diagnostics["source_url"] = url
    return OCRAnnotationResult(
        pages=pages,
        page_count=diagnostics["page_count"],
        diagnostics=diagnostics,
        annotation_raw=_extract_document_annotation(plain_payload),
        response_payload=plain_payload,
    )


def serialize_for_json(value: Any) -> Any:
    try:
        json.dumps(value)
        return value
    except Exception:
        return _to_plain_data(value)
