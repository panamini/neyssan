export type EditorAiJobContext = {
  jobId: string;
  title?: string | null;
  company?: string | null;
  sourceLanguage?: string | null;
  visibleSummary?: string | null;
  visibleRequirements?: string[];
  visibleKeywords?: string[];
};

function compactString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function compactStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => compactString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 12);
}

export function normalizeEditorAiJobContext(
  context: unknown,
): EditorAiJobContext | null {
  if (!context || typeof context !== "object") return null;
  const record = context as Record<string, unknown>;
  const jobId = compactString(record.jobId);
  if (!jobId) return null;

  return {
    jobId,
    title: compactString(record.title),
    company: compactString(record.company),
    sourceLanguage: compactString(record.sourceLanguage),
    visibleSummary: compactString(record.visibleSummary),
    visibleRequirements: compactStringArray(record.visibleRequirements),
    visibleKeywords: compactStringArray(record.visibleKeywords),
  };
}

export function isEditorAiJobContextSufficient(
  context: EditorAiJobContext | null,
): context is EditorAiJobContext {
  if (!context?.jobId) return false;

  return Boolean(
    context.title ||
      context.visibleSummary ||
      context.visibleRequirements?.length ||
      context.visibleKeywords?.length,
  );
}

export function requireSufficientEditorAiJobContext(
  context: unknown,
): EditorAiJobContext {
  const normalized = normalizeEditorAiJobContext(context);
  if (!isEditorAiJobContextSufficient(normalized)) {
    throw new Error("tailor_to_job requires compact job context");
  }
  return normalized;
}

export function formatEditorAiJobContextForPrompt(
  context: EditorAiJobContext,
): string {
  const lines = [
    `Job ID: ${context.jobId}`,
    context.title ? `Title: ${context.title}` : null,
    context.company ? `Company: ${context.company}` : null,
    context.sourceLanguage ? `Source language: ${context.sourceLanguage}` : null,
    context.visibleSummary ? `Visible summary: ${context.visibleSummary}` : null,
    context.visibleRequirements?.length
      ? `Visible requirements: ${context.visibleRequirements.join("; ")}`
      : null,
    context.visibleKeywords?.length
      ? `Visible keywords: ${context.visibleKeywords.join("; ")}`
      : null,
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}
