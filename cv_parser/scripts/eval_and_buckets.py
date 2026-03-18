#!/usr/bin/env python3
"""
Full evaluation + error bucket pipeline for CV parser.

Features:
- Auto-detect newest model: training/**/{model-last,model-best}
- Or use --model to pass a path explicitly (dir or model dir)
- Evaluates on --gold DocBin (default: my-app/testdata/cv_filtered/dev.spacy)
- Saves timestamped eval JSON + error-bucket JSON to --out-dir
- Robust call into error_buckets.py (supports both CLI-style main() and subprocess fallback)
"""

from __future__ import annotations

import argparse
import json
import sys
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple, List

import spacy
from spacy.scorer import Scorer
from spacy.tokens import DocBin
from spacy.training import Example


THIS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = THIS_DIR.parent.parent  # cv_parser/scripts -> cv_parser -> neyssan
DEFAULT_GOLD = PROJECT_ROOT / "my-app" / "testdata" / "cv_filtered" / "dev.spacy"
DEFAULT_OUT = PROJECT_ROOT / "diagnostics"
ERROR_BUCKETS_PY = THIS_DIR / "error_buckets.py"


def _resolve_model_path(p: Path, prefer_best: bool) -> Path:
    """Given a candidate (dir or model dir), return a loadable model path."""
    if p.is_dir():
        # If it's already a model directory (has meta.json), return it
        if (p / "meta.json").exists() and (p / "config.cfg").exists():
            return p
        # Otherwise look for model-best/model-last inside
        best = p / "model-best"
        last = p / "model-last"
        if prefer_best and best.exists():
            return best
        if last.exists():
            return last
        if best.exists():
            return best
    raise FileNotFoundError(f"Could not resolve a spaCy model dir from: {p}")


def _find_newest_model(prefer_best: bool) -> Path:
    """Scan multiple training roots for the freshest model-best or model-last."""
    candidate_roots = [
        PROJECT_ROOT / "training",
        Path.cwd() / "training",
        THIS_DIR.parent / "training",
    ]
    
    print("🔍 Searching for models in:")
    for root in candidate_roots:
        print(f"  - {root}")
    
    candidates: List[Tuple[float, Path]] = []
    for root in candidate_roots:
        if not root.exists():
            print(f"  (skipped: {root} does not exist)")
            continue
        print(f"  (found: {root})")
        
        # Recursively find model-last or model-best dirs with meta.json
        for sub in root.rglob("model-*"):
            if sub.is_dir() and sub.name in ("model-last", "model-best") and (sub / "meta.json").exists():
                try:
                    mtime = sub.stat().st_mtime
                    candidates.append((mtime, sub))
                except OSError:
                    pass
    
    if not candidates:
        raise FileNotFoundError(
            f"No model directories (model-last or model-best with meta.json) found under searched paths.\n"
            f"Suggestion: Use --model training/OUT_DIR/model-last to specify explicitly."
        )
    
    # Sort by modification time descending
    candidates.sort(key=lambda t: t[0], reverse=True)
    
    # If prefer_best, bias towards newest model-best
    if prefer_best:
        best_candidates = [c for _, c in candidates if c.name == "model-best"]
        if best_candidates:
            # Pick the newest model-best
            best_mtimes = [(c.stat().st_mtime, c) for c in best_candidates]
            best_mtimes.sort(key=lambda t: t[0], reverse=True)
            return best_mtimes[0][1]
    
    # Otherwise, return the overall newest
    newest = candidates[0][1]
    print(f"✅ Found newest model: {newest} (mtime: {datetime.fromtimestamp(candidates[0][0])})")
    return newest


def _load_gold_docs(docbin_path: Path, vocab) -> list:
    db = DocBin().from_disk(docbin_path)
    return list(db.get_docs(vocab))


def _print_scores(scores: dict) -> None:
    ents_p = float(scores.get("ents_p", 0.0))
    ents_r = float(scores.get("ents_r", 0.0))
    ents_f = float(scores.get("ents_f", 0.0))
    print("\n=== OVERALL ===")
    print(f"ENTS_P: {ents_p:.3f} | ENTS_R: {ents_r:.3f} | ENTS_F: {ents_f:.3f}")

    per = scores.get("ents_per_type", {}) or {}
    print("\n=== PER LABEL ===")
    if not per:
        print("(no per-label metrics available)")
        return
    for label, r in sorted(per.items()):
        p = float(r.get("p", 0.0))
        rr = float(r.get("r", 0.0))
        f = float(r.get("f", 0.0))
        print(f"{label:14} P={p:.3f} R={rr:.3f} F={f:.3f}")


def _call_error_buckets_cli(ner_model: Path, gold: Path, out_json: Path, top_n: int) -> None:
    """Robustly invoke error_buckets.py as a subprocess (most compatible)."""
    cmd = [
        sys.executable,
        str(ERROR_BUCKETS_PY),
        "--ner-model",
        str(ner_model),
        "--gold",
        str(gold),
        "--out",
        str(out_json),
        "--top-n",
        str(top_n),
    ]
    print("📊 Running error_buckets.py via subprocess:")
    print("   ", " ".join(cmd))
    subprocess.run(cmd, check=True)


def _call_error_buckets_inproc(ner_model: Path, gold: Path, out_json: Path, top_n: int) -> bool:
    """
    Try to call error_buckets.main() in-process by faking sys.argv.
    Return True if it worked, False if we should fall back to subprocess.
    """
    # Dynamically import module by path so package imports aren’t required
    import importlib.util

    spec = importlib.util.spec_from_file_location("error_buckets", ERROR_BUCKETS_PY)
    if not spec or not spec.loader:
        return False
    mod = importlib.util.module_from_spec(spec)
    sys.modules["error_buckets"] = mod
    spec.loader.exec_module(mod)

    # Build argv as the script expects
    args = [
        str(ERROR_BUCKETS_PY),
        "--ner-model",
        str(ner_model),
        "--gold",
        str(gold),
        "--out",
        str(out_json),
        "--top-n",
        str(top_n),
    ]

    # If the script defines main() that parses sys.argv, call it with shim
    if hasattr(mod, "main"):
        argv_backup = sys.argv
        sys.argv = args
        try:
            mod.main()
            return True
        except TypeError:
            # Signature mismatch (e.g., main(kwargs)), bail to subprocess
            return False
        except SystemExit as e:
            # Normal Typer/argparse exit (0 is success)
            return int(getattr(e, "code", 0) or 0) == 0
        finally:
            sys.argv = argv_backup

    # If not, no luck
    return False


def main() -> None:
    ap = argparse.ArgumentParser(description="Evaluate a model and produce error buckets")
    ap.add_argument(
        "--model",
        type=str,
        default=None,
        help="Path to model dir or its parent (will resolve to model-last/best). If omitted, auto-detect newest.",
    )
    ap.add_argument(
        "--prefer-best",
        action="store_true",
        help="When auto-detecting or resolving a model dir, prefer model-best if present.",
    )
    ap.add_argument(
        "--gold",
        type=str,
        default=str(DEFAULT_GOLD),
        help="Path to gold DocBin (default dev.spacy).",
    )
    ap.add_argument(
        "--out-dir",
        type=str,
        default=str(DEFAULT_OUT),
        help="Directory for outputs (metrics + buckets).",
    )
    ap.add_argument("--top-n", type=int, default=5, help="Top-N error fixtures per label.")
    args = ap.parse_args()

    # Resolve model path
    if args.model:
        model_root = Path(args.model).resolve()
        try:
            model_path = _resolve_model_path(model_root, prefer_best=args.prefer_best)
        except FileNotFoundError:
            # maybe args.model already points to model-last/best dir with meta.json
            model_path = model_root
            if not (model_path / "meta.json").exists():
                raise FileNotFoundError(f"Specified --model {args.model} is not a valid spaCy model directory (missing meta.json).")
    else:
        model_path = _find_newest_model(prefer_best=args.prefer_best)

    print(f"🔧 Using model: {model_path}")

    # Load model and gold
    nlp = spacy.load(model_path.as_posix())
    gold_path = Path(args.gold).resolve()
    print(f"📦 Loading gold set: {gold_path}")
    gold_docs = _load_gold_docs(gold_path, nlp.vocab)

    if not gold_docs:
        raise RuntimeError(f"No docs found in {gold_path}")

    # Build examples (gold docs already have .ents)
    examples = [Example(nlp.make_doc(d.text), d) for d in gold_docs]

    # Evaluate
    print("🔍 Running evaluation…")
    scorer = Scorer()
    scores = scorer.score(examples)
    _print_scores(scores)

    # Save metrics JSON
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    metrics_json = out_dir / f"eval_metrics_{ts}.json"
    metrics_json.write_text(json.dumps(scores, indent=2))
    print(f"📄 Saved metrics JSON -> {metrics_json}")

    # Make error buckets
    buckets_json = out_dir / f"error_buckets_{ts}.json"
    print(f"📊 Generating error buckets -> {buckets_json}")

    # Try in-process first, then fall back to subprocess if needed
    ok = False
    if ERROR_BUCKETS_PY.exists():
        ok = _call_error_buckets_inproc(
            ner_model=model_path, gold=gold_path, out_json=buckets_json, top_n=args.top_n
        )
    if not ok:
        _call_error_buckets_cli(
            ner_model=model_path, gold=gold_path, out_json=buckets_json, top_n=args.top_n
        )

    print("✅ Done.")


if __name__ == "__main__":
    main()
