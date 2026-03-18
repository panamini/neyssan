"""Post-processing utilities for normalising entity values."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional


def normalise_email(value: str) -> str:
    local, _, domain = value.partition("@")
    if not domain:
        return value
    return f"{local.lower()}@{domain.lower()}"


def normalise_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if value.startswith("+"):
        return "+" + digits
    if len(digits) == 10:
        return "+1" + digits
    return "+" + digits if digits else value


def normalise_date(value: str) -> str:
    # Already ISO
    if re.match(r"^\d{4}-\d{2}$", value):
        return value
    if re.match(r"^\d{4}-\d{2}-\d{2}$", value):
        return value[:7]
    try:
        dt = datetime.strptime(value, "%Y-%m-%d")
        return dt.strftime("%Y-%m")
    except Exception:
        pass
    month_map = {
        "jan": "01",
        "feb": "02",
        "mar": "03",
        "apr": "04",
        "may": "05",
        "jun": "06",
        "jul": "07",
        "aug": "08",
        "sep": "09",
        "sept": "09",
        "oct": "10",
        "nov": "11",
        "dec": "12",
    }
    match = re.match(r"([A-Za-z]+)[\s/-]+(\d{4})", value)
    if match:
        month = month_map.get(match.group(1).lower()[:4], "01")
        year = match.group(2)
        return f"{year}-{month}"
    return value


def normalise_value(label: str, value: str) -> str:
    if label == "EMAIL":
        return normalise_email(value)
    if label == "PHONE":
        return normalise_phone(value)
    if label in {"START_DATE", "END_DATE"}:
        return normalise_date(value)
    return value

