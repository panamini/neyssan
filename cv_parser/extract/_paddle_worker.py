from __future__ import annotations

import faulthandler
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple


log = logging.getLogger(__name__)
if not log.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    handler.setFormatter(formatter)
    log.addHandler(handler)
log.setLevel(logging.INFO)


# Keep this worker minimal: only paddleocr, numpy, PIL, pypdfium2.
# Do NOT import torch, cv2, scipy, transformers, or application pipelines here.


MIN_PADDLE_BLOCKS = 4
_ENGINES: Dict[str, Any] = {}


def _env_truthy(value: Optional[str]) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _get_paddle_engine(lang: str = "en"):
    key = lang or "en"
    engine = _ENGINES.get(key)
    if engine is None:
        # Import locally to avoid importing Paddle at module import time
        from paddleocr import PaddleOCR  # type: ignore

        engine = PaddleOCR(
            enable_mkldnn=False,
            use_angle_cls=False,
            lang=key,
            ocr_version="PP-OCRv5",
        )
        _ENGINES[key] = engine
    return engine


def _render_pdf_pages(pdf_path: Path, dpi: int = 320) -> Tuple[List["Image.Image"], Dict[str, Any]]:
    images: List["Image.Image"] = []
    pages = 0
    try:
        import pypdfium2 as pdfium  # type: ignore
        from PIL import Image  # noqa: F401  (ensures PIL is present)

        pdf_doc = pdfium.PdfDocument(str(pdf_path))
        scale = dpi / 72.0
        try:
            for page_index in range(len(pdf_doc)):
                page = pdf_doc[page_index]
                bitmap = page.render(scale=scale)
                pil_image = bitmap.to_pil()
                if pil_image.mode != "RGB":
                    pil_image = pil_image.convert("RGB")
                images.append(pil_image)
        finally:
            pdf_doc.close()
        pages = len(images)
    except Exception as exc:
        log.warning("[worker] render failed at dpi=%s: %s", dpi, exc)
    return images, {"pages": pages, "dpi": dpi}


def _ocr_paddle(images: Sequence["Image.Image"], lang: str = "en") -> Tuple[str, Dict[str, Any]]:
    if not images:
        return "", {"engine": "paddle", "ocr_blocks": 0, "ocr_chars": 0, "lang_hint": lang}

    import numpy as np  # Local import to minimize global side effects

    engine = _get_paddle_engine(lang)
    text_blocks: List[str] = []
    total_blocks = 0
    for img in images:
        try:
            np_img = np.array(img)
            raw = engine.ocr(np_img)
        except Exception as exc:
            log.warning("[worker] Paddle OCR error: %s", exc)
            continue
        if not raw or not raw[0]:
            continue
        if isinstance(raw[0], dict):
            texts = raw[0].get("rec_texts", []) or []
        else:
            try:
                texts = [entry[1][0] for entry in raw[0] if entry and isinstance(entry, (list, tuple))]
            except Exception:
                texts = []
        cleaned = [t.strip() for t in texts if isinstance(t, str) and t.strip()]
        if cleaned:
            text_blocks.extend(cleaned)
            total_blocks += len(cleaned)

    combined = "\n".join(text_blocks).strip()
    diagnostics = {
        "engine": "paddle",
        "ocr_blocks": total_blocks,
        "ocr_chars": len(combined),
        "lang_hint": lang,
    }
    return combined, diagnostics


def _process_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    temp_path: Optional[Path] = None
    try:
        kind = payload.get("kind")
        if kind == "prewarm":
            lang = str(payload.get("lang") or "en")
            _get_paddle_engine(lang)
            return {"ok": True, "prewarm": True}

        if kind == "path":
            pdf_path = Path(str(payload.get("value")))
        elif kind == "bytes":
            data = payload.get("value") or b""
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(data)
                temp_path = Path(tmp.name)
            pdf_path = temp_path
        else:
            raise RuntimeError("invalid_payload_kind")

        dpi_primary = int(payload.get("dpi_primary", 320))
        dpi_retry = int(payload.get("dpi_retry", 360))
        lang = str(payload.get("lang", "en"))

        images, render_diag = _render_pdf_pages(pdf_path, dpi=dpi_primary)
        text, diag = _ocr_paddle(images, lang=lang)
        diagnostics = {
            "engine": "paddle",
            "dpi_used": render_diag.get("dpi", dpi_primary),
            "paddle_retry_used": False,
            "lang_hint": lang,
            "pages": render_diag.get("pages", 0),
        }
        diagnostics.update(diag)

        if text and diag.get("ocr_blocks", 0) >= MIN_PADDLE_BLOCKS:
            return {"ok": True, "text": text, "diagnostics": diagnostics}

        images2, render_diag2 = _render_pdf_pages(pdf_path, dpi=dpi_retry)
        diagnostics["paddle_retry_used"] = True
        if images2:
            text2, diag2 = _ocr_paddle(images2, lang=lang)
            diagnostics.update(diag2)
            diagnostics["dpi_used"] = render_diag2.get("dpi", dpi_retry)
            diagnostics["pages"] = render_diag2.get("pages", diagnostics.get("pages", 0))
            if text2 and diag2.get("ocr_blocks", 0) >= MIN_PADDLE_BLOCKS:
                return {"ok": True, "text": text2, "diagnostics": diagnostics}

        diagnostics.setdefault("failure_reason", "paddle_empty")
        return {"ok": True, "text": "", "diagnostics": diagnostics}
    finally:
        if temp_path is not None:
            try:
                temp_path.unlink(missing_ok=True)  # type: ignore[call-arg]
            except TypeError:
                try:
                    if temp_path.exists():
                        temp_path.unlink()
                except Exception:
                    pass


def _diagnostics_banner() -> None:
    if not _env_truthy(os.environ.get("CV_PADDLE_DIAG")):
        return
    try:
        faulthandler.enable(all_threads=True)
    except Exception:
        pass
    try:
        import ctypes
        ctypes.CDLL("libgfortran.so.5")
    except Exception as exc:
        log.warning("[worker] libgfortran5 load failed: %s", exc)
    try:
        from threadpoolctl import threadpool_info  # type: ignore
    except Exception as exc:  # pragma: no cover - diagnostics only
        log.warning("[worker] threadpoolctl unavailable: %s", exc)
    else:
        def _info_get(info: Any, key: str) -> Any:
            if isinstance(info, dict):
                return info.get(key)
            return getattr(info, key, None)

        openblas_infos = [
            info for info in threadpool_info() if "openblas" in str(info).lower()
        ]
        libraries = sorted(
            {
                (_info_get(info, "filepath") or "").strip()
                for info in openblas_infos
                if (_info_get(info, "filepath") or "").strip()
            }
        )
        thread_details = [
            {
                "filepath": _info_get(info, "filepath"),
                "num_threads": _info_get(info, "num_threads"),
                "prefix": _info_get(info, "prefix"),
            }
            for info in openblas_infos
        ]
        log.info("[worker] openblas_state libs=%s threads=%s", libraries, thread_details)
        if len(libraries) > 1:
            log.warning("[worker] multiple OpenBLAS libraries detected: %s", libraries)
    log.info(
        "[worker] diag: pid=%s ld_library_path=%s ld_preload=%s",
        os.getpid(),
        os.environ.get("LD_LIBRARY_PATH", ""),
        os.environ.get("LD_PRELOAD", ""),
    )


def main() -> None:
    import json
    import sys

    _diagnostics_banner()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        if line == "__quit__":
            break
        try:
            message = json.loads(line)
        except json.JSONDecodeError:
            log.warning("[worker] invalid JSON line: %s", line)
            continue

        job_id = message.get("job_id")
        payload = message.get("payload") or {}
        response: Dict[str, Any]
        try:
            result = _process_payload(payload)
            response = {"job_id": job_id}
            response.update(result)
        except Exception as exc:
            response = {"job_id": job_id, "ok": False, "error": str(exc)}
        print(json.dumps(response, separators=(",", ":")), flush=True)


if __name__ == "__main__":  # pragma: no cover
    main()
