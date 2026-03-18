from __future__ import annotations

import json
from pathlib import Path
from typing import Callable, Iterable, List, Sequence

import srsly
from spacy.language import Language
from spacy.tokens import Span
from spacy.util import registry

# Reference: https://spacy.io/api/spanruler
# Reference: https://spacy.io/usage/rule-based-matching#spanruler
# Reference: https://ljvmiranda921.github.io/notebook/2021/11/20/spacy-v3/


def _resolve_base_path(path: str) -> Path:
    raw = Path(path)
    if raw.exists():
        return raw
    module_dir = Path(__file__).resolve().parent
    direct = module_dir / raw
    if direct.exists():
        return direct
    name_match = module_dir / raw.name
    if name_match.exists():
        return name_match
    return raw


def _load_file(path: Path) -> List[dict]:
    if not path.exists() or not path.is_file():
        return []
    if path.suffix.lower() == ".jsonl":
        return list(srsly.read_jsonl(path))
    if path.suffix.lower() == ".json":
        data = srsly.read_json(path)
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        if isinstance(data, dict):
            patterns = data.get("patterns")
            if isinstance(patterns, list):
                return [item for item in patterns if isinstance(item, dict)]
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    return []


@registry.misc("cv_parser.patterns.load_patterns.v1")
def load_patterns(path: str) -> List[dict]:
    base_path = _resolve_base_path(path)
    patterns: List[dict] = []
    if base_path.exists() and base_path.is_dir():
        for child in sorted(base_path.glob("*")):
            patterns.extend(_load_file(child))
    elif base_path.exists():
        patterns.extend(_load_file(base_path))
    return patterns


@registry.callbacks("cv_parser.patterns.load_into_ruler.v1")
def load_into_ruler(path: str) -> Callable[[Language], Language]:
    base_path = _resolve_base_path(path)

    def _callback(nlp: Language) -> Language:
        if "pattern_ruler" not in nlp.pipe_names:
            return nlp
        patterns = load_patterns(str(base_path))
        if patterns:
            ruler = nlp.get_pipe("pattern_ruler")
            ruler.add_patterns(patterns)
        return nlp

    return _callback


@registry.callbacks("cv_parser.patterns.ensure_pattern_ruler.v1")
def ensure_pattern_ruler() -> Callable[[Language], Language]:
    def _callback(nlp: Language) -> Language:
        if "pattern_ruler" not in nlp.pipe_names:
            return nlp
        ruler = nlp.get_pipe("pattern_ruler")
        pattern_list: Sequence[dict] = getattr(ruler, "patterns", [])
        if not pattern_list:
            cfg = nlp.config.interpolate()
            pattern_dir = None
            paths_cfg = cfg.get("paths") if isinstance(cfg.get("paths"), dict) else {}
            if isinstance(paths_cfg, dict):
                pattern_dir = paths_cfg.get("pattern_dir")
            if pattern_dir:
                loaded = load_patterns(str(pattern_dir))
                if loaded:
                    ruler.add_patterns(loaded)
                    pattern_list = getattr(ruler, "patterns", [])
        if not pattern_list:
            nlp.remove_pipe("pattern_ruler")
            print("pattern_ruler removed (no patterns)")
        return nlp

    return _callback
