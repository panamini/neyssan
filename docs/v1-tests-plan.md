# V1 Testing Plan: Parser → Normalizer → Blocks

Scope
- Validate end-to-end pipeline from AI parsing to normalized CV document and representative blocks.
- Deprecate legacy normalization tests and replace with v1-focused suites.

Core system under test
- [normalizeAndValidateCvDocument()](my-app/src/lib/normalize-cv.ts:434)
- [ensureRepresentativeBlocks()](my-app/src/lib/normalize-cv.ts:206)
- [ensureRemirrorDoc()](my-app/src/components/remirror-editor/utils/conversion.ts:904)
- [htmlToPmFragment()](my-app/src/components/remirror-editor/utils/conversion.ts:118)
- [pmFragmentToHtml()](my-app/src/components/remirror-editor/utils/conversion.ts:240)
- [parseCV()](my-app/convex/lib/parsing/hybridParser.ts:322)
- Schemas: [cvDocument.schema.ts](my-app/src/schemas/cvDocument.schema.ts:1)
- Templates: [cv-template.ts](my-app/src/lib/cv-template.ts:1)

1) Quarantine legacy tests
Target legacy suite:
- [cv-normalize.test.ts](my-app/src/__tests__/cv-normalize.test.ts:1)

Strategy:
- Wrap top-level describe with describe.skip and add rationale comment.
- Alternatively rename file to cv-normalize.legacy.test.ts and update Vitest exclude.

Suggested patch (to be applied in code mode):

// In [cv-normalize.test.ts](my-app/src/__tests__/cv-normalize.test.ts:1)
describe.skip('Legacy normalize-cv suite', () => {
  // TODO: Legacy suite retained for reference. Replaced by v1 precision-aware tests.
});

Vitest exclude recommendation:
- In [vitest.config.ts](my-app/vitest.config.ts), add testExclude: ['**/*.legacy.test.ts']

2) New unit tests: normalization behavior
File: [my-app/src/__tests__/v1.normalize.blocks.test.ts](my-app/src/__tests__/v1.normalize.blocks.test.ts)
Cases:
- Creates one representative text block per Experience item; links via attributes.linkedStructuredId.
- Does not duplicate when a linked block already exists.
- Prunes blocks linked to invalid/removed structured ids.
- Preserves unlinked user blocks.
- Derives block title from company or position (experience) and institution or degree (education).
References: [ensureRepresentativeBlocks()](my-app/src/lib/normalize-cv.ts:206)

3) New unit tests: date precision semantics
File: [my-app/src/__tests__/v1.normalize.dates.test.ts](my-app/src/__tests__/v1.normalize.dates.test.tsæ)
Cases:
- '2021' -> precision 'year', ISO at YYYY-01-01T00:00:00.000Z.
- '2021-05' -> precision 'month', ISO at YYYY-05-01T00:00:00.000Z.
- '2021-05-10' or Date.parse-able -> precision 'day', normalized to UTC midnight.
- isCurrent true only when explicitly provided; do not infer from empty endDate.
- When isCurrent true: endDate=null and endDatePrecision undefined.
References: parseFlexibleDate and normalizeExperienceItem in [normalize-cv.ts](my-app/src/lib/normalize-cv.ts:37)

4) Conversion fidelity tests
File: [my-app/src/components/remirror-editor/utils/conversion.test.ts](my-app/src/components/remirror-editor/utils/conversion.test.ts)
Extend with:
- htmlToPmFragment preserves strong/em/link marks on inline text.
- pmFragmentToHtml round-trips simple paragraphs and lists.
- ensureRemirrorDoc treats falsy/empty input as placeholder doc; ignores 'Start typing here…' in extractPlainText.
References: [htmlToPmFragment()](my-app/src/components/remirror-editor/utils/conversion.ts:118), [pmFragmentToHtml()](my-app/src/components/remirror-editor/utils/conversion.ts:240), [extractPlainText()](my-app/src/components/remirror-editor/utils/conversion.ts:286)

5) Parser integration tests
File: [my-app/convex/lib/parsing/__tests__/v1.hybridParser.integration.test.ts](my-app/convex/lib/parsing/__tests__/v1.hybridParser.integration.test.ts)
Setup:
- Ensure no external network: set OPENAI_API_KEY empty and vi.mock fetch.
- Use [parseCV()](my-app/convex/lib/parsing/hybridParser.ts:322) with returnMappedCV: true.
- Leverage deterministic behavior: without API key parseCV returns mock sections/metadata.
Assertions:
- Experience/Education sections mapped contain startDate/endDate strings or null with explicit isCurrent when Present token occurs.
- Pipe the mapped CV through [normalizeAndValidateCvDocument()](my-app/src/lib/normalize-cv.ts:434) and assert representative blocks created once per item.

6) E2E pipeline test: Import from AI → Save → Normalize
File: [my-app/src/__tests__/v1.import-to-normalize.e2e.test.ts](my-app/src/__tests__/v1.import-to-normalize.e2e.test.ts)
Flow:
- Start from [generateCvTemplateV1()](my-app/src/lib/cv-template.ts:289).
- Simulate parsed Experience array with mixed date tokens: '2021', 'Jan 2023', '2022-05', 'Present'.
- Map description as plain text and as Remirror JSON; verify [ensureRemirrorDoc()](my-app/src/components/remirror-editor/utils/conversion.ts:904) accepts both.
- Apply to CV structuredContent; call [ensureRepresentativeBlocks()](my-app/src/lib/normalize-cv.ts:206); verify block linking and pruning.

7) AI mapping module tests
File: [my-app/src/lib/__tests__/ai-mapping.test.ts](my-app/src/lib/__tests__/ai-mapping.test.ts)
After adding ai-mapping.ts, cover:
- detectPresent handles 'present', 'current', 'now' case-insensitively and does not trigger on empty end.
- parseHumanDateToken supports YYYY, Mon YYYY, YYYY-MM, DD Mon YYYY, MM/YYYY without guessing missing units.
- mapDateRangeToIsoPrecision composes ISO + precision and sets isCurrent/endDate as specified.
- mapAiExperience produces IExperienceItem with description normalized via [ensureRemirrorDoc()](my-app/src/components/remirror-editor/utils/conversion.ts:904).

8) Regression tests for templates
File: [my-app/src/__tests__/v1.template.defaults.test.ts](my-app/src/__tests__/v1.template.defaults.test.ts)
Cases:
- [generateCvTemplate()](my-app/src/lib/cv-template.ts:126) seeds Experience.startDate with epoch sentinel and Education dates undefined.
- Sections include representative blocks linked to initial items.

9) Test infrastructure and mocks
- Ensure jsdom environment.
- vi.mock('convex/react') consistent with existing [useCvParser.test.tsx](my-app/src/hooks/__tests__/useCvParser.test.ts:1) placeholder.
- Provide helper to assert block↔item linkage.

10) Acceptance criteria
- All v1 test suites pass locally and in CI.
- No network calls made during tests; hybridParser deterministic path is used.
- Legacy normalize-cv suite is skipped/renamed and no longer fails CI.
- Representative blocks count equals structured items count for Experience/Education.
- Date precision and Present semantics validated across unit and integration levels.

Implementation order
1. Quarantine legacy suite [cv-normalize.test.ts](my-app/src/__tests__/cv-normalize.test.ts:1).
2. Add normalization tests for blocks and dates.
3. Extend conversion tests with mark fidelity.
4. Add parser integration test using deterministic path.
5. Add AI mapping module and its tests.
6. Add E2E import-to-normalize test.

Notes
- Keep tests independent of UI components; focus on pure functions and schema parsing.
- Prefer factories from [cv-template.ts](my-app/src/lib/cv-template.ts:20) to generate items when needed.
- Use strict Zod schemas to validate fixtures in tests where applicable.