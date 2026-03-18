import random
import spacy
from spacy.tokens import DocBin

import cv_parser.bootstrap  # noqa: F401 ensures custom components register

MODEL_PATH = "training/output_main/model-last"
DEV_PATH = "my-app/testdata/cv/dev.spacy"
SAMPLES = 5

nlp = spacy.load(MODEL_PATH)
docbin = DocBin().from_disk(DEV_PATH)
docs = list(docbin.get_docs(nlp.vocab))

random.seed(0)
for i, doc in enumerate(random.sample(docs, SAMPLES)):
    parsed = nlp(doc.text)
    by_label = {}
    for ent in parsed.ents:
        by_label.setdefault(ent.label_, []).append(ent.text)
    print(f"--- sample {i} ---")
    for label, spans in sorted(by_label.items(), key=lambda item: -len(item[1])):
        preview = spans[:10]
        print(f"{label}: {preview}")
    if not by_label:
        print("(no entities)")
