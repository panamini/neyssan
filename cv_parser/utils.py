"""Utility helpers shared across pipeline components."""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Iterable, List, Sequence


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def read_jsonl(path: Path) -> Iterable[dict]:
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def set_seed(seed: int) -> None:
    random.seed(seed)
    try:
        import numpy as np  # type: ignore

        np.random.seed(seed)
    except Exception:
        pass
    try:
        import torch  # type: ignore

        torch.manual_seed(seed)
        if torch.cuda.is_available():  # type: ignore[attr-defined]
            torch.cuda.manual_seed_all(seed)  # type: ignore[attr-defined]
    except Exception:
        pass


def sliding_window(sequence: Sequence, size: int, step: int = 1) -> Iterable[Sequence]:
    for i in range(0, max(len(sequence) - size + 1, 0), step):
        yield sequence[i : i + size]


def flatten(list_of_lists: Iterable[Iterable]) -> List:
    return [item for sub in list_of_lists for item in sub]

