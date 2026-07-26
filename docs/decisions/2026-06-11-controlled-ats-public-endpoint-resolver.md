# Controlled ATS public endpoint resolver

## Decision

Add a narrow public endpoint layer to `controlled-ats-scout` for known ATS job-board URLs only.

Supported no-auth public sources are Greenhouse, Lever, SmartRecruiters, and Recruitee. Ashby remains payload-only because live API access requires credentials.

## Endpoint Matrix

| Vendor | Source URL | Resolved endpoint | Auth | Pagination | Notes |
| --- | --- | --- | --- | --- | --- |
| Greenhouse | `boards.greenhouse.io/{board}` | `boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true` | none | none | GET job board data is public. |
| Lever | `jobs.lever.co/{site}` / `jobs.eu.lever.co/{site}` | `api.lever.co/v0/postings/{site}?mode=json&limit=100&skip=0` / EU equivalent | none | `skip/limit` | Public postings only. |
| SmartRecruiters | `careers.smartrecruiters.com/{companyIdentifier}` | `api.smartrecruiters.com/v1/companies/{companyIdentifier}/postings?limit=100&offset=0` | none | `offset/limit` | Active public postings. |
| Recruitee | `{subdomain}.recruitee.com` | `{subdomain}.recruitee.com/api/offers/` | none | none | Uses `accept: application/json`. |

## Boundaries

- The resolver accepts only known ATS hosts and emits official JSON endpoint descriptors.
- The fetcher uses an injected `fetchImpl`, `GET`, `accept: application/json`, and `redirect: "manual"`.
- Fetch guards reject auth headers, cookies, redirects, non-200 status, non-JSON responses, oversized responses, and invalid JSON.
- Normalizers remain pure payload adapters and do not perform network calls.

## Fetch Behavior

- `GET` only.
- Injected `fetchImpl` only.
- No global network call from normalizers.
- `redirect: "manual"`.
- `AbortController` timeout from `timeoutMs`.
- Reject auth headers and cookies.
- Reject redirects, non-200 status, non-JSON content type, invalid JSON, and oversized body.
- Paginate only known official paginated endpoints.

## Explicit Exclusions

- Ashby live API is excluded because official live access requires credentials.
- Workable is excluded because official API access requires credentials and scope.
- Adzuna is excluded because it requires app credentials and is an aggregator, not a controlled ATS source.
- LinkedIn, Upwork, and Indeed remain forbidden because they are outside the controlled no-auth ATS boundary.

## Rollback

Rollback is deletion/revert-only: remove the resolver, fetcher, public endpoint tests, SmartRecruiters/Recruitee adapter additions, and this decision doc.
