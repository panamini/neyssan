Hotfix: fix-unawaited-fetch — exact diff and staging deployment checklist

Summary
- Root cause: Promise.race timeouts left underlying provider fetches detached; Convex warned "[WARN] 1 unawaited operation: [fetch]".
- Fixes applied:
  - Propagate AbortSignal through adapters and fetch/SDK calls.
  - Abort underlying request on timeout and await the underlying promise (bounded) to avoid detached fetches.
  - Add bounded await-after-abort (2s) to avoid blocking when SDKs ignore AbortSignal.
  - Cap effective provider timeouts (20s).

Exact file changes (representative unified diffs)
- Files edited:
  - [`my-app/config/llmAdapters.ts`](my-app/config/llmAdapters.ts:1)
  - [`my-app/convex/lib/parsing/hybridParser.ts`](my-app/convex/lib/parsing/hybridParser.ts:1)

1) my-app/config/llmAdapters.ts (summary of changes)
- Changed ILLMAdapter.call signature to accept opts?: { signal?: AbortSignal }
- Forwarded opts?.signal into fetch init and SDK request payloads where possible.
- When delegating (generic adapter) pass opts through.

Representative diff (human-readable; apply with git):
--- a/my-app/config/llmAdapters.ts
+++ b/my-app/config/llmAdapters.ts
@@
-export interface ILLMAdapter {
-  call(prompt: string, schema?: unknown): Promise<string | object>;
-}
+export interface ILLMAdapter {
+  call(prompt: string, schema?: unknown, opts?: { signal?: AbortSignal }): Promise<string | object>;
+}
@@
-  async function call(prompt: string, schema?: unknown) {
+  async function call(prompt: string, schema?: unknown, opts?: { signal?: AbortSignal }) {
@@
-    let res = await fetch("https://api.openai.com/v1/responses", {
+    let res = await fetch("https://api.openai.com/v1/responses", {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         Authorization: `Bearer ${key}`
       },
       body: JSON.stringify(body)
+      , signal: opts?.signal
     });
@@
-          res = await fetch("https://api.openai.com/v1/responses", {
+          res = await fetch("https://api.openai.com/v1/responses", {
             method: "POST",
             headers: {
               "Content-Type": "application/json",
               Authorization: `Bearer ${key}`
             },
             body: JSON.stringify(body)
+            , signal: opts?.signal
           });
@@
-  async function call(prompt: string, schema?: unknown) {
+  async function call(prompt: string, schema?: unknown, opts?: { signal?: AbortSignal }) {
@@
-            resp = await client.generate({ model: effectiveModel, input: prompt });
+            resp = await client.generate({ model: effectiveModel, input: prompt, signal: opts?.signal });
@@
-        const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
+        const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
           method: "POST",
           headers: {
             "Content-Type": "application/json",
             Authorization: `Bearer ${key}`
           },
           body: JSON.stringify(body)
+          , signal: opts?.signal
         });
@@
-  async function call(prompt: string, schema?: unknown) {
+  async function call(prompt: string, schema?: unknown, opts?: { signal?: AbortSignal }) {
     // Delegate to OpenAI adapter for a generic provider config to keep behavior consistent.
-      const openaiAdapter = createOpenAIAdapter(config);
-      return openaiAdapter.call(prompt, schema);
+      const openaiAdapter = createOpenAIAdapter(config);
+      return openaiAdapter.call(prompt, schema, opts);

Notes:
- The exact positions are present in the committed files. The above shows the essential edits to propagate the AbortSignal to both fetch fallbacks and SDK calls.

2) my-app/convex/lib/parsing/hybridParser.ts (summary of changes)
- callLLM(prompt, schema, skipAdapters, opts?) now accepts opts?: { signal?: AbortSignal } and forwards to adapters.
- callLLMWithTimeout now creates an AbortController, passes controller.signal into callLLM, and on timeout calls controller.abort(); it then awaits the llmPromise settlement with a bounded wait.
- When delegating to adapter.call, create per-call AbortController, pass controller.signal to adapter.call, and on race timeout call controller.abort() and await adapterPromise settlement bounded.

Representative diff (human-readable):
--- a/my-app/convex/lib/parsing/hybridParser.ts
+++ b/my-app/convex/lib/parsing/hybridParser.ts
@@
-async function callLLM(prompt: string, schema?: unknown, skipAdapters?: boolean): Promise<string> {
+async function callLLM(prompt: string, schema?: unknown, skipAdapters?: boolean, opts?: { signal?: AbortSignal }): Promise<string> {
@@
-            const adapterResult = await adapter.call(prompt, schema);
+            const adapterResult = await adapter.call(prompt, schema, opts);
@@
-  const llmPromise = callLLM(promptWithText, schema, skipAdapters);
-  const timeoutPromise = new Promise<string>((_, reject) =>
-    setTimeout(() => reject(new Error('LLM timeout')), timeoutMs)
-  );
+  // Cap effective timeout and use AbortController so we can cancel underlying requests.
+  const effectiveTimeout = Math.min(timeoutMs, 20000);
+  const controller = new AbortController();
+  const llmPromise = callLLM(promptWithText, schema, skipAdapters, { signal: controller.signal });
+  const timeoutPromise = new Promise<string>((_, reject) =>
+    setTimeout(() => {
+      try { controller.abort(); } catch {}
+      reject(new Error('LLM timeout'));
+    }, effectiveTimeout)
+  );
@@
-            const adapterPromise = adapter.call(promptWithText, undefined);
-            let adapterResult: any;
-            try {
-              adapterResult = await Promise.race([
-                adapterPromise,
-                new Promise<string>((_, reject) => setTimeout(() => reject(new Error("adapter timeout")), timeoutMs))
-              ]);
-            } catch (raceErr) {
-              try { await adapterPromise.catch(() => {}); } catch { /* swallow */ }
-              throw raceErr;
-            }
+            // Bound the adapter timeout (per-call controller) and ensure we abort + await settlement.
+            const effectiveTimeout = Math.min(timeoutMs, 20000);
+            const controller = new AbortController();
+            const adapterPromise = adapter.call(promptWithText, undefined, { signal: controller.signal });
+            let adapterResult: any;
+            try {
+              adapterResult = await Promise.race([
+                adapterPromise,
+                new Promise<string>((_, reject) => setTimeout(() => reject(new Error("adapter timeout")), effectiveTimeout))
+              ]);
+            } catch (raceErr) {
+              try { controller.abort(); } catch {}
+              // Bounded await so we don't block indefinitely if SDK ignores AbortSignal.
+              try { await Promise.race([adapterPromise.catch(() => {}), new Promise((r) => setTimeout(r, 2000))]); } catch {}
+              throw raceErr;
+            }

Notes:
- The effective timeout cap was raised to 20s after local trials to reduce false timeouts for slow providers.
- The await-after-abort is bounded (2s) to avoid indefinite blocking if an adapter/SDK ignores AbortSignal.

Staging deployment checklist (step-by-step)
1) Prepare branch and commit
   - Branch name: hotfix/fix-unawaited-fetch
   - Commit message: "hotfix: propagate AbortSignal to adapters; abort + bounded await to prevent detached fetches"

2) Run tests & linters locally
   - npm test (or repo-specific test command)
   - npm run lint (fix any lints that block CI)

3) Deploy to staging
   - Push branch and create PR targeting staging.
   - Deploy staging via your pipeline or run the local staging steps:
     - Option A (local dev): npm run dev (starts frontend + convex functions)
     - Option B (CI): trigger staging pipeline

4) Smoke tests (immediately after staging deploy)
   - Reproduce the refine flow:
     - Open the app in staging environment.
     - Trigger ProfileReviewModal -> Refine for a CV with real-ish content.
   - Collect logs from staging Convex runtime and server:
     - Look for [fetch-instrument] entries indicating provider calls.
     - Verify no Convex warnings like "[WARN] 1 unawaited operation: [fetch]".
     - Verify adapter/provider aborts show up when timeouts are triggered and that jobs finish (either with provider result or fallback heuristics).
   - Useful grep:
     - grep -E "\[fetch-instrument\]|\[WARN\] 1 unawaited operation|adapter timeout|LLM timeout|repair timeout|adapter.provider_result" PATH_TO_LOGS

5) Monitoring checklist (first 60 minutes)
   - Confirm absence of "[WARN] 1 unawaited operation: [fetch]" in Convex logs.
   - Check telemetry:
     - adapter.provider_latency (p50/p95)
     - adapter.provider_result counts (ok vs error)
     - adapter.fallback_trace frequency
   - Check user-facing behavior:
     - Spinner terminates (success or fallback)
     - Any excessive latencies or increase in heuristics fallback rate
   - Rollback criteria:
     - Convex errors spike or reappearing unawaited fetch warnings
     - Heuristics fallback rate increases dramatically (>X% baseline — set your threshold)
     - User-impacting errors or regressions

6) Promote to production
   - If staging is clean for the watch window, merge PR and promote to production.
   - Monitor in production closely for 30–60 minutes using the same checks above.

Rollback plan
- If issues surface, revert the branch/PR or deploy a rollback patch.
- As a precaution, keep the original branch/commit available to reapply quickly.

Deliverables I can provide for you
- Exact git patch (git diff) ready to apply via your tooling.
- Draft PR description and release notes.
- Quick monitoring/runbook checklist (as above).

If you want the exact git diff output file I can:
- Create a patch file (git unified diff) and write it under patches/ (e.g., patches/0001-fix-unawaited-fetch.patch) for you to apply with git am/apply.

Next step (pick one)
- A: Provide the exact git unified diff file now (I will write patches/0001-fix-unawaited-fetch.patch).
- B: I return a ready-to-paste PR body + release notes (you will create the branch/PR).
- C: I wait for you to paste your release notes (you create PR) and I will produce the git patch on demand.

Selected by you: please reply with A, B, or C. I will proceed accordingly.