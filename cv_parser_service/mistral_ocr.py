from __future__ import annotations

import logging
import io
from functools import lru_cache
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlparse

import pdfplumber
import requests
from mistralai import models
from mistralai.sdk import Mistral

LOGGER = logging.getLogger(__name__)


class MistralOCRError(RuntimeError):
    """Raised when a Mistral OCR request fails."""


@lru_cache(maxsize=4)
def _client_for_key(api_key: str) -> Mistral:
    return Mistral(api_key=api_key, timeout_ms=120_000)


def _safe_filename(name: Optional[str], fallback: str = "upload.pdf") -> str:
    if name:
        candidate = name.strip()
        if candidate:
            return candidate
    return fallback


def _collect_pages(response: models.OCRResponse) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    pages: List[Dict[str, Any]] = []
    total_chars = 0
    for page in response.pages or []:
        markdown = page.markdown or ""
        total_chars += len(markdown)
        pages.append(
            {
                "index": int(page.index),
                "markdown": markdown,
            }
        )

    usage_info = response.usage_info
    page_count = getattr(usage_info, "pages_processed", None) or len(pages)
    diagnostics = {
        "model": response.model,
        "pages": page_count,
        "ocr_chars": total_chars,
    }
    if usage_info and getattr(usage_info, "doc_size_bytes", None):
        diagnostics["doc_size_bytes"] = usage_info.doc_size_bytes
    return pages, diagnostics


def _fallback_pages_from_pdf_bytes(data: bytes, document_name: Optional[str]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    try:
        pdf = pdfplumber.open(io.BytesIO(data))
    except Exception as exc:
        raise MistralOCRError("mistral_ocr_unreadable_pdf") from exc

    pages: List[Dict[str, Any]] = []
    total_chars = 0
    try:
        for index, page in enumerate(pdf.pages or []):
            text = page.extract_text() or ""
            markdown = text.strip()
            total_chars += len(markdown)
            pages.append({"index": index, "markdown": markdown})
    finally:
        pdf.close()

    diagnostics = {
        "model": "mistral-fallback-dev",
        "pages": len(pages),
        "ocr_chars": total_chars,
        "document": _safe_filename(document_name),
        "fallback": True,
    }
    return pages, diagnostics


def _document_name_from_url(url: str) -> Optional[str]:
    try:
        path = urlparse(url).path or ""
    except Exception:
        return None
    candidate = path.rstrip("/").rsplit("/", 1)[-1]
    return candidate or None


def run_mistral_ocr_from_bytes(
    *,
    file_name: Optional[str],
    content_type: Optional[str],
    data: bytes,
    api_key: str,
    model_name: Optional[str],
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    if not data:
        raise MistralOCRError("empty file payload")

    client = _client_for_key(api_key)
    normalized_name = _safe_filename(file_name)

    file_id: Optional[str] = None
    try:
        upload = client.files.upload(
            file=models.File(
                file_name=normalized_name,
                content=data,
                content_type=content_type,
            ),
            purpose="ocr",
        )
        file_id = upload.id
        document = models.FileChunk(file_id=file_id)
        response = client.ocr.process(
            model=model_name,
            document=document,
        )
        pages, diagnostics = _collect_pages(response)
        return pages, diagnostics
    except Exception as exc:  # pragma: no cover - network / API failure
        LOGGER.warning("Mistral OCR (file) failed; falling back to local extraction: %s", exc)
        return _fallback_pages_from_pdf_bytes(data, normalized_name)
    finally:
        if file_id:
            try:
                client.files.delete(file_id=file_id)
            except Exception:  # pragma: no cover - best effort cleanup
                LOGGER.debug("Failed to delete uploaded file %s after OCR", file_id)


def run_mistral_ocr_from_url(
    *,
    url: str,
    api_key: str,
    model_name: Optional[str],
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    document_name = _document_name_from_url(url)
    document = models.DocumentURLChunk(
        document_url=url,
        document_name=document_name,
    )
    client = _client_for_key(api_key)
    try:
        response = client.ocr.process(
            model=model_name,
            document=document,
        )
        return _collect_pages(response)
    except Exception as exc:  # pragma: no cover - network / API failure
        LOGGER.warning("Mistral OCR (url) failed; attempting fallback: %s", exc)
        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            return _fallback_pages_from_pdf_bytes(resp.content, document_name)
        except Exception as inner_exc:  # pragma: no cover - network / API failure
            raise MistralOCRError("mistral_ocr_request_failed") from inner_exc


def join_markdown_pages(pages: Iterable[Dict[str, Any]], delimiter: str = "\n\n---\n\n") -> str:
    chunks: List[str] = []
    for page in pages:
        markdown = (page.get("markdown") or "").strip()
        if markdown:
            chunks.append(markdown)
    return delimiter.join(chunks)
