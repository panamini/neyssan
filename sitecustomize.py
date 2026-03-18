"""
sitecustomize: Ensure predictable imports in all Python subprocesses.

Python automatically imports `site` on startup, which then attempts to
import `sitecustomize` if it is importable on sys.path. By placing this
file at the project root (copied to `/app` in Docker), we guarantee that
both the primary process and any reload/subprocesses start with `/app`
and the current working directory injected into `sys.path`.

This hardens imports for uvicorn's reload worker, which can sometimes
spawn with a reduced or different sys.path.
"""

from __future__ import annotations

import os
import sys


def _ensure_path(p: str | None) -> None:
    if not p:
        return
    try:
        # Normalize and avoid duplicates
        p = os.path.abspath(p)
        if p not in sys.path:
            sys.path.insert(0, p)
    except Exception:
        # Best-effort only; never raise on startup
        pass


def _bootstrap_paths() -> None:
    candidates = {
        "/app",
        os.getcwd(),
        os.environ.get("PYTHONPATH"),  # may contain multiple entries; handled below
    }

    for c in list(candidates):
        if not c:
            continue
        # If PYTHONPATH contains multiple entries, split them
        if os.pathsep in c:
            for part in c.split(os.pathsep):
                _ensure_path(part)
        else:
            _ensure_path(c)


_bootstrap_paths()

