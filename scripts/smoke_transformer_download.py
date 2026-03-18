#!/usr/bin/env python3
from pathlib import Path
import time
import sys

def now():
  return time.strftime("%H:%M:%S")

print(f"[{now()}] Starting smoke transformer download/test")

try:
  import torch
  import transformers
  import spacy
except Exception as e:
  print(f"[{now()}] Failed importing libs: {e}", file=sys.stderr)
  raise

print(f"[{now()}] python: {sys.version.split()[0]}")
print(f"[{now()}] torch: {getattr(torch, '__version__', 'n/a')}, mps_available: {torch.backends.mps.is_available()}, mps_built: {torch.backends.mps.is_built()}")
print(f"[{now()}] spacy: {spacy.__version__}")
print(f"[{now()}] transformers: {getattr(transformers, '__version__', 'n/a')}")

from transformers import AutoModel

model_name = "distilroberta-base"
print(f"[{now()}] Starting AutoModel.from_pretrained('{model_name}')")
t0 = time.time()
try:
  m = AutoModel.from_pretrained(model_name)
except Exception as e:
  print(f"[{now()}] Error during download/instantiate: {e}", file=sys.stderr)
  raise
t1 = time.time()
print(f"[{now()}] from_pretrained done in {t1 - t0:.2f}s, model type: {type(m)}")

device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
print(f"[{now()}] Moving model to device: {device}")
t2 = time.time()
try:
  m.to(device)
except Exception as e:
  print(f"[{now()}] Error moving model to device: {e}", file=sys.stderr)
  raise
t3 = time.time()
print(f"[{now()}] Model moved to device in {t3 - t2:.2f}s")
print(f"[{now()}] Done smoke test")