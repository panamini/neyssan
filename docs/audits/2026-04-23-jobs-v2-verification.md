## Jobs V2 Verification

Date: 2026-04-23

### Verified locally

- `JobsPage` list and detail now read through `useQuery`.
- `Archive` and `Duplicate` are wired through live Convex mutations.
- Archived jobs are excluded from the default jobs list projection.
- Duplicated jobs get a fresh `dedupeKey`.
- Duplicated jobs do not copy `matchReadSynthesis`.
- Structured `company` and `location` now flow through the extension save path for LinkedIn and Indeed.
- ZipRecruiter and HelloWork now send structured metadata instead of prepending it into `description`.

### Verified by command

- `rtk ./node_modules/.bin/vitest --run --exclude 'pdf-ingest/*' --maxWorkers=1 --minWorkers=1 src/pages/__tests__/JobsPage.test.tsx` in `my-app`
- `rtk ./node_modules/.bin/vitest --run --exclude 'pdf-ingest/*' --maxWorkers=1 --minWorkers=1 convex/lib/jobs/__tests__/canonicalJobs.test.ts` in `my-app`
- `rtk npx tsc --noEmit` in `my-app`
- `rtk npx tsc --noEmit` in `clerk-chrome-extension-final`

### Confirmed product/runtime gaps

- `JobsPage` still keeps a focus/visibility fallback refresh via `loadForUser`, so the list is not purely subscription-driven yet.
- There is no unarchive path in the current Jobs UI or public jobs mutations.

### Not verified from this execution boundary

- Live scrape/network payload on LinkedIn, Indeed, ZipRecruiter, HelloWork with the unpacked extension loaded in Chrome.
- Browser-visible flicker on inline edit under live `useQuery` updates.
- Browser smoke for archive/duplicate in a real authenticated session.
- Staging payload review for P6.
- P7 cohort rollout criteria review.
- P8 shadow agreement and cost review.

### Follow-up acceptance items

1. Run a real browser pass with the unpacked extension loaded and inspect the payload sent to Convex on all four supported job platforms.
2. Verify inline-edit behavior visually for stale-then-correct flicker under `useQuery`.
3. Decide whether archive is intentionally one-way or whether unarchive must be added.
4. Browser-smoke duplicate: confirm new row appears reactively, recomputes match read on first open, and behaves as a distinct job.
5. Complete the P6, P7, and P8 acceptance gates outside local dev.
