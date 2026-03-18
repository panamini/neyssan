#!/usr/bin/env python3
import argparse, spacy, json, hashlib
from pathlib import Path
from spacy.tokens import DocBin, Span
from spacy.training import Example

def doc_hash(text, ents):
    # ents: list[(start_char,end_char,label)]
    key = text + "||" + "|".join(f"{s}-{e}-{l}" for s,e,l in ents)
    return hashlib.sha1(key.encode("utf8")).hexdigest()

def load_hashes(docbin_path: str) -> set[str]:
    nlp = spacy.blank("en")
    hashes = set()
    db = DocBin().from_disk(docbin_path)
    for doc in db.get_docs(nlp.vocab):
        ents = [(ent.start_char, ent.end_char, ent.label_) for ent in doc.ents]
        hashes.add(doc_hash(doc.text, ents))
    return hashes

def extract_context(text, start_char, end_char, window=80):
    a = max(0, start_char - window)
    b = min(len(text), end_char + window)
    return text[a:b], a, b

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--gold", required=True)   # dev or golden docbin with gold ents
    ap.add_argument("--train", required=True)  # current train.spacy to de-dup against
    ap.add_argument("--out", required=True)
    ap.add_argument("--labels", nargs="*", default=["SKILL","COMPANY","START_DATE","END_DATE"])
    ap.add_argument("--limit", type=int, default=400)
    args = ap.parse_args()

    nlp = spacy.load(args.model)
    gold_db = DocBin().from_disk(args.gold)
    existing = load_hashes(args.train)

    out_db = DocBin(store_user_data=True)
    kept = 0
    for gold_doc in gold_db.get_docs(nlp.vocab):
        pred_doc = nlp(gold_doc.text)
        # map gold FNs (present in gold, missing in pred) for target labels
        for gold_ent in gold_doc.ents:
            if gold_ent.label_ not in args.labels:
                continue
            # overlap test: any pred span of same label overlapping gold span?
            has_pred = any(
                (p.label_ == gold_ent.label_) and not (p.end_char <= gold_ent.start_char or p.start_char >= gold_ent.end_char)
                for p in pred_doc.ents
            )
            if has_pred:
                continue  # not an FN

            # build a short context doc to avoid duplicating long docs
            ctx_text, a, b = extract_context(gold_doc.text, gold_ent.start_char, gold_ent.end_char, window=80)
            start = gold_ent.start_char - a
            end   = gold_ent.end_char   - a

            tmp_doc = nlp.make_doc(ctx_text)
            span = tmp_doc.char_span(start, end, label=gold_ent.label_, alignment_mode="contract")
            if not span:
                continue
            tmp_doc.ents = [span]
            h = doc_hash(tmp_doc.text, [(span.start_char, span.end_char, span.label_)])
            if h in existing:
                continue
            out_db.add(tmp_doc)
            existing.add(h)
            kept += 1
            if kept >= args.limit:
                break
        if kept >= args.limit:
            break

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    out_db.to_disk(args.out)
    print(f"✅ Harvested {kept} NEW hard positives to {args.out}")

if __name__ == "__main__":
    main()
