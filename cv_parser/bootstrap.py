"""Utility helpers to bootstrap spaCy pipelines for the CV parser."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, List

import spacy
from spacy.language import Language
from spacy.tokens import DocBin
from spacy.training import Example
from spacy.util import load_config, load_model_from_config

from cv_parser import training_callbacks as _training_callbacks  # noqa: F401
from cv_parser import patterns as _patterns  # noqa: F401

_DEFAULT_CONFIG = (Path(__file__).resolve().parent / "configs" / "config_xlmroberta.cfg").resolve()


def _candidate_paths(value: str) -> Iterable[Path]:
    """Yield potential filesystem locations for a config string."""

    raw = Path(value)
    if raw.is_absolute():
        yield raw
    else:
        yield Path.cwd() / raw
        yield _DEFAULT_CONFIG.parent / raw
    if raw.exists():  # reuse existing relative path resolution
        yield raw.resolve()


def _initialization_examples(cfg, nlp: Language, limit: int) -> List[Example]:
    """Load a small batch of training examples to initialise components."""

    examples: List[Example] = []
    train_path = cfg.get("paths", {}).get("train")
    if not train_path:
        return examples

    candidate = Path(train_path)
    if not candidate.exists():
        candidate = (_DEFAULT_CONFIG.parent / train_path).resolve()
    if not candidate.exists():  # fall back to current working directory
        candidate = (Path.cwd() / train_path).resolve()
    if not candidate.exists():
        return examples

    try:
        docbin = DocBin().from_disk(candidate)
    except Exception:  # pragma: no cover - safeguard for partial datasets
        return examples

    for doc in docbin.get_docs(nlp.vocab):
        ents = [(ent.start_char, ent.end_char, ent.label_) for ent in doc.ents]
        examples.append(Example.from_dict(nlp.make_doc(doc.text), {"entities": ents}))
        if len(examples) >= limit:
            break
    return examples


def load_multilingual(
    model_dir_or_name: str = str(_DEFAULT_CONFIG),
    *,
    initialize: bool = False,
    example_limit: int = 3,
) -> Language:
    """Load the multilingual spaCy pipeline configured around XLM-RoBERTa.

    The helper accepts either a config file path or an installed model name.
    When a config is provided we construct the pipeline directly from the
    serialized settings while optionally initialising the components using a
    handful of training examples to materialise the transformer weights.
    """

    path_candidate = Path(model_dir_or_name)

    # First allow loading an existing model directory or package name.
    if path_candidate.is_dir():
        return spacy.load(path_candidate.as_posix())
    try:
        return spacy.load(model_dir_or_name)
    except OSError:
        pass

    resolved_path = None
    for candidate in _candidate_paths(model_dir_or_name):
        if candidate.exists():
            resolved_path = candidate.resolve()
            break
    if resolved_path is None:
        raise FileNotFoundError(f"Could not locate spaCy config: {model_dir_or_name}")

    cfg = load_config(resolved_path, interpolate=True)
    lang_code = cfg.get("nlp", {}).get("lang", "xx")
    _ = spacy.blank(lang_code)
    nlp = load_model_from_config(cfg, auto_fill=True, validate=True)
    if nlp.lang != lang_code:
        nlp.lang = lang_code

    if initialize:
        examples = _initialization_examples(cfg, nlp, max(1, example_limit))
        if examples:
            nlp.initialize(lambda: examples)
        else:
            nlp.initialize()
    return nlp


__all__ = ["load_multilingual"]
