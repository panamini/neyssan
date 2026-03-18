import json
from pathlib import Path

import spacy
from spacy.tokens import DocBin, Span

from cv_parser import evaluate_report


def build_test_model(tmp_path: Path) -> Path:
    nlp = spacy.blank("en")
    ruler = nlp.add_pipe("entity_ruler")
    ruler.add_patterns(
        [
            {"label": "ROLE", "pattern": "Engineer"},
            {"label": "COMPANY", "pattern": "Acme University"},
            {"label": "CERTIFICATE", "pattern": "BSc"},
        ]
    )
    model_dir = tmp_path / "model"
    nlp.to_disk(model_dir)
    return model_dir


def build_gold_docbin(tmp_path: Path) -> Path:
    gold_nlp = spacy.blank("en")
    docs = []

    doc1 = gold_nlp.make_doc("Engineer")
    doc1.ents = [Span(doc1, 0, 1, label="SKILL")]
    docs.append(doc1)

    doc2 = gold_nlp.make_doc("Acme University")
    doc2.ents = [Span(doc2, 0, 2, label="INSTITUTION")]
    docs.append(doc2)

    doc3 = gold_nlp.make_doc("BSc")
    doc3.ents = [Span(doc3, 0, 1, label="DEGREE")]
    docs.append(doc3)

    docbin = DocBin(store_user_data=False)
    for doc in docs:
        docbin.add(doc)

    data_path = tmp_path / "dev.spacy"
    docbin.to_disk(data_path)
    return data_path


def test_evaluate_report_outputs_confusion_and_remediation(tmp_path, capsys):
    model_dir = build_test_model(tmp_path)
    data_path = build_gold_docbin(tmp_path)

    report = {
        "ents_p": 0.2,
        "ents_r": 0.2,
        "ents_f": 0.2,
        "ents_per_type": {
            "ROLE": {"p": 0.1, "r": 0.1, "f": 0.1},
            "COMPANY": {"p": 0.1, "r": 0.1, "f": 0.1},
            "INSTITUTION": {"p": 0.1, "r": 0.1, "f": 0.1},
            "DEGREE": {"p": 0.4, "r": 0.4, "f": 0.4},
            "START_DATE": {"p": 0.5, "r": 0.5, "f": 0.5},
            "END_DATE": {"p": 0.29, "r": 0.29, "f": 0.29},
        },
    }
    report_path = tmp_path / "report.json"
    report_path.write_text(json.dumps(report), encoding="utf-8")

    remediation_path = tmp_path / "remediation.json"

    evaluate_report.main(
        [
            str(report_path),
            "--model-dir",
            str(model_dir),
            "--data-path",
            str(data_path),
            "--remediation-threshold",
            "0.3",
            "--remediation-output",
            str(remediation_path),
        ]
    )

    captured = capsys.readouterr()
    assert "Overall:" in captured.out
    assert "ROLE ↔ SKILL" in captured.out
    assert "COMPANY ↔ INSTITUTION" in captured.out
    assert "DEGREE ↔ CERTIFICATE" in captured.out
    assert "Remediation plan:" in captured.out
    assert "ROLE:+250" in captured.out
    assert "COMPANY:+250" in captured.out
    assert "INSTITUTION:+250" in captured.out
    assert "END_DATE:+200" in captured.out

    data = json.loads(remediation_path.read_text())
    assert "advice" in data
    assert "ROLE:+250" in data["advice"]
