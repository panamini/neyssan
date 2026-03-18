# Training Run Guide (SpaCy + MPS on macOS)

This document explains:
- The key problems we encountered when training the NER model.
- The fixes we applied so runs are reproducible.
- How to safely re-run training (short sanity runs, full training).

---

## 🧩 Problems Encountered & Fixes

| Problem | Symptom | Fix |
|--------|---------|-----|
| **Wrong corpus used** | Model always predicted SKILL everywhere, ignored other labels. | Updated `cv_parser/config.cfg` to point `paths.train` / `paths.dev` at `my-app/testdata/cv_filtered/*.spacy`. |
| **Log suppression** | `training/logs/balanced_run.log` already existed → SpaCy disabled console logging. | Delete stale log before run: `rm -f training/logs/balanced_run.log`. |
| **CLI "freezing"** | Training showed only table header, no step rows. | Disable progress bar (`--training.logger.progress_bar false`), run foreground, tee output to log. |
| **Mac deadlocks / high CPU** | Runs stalled at first batch. | Added `OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 TOKENIZERS_PARALLELISM=false PYTORCH_ENABLE_MPS_FALLBACK=1`. |
| **Custom component not found** | `[E002] Can't find factory for 'span_window_probe'`. | Import `cv_parser.bootstrap` before building pipeline (this registers factories). |
| **Python 3.13 + thinc-apple-ops build errors** | Compilation failed during pip install. | Downgraded to Python **3.12.4** using pyenv, reinstalled dependencies (confirmed PyTorch MPS wheel works). |
| **Unclear step time** | Needed quick feedback before long runs. | Added `run_20steps.sh` (parametrized step count, short runs). |

---

## 🏃 How to Run Training

### 1. Quick Sanity Run (Default 20 Steps)
Runs a short training loop to check pipeline + data correctness.

```bash
bash run_20steps.sh

After the run, check results quickly:

cat training/out_500_*/eval.log


python run_20steps.py --steps 20 --device mps --log training/out_debug/train.log


Output:

Live logs in terminal.

Saved logs at training/out_20/train.log.

Model at training/out_20/model-last.

2. Longer Run
bash run_20steps.sh 5000


Creates training/out_5000 and logs there.
You can monitor live progress:

tail -f training/out_5000/train.log

3. Full Training from Scratch
# Clean old outputs
rm -rf training/output_full training/logs/balanced_run.log

# Run (example: 20k steps, eval every 500 steps)
bash run_20steps.sh 20000

🔧 Environment Setup (Mac + MPS)

Make sure:

Python 3.12.x is installed (via pyenv).

Virtualenv is recreated & requirements installed:

rm -rf .venv
python -m venv .venv
source .venv/bin/activate
pip install -U pip setuptools wheel
pip install --index-url https://download.pytorch.org/whl/metal.html torch torchvision torchaudio
pip install -r cv_parser/requirements.txt


Environment variables to avoid deadlocks:

export OMP_NUM_THREADS=1
export MKL_NUM_THREADS=1
export TOKENIZERS_PARALLELISM=false
export PYTORCH_ENABLE_MPS_FALLBACK=1

✅ Checklist Before a New Run

 Config paths.train / paths.dev point to cv_filtered/*.spacy.

 training/logs/balanced_run.log deleted.

 MPS is available (python -c "import torch; print(torch.backends.mps.is_available())" → True).

 Environment vars set (see above).

 (Optional) Test with bash run_20steps.sh 20 first.

📊 Evaluating Model

After training completes:

python -m spacy evaluate training/out_5000/model-last my-app/testdata/cv_filtered/dev.spacy --code cv_parser/bootstrap.py


Look at NER P/R/F and per-label metrics.
Precision/Recall near zero → check data paths or stoplist filters.

🚨 Debugging Tips

If you see no step output → delete logs, re-run with progress_bar false.

If you see factory not found → check cv_parser/bootstrap.py is imported.

If you see MPS unavailable → confirm PyTorch installed with Metal wheels.

If losses are NaN → reduce learning rate or check data for empty spans.


Here’s what happens under the hood when you run bash run_20steps.sh:

It calls run_20steps.py, which:

Loads your cv_parser/config.cfg and registers custom factories (span_window_probe).

Loads train/dev data from my-app/testdata/cv_filtered.

Initializes the pipeline and optimizer.

Runs N steps of manual gradient updates (exactly like spaCy’s trainer, just simpler).

Logs losses and quick dev-set metrics every 5 steps.

At the end, calls nlp.to_disk(out_dir / "model-last"), which writes the trained pipeline to:

training/out_<STEPS>/model-last/


That directory contains:

meta.json (training metadata)

tokenizer (your tokenizer config)

transformer, ner, etc. (trained model weights)

You can immediately evaluate or use that model:

python -m spacy evaluate training/out_500/model-last my-app/testdata/cv_filtered/dev.spacy --code cv_parser/bootstrap.py


Or to use it interactively:

import spacy
nlp = spacy.load("training/out_500/model-last")
doc = nlp("John Doe worked at Google as a Data Scientist.")
print([(ent.text, ent.label_) for ent in doc.ents])