Got it 👍 — you don’t want to lose all the context we’ve built up. The cleanest way is to give him a **TASKS.md** (or `CONTEXT.md`) in your repo that has:

1. **Context recap** → what we’re building (CV parser, hybrid spaCy pipeline, JSON Resume output, ESCO seeding, FUNSD for section QA).
2. **What’s already done** → scaffolded modules, initial config, prepare\_dataset.py improvements.
3. **What’s next** → the to-do list (so he doesn’t drift or re-invent).

---

Here’s a draft `TASKS.md` you can drop in:

````markdown
# CV Parsing Pipeline — Task Plan

## 🎯 Goal
Build a production-grade CV parser with **spaCy + spaCy-transformers** and a **layout-aware preprocessor**.  
Hybrid design: transformer NER + deterministic rules (seeds only) + layout/heading segmentation.  
Final output must validate against **JSON Resume schema**.

---

## ✅ Context Recap
- We already scaffolded `cv_parser/` modules:
  - `layout_ingest.py`, `section_segmenter.py`, `rules.py`, `hybrid_pipeline.py`, `conflict_resolver.py`, `postprocessing.py`, `pack_json.py`.
  - Config file `cv_parser/config.cfg` (transformer NER with roberta-base).
  - Tests: `test_section_segmenter.py`, `test_hybrid_pipeline.py`.
- Added `prepare_dataset.py` to map noisy labels → schema + output `.spacy` files.
- Annotated datasets available:
  - `@my-app/testdata/cv/Entity_Recognition_in_Resumes.json` → main training data.
  - `@my-app/testdata/cv/esco/` → ESCO CSVs for SKILL/LANGUAGE normalization.
  - `@my-app/testdata/cv/ResumesJsonAnnotated/` → FUNSD-style data for section QA (not NER training).
- JSON Resume schema available at: `@my-app/testdata/cv/jsonresume.json`.

---

## 📌 Remaining Tasks

### 1. Dataset Conversion
- Implement `convert_jsonresume_dataset.py`:
  - Parse `Entity_Recognition_in_Resumes.json`.
  - Map noisy labels → agreed schema.
  - Split 80/20 → `train.spacy` / `dev.spacy` in `@my-app/testdata/cv/`.
  - Log entity counts + skipped spans.
- Update `config.cfg`:
  - `[paths.train] = @my-app/testdata/cv/train.spacy`
  - `[paths.dev]   = @my-app/testdata/cv/dev.spacy`

### 2. Training
- Run:
  ```bash
  python -m spacy train cv_parser/config.cfg --output training/output
````

* Confirm non-zero docs + sensible F1.
* Run `spacy debug data` before training.

### 3. ESCO Integration

* Add `--esco` loader:

  * Load CSVs from `@my-app/testdata/cv/esco`.
  * Use `preferredLabel` for canonical names, `altLabels` for synonyms.
  * Seed SKILL/LANGUAGE spans with `EntityRuler` before transformer NER.
  * Do not bake ESCO into training `.spacy` files (runtime only).

### 4. JSON Resume Alignment

* Update `pack_json.py`:

  * Map sections to JSON Resume schema (basics, work, education, skills, certificates, projects, awards, languages, etc.).
* Add validation test:

  * `tests/test_jsonresume_validation.py` → inference output must validate against `jsonresume.json`.

### 5. Evaluation Enhancements

* Extend `evaluate.py`:

  * Per-entity P/R/F1.
  * Per-section P/R/F1.
  * Confusion matrices (ROLE↔SKILL, COMPANY↔INSTITUTION, DEGREE↔CERTIFICATE).
  * Slice metrics (1 vs 2 columns, tables present/absent).

### 6. Tests & Fixtures

* Keep FUNSD dataset only for section segmentation QA.
* Add fixtures for:

  * Empty SKILLS.
  * EDUCATION above EXPERIENCE.
  * 2-column layouts.
  * Mixed languages.
  * Tables.

### 7. Augmentation

* Implement `augment.py`:

  * Layout jitter.
  * Typography noise.
  * Header synonyms.
  * Multilingual ESCO seeding.
  * Negative sampling.

---

## ✅ Acceptance Criteria

* `train.spacy` + `dev.spacy` generated and paths set in config.
* Training runs successfully with non-zero docs.
* Inference JSON validates against JSON Resume schema.
* ESCO integrated at inference via `--esco`.
* FUNSD used only for section QA.
* Confusion matrices + schema validation included in eval.

```

---

👉 Do you want me to also make a **super short “handoff note”** you can paste in your next Codex prompt, pointing it to `TASKS.md` so it reads the context from the repo instead of you repeating the whole history?
```
