"""Post-processing helpers shared by both extraction paths."""
from __future__ import annotations

import logging
import re
from typing import Optional

from ..schema.model import NormalizedCv, StrictContact

log = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"\+?[0-9][0-9\s().-]{7,}")
NAME_RE = re.compile(r"^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$")


def enrich_contacts(normalized: NormalizedCv, strict: Optional[StrictContact]) -> StrictContact:
    """Ensure strict contact fields are populated from normalized text when missing."""
    if strict is None:
        strict = StrictContact()

    # Prefer existing strict values.
    summary = normalized.summary.text if normalized.summary else ""
    raw = normalized.raw or summary

    if strict.email is None and normalized.contact.email:
        strict.email = normalized.contact.email
    elif strict.email is None:
        match = EMAIL_RE.search(raw)
        if match:
            strict.email = match.group(0)

    if strict.phone is None and normalized.contact.phone:
        strict.phone = normalized.contact.phone
    elif strict.phone is None:
        match = PHONE_RE.search(raw)
        if match:
            strict.phone = match.group(0)

    if strict.name is None and normalized.name:
        strict.name = normalized.name
    elif strict.name is None and summary:
        candidate = summary.splitlines()[0].strip()
        if NAME_RE.match(candidate):
            strict.name = candidate

    if strict.location is None and normalized.contact.addressNormalized:
        strict.location = normalized.contact.addressNormalized

    if strict.desiredPosition is None and normalized.contact.desiredPosition:
        strict.desiredPosition = normalized.contact.desiredPosition

    return strict
