# Audit: `local-fast` vs `tunnel` Parsing Divergence

Date: 2026-04-14

Fixture used for proof:

- `/Users/pana/Downloads/fixtures/cv_surname-en.pdf`

## Scope

Audit whether `./run.sh local-fast` degrades parsing relative to `./run.sh tunnel`, and identify the first divergence point without changing parser code.

## Runtime Comparison

### `local-fast`

- parser runtime: `workspace`
- parser container: `cv-parser-service-dev`
- mounts:
  - repo bind mount to `/app`
  - anonymous volume on `/app/node_modules`
  - anonymous volume on `/app/my-app/node_modules`
- Convex: local (`http://127.0.0.1:3310`)
- parser origin selected by Convex: `http://127.0.0.1:8001`

### `tunnel`

- parser runtime: `image`
- parser container: `cv-parser-service-dev`
- mounts:
  - none
- Convex: cloud
- parser origin selected by Convex: `https://parser.dasti.ai`

### Env parity inside parser runtime

Verified in both modes:

- `API_ENABLE_MISTRAL_OCR=1`
- `MISTRAL_API_KEY` present
- `CV_OCR_ENGINE=auto`
- `OCR_ENGINE=auto`
- `PYTHONPATH=/app`

## Runtime Code Inside Container

Exact live hashes for `cv_parser_service/mistral_resume_v3/*.py` matched between host workspace and tunnel image runtime.

Relevant greps inside the running parser runtime:

```text
/app/cv_parser_service/mistral_resume_v3/prompt.py
19: "Map explicit LANGUAGES headings and explicit language/proficiency lines to languages[]..."
20: "Map explicit SKILLS, EXPERTISE, AREAS OF EXPERTISE, CORE COMPETENCIES, and grouped expertise sections to skills[]..."

/app/cv_parser_service/mistral_resume_v3/extraction_schema.py
67: description="Atomic skill/tool/technology/competency label only. Populate from explicit skills..."
73: description="Extract only explicitly stated spoken or human languages. Populate from explicit Languages..."
```

Conclusion: the live prompt/schema code was not the first divergence point for this audit.

## Execution Path

Confirmed active import path:

1. browser upload
2. `my-app/convex/actions/structuredUpload.ts`
3. parser endpoint `/mistral-ocr/parse`
4. `cv_parser_service/main.py`
5. `cv_parser_service/mistral_resume_v3/pipeline.py`
6. annotation parse + normalization
7. Convex canonicalization / persistence

`useMistral: true` stayed enabled in the tested path.

## Reproduction Results

### Direct parser call: local parser

Target:

- `http://127.0.0.1:8001/mistral-ocr/parse`

Observed result:

- `name = "Name Surname"`
- `skills = 46`
- `languages = 2`
- `mistral_fallback = false`
- `mistral_runtime = "mistral"`
- `mistral_parser_status = "partial"`

### Tunnel cloud action: first run

Target selected by cloud Convex:

- `https://parser.dasti.ai/mistral-ocr/parse`

Observed raw parser payload inside `structuredUpload`:

- `skills = []`
- `languages = []`
- `mistral_fallback = false`
- `mistral_runtime = "mistral"`
- `mistral_parser_status = "partial"`

Observed final action result:

- `skills = 0`
- `languages = 0`

### Tunnel cloud action: repeated run, same mode, same file, no code/env changes

Target selected by cloud Convex:

- `https://parser.dasti.ai/mistral-ocr/parse`

Observed raw parser payload inside `structuredUpload`:

- `skills = 46`
- `languages = 2`
- `mistral_fallback = false`
- `mistral_runtime = "mistral"`
- `mistral_parser_status = "partial"`

Observed final action result:

- `skills = 46`
- `languages = 2`

## First Proven Divergence Point

The first proven divergence was inside the parser response returned from `/mistral-ocr/parse`, before Convex canonicalization and before storage.

That divergence was not tied to:

- `local-fast` vs `tunnel` runtime mode
- parser container env
- prompt/schema code inside runtime
- fallback routing
- endpoint choice within a given request

Why:

- the same `tunnel` path (`https://parser.dasti.ai/mistral-ocr/parse`) produced both degraded and non-degraded parser payloads for the same file on repeat runs
- `mistral_fallback` remained `false` in both cases
- `mistral_runtime` remained `"mistral"` in both cases

## Root Cause

For this fixture, the degradation is not caused by `local-fast`.

The proved cause is nondeterministic Mistral OCR annotation output reaching the parser pipeline:

- same parser path
- same runtime code
- same env
- same file
- different `skills` / `languages` extraction on repeat runs

This makes the first unstable boundary the external Mistral OCR annotation response consumed by `cv_parser_service/mistral_resume_v3/pipeline.py`, not `run.sh` mode selection or Convex parser-origin wiring.

## Minimal Fix Location

Not `run.sh`.

Not local-fast env wiring.

If this symptom needs to be hardened, the minimal fix surface is in the parser pipeline around the Mistral OCR response boundary, for example:

- `cv_parser_service/mistral_resume_v3/ocr_client.py`
- `cv_parser_service/mistral_resume_v3/pipeline.py`
- validation / retry / acceptance logic around obviously missing first-class sections such as explicit `Languages` or `Skills`

## Notes

- This audit did not reproduce a stable `local-fast bad / tunnel good` split with the supplied fixture.
- Both modes can reach the Mistral path successfully.
- A separate, later-layer normalization difference still exists for `name` / `summary` in `structuredUpload`, but that was not the first cause of the `skills` / `languages` gap in this audit.
