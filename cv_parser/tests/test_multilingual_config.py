"""Smoke checks for the multilingual spaCy pipeline configuration."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

from cv_parser.bootstrap import load_multilingual

CONFIG_PATH = Path("cv_parser/configs/config_xlmroberta.cfg")
RUN_MULTILINGUAL_SMOKE = os.environ.get("RUN_MULTILINGUAL_SMOKE") == "1"


@pytest.mark.slow
def test_spacy_debug_config_runs() -> None:
    """Ensure ``spacy debug config`` completes for the multilingual config."""

    if not RUN_MULTILINGUAL_SMOKE:
        pytest.skip("Set RUN_MULTILINGUAL_SMOKE=1 to enable multilingual smoke checks")

    result = subprocess.run(
        ["python", "-m", "spacy", "debug", "config", str(CONFIG_PATH)],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        pytest.fail(
            "spacy debug config failed:\n"
            f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )


@pytest.mark.slow
def test_multilingual_pipeline_handles_fr_es_texts() -> None:
    """The bootstrap helper should load and process FR/ES snippets without errors."""

    if not RUN_MULTILINGUAL_SMOKE:
        pytest.skip("Set RUN_MULTILINGUAL_SMOKE=1 to enable multilingual smoke checks")

    try:
        nlp = load_multilingual(initialize=True, example_limit=2)
    except (OSError, FileNotFoundError, ImportError) as exc:  # pragma: no cover - depends on HF cache
        pytest.skip(f"Multilingual model weights unavailable: {exc}")

    samples = [
        "Expérience professionnelle – septembre 2021 à Toulouse.",
        "Logros principales obtenidos en dic. 2023 en Madrid.",
        "Bénévole depuis avr. 2018 dans une association locale.",
    ]
    docs = list(nlp.pipe(samples))
    assert len(docs) == len(samples)
    for doc in docs:
        # Accessing the transformer outputs confirms the forward pass executed.
        trf_data = getattr(doc._, "trf_data", None)
        if trf_data is None:
            pytest.skip("spaCy transformers extensions missing; ensure spacy-transformers is installed")
        assert trf_data.tensors, "Transformer component did not produce tensors"
        assert all(tensor.shape[0] > 0 for tensor in trf_data.tensors)
