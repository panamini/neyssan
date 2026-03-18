#!/usr/bin/env python3
"""
make_hard_negatives_solid.py
- Generates hard negatives for COMPANY / SKILL / DATE lookalikes.
- Writes DocBin with NO gold entities and with doc.spans["incorrect"] to
  teach the model "these tempting spans are NOT entities".
- Dedupes against an existing train DocBin by hashing text + incorrect spans.
"""

from __future__ import annotations
import argparse, hashlib, random
from pathlib import Path
from typing import List, Tuple
import spacy
from spacy.tokens import Doc, DocBin, Span

# --- Seed lists (expand anytime) ------------------------------------------------

COMPANY_LIKES: List[Tuple[str, List[Tuple[int,int]]]] = [
    # text, list of (start_char,end_char) for the tempting span
    ("We drafted the spec in Google Docs last week.",              [(20, 31)]),  # "Google Docs"
    ("The Amazon rainforest spans nine countries.",                [(4, 10)]),   # "Amazon"
    ("I baked an Apple pie for the meetup.",                       [(10, 15)]),  # "Apple"
    ("We discussed Meta cognition during the seminar.",            [(12, 16)]),  # "Meta"
    ("He read about Oracle bones in ancient China.",               [(14, 20)]),  # "Oracle"
    ("Our team used Unity as a metaphor for teamwork.",            [(12, 17)]),  # "Unity"
    ("They visited Spring garden in April.",                       [(13, 19)]),  # "Spring"
]

SKILL_LIKES: List[Tuple[str, List[Tuple[int,int]]]] = [
    ("We handled a python snake safely at the zoo.",               [(13, 19)]),  # "python"
    ("Her talk on Reactivity in chemistry drew a crowd.",          [(12, 22)]),  # "Reactivity"
    ("The class brewed coffee with Java beans.",                   [(28, 32)]),  # "Java"
    ("Our Docker bay was packed with ships.",                      [(4, 10)]),   # "Docker"
    ("Kubernetes is the name of our internal yacht.",              [(0, 10)]),   # "Kubernetes"
    ("He studied Rust patterns on old metal tools.",               [(10, 14)]),  # "Rust"
    ("The workshop explored Swift currents in rivers.",            [(22, 27)]),  # "Swift"
    ("They enjoy .NET (as in basketball net) jokes.",              [(11, 14)]),  # ".NET"
]

DATE_LIKES: List[Tuple[str, List[Tuple[int,int]]]] = [
    ("The code was named 03/22 but it isn't a date.",              [(18, 23)]),  # "03/22"
    ("We shipped version 2020-13 which is not a real month.",      [(16, 23)]),  # "2020-13"
    ("Set the parameter to March 99 for testing.",                 [(21, 28)]),  # "March 99"
    ("The field 12/34/5678 is sample data, not a date.",           [(10, 20)]),  # "12/34/5678"
    ("Project phase 'Q3 202A' is a placeholder.",                  [(15, 21)]),  # "Q3 202A"
    ("Release tag was 2025.99.01, ignore as date.",                [(16, 26)]),  # "2025.99.01"
]

# --------------------------------------------------------------------------------

def _hash_example(text: str, incorrect_spans: List[Tuple[int,int,str]]) -> str:
    key = text + "||" + "|".join(f"{s}-{e}-{lbl}" for s, e, lbl in incorrect_spans)
    return hashlib.sha1(key.encode("utf8")).hexdigest()

def _load_existing_hashes(train_path: Path) -> set[str]:
    hashes: set[str] = set()
    if not train_path.exists():
        return hashes
    nlp = spacy.blank("en")
    db = DocBin().from_disk(train_path)
    for doc in db.get_docs(nlp.vocab):
        inc = [(sp.start_char, sp.end_char, sp.label_) for sp in doc.spans.get("incorrect", [])]
        ents = [(ent.start_char, ent.end_char, ent.label_) for ent in doc.ents]
        # hash both incorrect spans & ents so we avoid collision with prior negatives or positives
        key = doc.text + "||I:" + "|".join(f"{s}-{e}-{l}" for s,e,l in inc) + "||E:" + "|".join(f"{s}-{e}-{l}" for s,e,l in ents)
        hashes.add(hashlib.sha1(key.encode("utf8")).hexdigest())
    return hashes

def _make_doc(nlp, text: str, spans: List[Tuple[int,int,str]]) -> Doc:
    doc = nlp.make_doc(text)
    doc.ents = []  # explicit: no gold entities
    inc_spans: List[Span] = []
    for s, e, label in spans:
        span = doc.char_span(s, e, label=label, alignment_mode="contract")
        if span:
            inc_spans.append(span)
    if inc_spans:
        doc.spans["incorrect"] = inc_spans
    return doc

def build_pool() -> List[Tuple[str, List[Tuple[int,int,str]]]]:
    # attach labels for each tempting span
    pool: List[Tuple[str, List[Tuple[int,int,str]]]] = []
    for t, spans in COMPANY_LIKES:
        pool.append((t, [(s, e, "COMPANY") for (s, e) in spans]))
    for t, spans in SKILL_LIKES:
        pool.append((t, [(s, e, "SKILL") for (s, e) in spans]))
    for t, spans in DATE_LIKES:
        pool.append((t, [(s, e, "START_DATE") for (s, e) in spans]))  # mark ambiguous dates as start-like
    return pool

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="Output DocBin path for negatives")
    ap.add_argument("--count", type=int, default=400, help="How many negative docs to generate")
    ap.add_argument("--train", type=str, default="my-app/testdata/cv_filtered/train.spacy", help="Existing train DocBin to de-dup against")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    random.seed(args.seed)
    nlp = spacy.blank("en")
    existing = _load_existing_hashes(Path(args.train))

    pool = build_pool()
    # diversify with small variants (simple replacements)
    variants = [
        ("Google Docs", ["Google Sheet", "Google Slides"]),
        ("Amazon", ["Amazonia", "Amazon basin"]),
        ("Apple", ["apple", "APPLE"]),
        ("Meta", ["meta", "META"]),
        ("Oracle", ["oracle", "ORACLE"]),
        ("Unity", ["unity", "UNITY"]),
        ("Spring", ["spring", "SPRING"]),
        ("python", ["Python", "PYTHON"]),
        ("Reactivity", ["reactivity", "REACTIVITY"]),
        ("Java", ["java", "JAVA"]),
        ("Docker", ["docker", "DOCKER"]),
        ("Kubernetes", ["kubernetes", "KUBERNETES"]),
        ("Rust", ["rust", "RUST"]),
        ("Swift", ["swift", "SWIFT"]),
    ]

    docs = []
    tries = 0
    while len(docs) < args.count and tries < args.count * 10:
        tries += 1
        base_text, mislabeled = random.choice(pool)

        # light random variant
        text = base_text
        for src, repls in random.sample(variants, k=min(3, len(variants))):
            if src in text and random.random() < 0.5:
                text = text.replace(src, random.choice(repls))

        # recompute char offsets if text changed length? keep replacements length-similar
        # We used length-similar variants; still safe to re-find spans by substring when possible:
        spans_adj: List[Tuple[int,int,str]] = []
        ok = True
        for s, e, lbl in mislabeled:
            token_str = base_text[s:e]
            new_s = text.find(token_str)
            if new_s == -1:
                ok = False
                break
            spans_adj.append((new_s, new_s + len(token_str), lbl))
        if not ok:
            continue

        tmp_doc = _make_doc(nlp, text, spans_adj)
        inc = [(sp.start_char, sp.end_char, sp.label_) for sp in tmp_doc.spans.get("incorrect", [])]
        h = _hash_example(tmp_doc.text, inc)
        if h in existing:
            continue
        existing.add(h)
        docs.append(tmp_doc)

    out = DocBin(store_user_data=True)
    for d in docs:
        out.add(d)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    out.to_disk(args.out)
    print(f"✅ Wrote {len(docs)} hard negatives → {args.out}")

if __name__ == "__main__":
    main()
