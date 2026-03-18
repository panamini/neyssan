/**
 * Lightweight Storage Adapter for CV documents.
 *
 * - Uses browser localStorage when available.
 * - Falls back to an in-memory store (useful for SSR or tests).
 *
 * Exports:
 * - async function saveCv(cv: CvDocument): Promise<void>
 * - async function loadCv(id: string): Promise<CvDocument | null>
 * - async function listCvIds(): Promise<string[]>
 * - async function deleteCv(id: string): Promise<void>
 *
 * This file intentionally has no heavy dependencies and uses the
 * project's `CvDocument` type where available.
 */

import type { CvDocument } from "../types/cvDocument";

const STORAGE_PREFIX = "cv-doc:";

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

/**
 * In-memory fallback for environments without localStorage (or tests).
 */
const inMemoryStore: Record<string, string> = {};

/**
 * Serialize a CV document for persistence.
 */
function serialize(cv: CvDocument): string {
  return JSON.stringify(cv);
}

/**
 * Deserialize stored string to CvDocument.
 * Keeps defensive try/catch to avoid throwing on bad data.
 */
function deserialize(payload: string | null): CvDocument | null {
  if (!payload) return null;
  try {
    return JSON.parse(payload) as CvDocument;
  } catch {
    return null;
  }
}

/**
 * Save a CV document (upsert).
 */
export async function saveCv(cv: CvDocument): Promise<void> {
  const key = `${STORAGE_PREFIX}${cv.id}`;
  const payload = serialize(cv);
  try {
    if (hasLocalStorage()) {
      window.localStorage.setItem(key, payload);
      return;
    }
  } catch {
    // ignore localStorage failures and fall back to in-memory store
  }
  inMemoryStore[key] = payload;
}

/**
 * Load a CV document by id.
 */
export async function loadCv(id: string): Promise<CvDocument | null> {
  const key = `${STORAGE_PREFIX}${id}`;
  try {
    if (hasLocalStorage()) {
      const raw = window.localStorage.getItem(key);
      return deserialize(raw);
    }
  } catch {
    // fall back
  }
  return deserialize(inMemoryStore[key] ?? null);
}

/**
 * Delete a CV document by id.
 */
export async function deleteCv(id: string): Promise<void> {
  const key = `${STORAGE_PREFIX}${id}`;
  try {
    if (hasLocalStorage()) {
      window.localStorage.removeItem(key);
      return;
    }
  } catch {
    // fall back
  }
  delete inMemoryStore[key];
}

/**
 * List all CV ids in storage.
 */
export async function listCvIds(): Promise<string[]> {
  try {
    if (hasLocalStorage()) {
      const out: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          out.push(k.replace(STORAGE_PREFIX, ""));
        }
      }
      return out;
    }
  } catch {
    // fall through to in-memory
  }
  return Object.keys(inMemoryStore)
    .filter((k) => k.startsWith(STORAGE_PREFIX))
    .map((k) => k.replace(STORAGE_PREFIX, ""));
}

/**
 * Utility: attempt to load the "first" CV stored. Useful in demos.
 */
export async function loadAnyCv(): Promise<CvDocument | null> {
  const ids = await listCvIds();
  if (ids.length === 0) return null;
  return loadCv(ids[0]);
}

export default {
  saveCv,
  loadCv,
  deleteCv,
  listCvIds,
  loadAnyCv,
};
};
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem(`cv:${id}`);
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw) as CvDocument;
          // Validate cached document before returning it to the application.
          try {
            parseCvDocumentStrict(parsed as any);
            return parsed;
          } catch (validationErr) {
            // eslint-disable-next-line no-console
            console.warn("[StorageAdapter] cached CvDocument failed validation; ignoring cache", validationErr);
            return null;
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("[StorageAdapter] failed to parse cached cv JSON", err);
          return null;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Load + strict-validate result helper.
   * Returns a Result-style object instead of throwing on validation errors to make
   * calling code (UI) more resilient.
   */
  public async loadValidated(
    id: string
  ): Promise<
    | { ok: true; value: CvDocumentStrict }
    | { ok: false; error: string; loose?: CvDocument | null }
  > {
    try {
      const loose = await this.load(id);
      if (!loose) return { ok: false, error: "not_found", loose: null };
      try {
        const strict = parseCvDocumentStrict(loose);
        return { ok: true, value: strict };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg, loose };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg, loose: null };
    }
  }
}

/**
 * React hook factory that constructs a ConvexStorageAdapter using Convex hooks.
 * Must be called from a React component or other hook (valid hook usage).
 */
export function useConvexStorageAdapter(): ConvexStorageAdapter {
  const patchMutation = useMutation(api.profiles.patch) as unknown as (args: { profileId: string; patch: Partial<INormalizedProfile> }) => Promise<any>;

  // Provide a loader that uses convexClient.query(api.profilesPublic.get) and maps to CvDocument.
  const loadFn = async (_profileId: string): Promise<CvDocument | null> => {
    const prof = await convexClient.query(api.profilesPublic.get);
    if (!prof) return null;
    // Use the shared, pure mapper to convert raw profile -> CvDocument.
    return mapProfileToCvDocument(prof, _profileId);
  };

  return new ConvexStorageAdapter(patchMutation, loadFn);
}

/* ----------------------------- Helpers ----------------------------------- */

/**
 * Safely extract a human-readable summary string from the CvDocument's summary
 * which may be either a string or a Remirror JSON object.
 */
function extractSummary(summary: CvDocumentStrict["summary"]): string | undefined {
  if (summary == null) return undefined;
  if (typeof summary === "string") return summary;
  try {
    return JSON.stringify(summary);
  } catch {
    return undefined;
  }
}

/**
 * Map CvDocument to a Partial<INormalizedProfile> that the backend expects.
 * We include:
 * - summary (string if available)
 * - metadata (if present)
 * - rawSections: an autosave-friendly representation built from sections/blocks
 * - tags mapped to languages (backend uses `languages` array)
 * - structured experience/education when available
 *
 * Pure function — no side effects.
 */
export function mapCvDocumentToPatch(cv: CvDocumentStrict): Partial<INormalizedProfile> {
  const summary = extractSummary(cv.summary);
  const metadata = cv.metadata ?? undefined;
  const tags = cv.tags ?? undefined;

  // Build rawSections from blocks (fall back to section title + concatenated block text)
  const rawSections = Array.isArray(cv.sections)
    ? cv.sections.map((s) => {
        const contentText =
          Array.isArray(s.blocks) && s.blocks.length > 0
            ? s.blocks.map((b) => (b.plainText ?? extractTextFromRemirror(b.content))).join("\n\n")
            : "";
        return { title: s.title, content: contentText };
      })
    : undefined;

  const patch: Partial<INormalizedProfile> = {};

  if (summary !== undefined) patch.summary = summary;
  // NOTE: Do NOT forward internal `cv.metadata` (createdAt/updatedAt/version) to the
  // backend profile patch. The server's `metadata` validator expects a different
  // shape (import/source info). Sending createdAt/updatedAt caused validation errors.
  // If there are specific metadata fields that must be sent, map them explicitly here.
  if (rawSections !== undefined) (patch as any).rawSections = rawSections;
  if (tags !== undefined) (patch as any).languages = tags;

  // Attempt to extract structured experience/education from typed sections when present.
  if (Array.isArray(cv.sections)) {
    for (const s of cv.sections) {
      if (s.type === "experience" && s.structuredContent) {
        // structuredContent may be union; normalize if it matches experience schema
        const maybeExp = tryExtractExperience(s.structuredContent);
        if (maybeExp) (patch as any).experience = maybeExp;
      }
      if (s.type === "education" && s.structuredContent) {
        const maybeEdu = tryExtractEducation(s.structuredContent);
        if (maybeEdu) (patch as any).education = maybeEdu;
      }
    }
  }

  return patch;
}

/**
 * Helpers to convert normalized Convex profile -> CvDocument sections.
 * These are best-effort and conservative.
 */
function buildSectionsFromNormalizedProfile(prof: any): CvDocument["sections"] {
  const sections: CvDocument["sections"] = [];

  if (prof.summary) {
    sections.push({
      id: "summary",
      title: "Summary",
      type: "summary",
      blocks: [
        {
          id: "summary-block",
          type: "text",
          content: typeof prof.summary === "string" ? { type: "text", text: prof.summary } : prof.summary,
          plainText: typeof prof.summary === "string" ? prof.summary : undefined,
        },
      ],
      structuredContent: null,
    });
  }

  if (Array.isArray(prof.experience) && prof.experience.length > 0) {
    sections.push({
      id: "experience",
      title: "Experience",
      type: "experience",
      blocks: [],
      structuredContent: prof.experience as any,
    });
  }

  if (Array.isArray(prof.education) && prof.education.length > 0) {
    sections.push({
      id: "education",
      title: "Education",
      type: "education",
      blocks: [],
      structuredContent: prof.education as any,
    });
  }

  return sections;
}

/* ----------------------------- Structured extraction --------------------- */

function tryExtractExperience(sc: unknown): IExperienceItem[] | undefined {
  if (!Array.isArray(sc)) return undefined;
  const out: IExperienceItem[] = [];
  for (const it of sc) {
    if (!it || typeof it !== "object") continue;
    const company = typeof it.company === "string" ? it.company : undefined;
    const title = typeof it.position === "string" ? it.position : typeof it.title === "string" ? it.title : undefined;
    const startDate = it.startDate ? String(it.startDate) : undefined;
    const endDate = it.endDate ? String(it.endDate) : undefined;
    const description = typeof it.description === "string" ? it.description : undefined;
    if (company || title) {
      out.push({ company, title, startDate, endDate, description });
    }
  }
  return out.length > 0 ? out : undefined;
}

function tryExtractEducation(sc: unknown): IEducationItem[] | undefined {
  if (!Array.isArray(sc)) return undefined;
  const out: IEducationItem[] = [];
  for (const it of sc) {
    if (!it || typeof it !== "object") continue;
    const institution = typeof it.institution === "string" ? it.institution : typeof it.school === "string" ? it.school : undefined;
    const degree = typeof it.degree === "string" ? it.degree : undefined;
    const fieldOfStudy = typeof it.fieldOfStudy === "string" ? it.fieldOfStudy : undefined;
    const startDate = it.startDate ? String(it.startDate) : undefined;
    const endDate = it.endDate ? String(it.endDate) : undefined;
    if (institution) {
      out.push({ institution, degree, fieldOfStudy, startDate, endDate });
    }
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Attempt to extract text from a Remirror JSON node if possible.
 * It's intentionally permissive: if extraction fails we return an empty string.
 */
function extractTextFromRemirror(node: unknown): string {
  try {
    if (!node || typeof node !== "object") return "";
    return collectText(node);
  } catch {
    return "";
  }

  function collectText(n: any): string {
    if (!n) return "";
    if (typeof n === "string") return n;
    if (typeof n.text === "string") return n.text;
    if (Array.isArray(n.content)) return n.content.map(collectText).join(" ");
    return "";
  }
}