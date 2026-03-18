"""Helpers for normalising bounding boxes into a 0-1000 coordinate space."""
from __future__ import annotations

from typing import Iterable, List, Tuple


def normalize_bbox(
    bbox: Iterable[float],
    page_width: float,
    page_height: float,
) -> List[int]:
    """Return a list [x0, y0, x1, y1] scaled to the 0-1000 range."""
    x0, y0, x1, y1 = bbox
    width = max(page_width, 1.0)
    height = max(page_height, 1.0)
    return [
        int(round(max(min(x0 / width * 1000, 1000), 0))),
        int(round(max(min(y0 / height * 1000, 1000), 0))),
        int(round(max(min(x1 / width * 1000, 1000), 0))),
        int(round(max(min(y1 / height * 1000, 1000), 0))),
    ]


def clamp_bbox(bbox: Tuple[int, int, int, int]) -> List[int]:
    return [max(min(value, 1000), 0) for value in bbox]
