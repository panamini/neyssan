#!/usr/bin/env python3
"""
Evaluate LayoutLMv3 for CV Parsing (robust with word alignment)

- Mirrors training preprocessing (images + words + boxes, -100 masking)
- Uses Trainer.predict() for batched inference
- Computes seqeval precision/recall/F1 + per-label report offline
- Aligns predictions back to words using word_ids
- Saves metrics, error analysis, and (optional) per-word predictions
"""

import csv
import json
import logging
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
from datasets import load_from_disk
from PIL import Image
from seqeval.metrics import classification_report, f1_score, precision_score, recall_score
from transformers import (
    DataCollatorForTokenClassification,
    LayoutLMv3ForTokenClassification,
    LayoutLMv3Processor,
    Trainer,
    TrainingArguments,
    set_seed,
)

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("eval")


# --------------------------- Preprocessing ---------------------------

def _preprocess_batch(batch, processor):
    """Tokenize and align labels, store word_ids for later error analysis."""
    images = []
    for p in batch["image_path"]:
        with Image.open(p) as img:
            images.append(img.convert("RGB"))

    enc = processor(
        images=images,
        text=batch["words"],
        boxes=batch["bboxes"],
        truncation=True,
        padding="max_length",
        max_length=512,
    )

    labels_out: List[List[int]] = []
    word_ids_all: List[List[int]] = []
    for i, word_labels in enumerate(batch["ner_tags"]):
        word_ids = enc.word_ids(batch_index=i)
        prev_wid = None
        aligned = []
        for wid in word_ids:
            if wid is None:
                aligned.append(-100)
            elif wid != prev_wid:
                aligned.append(int(word_labels[wid]))
            else:
                aligned.append(-100)
            prev_wid = wid
        labels_out.append(aligned)
        word_ids_all.append([wid if wid is not None else -1 for wid in word_ids])

    enc["labels"] = labels_out
    enc["word_ids"] = word_ids_all
    return enc


# --------------------------- Metrics helpers ---------------------------

def _seqeval_from_logits_and_labels(
    logits: np.ndarray, labels: np.ndarray, word_ids_list: List[List[int]], id2label: Dict[int, str]
) -> Tuple[List[List[str]], List[List[str]]]:
    """Convert logits+labels+word_ids into per-word true/pred label sequences."""
    preds = np.argmax(logits, axis=2)

    y_true, y_pred = [], []
    for p_row, l_row, wids in zip(preds, labels, word_ids_list):
        word_level_true, word_level_pred = {}, {}
        for p_i, l_i, wid in zip(p_row.tolist(), l_row.tolist(), wids):
            if wid == -1 or l_i == -100:
                continue
            if wid not in word_level_true:  # take only first subword
                word_level_true[wid] = id2label[int(l_i)]
                word_level_pred[wid] = id2label[int(p_i)]
        y_true.append([word_level_true[i] for i in sorted(word_level_true)])
        y_pred.append([word_level_pred[i] for i in sorted(word_level_pred)])
    return y_true, y_pred


def _analyze_errors(
    y_true: List[List[str]],
    y_pred: List[List[str]],
    words_list: List[List[str]],
) -> Dict:
    """Error diagnostics aligned with words."""
    from collections import defaultdict

    analysis = {
        "common_errors": defaultdict(int),
        "false_positives": defaultdict(list),
        "false_negatives": defaultdict(list),
        "confusion_matrix": defaultdict(lambda: defaultdict(int)),
    }

    for t_seq, p_seq, w_seq in zip(y_true, y_pred, words_list):
        for t, p, w in zip(t_seq, p_seq, w_seq):
            if t != p:
                key = f"{t}->{p}"
                analysis["common_errors"][key] += 1
                if p != "O" and t == "O":
                    analysis["false_positives"][p].append(w)
                elif p == "O" and t != "O":
                    analysis["false_negatives"][t].append(w)
                analysis["confusion_matrix"][t][p] += 1

    return {
        "common_errors": dict(sorted(analysis["common_errors"].items(), key=lambda x: x[1], reverse=True)),
        "false_positives": {k: v[:20] for k, v in analysis["false_positives"].items()},
        "false_negatives": {k: v[:20] for k, v in analysis["false_negatives"].items()},
        "confusion_matrix": {k: dict(v) for k, v in analysis["confusion_matrix"].items()},
    }


# --------------------------- Main evaluation ---------------------------

def evaluate_model(
    model_path: Path,
    dataset_path: Path,
    output_dir: Path = Path("evaluation_results"),
    split: str = "test",
    batch_size: int = 4,
    num_workers: int = 0,
    fp16: bool = False,
    seed: int = 42,
    save_preds: bool = False,
):
    set_seed(seed)

    dset = load_from_disk(str(dataset_path))
    if split in dset:
        eval_ds_raw = dset[split]
    elif "validation" in dset:
        eval_ds_raw = dset["validation"]
        log.warning(f'Split "{split}" not found. Falling back to "validation".')
    else:
        raise ValueError("Dataset must contain 'test' or 'validation' split.")

    words_list = [words for words in eval_ds_raw["words"]]

    processor = LayoutLMv3Processor.from_pretrained(str(model_path), apply_ocr=False)
    model = LayoutLMv3ForTokenClassification.from_pretrained(str(model_path))
    id2label = {int(k): v for k, v in model.config.id2label.items()}

    log.info("Tokenizing evaluation split…")
    eval_ds = eval_ds_raw.map(
        lambda batch: _preprocess_batch(batch, processor),
        batched=True,
        remove_columns=eval_ds_raw.column_names,
        desc="Tokenize+align",
    )

    collator = DataCollatorForTokenClassification(tokenizer=processor.tokenizer)

    args = TrainingArguments(
        output_dir=str(output_dir / "tmp_trainer"),
        per_device_eval_batch_size=batch_size,
        dataloader_num_workers=num_workers,
        report_to="none",
        fp16=fp16,
    )

    trainer = Trainer(
        model=model,
        args=args,
        eval_dataset=eval_ds,
        tokenizer=processor.tokenizer,
        data_collator=collator,
    )

    log.info(f"Running batched inference on {len(eval_ds)} samples…")
    pred = trainer.predict(eval_ds)

    y_true, y_pred = _seqeval_from_logits_and_labels(
        pred.predictions, pred.label_ids, eval_ds["word_ids"], id2label
    )

    # Check dataset/word alignment
    for i, (t_seq, w_seq) in enumerate(zip(y_true, words_list)):
        if len(t_seq) != len(w_seq):
            log.warning(f"Length mismatch: sample {i} labels={len(t_seq)} words={len(w_seq)}")

    metrics = {
        "precision": float(precision_score(y_true, y_pred)),
        "recall": float(recall_score(y_true, y_pred)),
        "f1": float(f1_score(y_true, y_pred)),
    }
    report = classification_report(y_true, y_pred, output_dict=True)
    errors = _analyze_errors(y_true, y_pred, words_list)

    output_dir.mkdir(parents=True, exist_ok=True)
    with open(output_dir / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    with open(output_dir / "classification_report.json", "w") as f:
        json.dump(report, f, indent=2)
    with open(output_dir / "error_analysis.json", "w") as f:
        json.dump(errors, f, indent=2)

    if save_preds:
        csv_path = output_dir / "predictions.csv"
        with open(csv_path, "w", newline="") as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(["sample_id", "word", "true_label", "pred_label"])
            for sid, (words, t_seq, p_seq) in enumerate(zip(words_list, y_true, y_pred)):
                for w, t, p in zip(words, t_seq, p_seq):
                    writer.writerow([sid, w, t, p])
        log.info(f"Saved per-word predictions to {csv_path}")

    log.info("=== EVALUATION SUMMARY ===")
    log.info(f"Precision: {metrics['precision']:.4f}")
    log.info(f"Recall:    {metrics['recall']:.4f}")
    log.info(f"F1 Score:  {metrics['f1']:.4f}")

    for k, v in list(errors["common_errors"].items())[:5]:
        log.info(f"  {k}: {v}x")


def main():
    import argparse

    ap = argparse.ArgumentParser(description="Evaluate LayoutLMv3 for CV parsing")
    ap.add_argument("--model-path", required=True)
    ap.add_argument("--dataset-path", required=True)
    ap.add_argument("--output-dir", default="evaluation_results")
    ap.add_argument("--split", default="test")
    ap.add_argument("--batch-size", type=int, default=4)
    ap.add_argument("--num-workers", type=int, default=0)
    ap.add_argument("--fp16", action="store_true")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--save-preds", action="store_true")
    args = ap.parse_args()

    evaluate_model(
        model_path=Path(args.model_path),
        dataset_path=Path(args.dataset_path),
        output_dir=Path(args.output_dir),
        split=args.split,
        batch_size=args.batch_size,
        num_workers=args.num_workers,
        fp16=args.fp16,
        seed=args.seed,
        save_preds=args.save_preds,
    )


if __name__ == "__main__":
    main()
