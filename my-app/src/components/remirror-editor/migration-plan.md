# Migration Plan: Unify Section Content Type

**Objective:** Resolve the `RMR0021` runtime errors and TypeScript type conflicts by adopting a consistent and flexible type for `Section.content`.

### Current Problem
- The `RemirrorEditor` was refactored to treat `Section.content` as a `RemirrorJSON` object for type safety within the editor.
- However, the rest of the application, including the global `Section` type in `my-app/src/types/cv.ts` and the `ProfileReviewCard` component, still treats `content` as an HTML `string`.
- This mismatch causes TypeScript errors and runtime failures because `useRemirror` receives data in an unexpected format.

### Solution: Adopt a Hybrid Type
The best solution is to make the application temporarily bilingual, allowing `Section.content` to be either a `string` or a `RemirrorJSON` object. This allows for an incremental migration.

---

### Phase 1: Type Unification & Coercion (Current Task)

**1. Update Global `Section` Type:**
- Modify the `Section` interface in `my-app/src/types/cv.ts` to allow `content` to be `string | RemirrorJSON`.
- This makes the dual-type explicit and is the source of truth for the data model.

**2. Create a Type Guard/Coercion Utility:**
- In `my-app/src/components/remirror-editor/utils/conversion.ts`, create a new function: `ensureRemirrorDoc(content: string | RemirrorJSON): RemirrorJSON`.
- This function will be the single point of responsibility for converting any `Section.content` into a valid `RemirrorJSON` document that is safe to pass to `useRemirror`.
- **Logic:**
    - If input is already a valid `RemirrorJSON` object, return it.
    - If input is a `string`, use the existing `htmlToPmFragment` utility to convert it into a `RemirrorJSON` doc.
    - If input is `null`, `undefined`, or invalid, return a minimal, empty `RemirrorJSON` doc (`{ type: 'doc', content: [...] }`).

**3. Update `RemirrorEditor` to Use the Coercion Utility:**
- In `my-app/src/components/remirror-editor/RemirrorEditor.tsx`, within the `SectionEditor` component, call `ensureRemirrorDoc(section.content)` to generate the `initialContent` for `useRemirror`.
- This ensures the editor *always* receives a valid document, eliminating the root cause of the `RMR0021` error.

**4. Define Data Flow for `onChange` Events:**
- Decide on the canonical format for data persistence. **Recommendation:** Continue emitting HTML `string` from `onChangeSections` for now. This prevents breaking the database persistence logic in `ProfileReviewCard`.
- In `SectionEditor`'s `handleChange` function, convert the editor's `RemirrorJSON` state back to an HTML string using `pmFragmentToHtml` before calling `onSectionChange`.

### Phase 2: Full Migration (Future Task)

**5. Update Database & API:**
- Modify the Convex database schema and mutations (`saveProfile`, `patch`) to store `RemirrorJSON` directly instead of HTML strings.
- This will make the editor's native format the source of truth, eliminating the need for back-and-forth conversions.

**6. Remove Legacy Conversions:**
- Once all parts of the app (persistence, rendering) can handle `RemirrorJSON`, remove the `pmFragmentToHtml` conversion from the `handleChange` event.
- The `ensureRemirrorDoc` function will still be useful for handling legacy data during a transition period.