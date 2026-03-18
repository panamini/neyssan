#!/usr/bin/env python3
"""
Debug learning rate and gradients using the full CV parser bootstrap.
"""

import spacy
from pathlib import Path
from spacy.training import Example
from cv_parser import bootstrap  # <-- ensure we use your actual bootstrap hooks

CONFIG = "cv_parser/config_roberta.cfg"
TRAIN = "my-app/testdata/cv_filtered/train.spacy"

print("🔧 Loading project config with bootstrap…")
config = spacy.util.load_config(CONFIG)
nlp = spacy.util.load_model_from_config(config, auto_fill=True, validate=True)

# Apply any bootstrap logic you have
if hasattr(bootstrap, "patch_pipeline"):
    print("🔧 Applying bootstrap.patch_pipeline()")
    bootstrap.patch_pipeline(nlp)

train_corpus = spacy.Corpus(TRAIN)
examples = list(train_corpus(nlp))[:4]

print("🔧 Initializing components & optimizer…")
optimizer = nlp.initialize(lambda: examples)

print(f"✅ Optimizer initial learn rate: {optimizer.learn_rate}")
losses = {}
nlp.update(examples, sgd=optimizer, losses=losses)
print(f"🔧 After first update: losses = {losses}")
print(f"🔧 Current LR after step: {optimizer.learn_rate}")

# Gradient norm check
transformer = nlp.get_pipe("transformer")
total_norm = 0.0
for name, param in transformer.model.named_parameters():
    if param.grad is not None:
        total_norm += param.grad.norm().item()
print(f"🔧 Total gradient norm after step: {total_norm:.4f}")
