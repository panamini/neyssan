# Indeed Title "`- job post`" Audit

Date: 2026-03-12

## Scope

- Audit only.
- No code changes.
- Investigate why scraped Indeed titles can end up as `Graphiste H/F- job post`.

## Active Code

- The active Indeed title path is `scrapeIndeedJobData()` in `src/contents/content.tsx`.
- It resolves the title from:
  - `h1[data-testid="jobsearch-JobInfoHeader-title"]`
  - `h1[data-testid="simpler-jobTitle"]`
  - `.jobsearch-JobInfoHeader-title`
  - `main h1`
  - `h1`
- The scraper takes the first non-empty match through `queryFirstMeaningfulText()`.
- `queryFirstMeaningfulText()` calls `textFromNode()`.
- `textFromNode()` reads `HTMLElement.innerText || textContent` and only normalizes whitespace/newlines. It does not strip status badges such as `job post`.

## Root Cause

- The extension is not appending `job post` itself.
- It is copying the raw rendered Indeed heading text with no title-specific cleanup.
- Current Indeed job pages and search snippets still expose titles in the shape `Job Title - job post`, which matches the bad output seen in the extension.
- Because the extension renders the scraped title into a single-line `<input>`, any newline between the job title and the `- job post` badge can collapse visually into `Graphiste H/F- job post`.

## Why The Current Code Produces It

1. `scrapeIndeedJobData()` chooses the first matching Indeed title node.
2. `textFromNode()` reads the full visible text payload from that node.
3. No Indeed-specific title sanitization removes `job post`.
4. The resulting string is assigned directly to `jobData.title`.
5. The panel renders `jobData.title` in a single-line input.

## Evidence

### Local Code Evidence

- `src/contents/content.tsx`
  - `textFromNode()` uses `innerText || textContent`.
  - `queryFirstMeaningfulText()` returns the first non-empty title as-is.
  - `scrapeIndeedJobData()` uses that raw title path.
  - The panel displays the scraped title directly in the title input.

### Current External Evidence

- Current Indeed search results still show titles in the form `Graphiste H/F - job post` and similar:
  - `https://fr.indeed.com/q-graphiste-h-f-emplois.html`
  - `https://fr.indeed.com/q-graphiste-designer-h-f-emplois.html`

## Conclusion

- This is an active scraper cleanup gap, not a Proposal Forge or generation issue.
- The bad suffix comes from Indeed’s title text as exposed on the page.
- The extension currently preserves that suffix because the Indeed title extractor has no title-specific cleanup stage.
