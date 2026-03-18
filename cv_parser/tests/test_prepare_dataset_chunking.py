from __future__ import annotations

from pathlib import Path

from spacy.training import initialize, loop
from spacy.util import load_config

from cv_parser.prepare_dataset import CorpusBuilder, ParsedRecord


def _encode_wp_length(builder: CorpusBuilder, text: str) -> int:
    return len(
        builder.tokenizer(  # type: ignore[attr-defined]
            text, add_special_tokens=False
        )["input_ids"]
    )


def test_prepare_dataset_chunks_long_resume_and_train(tmp_path: Path) -> None:
    # Build a synthetic resume that significantly exceeds the max wordpiece limit.
    heading = "Candidate Name"
    sections = []
    for idx in range(1, 25):
        body = " ".join([f"experience{idx}"] * 30)
        sections.append(f"Section {idx}\n{body}")
    text = heading + "\n\n" + "\n\n".join(sections)

    spans = [
        (0, len(heading), "NAME"),
        (text.index("Section 1"), text.index("Section 1") + len("Section 1"), "ROLE"),
    ]

    tokenizer_name = "hf-internal-testing/tiny-random-roberta"
    builder = CorpusBuilder(lang="en", max_wp=120, tokenizer_name=tokenizer_name)
    builder.add_record(ParsedRecord(text=text, spans=spans, source="test"))

    assert len(builder.records) >= 2
    assert all(_encode_wp_length(builder, rec.text) <= 120 for rec in builder.records)

    builder.shuffle(seed=13)
    train_records, dev_records = builder.train_dev_split(0.5)
    corpus_dir = tmp_path / "corpora"
    counts = builder.export(train_records, dev_records, corpus_dir)
    assert counts["total"]

    overrides = {
        "paths.train": str(corpus_dir / "train.spacy"),
        "paths.dev": str(corpus_dir / "dev.spacy"),
        "training.max_steps": 1,
        "training.eval_frequency": 1,
        "training.patience": 1,
        "training.max_epochs": 1,
        "training.batcher.size": 4,
        "components.transformer.model.name": tokenizer_name,
    }

    project_root = Path(__file__).resolve().parents[2]
    config_path = project_root / "cv_parser" / "config.cfg"
    config = load_config(str(config_path), overrides=overrides)
    nlp = initialize.init_nlp(config, use_gpu=-1)
    trained_nlp, _ = loop.train(nlp, output_path=None)

    performance = trained_nlp.meta.get("performance", {})
    assert performance, "training loop did not complete an evaluation step"
