#!/usr/bin/env python3
import random
import os
from pathlib import Path
import spacy
from spacy.tokens import DocBin
from spacy.training import Example
from spacy.util import minibatch

# Use absolute path for prev model
BASE = Path(__file__).resolve().parent.parent.parent  # to project root
PREV_MODEL = BASE / "training/out_fix1k_lrtest/model-last"
TRAIN_BIN  = BASE / "my-app/testdata/cv_filtered/train.spacy"
DEV_BIN    = BASE / "my-app/testdata/cv_filtered/dev.spacy"
OUT_DIR    = Path("/Volumes/video/training/out_fix1k_lrtest_cont")

EXTRA_UPDATES = 700
BATCH_SIZE    = 16
DROPOUT       = 0.1
EVAL_EVERY    = 100

def load_docs(db_path, vocab):
    db = DocBin().from_disk(db_path)
    return list(db.get_docs(vocab))

def main():
    print("🔧 Loading prev model:", PREV_MODEL)
    if not PREV_MODEL.exists():
        print(f"❌ ERROR: previous model not found at {PREV_MODEL}")
        return

    nlp = spacy.load(PREV_MODEL.as_posix())
    print("📦 Loaded pipes:", nlp.pipe_names)
    print("📦 Loading data…")
    train_docs = load_docs(TRAIN_BIN, nlp.vocab)
    dev_docs   = load_docs(DEV_BIN, nlp.vocab)
    if not train_docs or not dev_docs:
        print("❌ ERROR: train or dev data empty!")
        return

    train_ex = [
        Example.from_dict(nlp.make_doc(d.text), {"entities":[(e.start_char, e.end_char, e.label_) for e in d.ents]})
        for d in train_docs
    ]
    dev_ex = [Example(nlp.make_doc(d.text), d) for d in dev_docs]

    # Try to align LR scheduler if possible
    total_steps = EXTRA_UPDATES
    # If you know original max_steps, you could read it, otherwise just use a fresh schedule
    print(f"📊 Continuing for {EXTRA_UPDATES} updates. (Batch size {BATCH_SIZE})")

    # Override config for LR schedule
    total_steps = 500 + EXTRA_UPDATES
    nlp.config['training']['max_steps'] = total_steps
    nlp.config['training']['optimizer']['learn_rate']['total_steps'] = total_steps
    nlp.config.interpolate()
    print(f"📊 Set total_steps={total_steps} for LR schedule")
    
    optimizer = nlp.resume_training()

    best_f = 0.0
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for upd in range(1, EXTRA_UPDATES + 1):
        random.shuffle(train_ex)
        losses = {}
        for batch in minibatch(train_ex, size=BATCH_SIZE):
            nlp.update(batch, sgd=optimizer, drop=DROPOUT, losses=losses)
            break  # one batch per update? you may want consistent size; this example simplified

        if upd % EVAL_EVERY == 0 or upd == EXTRA_UPDATES:
            scores = nlp.evaluate(dev_ex)
            f = scores.get("ents_f", 0.0)
            p = scores.get("ents_p", 0.0)
            r = scores.get("ents_r", 0.0)
            print(f"update={upd:>4} | F1={f:.3f}, P={p:.3f}, R={r:.3f} | losses={losses}")

            if f >= best_f:
                best_f = f
                snap = OUT_DIR / "model-best"
                nlp.to_disk(snap)
                print(f"💾 Saved best to {snap} (F1={best_f:.3f})")

    # Save last
    last_path = OUT_DIR / "model-last"
    nlp.to_disk(last_path)
    print(f"✅ Done. Last => {last_path}. Best F1={best_f:.3f}")

if __name__ == "__main__":
    main()
