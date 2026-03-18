#!/usr/bin/env python3
"""
Instrumented minimal training loop to reproduce where spaCy training may hang.

What it does:
- Loads 4 examples from my-app/testdata/cv_filtered/train.spacy
- Builds the pipeline from cv_parser/config.cfg
- Initializes the pipeline for training
- Runs a single nlp.update(...) and prints progress markers and timings

Run with safe env vars to reduce macOS thread deadlocks:
OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 TOKENIZERS_PARALLELISM=false python debug_train.py
"""
from pathlib import Path
import time
import sys
import traceback

def now():
    return time.strftime("%H:%M:%S")

print(f"[{now()}] debug_train.py start")
try:
    import spacy
    from spacy.tokens import DocBin
    from spacy.training import Example
    from spacy.util import load_model_from_config
except Exception as e:
    print(f"[{now()}] IMPORT ERROR: {e}", file=sys.stderr)
    traceback.print_exc()
    sys.exit(1)

import cv_parser.bootstrap  # registers custom components and callbacks used by the config

cfg_path = Path("cv_parser/config.cfg").resolve()
print(f"[{now()}] Using config path: {cfg_path}")
train_path = Path("my-app/testdata/cv_filtered/train.spacy").resolve()

if not cfg_path.exists():
    print(f"[{now()}] Config not found: {cfg_path}", file=sys.stderr)
    sys.exit(2)
if not train_path.exists():
    print(f"[{now()}] Train file not found: {train_path}", file=sys.stderr)
    sys.exit(2)

print(f"[{now()}] Loading 4 examples from {train_path}")
t0 = time.time()
db = DocBin().from_disk(str(train_path))
# Use a lightweight blank vocab to extract gold docs (no transformer tokenization)
blank = spacy.blank("en")
gold_docs = list(db.get_docs(blank.vocab))[:4]
t1 = time.time()
print(f"[{now()}] Loaded {len(gold_docs)} gold docs (timings: load_docs={t1-t0:.3f}s)")

# Extract simple entity dicts per doc
examples_data = []
for gd in gold_docs:
    ents = []
    for ent in gd.ents:
        ents.append((ent.start_char, ent.end_char, ent.label_))
    examples_data.append({"text": gd.text, "entities": ents})

print(f"[{now()}] Building pipeline from config: {cfg_path}")
t2 = time.time()
try:
    # Use spaCy util API compatible with the installed spaCy version
    from spacy import util
    cfg_obj = util.load_config(cfg_path)
    nlp = util.load_model_from_config(cfg_obj)
except Exception as e:
    # Fallback: try passing path/string to load_model_from_config
    print(f"[{now()}] Warning: util.load_config/load_model_from_config failed: {e}", file=sys.stderr)
    nlp = load_model_from_config(str(cfg_path), auto_fill=True)
t3 = time.time()
print(f"[{now()}] Pipeline built: {nlp.pipe_names} (build_time={t3-t2:.3f}s)")

# Create Example objects suitable for nlp.update
examples = []
for d in examples_data:
    pred = nlp.make_doc(d["text"])
    # Use from_dict to supply gold entities
    try:
        ex = Example.from_dict(pred, {"entities": d["entities"]})
    except Exception:
        # Last-resort: create reference doc with gold tokenization using nlp.tokenizer then Example(ref, ref)
        ref = nlp(d["text"])
        ex = Example(pred, ref)
    examples.append(ex)

print(f"[{now()}] Prepared {len(examples)} Example objects")

# Initialize and run a single update
print(f"[{now()}] Initializing pipeline for training")
t_init0 = time.time()
try:
    # Provide a get_examples callable that yields the Examples for initialization
    nlp.initialize(lambda: (e for e in examples))
except Exception as e:
    print(f"[{now()}] ERROR during initialize: {e}", file=sys.stderr)
    traceback.print_exc()
    sys.exit(1)
t_init1 = time.time()
print(f"[{now()}] Initialization done (time={t_init1-t_init0:.3f}s)")

print(f"[{now()}] Creating optimizer")
try:
    optimizer = nlp.create_optimizer()
except Exception:
    # Older/newer spaCy versions may expose different API
    try:
        optimizer = nlp.resume_training()
    except Exception as e:
        print(f"[{now()}] Failed to create optimizer: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

print(f"[{now()}] Running one update()")
t_up0 = time.time()
losses = {}
try:
    nlp.update(examples, sgd=optimizer, losses=losses)
except Exception as e:
    print(f"[{now()}] ERROR during nlp.update: {e}", file=sys.stderr)
    traceback.print_exc()
    sys.exit(1)
t_up1 = time.time()
print(f"[{now()}] First update done (time={t_up1-t_up0:.3f}s) losses={losses}")

print(f"[{now()}] debug_train.py finished successfully")
sys.exit(0)