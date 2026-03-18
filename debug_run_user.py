#!/usr/bin/env python3
import time, sys
from pathlib import Path
import spacy
from spacy.training import Example
from spacy.util import load_model_from_config
import cv_parser.bootstrap  # ensure custom components registered

def now(): return time.strftime("%H:%M:%S")

cfg_path = Path("cv_parser/config.cfg").resolve()
train_path = Path("my-app/testdata/cv_filtered/train.spacy").resolve()

print(f"[{now()}] debug_train.py start")
print(f"[{now()}] Using config path: {cfg_path}")
print(f"[{now()}] Loading few examples from {train_path}")
import srsly
from spacy.training import Corpus
corpus = Corpus(train_path)
docs = list(corpus(nlp=None))[:4]
print(f"[{now()}] Loaded {len(docs)} gold docs")

print(f"[{now()}] Building pipeline from config...")
try:
    from spacy import util
    cfg = util.load_config(cfg_path)
    nlp = util.load_model_from_config(cfg)
except Exception as e:
    print(f"[{now()}] Pipeline build failed: {e}", file=sys.stderr)
    sys.exit(1)
print(f"[{now()}] Pipeline built: {nlp.pipe_names}")

print(f"[{now()}] Preparing Examples...")
examples = [Example.from_dict(nlp.make_doc(d.text), d.to_dict()) for d in docs]
print(f"[{now()}] Prepared {len(examples)} examples")

print(f"[{now()}] Initializing...")
nlp.initialize(lambda: examples)
print(f"[{now()}] Initialization done")

print(f"[{now()}] Creating optimizer & running 1 update...")
optimizer = nlp.resume_training()
losses = nlp.update(examples, sgd=optimizer)
print(f"[{now()}] First update done, losses={losses}")

print(f"[{now()}] debug_train.py finished successfully")