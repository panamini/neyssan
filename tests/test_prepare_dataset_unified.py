import json
from collections import Counter
from pathlib import Path

import pytest

from cv_parser import prepare_dataset


class DummyAutoTokenizer:
    def __init__(self) -> None:
        self.is_fast = True
        self.model_max_length = 512

    @classmethod
    def from_pretrained(cls, name: str, use_fast: bool = True):
        return cls()

    def __call__(self, text: str, add_special_tokens: bool = False, return_offsets_mapping: bool = True):
        offsets = []
        start = 0
        for token in text.split():
            idx = text.find(token, start)
            offsets.append((idx, idx + len(token)))
            start = idx + len(token)
        if not offsets:
            offsets = [(0, 0)]
        return {"offset_mapping": offsets, "input_ids": list(range(len(offsets)))}


def test_prepare_dataset_filters_skills(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(prepare_dataset, "AutoTokenizer", DummyAutoTokenizer)

    span_dir = tmp_path / "span_data"
    span_dir.mkdir()
    sample = {
        "text": "Python developer proficient with Gmail automation.",
        "annotations": [
            {"start": 0, "end": 6, "label": "SKILL"},
            {"start": 7, "end": 16, "label": "ROLE"},
            {"start": 33, "end": 38, "label": "SKILL"},
        ],
    }
    (span_dir / "doc1.json").write_text(json.dumps(sample), encoding="utf-8")

    esco_path = tmp_path / "skills_en.csv"
    esco_path.write_text("preferredLabel,altLabels\nPython,\n", encoding="utf-8")

    mapping_path = tmp_path / "mapping.yaml"
    mapping_path.write_text("mappings:\n  ROLE: DROP\n", encoding="utf-8")

    output_dir = tmp_path / "output"

    argv = [
        "prepare_dataset_unified.py",
        str(span_dir),
        "--output-dir",
        str(output_dir),
        "--tokenizer-name",
        "dummy",
        "--dedup",
        "--no-oversample",
        "--no-augment-missing",
        "--auto-drop-threshold",
        "0",
        "--min-per-label",
        "1",
        "--min-per-label-default",
        "1",
        "--priority-labels",
        "ROLE",
        "--filter-skills-with-esco",
        str(esco_path),
        "--keep-top-skill-forms",
        "1",
        "--disable-guardrails",
        "--mapping",
        str(mapping_path),
        "--report-esco-domains",
    ]

    monkeypatch.setattr("sys.argv", argv)

    prepare_dataset.main()

    captured = capsys.readouterr()
    assert "SKILL filtering summary" in captured.out
    assert "ESCO coverage" in captured.out
    assert "ESCO domain coverage (frequency):" in captured.out
    assert "Dropped spans via DROP mapping" in captured.out
    assert "Stoplist hits" in captured.out

    train_path = output_dir / "train.spacy"
    dev_path = output_dir / "dev.spacy"
    assert train_path.exists()
    assert dev_path.exists()

    import spacy
    from spacy.tokens import DocBin

    nlp = spacy.blank("en")
    docs = list(DocBin().from_disk(train_path).get_docs(nlp.vocab))
    skill_spans = [span for doc in docs for span in doc.ents if span.label_ == "SKILL"]
    surfaces = {span.text for span in skill_spans}
    assert surfaces == {"Python"}


def test_guardrails_raise_for_low_skill(tmp_path, monkeypatch):
    monkeypatch.setattr(prepare_dataset, "AutoTokenizer", DummyAutoTokenizer)

    span_dir = tmp_path / "span_data"
    span_dir.mkdir()
    sample = {
        "text": "Python developer.",
        "annotations": [
            {"start": 0, "end": 6, "label": "SKILL"},
        ],
    }
    (span_dir / "doc1.json").write_text(json.dumps(sample), encoding="utf-8")

    esco_path = tmp_path / "skills_en.csv"
    esco_path.write_text("preferredLabel,altLabels\nPython,\n", encoding="utf-8")

    argv = [
        "prepare_dataset_unified.py",
        str(span_dir),
        "--output-dir",
        str(tmp_path / "output"),
        "--tokenizer-name",
        "dummy",
        "--dedup",
        "--no-oversample",
        "--no-augment-missing",
        "--auto-drop-threshold",
        "0",
        "--min-per-label",
        "0",
        "--min-per-label-default",
        "0",
        "--priority-labels",
        "SKILL",
        "--filter-skills-with-esco",
        str(esco_path),
        "--keep-top-skill-forms",
        "1",
    ]

    monkeypatch.setattr("sys.argv", argv)

    with pytest.raises(RuntimeError, match="SKILL spans below 20000"):
        prepare_dataset.main()


def test_dev_split_receives_priority_labels(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(prepare_dataset, "AutoTokenizer", DummyAutoTokenizer)

    span_dir = tmp_path / "span_data"
    span_dir.mkdir()

    doc_train = {
        "text": "Engineer at Acme Corp.",
        "annotations": [
            {"start": 0, "end": 8, "label": "ROLE"},
            {"start": 12, "end": 21, "label": "COMPANY"},
            {"start": 12, "end": 21, "label": "SKILL"},
        ],
    }
    doc_dev = {
        "text": "General Python work.",
        "annotations": [
            {"start": 8, "end": 14, "label": "SKILL"},
        ],
    }
    (span_dir / "train.json").write_text(json.dumps(doc_train), encoding="utf-8")
    (span_dir / "dev.json").write_text(json.dumps(doc_dev), encoding="utf-8")

    esco_path = tmp_path / "skills_en.csv"
    esco_path.write_text("preferredLabel,altLabels\nskill,\n", encoding="utf-8")

    output_dir = tmp_path / "output"

    mapping_path = tmp_path / "map.yaml"
    mapping_path.write_text("mappings:\n  ROLE: ROLE\n  COMPANY: COMPANY\n  SKILL: SKILL\n", encoding="utf-8")

    argv = [
        "prepare_dataset_unified.py",
        str(span_dir),
        "--output-dir",
        str(output_dir),
        "--tokenizer-name",
        "dummy",
        "--dedup",
        "--no-oversample",
        "--no-augment-missing",
        "--auto-drop-threshold",
        "0",
        "--min-per-label",
        "1",
        "--min-per-label-default",
        "1",
        "--priority-labels",
        "ROLE",
        "--filter-skills-with-esco",
        str(esco_path),
        "--keep-top-skill-forms",
        "0",
        "--disable-guardrails",
        "--mapping",
        str(mapping_path),
    ]

    monkeypatch.setattr("sys.argv", argv)

    prepare_dataset.main()

    captured = capsys.readouterr()
    assert "Adjusted split: ensured ROLE in dev (moved 1 doc)." in captured.out

    from spacy.tokens import DocBin
    import spacy

    dev_docs = list(DocBin().from_disk(output_dir / "dev.spacy").get_docs(spacy.blank("en").vocab))
    assert any(ent.label_ == "ROLE" for doc in dev_docs for ent in doc.ents)


def test_priority_guard_raises_when_label_missing():
    train_counts = Counter({"SKILL": 20000})
    dev_counts = Counter()

    with pytest.raises(RuntimeError, match="Priority labels missing after balancing: ROLE"):
        prepare_dataset.enforce_guardrails(
            train_counts=train_counts,
            dev_counts=dev_counts,
            priority_labels={"ROLE"},
            min_per_label=0,
            min_per_label_default=0,
        )
