# Patch set: add languages and contact fields

Overview
- This file contains a ready-to-review, ready-to-apply patch set (diff snippets) that add dedicated `languages` and `contact` fields to the Convex schema and propagate the changes through backend parsing, LLM post-processing, worker storage, frontend types and the reviewer UI.
- Each diff block below references the target file with a clickable link (line number indicated for context). Review the diffs and request application when ready.

Files changed (summary)
- [`my-app/convex/schema.ts`](my-app/convex/schema.ts:54)
- [`my-app/convex/profilesPublic.ts`](my-app/convex/profilesPublic.ts:1)
- [`my-app/convex/mutations/upsertProfile.ts`](my-app/convex/mutations/upsertProfile.ts:1)
- [`my-app/convex/parsePdf.ts`](my-app/convex/parsePdf.ts:1)
- [`my-app/convex/actions/formatCompleteCV.ts`](my-app/convex/actions/formatCompleteCV.ts:43)
- [`my-app/convex/lib/parsing/llmPostProcessor.ts`](my-app/convex/lib/parsing/llmPostProcessor.ts:130)
- [`my-app/worker/llmWorker.ts`](my-app/worker/llmWorker.ts:165)
- [`my-app/src/types/profile.ts`](my-app/src/types/profile.ts:23)
- [`my-app/src/utils/parseRefinedMarkdown.ts`](my-app/src/utils/parseRefinedMarkdown.ts:88)
- [`my-app/src/utils/simpleClientParse.ts`](my-app/src/utils/simpleClientParse.ts:49)
- [`my-app/src/components/ProfileReviewModal.tsx`](my-app/src/components/ProfileReviewModal.tsx:866)
- [`my-app/src/components/ProfileView.tsx`](my-app/src/components/ProfileView.tsx:60)

Notes
- The approach is conservative: add new top-level fields and wire parsing + UI to populate/use them, while keeping `rawParsedSections` as a fallback for backward compatibility.
- After review I can generate exact git patch files or apply the changes directly.

----
### 1) [`my-app/convex/schema.ts`](my-app/convex/schema.ts:54)
```diff
*** Begin Patch
*** Update File: my-app/convex/schema.ts
@@
         linkedIn: v.optional(v.string()),
         raw_text: v.optional(v.string()),
+        // New dedicated fields for languages and contact
+        languages: v.optional(v.array(v.string())),
+        contact: v.optional(v.object({
+          phone: v.optional(v.string()),
+          address: v.optional(v.string()),
+        })),
         metadata: v.optional(
*** End Patch
```

----
### 2) [`my-app/convex/profilesPublic.ts`](my-app/convex/profilesPublic.ts:1)
```diff
*** Begin Patch
*** Update File: my-app/convex/profilesPublic.ts
@@
   export interface UserProfile {
     ...
     linkedIn?: string;
     raw_text?: string;
+    languages?: string[];
+    contact?: { phone?: string; address?: string } | null;
     metadata?: {
@@
     if (args.profile.linkedIn !== undefined) updates.linkedIn = args.profile.linkedIn;
+    if (args.profile.languages !== undefined) updates.languages = args.profile.languages;
+    if (args.profile.contact !== undefined) updates.contact = args.profile.contact;
*** End Patch
```

----
### 3) [`my-app/convex/mutations/upsertProfile.ts`](my-app/convex/mutations/upsertProfile.ts:1)
```diff
*** Begin Patch
*** Update File: my-app/convex/mutations/upsertProfile.ts
@@
         if (args.profileData.summary !== undefined) updates.summary = args.profileData.summary;
+        if (args.profileData.languages !== undefined) updates.languages = args.profileData.languages;
+        if (args.profileData.contact !== undefined) updates.contact = args.profileData.contact;
*** End Patch
```

----
### 4) [`my-app/convex/parsePdf.ts`](my-app/convex/parsePdf.ts:1)
```diff
*** Begin Patch
*** Update File: my-app/convex/parsePdf.ts
@@
   const skills = extractSkills(text);
   const experience = extractExperiences(text);
+  const languages = typeof extractLanguages === "function" ? extractLanguages(text) : [];
+  const contact = typeof extractContactBlock === "function" ? extractContactBlock(text) : undefined;
...
     skills: skills ?? undefined,
     experience: experience ?? undefined,
+    languages: languages.length ? languages : undefined,
+    contact: contact ? contact : undefined,
*** End Patch
```

- Note: add helper functions `extractLanguages` and `extractContactBlock` in the same file or shared parser util. These should scan for headings "Langues/Languages" and "Coordonnées/Contact" and parse lists / phone/address with regex heuristics.

----
### 5) [`my-app/convex/actions/formatCompleteCV.ts`](my-app/convex/actions/formatCompleteCV.ts:43)
```diff
*** Begin Patch
*** Update File: my-app/convex/actions/formatCompleteCV.ts
@@
 const RefinedContentSchema = z.object({
   summary: z.string().optional(),
   skills: z.array(z.string()).optional(),
+  languages: z.array(z.string()).optional(),
+  contact: z.object({ phone: z.string().optional(), address: z.string().optional() }).optional(),
   ...
   rawParsedSections: z.array(ReviewerSectionSchema),
*** End Patch
```

----
### 6) [`my-app/convex/lib/parsing/llmPostProcessor.ts`](my-app/convex/lib/parsing/llmPostProcessor.ts:130)
```diff
*** Begin Patch
*** Update File: my-app/convex/lib/parsing/llmPostProcessor.ts
@@
   function mapHeaderToField(header: string): string {
-    // existing map
+    const h = (header || "").toLowerCase();
+    if (/(langues|languages|langue)/.test(h)) return "languages";
+    if (/(coordonn[eé]es|contact|contact details|coordonnées)/.test(h)) return "contact";
     // existing rules (summary, experience, skills, education, achievements, identity)
   }
*** End Patch
```

----
### 7) [`my-app/worker/llmWorker.ts`](my-app/worker/llmWorker.ts:165)
```diff
*** Begin Patch
*** Update File: my-app/worker/llmWorker.ts
@@
           const patch = extractPatchFromText(llmText);
- 
+  let storedPatch;
+  try {
+    // Attempt to normalize using server-side post-processor if available.
+    // We call the local parse function (server-side). This call is defensive:
+    // if parseLLMSections is not available in this runtime, fallback to raw.
+    const normalized = typeof (global as any).parseLLMSections === "function"
+      ? (global as any).parseLLMSections(String(patch ?? llmText))
+      : null;
+    storedPatch = { raw: patch ?? llmText, normalized: normalized ?? null };
+  } catch (e) {
+    storedPatch = patch ?? llmText;
+  }
@@
-              full_response: llmResp.raw,
-              patch: patch ?? llmText,
+              full_response: llmResp.raw,
+              patch: storedPatch,
               merged: false,
               createdAt: Date.now(),
             }
           })) as Id<"llmHistory">;
*** End Patch
```

- Note: this patch stores both raw and normalized payload into `llmHistory.patch`. The post-processor should be implemented in Convex action code (formatCompleteCV / llmPostProcessor) to produce `normalized`.

----
### 8) [`my-app/src/types/profile.ts`](my-app/src/types/profile.ts:23)
```diff
*** Begin Patch
*** Update File: my-app/src/types/profile.ts
@@
   experience?: IExperienceItem[] | null;
   education?: IEducationItem[] | null;
   achievements?: string[] | null;
+  languages?: string[] | null;
+  contact?: { phone?: string | null; address?: string | null } | null;
   rawText?: string | null;
*** End Patch
```

Also update `IReviewerSection` allowed fieldKey union (optional):
```diff
*** Begin Patch
*** Update File: my-app/src/types/profile.ts
@@
 export interface IReviewerSection {
   id: string;
   title: string;
   content: string;
   dismissed?: boolean;
-  fieldKey?: string | "identity";
+  fieldKey?: string | "identity" | "languages" | "contact";
 }
*** End Patch
```

----
### 9) [`my-app/src/utils/parseRefinedMarkdown.ts`](my-app/src/utils/parseRefinedMarkdown.ts:88)
```diff
*** Begin Patch
*** Update File: my-app/src/utils/parseRefinedMarkdown.ts
@@
   const result: RefinedContent = {
     raw: md,
     identity: lookup(["identité & coordonnées", "identite", "identity", "identité", "contact", "coordonnées", "contact details"]),
     summary: lookup(["résumé professionnel", "résumé", "professional summary", "summary"]),
     experience: lookup(["parcours professionnel", "parcours", "experience", "professional experience", "work experience"]),
     education: lookup(["formation", "education", "studies"]),
     skills: lookup(["compétences", "skills", "competences", "core competencies"]),
+    contact: lookup(["coordonnées", "contact", "contact details"]),
+    languages: lookup(["langues", "languages", "langue"]),
     points: lookup(["points forts", "strengths"]),
     achievements: lookup(["réalisations", "achievements", "accomplishments"]),
   };
*** End Patch
```

- Also ensure `RefinedContent` interface includes `languages?: string; contact?: string;` if not already present.

----
### 10) [`my-app/src/utils/simpleClientParse.ts`](my-app/src/utils/simpleClientParse.ts:49)
```diff
*** Begin Patch
*** Update File: my-app/src/utils/simpleClientParse.ts
@@
-        const fieldKey = key.includes("experience") ? "experience" : key.includes("project") ? "experience" : key.includes("skill") ? "skills" : key.includes("education") ? "education" : key.includes("identity") || key.includes("contact") ? "identity" : "summary";
+        const fieldKey = key.includes("experience") ? "experience"
+          : key.includes("project") ? "experience"
+          : key.includes("skill") ? "skills"
+          : key.includes("education") ? "education"
+          : key.includes("langue") || key.includes("language") || key.includes("langues") ? "languages"
+          : key.includes("contact") || key.includes("coordonn") ? "contact"
+          : key.includes("identity") ? "identity"
+          : "summary";
*** End Patch
```

----
### 11) [`my-app/src/components/ProfileReviewModal.tsx`](my-app/src/components/ProfileReviewModal.tsx:866)
```diff
*** Begin Patch
*** Update File: my-app/src/components/ProfileReviewModal.tsx
@@
           ensureSection("education", "Education", refinedFromAction.educationText ?? (refinedFromAction.education ? JSON.stringify(refinedFromAction.education, null, 2) : undefined));
           ensureSection("achievements", "Achievements", refinedFromAction.achievements ?? undefined);
+          // New canonical fields (languages, contact)
+          ensureSection("languages", "Languages", Array.isArray(refinedFromAction.languages) ? refinedFromAction.languages.join(", ") : refinedFromAction.languages ?? undefined);
+          ensureSection("contact", "Contact", refinedFromAction.contact ? `${refinedFromAction.contact.phone ?? ""}${refinedFromAction.contact.address ? " / " + refinedFromAction.contact.address : ""}` : undefined);
@@
           setSuggestions({
             summary: refinedFromAction.summary ?? payload.rawText,
             skills: Array.isArray(refinedFromAction.skills) ? refinedFromAction.skills.join(", ") : (refinedFromAction.skillsText ?? ""),
             experience: refinedFromAction.experienceText ?? (refinedFromAction.experience ? JSON.stringify(refinedFromAction.experience, null, 2) : undefined),
             education: refinedFromAction.educationText ?? (refinedFromAction.education ? JSON.stringify(refinedFromAction.education, null, 2) : undefined),
             achievements: refinedFromAction.achievements ?? undefined,
+            languages: Array.isArray(refinedFromAction.languages) ? refinedFromAction.languages.join(", ") : refinedFromAction.languages ?? undefined,
+            contact: refinedFromAction.contact ? (refinedFromAction.contact.phone ?? "") + (refinedFromAction.contact.address ? " / " + refinedFromAction.contact.address : "") : undefined,
           });
*** End Patch
```

- Optional: add inline editable `RefinementField` entries for languages/contact in manual review UI if desired.

----
### 12) [`my-app/src/components/ProfileView.tsx`](my-app/src/components/ProfileView.tsx:60)
```diff
*** Begin Patch
*** Update File: my-app/src/components/ProfileView.tsx
@@
             {profile.linkedIn && (
               <div className="mt-1">
                 <a
                   href={profile.linkedIn}
                   target="_blank"
                   rel="noreferrer"
                 >
                   {profile.linkedIn}
                 </a>
               </div>
             )}
+            {profile.contact?.phone && <div className="text-sm text-muted">Phone: {profile.contact.phone}</div>}
+            {profile.contact?.address && <div className="text-sm text-muted">Address: {profile.contact.address}</div>}
+            {profile.languages && profile.languages.length > 0 && (
+              <div className="mt-2">
+                <h4 className="mb-1 text-sm font-medium">Languages</h4>
+                <div className="text-sm text-muted">{profile.languages.join(", ")}</div>
+              </div>
+            )}
*** End Patch
```

----

Notes & Next steps
- These diffs are intentionally conservative: they add schema fields and wire up the main parsing + UI surfaces to include them.
- Recommended rollout:
  1. Add schema changes and deploy Convex schema update.
  2. Implement parser helpers (extractLanguages / extractContactBlock) and run unit tests.
  3. Update `formatCompleteCV` action and LLM post-processor so server returns normalized structure including `languages`/`contact` in `rawParsedSections` and top-level fields (dual-write).
  4. Update worker to store normalized patch (dual object with `{ raw, normalized }`).
  5. Update frontend types and UI to prefer top-level fields with fallback to `rawParsedSections`.
  6. Backfill data for existing profiles by scanning `llmHistory` and populating new fields where `rawParsedSections` include them (create migration action or server script).
  7. Run full test suite and QA.

If you approve these diffs, I can:
- produce apply-ready git patch files (git-format-patch) and include exact apply commands; or
- apply the patches directly in the repo.

End of patch set.