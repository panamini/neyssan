from __future__ import annotations

from typing import Any


INTERNAL_CANONICAL_PAYLOAD_DIAGNOSTIC_KEY = "_mistral_resume_v3_canonical_payload"


def run_resume_pipeline_from_bytes(*, file_name: str | None, content_type: str | None, data: bytes, api_key: str, model_name: str | None) -> dict[str, Any]:
    from .pipeline import run_resume_pipeline_from_bytes as _impl

    return _impl(
        file_name=file_name,
        content_type=content_type,
        data=data,
        api_key=api_key,
        model_name=model_name,
    )


def run_resume_pipeline_from_url(*, url: str, api_key: str, model_name: str | None) -> dict[str, Any]:
    from .pipeline import run_resume_pipeline_from_url as _impl

    return _impl(
        url=url,
        api_key=api_key,
        model_name=model_name,
    )


__all__ = [
    "INTERNAL_CANONICAL_PAYLOAD_DIAGNOSTIC_KEY",
    "run_resume_pipeline_from_bytes",
    "run_resume_pipeline_from_url",
]
