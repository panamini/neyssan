# cvMapper — mapping helper for parsed CV sections

Purpose
This utility converts the downstream output of the parsing pipeline (the LLM/heuristic `sections` array + optional `metadata`) into a canonical CV-shaped object that is convenient for UI rendering, storage, and further transformations. The mapper is intentionally non-invasive: it does not change or replace the existing `parseCV` return shape. Callers can opt-in to mapping by invoking the exported utility.

Primary files
- [`my-app/convex/lib/parsing/cvMapper.ts:1`](my-app/convex/lib/parsing/cvMapper.ts:1) — implementation & exported functions.
- [`my-app/convex/lib/parsing/__tests__/cvMapper.test.ts:1`](my-app/convex/lib/parsing/__tests__/cvMapper.test.ts:1) — basic unit test.
- [`my-app/convex/lib/parsing/__tests__/cvMapper.edgecases.test.ts:1`](my-app/convex/lib/parsing/__tests__/cvMapper.edgecases.test.ts:1) — edge-case unit tests.

Exports
- mapSectionsToCV(sections: IParsedSection[], metadata?: IParsedMetadata): ICVObject
  - Main typed mapping function; throws on invalid input (validated with Zod).
- mapSectionsToCVSafe(input: unknown): ICVObject
  - Safe entrypoint that validates the unknown input using Zod and delegates to mapSectionsToCV.

ICVObject (summary)
- name?: string | null
- contact?: { email?: string | null; phone?: string | null; linkedinUrl?: string | null; raw?: string | null }
- summary?: { text: string; confidence: number } | null
- experience: Array<{ content: string; confidence: number; title?: string; sourceSpan?: { start: number; end: number } | null }>
- education: same shape as experience
- skills?: { text: string; confidence: number } | null
- languages?: { text: string; confidence: number } | null
- achievements?: { text: string; confidence: number } | null
- projects: Array<...>
- research, volunteer, references, other: Array<...>
- raw?: string | null

Merging & normalization semantics
- Repeatable sections (experience, education, projects, research, volunteer, references, other)
  - Preserved as arrays; each entry retains its original content, title (when present), confidence value, and optional sourceSpan.
- Singular fields (summary/introduction, skills, languages, achievements)
  - Multiple sections mapping to the same singular bucket are concatenated into a single text blob using a readable separator (default: double line break for summary, newline or comma for others).
  - Confidence is averaged across contributing sections.
- Contact
  - Prefer explicit metadata (name/email/phone/linkedinUrl) passed in separately; when metadata keys are missing, mapper will attempt lightweight extraction from any `contact` sections using regex (email, phone, first http(s) link).
  - The extracted raw contact block is preserved in contact.raw when available.
- Unknown field keys
  - Sections with unrecognized `fieldKey` values are grouped into the `other` array so nothing is dropped.

Usage example
- Typical consumption after calling existing parse function:
  - const parsed = await parseCV(rawText) // unchanged API
  - const cv = mapSectionsToCV(parsed.sections, parsed.metadata)
  - render CV using `cv.summary`, `cv.experience`, `cv.skills`, etc.
- The mapper is intentionally pure and synchronous; it relies only on the provided `sections` + `metadata` and will not call external services.

Testing
- Unit tests live alongside the implementation:
  - [`my-app/convex/lib/parsing/__tests__/cvMapper.test.ts:1`](my-app/convex/lib/parsing/__tests__/cvMapper.test.ts:1)
  - [`my-app/convex/lib/parsing/__tests__/cvMapper.edgecases.test.ts:1`](my-app/convex/lib/parsing/__tests__/cvMapper.edgecases.test.ts:1)
- Run tests from repository root:
  - cd my-app && npm test
  - Or run only mapper tests: npx vitest run my-app/convex/lib/parsing/__tests__/cvMapper.test.ts

Notes & future improvements
- Contact parsing: current extraction is lightweight (regex). For stronger accuracy, add a small contact-extraction util with Zod validation and tests.
- Language normalization: consider normalizing language names (ISO codes) and deduplicating across multiple language sections.
- Confidence rules: the default averaging strategy is simple; for higher accuracy, use weighted averages or prefer higher-confidence sections for singular fields.
- Integration: if you later want `parseCV` to return a `cv` property automatically, consider an opt-in flag or a minor, backward-compatible contract change. The current approach avoids breaking consumers.

This file documents the non-invasive mapper utility; for implementation details see the source:
- [`my-app/convex/lib/parsing/cvMapper.ts:1`](my-app/convex/lib/parsing/cvMapper.ts:1)