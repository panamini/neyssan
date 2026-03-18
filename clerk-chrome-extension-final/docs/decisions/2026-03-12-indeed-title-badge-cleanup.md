# Indeed Title Badge Cleanup

Date: 2026-03-12

## Decision

Clean trailing Indeed-only title badges in the Indeed title scraping path, not in shared text helpers.

## Scope

- Remove standalone trailing status markers such as `job post` from scraped Indeed titles.
- Keep the cleanup narrow and title-specific.
- Do not change description scraping or other platforms.

## Reason

Indeed can expose short status badges inside the title node. The extension should not preserve those badges as part of the final job title, but shared generic text cleanup would be too broad for this issue.
