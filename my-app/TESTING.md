# Testing Guide — my-app

This document explains how the test environment is configured and how to run and debug frontend tests for the `my-app` project. It also documents common pitfalls we ran into and the fixes applied so future contributors can avoid the same traps.

Contents
- Quick start (run tests)
- What I changed
  - Global test setup: `src/setupTests.ts`
  - Vite/Vitest configuration: `vite.config.ts`
  - Example test and MSW notes: `src/__tests__/ProfileEditorUnified.test.tsx`
- Common issues & fixes
- Debugging tips
- CI recommendations

---

Quick start (local)
1. Install deps (if not already):
   npm install

2. Run the full frontend test suite:
   cd my-app
   npm run test

3. Run a single test file:
   cd my-app
   npx vitest run src/__tests__/ProfileEditorUnified.test.tsx --run

Because Vitest is configured in `vite.config.ts` (see below) you don't need to pass `--environment jsdom` or point to a setup file every run — the config does that automatically.

---

What I changed
1) `src/setupTests.ts` (global initializers)
- Purpose:
  - Provide common test setup for all Vitest runs.
  - Stub environment variables used by the frontend tests.
  - Provide common global mocks (like `window.alert`) so tests do not trigger noisy side-effects.
- Key content:
  - `import '@testing-library/jest-dom'` for RTL matchers
  - `vi.stubEnv('VITE_PDF_INGEST_URL', 'http://localhost:8000')`
  - `vi.stubGlobal('alert', vi.fn())`

This file is referenced by Vitest automatically via `vite.config.ts` so tests start with a consistent environment.

2) `vite.config.ts`
- I added a `test` block to the Vite config so Vitest uses:
  - `environment: 'jsdom'`
  - `globals: true` (Vitest exposes test globals)
  - `setupFiles: ['src/setupTests.ts']` (load our setup file)
- Benefit: `npm run test` will run tests with the right environment and setup.

3) `src/__tests__/ProfileEditorUnified.test.tsx`
- Example test added/updated to demonstrate:
  - Mocking the Convex client (`useConvex`) with `vi.mock('convex/react', ...)` so the component has canonical profile data without calling a real Convex server.
  - Using MSW (mock-service-worker) Node handlers to simulate HTTP endpoints used by the component:
    - `POST /api/v1/llm-refine` -> returns placeholderId
    - `GET /api/v1/llm-history/:id` -> returns `pending` then `success`
    - `GET /api/v1/profiles/:id` -> returns canonical profile
  - How to test async flows: `findByText`, `waitFor`, `within`, and appropriate timeouts.
  - Important MSW note: MSW v2 for Node exposes `http` handlers, not `rest` — use `import { http } from 'msw'` for Node-based tests. Use `msw/node`'s `setupServer(...)`.

---

Common issues & fixes (what broke and how it was fixed)

1) Race conditions: clicking before data loads
- Symptom: clicking "Reapply" produced "No profile loaded to refine" alert.
- Fix: wait for the profile to render before interacting. Use:
  await screen.findByText(/Canonical Name/i)

2) MSW v2 API change (rest -> http)
- Symptom: TypeError: Cannot read properties of undefined (reading 'post') when using `msw` v2 in Node environment.
- Fix: use `http` for Node handlers:
  - `import { http } from 'msw'`
  - `import { setupServer } from 'msw/node'`
  - `setupServer(http.post(...), http.get(...))`

3) Host mismatch (localhost vs 127.0.0.1)
- Symptom: MSW warns: "intercepted a request without a matching request handler: POST http://127.0.0.1:8000/api/v1/llm-refine" and tests attempted a real HTTP request (ECONNREFUSED).
- Root cause: the component constructed a fetch to a host string that didn't exactly match the MSW handler's URL; MSW requires the handler string to match the request URL exactly (string equality).
- Fixes:
  - Prefer using `setupServer(http.post('http://127.0.0.1:8000/api/v1/llm-refine', ...))` if the component uses `127.0.0.1`.
  - Or ensure `VITE_PDF_INGEST_URL` stub matches the mocked URL string.
  - To avoid brittle host mismatches, prefer setting the app to use an env-driven base URL and stub that env in `setupTests.ts` (we stubbed `VITE_PDF_INGEST_URL`).

4) Vitest globals (beforeAll/afterAll undefined)
- Symptom: `beforeAll is not defined`
- Fix:
  - Configure Vitest to expose globals (`globals: true` in `vite.config.ts`), or import the vitest globals explicitly per-test:
    import { beforeAll, afterEach, afterAll, test, expect, vi } from 'vitest'

We set `globals: true` in the Vite config and also imported vitest utilities in the example test for clarity.

---

Recommended test patterns (example snippets)

- Mock Convex client (when component uses `useConvex`):
  vi.mock('convex/react', () => ({
    useConvex: () => ({
      query: async () => ({ id: 'profile-123', name: 'Canonical Name', summary: '...' }),
    }),
  }));

- MSW Node example:
  import { http } from 'msw'
  import { setupServer } from 'msw/node'
  const server = setupServer(
    http.post('http://127.0.0.1:8000/api/v1/llm-refine', (req) => HttpResponse.json({ placeholderId: '...' })),
    http.get('http://127.0.0.1:8000/api/v1/llm-history/:id', (req) => HttpResponse.json({ convex_write_status: 'pending' })),
  )
  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

- Async testing:
  await screen.findByText(/Canonical Name/i)
  await userEvent.click(reapplyButton)
  await screen.findByText(/<placeholder-id>/i)
  await waitFor(() => expect(someElement).toBeInTheDocument(), { timeout: 10000 })

---

Troubleshooting checklist
- If you see MSW "intercepted a request without a matching request handler":
  - Check the exact URL printed in the MSW warning.
  - Ensure your handler uses the exact same string (host + path).
  - If component uses `import.meta.env.VITE_PDF_INGEST_URL`, ensure `setupTests.ts` stubs that correctly (we stub it to `http://localhost:8000`).
  - Consider hardcoding `127.0.0.1` if fetch resolves to that and MSW sees `127.0.0.1`.

- If fetch fails with `ECONNREFUSED`:
  - Means a real network request was attempted. Fix the MSW handler or the env used by the component so MSW intercepts.

- If vitest complains about globals undefined:
  - Ensure `vite.config.ts` has `test: { globals: true }` OR import vitest globals in the test file.

---

CI / Automation suggestions
- Add a workflow that runs `npm ci && npm run test` inside `my-app` (or monorepo root with the correct `cd`).
- Add a diagnostic step that echoes environment variables used by tests and runs `node -e "console.log(process.env.VITE_PDF_INGEST_URL)"` to surface issues early.
- Run tests against a matrix of Node versions if you expect contributors to use different versions.

---

If you'd like, I can:
- Create a shorter README in `my-app/README_TESTING.md` and add it to the developer README.
- Open a PR with the `setupTests.ts`, `vite.config.ts` tests and this documentation bundled.
- Add a GitHub Action YAML that runs `npm ci && npm run test` and collects results.

Tell me which of those you want next and I’ll implement it.
