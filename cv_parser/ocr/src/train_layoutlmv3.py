#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Train LayoutLMv3 for CV Parsing (MVP, production-ready)

- Fine-tunes LayoutLMv3 (or any LayoutLMv3-compatible checkpoint) on your HF dataset.
- Uses images + words + 0–1000 bboxes with proper word_ids alignment (-100 masking).
- Adds mixed precision toggles (bf16/fp16), gradient checkpointing, early stopping.
- Logs truncation statistics to help you spot overly long pages/resumes.

Dataset expectation (from your builder):
  split columns: ["id","doc_id","page_index","words","bboxes","ner_tags","image_path","width","height","orig_json_path"]
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
from datasets import load_from_disk
from PIL import Image
from seqeval.metrics import precision_score, recall_score, f1_score
from transformers import (
    DataCollatorForTokenClassification,
    EarlyStoppingCallback,
    LayoutLMv3ForTokenClassification,
    LayoutLMv3Processor,
    Trainer,
    TrainingArguments,
    set_seed,
)

# ---------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("train")


# --------------------------- metrics ---------------------------

def compute_metrics(eval_pred: Tuple[np.ndarray, np.ndarray], id2label: Dict[int, str]) -> Dict[str, float]:
    """
    Lightweight seqeval metrics on predictions vs. labels.
    Only numbers are returned (keep compute_metrics cheap).
    """
    predictions, labels = eval_pred
    preds = predictions.argmax(axis=2)

    y_true: List[List[str]] = []
    y_pred: List[List[str]] = []
    for p_row, l_row in zip(preds, labels):
        cur_true, cur_pred = [], []
        for p_i, l_i in zip(p_row.tolist(), l_row.tolist()):
            if l_i == -100:
                continue
            cur_true.append(id2label[int(l_i)])
            cur_pred.append(id2label[int(p_i)])
        y_true.append(cur_true)
        y_pred.append(cur_pred)

    return {
        "precision": float(precision_score(y_true, y_pred)),
        "recall": float(recall_score(y_true, y_pred)),
        "f1": float(f1_score(y_true, y_pred)),
    }


# ------------------------ preprocess -------------------------

def make_preprocess_fn(processor: LayoutLMv3Processor, max_length: int = 512):
    """
    Returns a batched preprocess function that:
      - Loads page images
      - Calls LayoutLMv3Processor(images, words, boxes, ...)
      - Realigns BIO labels with word_ids and masks subword continuations with -100
      - Tracks truncation statistics
    """
    stats = {"samples": 0, "truncated": 0, "words_dropped": 0}

    def _preprocess_batch(batch: Dict[str, Any]) -> Dict[str, Any]:
        images = []
        for p in batch["image_path"]:
            with Image.open(p) as img:
                images.append(img.convert("RGB"))

        encodings = processor(
            images=images,
            text=batch["words"],
            boxes=batch["bboxes"],
            truncation=True,
            padding="max_length",
            max_length=max_length,
        )

        labels_out: List[List[int]] = []
        # truncation accounting (words not represented due to overflow)
        for i, word_labels in enumerate(batch["ner_tags"]):
            word_ids = encodings.word_ids(batch_index=i)
            label_ids: List[int] = []
            prev_wid = None

            # unique word ids that survived tokenization (first subword only)
            seen_words = set()

            for wid in word_ids:
                if wid is None:
                    label_ids.append(-100)
                elif wid != prev_wid:
                    label_ids.append(int(word_labels[wid]))
                    seen_words.add(int(wid))
                else:
                    # continuation subword → ignore for loss
                    label_ids.append(-100)
                prev_wid = wid
            labels_out.append(label_ids)

            # truncation stats
            stats["samples"] += 1
            total_words = len(word_labels)
            dropped = max(0, total_words - len(seen_words))
            if dropped > 0:
                stats["truncated"] += 1
                stats["words_dropped"] += dropped

        encodings["labels"] = labels_out
        # (Optional) keep word_ids if you want to debug later:
        # encodings["word_ids"] = [[-1 if w is None else w for w in encodings.word_ids(i)] for i in range(len(images))]
        return encodings

    # attach a read-only view so caller can log at the end
    _preprocess_batch.stats = stats  # type: ignore[attr-defined]
    return _preprocess_batch


# --------------------------- training ---------------------------

def train_layoutlmv3(
    dataset_path: Path,
    output_dir: Path = Path("runs/layoutlmv3_cv"),
    model_name: str = "microsoft/layoutlmv3-base",
    batch_size: int = 2,
    learning_rate: float = 5e-5,
    num_epochs: int = 3,
    max_length: int = 512,
    dataloader_num_workers: int = 0,
    dataloader_pin_memory: bool = True,
    gradient_accumulation_steps: int = 2,
    weight_decay: float = 0.0,
    warmup_ratio: float = 0.1,
    gradient_checkpointing: bool = False,
    use_fp16: bool = False,
    use_bf16: bool = False,
    optim: str = "adamw_torch",
    early_stopping_patience: int = 0,  # 0 disables early stopping
    seed: int = 42,
) -> None:
    """
    Train LayoutLMv3 for token classification on your HF dataset.
    """
    set_seed(seed)

    log.info("Loading dataset from %s", dataset_path)
    dataset = load_from_disk(str(dataset_path))
    if not {"train", "validation"}.issubset(dataset.keys()):
        raise ValueError("Dataset must have 'train' and 'validation' splits.")

    train_ds, val_ds = dataset["train"], dataset["validation"]

    label_names = train_ds.features["ner_tags"].feature.names
    id2label = {i: l for i, l in enumerate(label_names)}
    label2id = {l: i for i, l in enumerate(label_names)}
    log.info("Labels (%d): %s", len(label_names), label_names)

    # Processor (tokenizer + image preprocessor); we disable built-in OCR
    processor = LayoutLMv3Processor.from_pretrained(model_name, apply_ocr=False)

    model = LayoutLMv3ForTokenClassification.from_pretrained(
        model_name,
        num_labels=len(label_names),
        id2label=id2label,
        label2id=label2id,
        # SDPA often speeds up attention on recent PyTorch; harmless if ignored by older versions
        attn_implementation="sdpa",
    )

    # Gradient checkpointing to save memory (slower, but handy for 512 tokens)
    if gradient_checkpointing:
        model.gradient_checkpointing_enable()

    preprocess_fn = make_preprocess_fn(processor, max_length=max_length)

    log.info("Tokenizing datasets (max_length=%d)...", max_length)
    train_tok = train_ds.map(
        preprocess_fn, batched=True, remove_columns=train_ds.column_names, desc="Tokenize train"
    )
    val_tok = val_ds.map(
        preprocess_fn, batched=True, remove_columns=val_ds.column_names, desc="Tokenize val"
    )

    # Log truncation stats
    stats = preprocess_fn.stats  # type: ignore[attr-defined]
    if stats["samples"] > 0:
        trunc_rate = stats["truncated"] / stats["samples"]
        avg_drop = (stats["words_dropped"] / stats["truncated"]) if stats["truncated"] else 0.0
        log.info(
            "Truncation: %d/%d samples (%.2f%%), avg words dropped (truncated only)=%.2f",
            stats["truncated"], stats["samples"], trunc_rate * 100.0, avg_drop,
        )

    # Collator
    collator = DataCollatorForTokenClassification(tokenizer=processor.tokenizer)

    # Mixed precision knobs (bf16 on Ampere+, else fp16 on CUDA if requested)
    # You control via CLI flags; defaults keep both False for CPU/MPS safety.
    args = TrainingArguments(
        output_dir=str(output_dir),
        # core schedule
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        learning_rate=learning_rate,
        num_train_epochs=num_epochs,
        gradient_accumulation_steps=gradient_accumulation_steps,
        weight_decay=weight_decay,
        warmup_ratio=warmup_ratio,
        lr_scheduler_type="cosine",

        # evaluation/checkpointing
        evaluation_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        greater_is_better=True,

        # logging
        logging_dir=str(output_dir / "logs"),
        logging_steps=25,
        logging_first_step=True,
        report_to="none",

        # dataloader performance
        dataloader_num_workers=dataloader_num_workers,
        dataloader_pin_memory=dataloader_pin_memory,
        # keep columns we produced
        remove_unused_columns=False,

        # precision / optimizer
        fp16=use_fp16,
        bf16=use_bf16,
        optim=optim,

        seed=seed,
    )

    # Optional early stopping
    callbacks = []
    if early_stopping_patience and early_stopping_patience > 0:
        callbacks.append(EarlyStoppingCallback(early_stopping_patience=early_stopping_patience))

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train_tok,
        eval_dataset=val_tok,
        data_collator=collator,
        tokenizer=processor.tokenizer,
        compute_metrics=lambda p: compute_metrics(p, id2label),
        callbacks=callbacks,
    )

    log.info("Starting training...")
    trainer.train()
    log.info("Saving model + processor to %s", output_dir)
    trainer.save_model(str(output_dir))
    processor.save_pretrained(str(output_dir))

    log.info("Evaluating best checkpoint...")
    results = trainer.evaluate()
    log.info("Validation metrics: %s", results)


# ------------------------------- CLI -------------------------------

def main() -> None:
    import argparse

    ap = argparse.ArgumentParser(description="Train LayoutLMv3 for CV parsing")
    ap.add_argument("--dataset-path", required=True, help="HF dataset folder")
    ap.add_argument("--output-dir", default="runs/layoutlmv3_cv")
    ap.add_argument("--model-name", default="microsoft/layoutlmv3-base")

    ap.add_argument("--batch-size", type=int, default=2)
    ap.add_argument("--learning-rate", type=float, default=5e-5)
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--max-length", type=int, default=512)

    ap.add_argument("--num-workers", type=int, default=0)
    ap.add_argument("--pin-memory", action="store_true")
    ap.add_argument("--grad-accum", type=int, default=2)
    ap.add_argument("--weight-decay", type=float, default=0.0)
    ap.add_argument("--warmup-ratio", type=float, default=0.1)

    ap.add_argument("--gradient-checkpointing", action="store_true")
    ap.add_argument("--fp16", action="store_true")
    ap.add_argument("--bf16", action="store_true")
    ap.add_argument("--optim", default="adamw_torch", choices=[
        "adamw_torch", "adamw_torch_fused", "adamw_hf", "adamw_8bit", "adafactor"
    ])

    ap.add_argument("--early-stopping-patience", type=int, default=0, help="0 disables early stopping")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    train_layoutlmv3(
        dataset_path=Path(args.dataset_path),
        output_dir=Path(args.output_dir),
        model_name=args.model_name,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        num_epochs=args.epochs,
        max_length=args.max_length,
        dataloader_num_workers=args.num_workers,
        dataloader_pin_memory=args.pin_memory,
        gradient_accumulation_steps=args.grad_accum,
        weight_decay=args.weight_decay,
        warmup_ratio=args.warmup_ratio,
        gradient_checkpointing=args.gradient_checkpointing,
        use_fp16=args.fp16,
        use_bf16=args.bf16,
        optim=args.optim,
        early_stopping_patience=args.early_stopping_patience,
        seed=args.seed,
    )


if __name__ == "__main__":
    main()
