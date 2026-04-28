export type EditorAiJobContext = {
  jobId: string;
  title?: string | null;
  company?: string | null;
  sourceLanguage?: string | null;
  visibleSummary?: string | null;
  visibleRequirements?: string[];
  visibleKeywords?: string[];
};

function compactString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function compactStringArray(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => compactString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 12);
}

export function normalizeEditorAiJobContext(
  context: EditorAiJobContext | null | undefined,
): EditorAiJobContext | null {
  const jobId = compactString(context?.jobId);
  if (!jobId) return null;

  return {
    jobId,
    title: compactString(context?.title),
    company: compactString(context?.company),
    sourceLanguage: compactString(context?.sourceLanguage),
    visibleSummary: compactString(context?.visibleSummary),
    visibleRequirements: compactStringArray(context?.visibleRequirements),
    visibleKeywords: compactStringArray(context?.visibleKeywords),
  };
}

export function isEditorAiJobContextReady(
  context: EditorAiJobContext | null | undefined,
): boolean {
  const normalized = normalizeEditorAiJobContext(context);
  if (!normalized) return false;

  return Boolean(
    normalized.title ||
      normalized.visibleSummary ||
      normalized.visibleRequirements?.length ||
      normalized.visibleKeywords?.length,
  );
}
