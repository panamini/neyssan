/* eslint-disable @typescript-eslint/no-base-to-string -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
export type DocumentPageSizeId = "a4" | "letter";
export type DocumentPageSizePreference = DocumentPageSizeId | "auto";

export type DocumentPageSize = {
  id: DocumentPageSizeId;
  label: string;
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  aspectRatio: number;
  cssSize: string;
};

export const MM_TO_PX = 96 / 25.4;

function formatPageSizeNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(3))}`;
}

function buildPageSize(args: {
  id: DocumentPageSizeId;
  label: string;
  widthMm: number;
  heightMm: number;
}): DocumentPageSize {
  const widthMm = args.widthMm;
  const heightMm = args.heightMm;

  return {
    id: args.id,
    label: args.label,
    widthMm,
    heightMm,
    widthPx: widthMm * MM_TO_PX,
    heightPx: heightMm * MM_TO_PX,
    aspectRatio: widthMm / heightMm,
    cssSize: `${formatPageSizeNumber(widthMm)}mm ${formatPageSizeNumber(heightMm)}mm`,
  };
}

export const DOCUMENT_PAGE_SIZES = {
  a4: buildPageSize({
    id: "a4",
    label: "A4",
    widthMm: 210,
    heightMm: 297,
  }),
  letter: buildPageSize({
    id: "letter",
    label: "US Letter",
    widthMm: 215.9,
    heightMm: 279.4,
  }),
} as const satisfies Record<DocumentPageSizeId, DocumentPageSize>;

export function isDocumentPageSizeId(
  value: unknown,
): value is DocumentPageSizeId {
  return value === "a4" || value === "letter";
}

export function resolveDocumentPageSizePreference(
  value: unknown,
): DocumentPageSizePreference {
  return value === "auto" || isDocumentPageSizeId(value) ? value : "auto";
}

export function documentPageSizeToPx(
  pageSize: Pick<DocumentPageSize, "id" | "label" | "widthMm" | "heightMm">,
): DocumentPageSize {
  return buildPageSize({
    id: pageSize.id,
    label: pageSize.label,
    widthMm: pageSize.widthMm,
    heightMm: pageSize.heightMm,
  });
}

export function normalizeDocumentPageSize(
  value: unknown,
): DocumentPageSize | null {
  if (isDocumentPageSizeId(value)) {
    return DOCUMENT_PAGE_SIZES[value];
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<DocumentPageSize>;
  if (isDocumentPageSizeId(record.id)) {
    return DOCUMENT_PAGE_SIZES[record.id];
  }

  return null;
}

function countryUsesLetter(value: unknown): boolean {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  return new Set([
    "us",
    "usa",
    "u.s.",
    "u.s.a.",
    "united states",
    "united states of america",
    "ca",
    "canada",
  ]).has(normalized);
}

function localeUsesLetter(value: unknown): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return /^en[-_](us|ca)\b/.test(normalized);
}

export function resolveDocumentPageSize(args: {
  pageSize?: unknown;
  preference?: unknown;
  country?: unknown;
  locale?: unknown;
} = {}): DocumentPageSize {
  const explicitPageSize = normalizeDocumentPageSize(args.pageSize);
  if (explicitPageSize) {
    return explicitPageSize;
  }

  const preference = resolveDocumentPageSizePreference(args.preference);
  if (preference !== "auto") {
    return DOCUMENT_PAGE_SIZES[preference];
  }

  if (countryUsesLetter(args.country) || localeUsesLetter(args.locale)) {
    return DOCUMENT_PAGE_SIZES.letter;
  }

  return DOCUMENT_PAGE_SIZES.a4;
}

export function formatDocumentPageSizeMm(value: number): string {
  return formatPageSizeNumber(value);
}

export function buildDocumentPageSizePrintCss(pageSize: DocumentPageSize) {
  return `@page {
  size: ${pageSize.cssSize};
  margin: 0;
}`;
}
