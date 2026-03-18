#!/usr/bin/env python3
from __future__ import annotations

import importlib
import platform
import sys
import traceback

print("Python:", sys.version)
print("Platform:", platform.platform())
print("sys.path:", sys.path)

def probe(name: str) -> tuple[str, str, str]:
    try:
        importlib.import_module(name)
        return (name, "OK", "")
    except Exception as exc:  # pragma: no cover - audit surface
        return (name, "FAIL", f"{type(exc).__name__}: {exc}")

print("\nModule import probe:")
for mod in ("PIL", "cv_parser_service.main", "cv_parser.canonicalize"):
    name, status, msg = probe(mod)
    print(f"{name:28} {status:4} {msg}")

