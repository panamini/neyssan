# Controlled ATS public endpoint resolver

## Decision

Add a narrow public endpoint layer to `controlled-ats-scout` for known ATS job-board URLs only.

Supported no-auth public sources are Greenhouse, Lever, SmartRecruiters, and Recruitee. Ashby remains payload-only because live API access requires credentials.

## Boundaries

- The resolver accepts only known ATS hosts and emits official JSON endpoint descriptors.
- The fetcher uses an injected `fetchImpl`, `GET`, `accept: application/json`, and `redirect: "manual"`.
- Fetch guards reject auth headers, cookies, redirects, non-200 status, non-JSON responses, oversized responses, and invalid JSON.
- Normalizers remain pure payload adapters and do not perform network calls.

## Rollback

Rollback is deletion/revert-only: remove the resolver, fetcher, public endpoint tests, SmartRecruiters/Recruitee adapter additions, and this decision doc.
