# run.sh Docker package audit

Scope: the image built by `./run.sh`, which uses `cv_parser_service/Dockerfile` in `run.sh:103-125` and the runtime checks in `run.sh:228-231`.

## Findings

### 1. `npm` is runtime dead weight in the final image

- Evidence: the runtime stage installs `nodejs npm` in [`cv_parser_service/Dockerfile`](file:///Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/cv_parser_service/Dockerfile#L133-L163), but the only runtime Node usage I found is `node` itself, not `npm`.
- Evidence: [`cv_parser_service/document_export.py`](file:///Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/cv_parser_service/document_export.py#L28-L35) resolves `node`, then launches the TS worker with `node --import <tsx loader> ...`.
- Evidence: [`run.sh`](file:///Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/run.sh#L228-L231) checks for `node`, `tsx`, `playwright`, and `esbuild`, but not `npm`.
- Impact: `npm` is used during image build (`npm ci` and `npx playwright install`) but is not required by the running parser container.
- Assessment: this is the best candidate for trimming, but it is not a simple one-line delete because the same Docker stage currently uses `npm` to build the Node assets. To remove it from the final image, move the Node/package install work into a build-only stage and copy the resulting artifacts into runtime.

### 2. `curl` in the runtime image is probably removable, but it is lower value

- Evidence: all health checks I found use `curl` from host-side scripts like `run.sh`, `scripts/start-dev.sh`, and `scripts/smoke.sh`, not from inside the container.
- Evidence: no runtime Python path or export worker path I inspected calls `curl` in the container.
- Impact: removing it would save a small amount of image size and one apt package, but it is unlikely to move redeploy time much on its own.
- Assessment: safe to consider if you do not rely on interactive `docker exec` debugging inside the container.

### 3. `nodejs` is not dead weight

- Evidence: `cv_parser_service/document_export.py` needs `node` to render PDF/DOCX exports, and `run.sh` validates that the runtime image has the Node-based export surface.
- Assessment: keep `nodejs` unless you remove the document export worker path entirely.

### 4. `python3-numpy`, `libopenblas0-serial`, `liblapack3`, `libgomp1`, and `libgfortran5` are not obviously useless

- Evidence: the runtime image creates `/opt/paddle-venv` with `--system-site-packages` and then installs `paddlepaddle`, `paddleocr`, `paddlex`, and related numeric/ML packages in [`cv_parser_service/Dockerfile`](file:///Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/cv_parser_service/Dockerfile#L165-L196).
- Assessment: these packages are plausibly required for Paddle / scientific runtime stability, so I would not trim them without a narrower runtime failure target.

## Bottom line

Yes, you can reduce redeploy weight a bit, but the biggest safe target is `npm`, not the whole package set.

The current Dockerfile is already structured so that most expensive work is cached unless `cv_parser_service/Dockerfile`, the lockfiles, or the app package manifests change. So package trimming will mostly help when you force rebuilds or invalidate those layers, not when you are doing a code-only redeploy.

If you want the next step, the cleanest optimization is a small Dockerfile refactor:

1. install Node/npm only in a build-only stage
2. run `npm ci` and `npx playwright install` there
3. copy only `node_modules`, Playwright browsers, and the Python venvs into runtime

