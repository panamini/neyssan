Editor Stability QA Checklist

Purpose
This document captures a concise manual and automated verification plan for the editor stability regressions we saw. Focus: ensure typing (without blur) followed by structural mutations (add block/section, collapse/expand) does not erase local buffers and does not crash the app.

Environment
- Run the app in your normal development environment (npm run dev / pnpm dev).
- Use Chrome or Firefox for manual tests.
- Node 18+ recommended for running any automated tests.
- Optional: Playwright installed (npm i -D @playwright/test) to run the provided e2e snippet.

Manual Test Flows (high priority)
1) Block-level typing → Add Block
- Steps:
  1. Open a CV that contains at least one section with blocks.
  2. Click inside a block's editor ("Start typing here…").
  3. Type text but do NOT blur the editor.
  4. Click "Add Block" inside the same section.
- Expected:
  - Typed content in the block remains and is not erased.
  - New block is inserted in the correct position.
  - No console errors or React "maximum update depth" errors.

2) Block title typing → Add Block
- Steps:
  1. Click a block title input and type text but do NOT blur.
  2. Click "Add Block".
- Expected:
  - Block title persists (is not erased).
  - New block is inserted; other blocks unchanged.
  - No console errors.

3) Section-level typing → Collapse section (chevron)
- Steps:
  1. In a SectionEditor, type a section title and/or type inside section editor content (do NOT blur).
  2. Click the collapse chevron (toggle).
- Expected:
  - Section title and editor content persist after collapse.
  - No console errors.

4) Rapid structural changes stress test
- Steps:
  1. Type in a block title or content.
  2. Rapidly add 3 blocks, then delete one, then add a section.
- Expected:
  - No data loss for typed buffers.
  - No crashes. If anything fails, capture console log and steps.

Verification/Observability
- Open browser devtools console and network tab.
- Watch for:
  - React errors (Maximum update depth, etc.)
  - Convex validation errors or ArgumentValidationError
  - Unexpected re-renders causing focus loss (cursor jumps)

Debugging Steps if failure observed
- Reproduce in local dev and copy the exact console stack trace.
- Identify whether failure occurs during:
  - flushPendingEdits() invocation
  - setCurrentCv() update
  - Remirror mount/onChange lifecycle
- Check these files first:
  - my-app/src/contexts/CvLibraryContext.tsx
  - my-app/src/components/SectionEditor.tsx
  - my-app/src/components/cv-editor/BlockRenderer.tsx
  - my-app/src/components/remirror-editor/utils/conversion.ts
- Add temporary trace logs only when needed using the ENABLE_CONVERSION_TRACE flag in conversion utils.

Automated Test (Playwright) — Example
- This is a minimal Playwright test template that performs the critical "type without blur → add block" flow.
- Save under tests/editor-stability.spec.ts and run with Playwright (npx playwright test).
- Adjust selectors to match your DOM (classnames / aria-labels used in the components).

Code (Playwright example)
```ts
// tests/editor-stability.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Editor stability flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173'); // adjust if needed
    // TODO: navigate to a page with a CV loaded; if sidebar load is required, click a cv entry
  });

  test('typing inside block then add block preserves content', async ({ page }) => {
    // Selector assumptions (adjust as needed)
    const blockEditorSelector = '[aria-label="Section editor"] .ProseMirror, [data-test="block-editor"]';
    const addBlockButton = 'button[aria-label="Add block"], button[data-test="add-block"]';

    await page.waitForSelector(blockEditorSelector);
    const editor = await page.locator(blockEditorSelector).first();
    await editor.click();
    await editor.type('Hello world — typed without blur');

    // Click add block
    await page.click(addBlockButton);

    // Assert the previous block still contains the text
    await expect(editor).toContainText('Hello world — typed without blur');

    // Ensure no page-level errors appear (example)
    const consoleMessages: string[] = [];
    page.on('console', (msg) => consoleMessages.push(`${msg.type()}: ${msg.text()}`));
    expect(consoleMessages.filter((m) => /error|exception/i.test(m)).length).toBe(0);
  });
});
```

How I'll help run/expand tests
- I can:
  - Add the Playwright test into the repo with selectors tuned to your DOM.
  - Add a small NPM script "test:e2e" to run the Playwright test.
  - Expand these examples into additional scenarios (collapse, title typing, rapid mutations).

Next action (I will perform on your confirmation)
- Create the Playwright test file and an NPM script (test:e2e) that runs it.
- Or, if you prefer manual-only QA for now, I will produce a short one-page checklist in the PR description.

Which would you like me to add now?