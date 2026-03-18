"""Hybrid CV parser package using spaCy + layout-aware preprocessing."""

from __future__ import annotations

import logging

from .constants import SECTION_LABELS, ENTITY_LABELS  # noqa: F401

LOGGER = logging.getLogger(__name__)

try:  # spaCy callbacks are optional at runtime
    from . import training_callbacks as _training_callbacks  # type: ignore  # noqa: F401
except ImportError as exc:  # pragma: no cover - optional dependency
    LOGGER.warning("spaCy training callbacks unavailable: %s", exc)
    _training_callbacks = None  # type: ignore

try:  # Pattern loading also depends on spaCy
    from . import patterns as _patterns  # type: ignore  # noqa: F401
except ImportError as exc:  # pragma: no cover - optional dependency
    LOGGER.warning("spaCy pattern utilities unavailable: %s", exc)
    _patterns = None  # type: ignore
