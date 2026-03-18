"""Utility to verify canonicalizer imports resolve in current environment."""

from __future__ import annotations

import os
import sys


def main() -> int:
    print("[verify] cwd:", os.getcwd())
    print("[verify] PYTHONPATH:", os.environ.get("PYTHONPATH"))
    print("[verify] sys.path head:", sys.path[:10])

    try:
        import cv_parser_service.main as main_module  # noqa: F401
    except Exception as exc:  # pragma: no cover - diagnostic only
        print("[verify] main import FAIL:", repr(exc))
        return 1

    print("[verify] main imported OK from:", getattr(main_module, "__file__", None))
    has_attr = hasattr(main_module, "canonicalize_cv")
    print("[verify] has canonicalize_cv:", has_attr)
    return 0 if has_attr else 2


if __name__ == "__main__":
    raise SystemExit(main())
