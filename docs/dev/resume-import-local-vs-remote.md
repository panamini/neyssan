# Resume Import: Local vs Remote Runtime

This note describes the resume parsing/import pipeline as it exists in this repo on branch `codex/fix/show-debug-controls`.

It is intentionally repo-faithful. Where behavior depends on runtime setup rather than code alone, that is called out explicitly.

## 1. High-level pipeline

### Frontend import entry point

Resume upload/import is initiated from [my-app/src/components/StructuredUploadButton.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx).

`StructuredUploadButton.processFile(...)`:

- builds a file or text submission
- calls the Convex action reference for `actions/structuredUpload:structuredUpload`
- stores the returned structured payload for debug/runtime inspection
- decides whether the result may mutate editor sections

Relevant code:

- action invocation and payload handling: [StructuredUploadButton.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx:430)
- OCR trusted gate and section application: [StructuredUploadButton.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx:558)

### Convex action

The backend action is [my-app/convex/actions/structuredUpload.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts).

`structuredUpload`:

- resolves which parser endpoint(s) to try
- logs the selected parser target
- sends the submission to `/parse-cv` or `/mistral-ocr/parse`
- normalizes the parser response
- returns the structured payload plus `authoritativeResume` when the route looks like the Mistral OCR path

Relevant code:

- parser endpoint resolution: [structuredUpload.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts:281)
- parser target selection log: [structuredUpload.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts:615)
- authoritative envelope generation: [structuredUpload.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts:148)

### Parser endpoint

For OCR/scanned resumes, `structuredUpload` targets `/mistral-ocr/parse`.

That route lives in the parser service:

- [cv_parser_service/main.py](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/cv_parser_service/main.py)
- Mistral OCR helpers: [cv_parser_service/mistral_ocr.py](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/cv_parser_service/mistral_ocr.py)
- Mistral v3 OCR pipeline: [cv_parser_service/mistral_resume_v3/pipeline.py](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/cv_parser_service/mistral_resume_v3/pipeline.py)

### Authoritative trusted payload

The app treats `authoritativeResume` as the trusted OCR import source. The trust helpers live in:

- [my-app/src/lib/authoritative-resume.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/authoritative-resume.ts)

Trusted import requires:

- `authoritativeResume.trusted === true`
- `authoritativeResume.fallbackToLegacy === false`
- normalized authoritative payload present

The frontend OCR gate also checks runtime diagnostics:

- `mistral_fallback !== true`
- `mistral_runtime !== "local_fallback"`

### Editor import gate

The editor import gate is in `StructuredUploadButton.processFile(...)`.

Current OCR behavior:

- trusted OCR result: build sections from `authoritativeResume.normalized`
- rejected OCR result: do not call `onApplyToSections`
- rejected OCR result: do not call `onRecoveryRequired`
- non-OCR structured/text import still uses `payload.normalized`

This is the important product boundary:

- for OCR imports, `payload.normalized` is not an import source anymore
- for OCR imports, rejected fallback output is debug-only

## 2. Local vs remote stack

There are three distinct runtime modes that matter during debugging.

### Local frontend only

This means Vite is running locally, but that alone says nothing about where actions run.

The frontend Convex client uses `VITE_CONVEX_URL`, and the frontend parser debug log uses `VITE_PARSER_URL` or `VITE_CONVEX_PARSER_URL`:

- parser URL log in dev: [my-app/src/main.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/main.tsx:13)

If Vite is local but `VITE_CONVEX_URL` still points to `https://...convex.cloud`, then actions still run on shared cloud Convex.

### Local frontend + shared cloud Convex

This is the most common source of confusion.

In this mode:

- browser UI is local
- `structuredUpload` still runs on shared cloud Convex
- shared cloud Convex still uses its own env, including its parser URL

Consequence:

- local parser fixes are not exercised
- parser selection logs come from the cloud action runtime, not your machine
- if cloud Convex points at `https://parser.dasti.ai`, your local Docker parser is irrelevant for that import attempt

This was the exact reason earlier local parser fixes did not change the live import path.

### Local frontend + local Convex + local parser

This is the full local stack needed for end-to-end parser debugging.

In this mode:

- Vite runs locally
- frontend bundle contains local `VITE_CONVEX_URL`
- Convex action process runs against a local deployment
- parser URL resolves to local loopback
- OCR parser/debug changes are exercised by the real import path

Verified local values from the current startup flow:

- local Convex URL: `http://127.0.0.1:3210`
- local parser URL: `http://127.0.0.1:8001`

## 3. Commands and when to use them

### `./run.sh up --ui`

What it launches:

- local parser container
- local Vite frontend
- no local Convex bootstrap

What it is for:

- UI work
- local frontend work where cloud Convex behavior is acceptable
- reproducing the shared-cloud action path from a local browser

What it does not guarantee:

- it does not switch the app to local Convex
- OCR parser fixes in local Docker may still be bypassed if the frontend bundle points to cloud Convex

Does it still work:

- yes, as a local frontend + default/backend-env mode

### `./run.sh up --ui --local-origin --local-convex`

What it launches:

- local parser container on `127.0.0.1:8001`
- local Convex deployment on `127.0.0.1:3210`
- local Vite frontend wired to both

What it is for:

- end-to-end resume parsing/import debugging
- parser target verification
- local OCR/Mistral debugging
- any work where you need `structuredUpload` to exercise local parser changes

When local Convex is required:

- when debugging parser selection
- when debugging local parser behavior
- when you need action logs to reflect local loopback instead of shared cloud env

## 4. OCR fallback import rule

Current product rule in the frontend import gate:

- trusted authoritative Mistral OCR output imports
- fallback, local-fallback, or otherwise untrusted OCR output is rejected
- rejected OCR output is debug-only
- there is no OCR recovery import path
- there is no OCR import path from `payload.normalized`

This is implemented in:

- OCR gate and rejection state: [StructuredUploadButton.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx:558)
- trusted helper: [authoritative-resume.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/authoritative-resume.ts:177)
- runtime/debug label: [ProfileReviewCard.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProfileReviewCard.tsx:321)

User-visible OCR rejection label:

- `OCR import rejected (fallback/untrusted)`

Trusted OCR label:

- `Trusted Mistral import`

## 5. Local parser selection

Parser URL selection happens in:

- [structuredUpload.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts:281)

The current resolver behavior is:

1. gather parser origins from env in this order
   - `CONVEX_PARSER_URL`
   - `PARSER_ORIGIN`
   - `VITE_CONVEX_PARSER_URL`
   - `VITE_PARSER_URL`
2. if `preferLoopback` is true, prepend loopback candidates
   - `http://127.0.0.1:8000`
   - `http://localhost:8000`
3. otherwise use env-first behavior

Important runtime flags:

- `STRUCTURED_UPLOAD_PREFER_LOOPBACK=1`
- health-based auto-preference if the action runtime can see a healthy loopback parser

The action logs:

- `selectedBaseUrl`
- `selectedLabel`
- `selectedModeSource`
- whether target is local

Relevant code:

- resolver: [structuredUpload.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts:281)
- selection log: [structuredUpload.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts:615)

### Why this caused confusion

Earlier, cloud Convex still had `CONVEX_PARSER_URL=https://parser.dasti.ai`, so the action selected the remote parser and logged:

- `selectedLabel: env:CONVEX_PARSER_URL`
- `selectedModeSource: env_first`

That is expected if the action runtime is shared cloud Convex. It does not matter that a healthy local parser exists on your laptop if the action is not running there.

### What must be true for local parser to actually be used

All of these must hold in practice:

- frontend is connected to a local Convex deployment
- local Convex action runtime can see local loopback
- local parser is healthy
- local selection mode enables or auto-detects loopback preference

If the frontend still uses shared cloud Convex, local parser fixes will not be exercised.

## 6. Local Convex startup behavior

Current local startup logic lives in:

- [run.sh](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/run.sh)

### What `run.sh` now does for `--local-convex`

1. determine the configured team/project from `my-app/.env.local`
2. bootstrap a local Convex deployment for that project
3. sync required env vars into the local Convex deployment
4. start the long-running local Convex watcher
5. start Vite with local parser and local Convex URLs

Relevant code:

- load repo and app env: [run.sh](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/run.sh:13)
- project binding resolution: [run.sh](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/run.sh:118)
- local env sync: [run.sh](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/run.sh:139)
- local Convex bootstrap/start: [run.sh](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/run.sh:307)
- summary output: [run.sh](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/run.sh:565)

### Local ports

Current defaults in `run.sh`:

- local Convex cloud port: `3210`
- local Convex site port: `3211`
- local parser: `8001`
- local Vite: `5173`

### Known caveat: stale local backend

If a stale local Convex backend is already bound to `3210`, startup can fail or attach to the wrong process.

Practical symptoms:

- local readiness check fails unexpectedly
- `instance_name` does not match the intended local deployment

The script currently kills Vite port listeners, but local Convex conflicts still depend on what is already running on `3210`.

## 7. Verification checklist

Use this checklist when debugging resume import locally.

### Frontend env

In the browser bundle or `/src/main.tsx` dev output, verify:

- `VITE_CONVEX_URL` is local when using local Convex
- `VITE_PARSER_URL` is local when using local parser
- `VITE_CONVEX_PARSER_URL` is local when using local parser

Expected local values:

- `VITE_CONVEX_URL=http://127.0.0.1:3210`
- `VITE_PARSER_URL=http://127.0.0.1:8001`
- `VITE_CONVEX_PARSER_URL=http://127.0.0.1:8001`

### Local Convex URL

Verify:

```bash
curl http://127.0.0.1:3210/instance_name
```

Expected local response shape:

- instance name like `local-panamini-banzai`

### Local parser URL

Verify:

```bash
curl http://127.0.0.1:8001/ready
```

Expected:

- HTTP 200

### Selected parser base URL from logs

Read:

- [tmp/convex-dev.log](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/tmp/convex-dev.log)

Look for:

- `selectedBaseUrl`
- `selectedLabel`
- `selectedModeSource`

For true local action execution, this should point at loopback, not `https://parser.dasti.ai`.

### Runtime debug panel values

In local/dev, the import runtime panel should expose:

- `ocr_engine`
- `mistral_runtime`
- `mistral_fallback`
- `ocr_request_path`
- `authoritativeResume.trusted`
- effective import label

Possible effective labels:

- `Trusted Mistral import`
- `OCR import rejected (fallback/untrusted)`

### Meaning of `OCR import rejected (fallback/untrusted)`

It means:

- the OCR request returned fallback or untrusted runtime evidence
- the payload may still exist for debug inspection
- the app intentionally did not import sections into the editor

It does not mean the parser request itself necessarily failed. It means the import gate rejected it as non-authoritative.

## 8. Common failure modes

These are the failure classes already seen in this repo/debugging flow.

### Frontend pointed to shared cloud Convex

Symptom:

- local UI was running
- actions still executed on `https://...convex.cloud`

Impact:

- local parser changes had no effect on live imports

### Cloud Convex pointed to `parser.dasti.ai`

Symptom in `structuredUpload` logs:

- `selectedBaseUrl: https://parser.dasti.ai`
- `selectedLabel: env:CONVEX_PARSER_URL`
- `selectedModeSource: env_first`

Impact:

- imports still used the remote parser path

### Cloudflare tunnel failures

Observed classes:

- 502
- 530
- Cloudflare tunnel / host-unreachable style failures

Impact:

- parser call failed before structured runtime/debug fields were produced

### Local parser schema/request-construction bug

Observed parser-side error:

- `Unexpected type: 0`

Root cause:

- local Mistral request construction failed during JSON-schema formatting for document annotation

Impact:

- local OCR path fell back before producing authoritative Mistral output

This parser-side bug was fixed separately in parser code. That fix matters only when the app is truly exercising the local parser path.

### Local Convex bootstrap or readiness mismatch

Observed class:

- startup script waited for local Convex but CLI stayed cloud-backed

Later observed class:

- local deployment bootstrapped but required env vars were missing for local push

Impact:

- `./run.sh up --ui --local-origin --local-convex` could fail even though parser startup succeeded

### Browser auto-open oddities

Observed class:

- browser/open behavior can be noisy or inconvenient in local runs

Impact:

- not an app/runtime correctness issue by itself

Use:

```bash
OPEN_BROWSER=0 ./run.sh up --ui --local-origin --local-convex
```

## Practical recommendation

Use `./run.sh up --ui` when you are doing UI work or reproducing the shared-cloud path intentionally.

Use `./run.sh up --ui --local-origin --local-convex` when you are debugging parser selection, local OCR behavior, or any end-to-end resume import issue where local parser changes must be exercised.
