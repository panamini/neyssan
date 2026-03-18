#!/usr/bin/env python
import os, sys, time, random, argparse
from pathlib import Path
import spacy
from spacy import util
from spacy.tokens import DocBin
from spacy.training.example import Example

def now():
    return time.strftime("%H:%M:%S")

def load_docs(path, vocab):
    db = DocBin().from_disk(path)
    return list(db.get_docs(vocab))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="cv_parser/config.cfg")
    ap.add_argument("--train",  default="my-app/testdata/cv_filtered/train.spacy")
    ap.add_argument("--dev",    default="my-app/testdata/cv_filtered/dev.spacy")
    ap.add_argument("--steps",  type=int, default=1000)
    ap.add_argument("--batch",  type=int, default=6)
    ap.add_argument("--accum",  type=int, default=4)
    ap.add_argument("--dropout", type=float, default=0.2)
    ap.add_argument("--device", choices=["mps","cpu"], default="mps")
    ap.add_argument("--log", default="training/out_resume/train.log")
    ap.add_argument("--resume", default=None, help="Path to model-last to resume training from")
    args = ap.parse_args()

    # Safe macOS env
    os.environ.setdefault("OMP_NUM_THREADS","1")
    os.environ.setdefault("MKL_NUM_THREADS","1")
    os.environ.setdefault("TOKENIZERS_PARALLELISM","false")
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK","1")

    import cv_parser.bootstrap  # ensure custom factories are registered

    if args.resume:
        print(f"[{now()}] Resuming from {args.resume}")
        nlp = spacy.load(args.resume)
        optimizer = nlp.resume_training()
    else:
        cfg = util.load_config(args.config)
        cfg["paths"]["train"] = args.train
        cfg["paths"]["dev"]   = args.dev
        print(f"[{now()}] Building pipeline from: {Path(args.config).resolve()}")
        nlp = util.load_model_from_config(cfg)
        print(f"[{now()}] Pipeline: {nlp.pipe_names}")

        print(f"[{now()}] Loading TRAIN docs...")
        train_docs = load_docs(args.train, nlp.vocab)
        print(f"[{now()}] TRAIN docs: {len(train_docs)}")

        print(f"[{now()}] Loading DEV docs...")
        dev_docs = load_docs(args.dev, nlp.vocab)
        print(f"[{now()}] DEV docs: {len(dev_docs)}")

        train_examples = [Example(d, d) for d in train_docs]
        dev_examples   = [Example(d, d) for d in dev_docs]

        init_sample = train_examples[: min(64, len(train_examples))]
        print(f"[{now()}] Initializing with {len(init_sample)} samples...")
        optimizer = nlp.initialize(get_examples=lambda: init_sample)
        print(f"[{now()}] Initialization done")

    try:
        import torch
        if args.device == "mps" and torch.backends.mps.is_available():
            print(f"[{now()}] Using MPS acceleration")
        else:
            print(f"[{now()}] Using CPU")
    except Exception:
        print(f"[{now()}] Torch not available — CPU mode")

    # Load docs only once outside resume/fresh branch
    if not args.resume:
        # Already loaded above
        pass
    else:
        train_docs = load_docs(args.train, nlp.vocab)
        dev_docs   = load_docs(args.dev, nlp.vocab)
        train_examples = [Example(d, d) for d in train_docs]
        dev_examples   = [Example(d, d) for d in dev_docs]

    def batches(data, bsz):
        for i in range(0, len(data), bsz):
            yield data[i:i+bsz]

    Path(args.log).parent.mkdir(parents=True, exist_ok=True)
    with open(args.log, "w") as f:
        f.write("E    #       LOSS TRANS...  LOSS NER  ENTS_F  ENTS_P  ENTS_R\n")

    step = 0
    random.shuffle(train_examples)
    b_iter = iter(batches(train_examples, args.batch))
    log_interval = 10   # only log every 10 steps

    while step < args.steps:
        losses = {"transformer": 0.0, "ner": 0.0}
        for _ in range(args.accum):
            try:
                batch = next(b_iter)
            except StopIteration:
                random.shuffle(train_examples)
                b_iter = iter(batches(train_examples, args.batch))
                batch = next(b_iter)
            nlp.update(batch, sgd=optimizer, drop=args.dropout, losses=losses)

        if step % log_interval == 0 or step == args.steps - 1:
            ents_f = ents_p = ents_r = 0.0
            if dev_examples:
                scores = nlp.evaluate(dev_examples)
                ents_f = scores.get("ents_f", 0.0)
                ents_p = scores.get("ents_p", 0.0)
                ents_r = scores.get("ents_r", 0.0)

            line = f"{step:>5}    {losses['transformer']:.2f}    {losses['ner']:.2f}   {ents_f:5.2f}   {ents_p:5.2f}   {ents_r:5.2f}"
            print(line)
            with open(args.log, "a") as f:
                f.write(line + "\n")

        step += 1

    out_dir = Path(args.log).parent
    nlp.to_disk(out_dir / "model-last")
    print(f"[{now()}] Saved model to {out_dir/'model-last'}")

if __name__ == "__main__":
    main()
