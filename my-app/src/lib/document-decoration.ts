export type DocumentDecorationSizePreset = 18 | 35 | 52 | "custom";
export type DocumentDecorationFit = "contain" | "cover";
export type DocumentDecorationMimeType =
  | "image/png"
  | "image/jpeg"
  | "image/svg+xml";

export type DocumentDecoration = {
  visible: boolean;
  source: "upload";
  assetId?: string;
  dataUrl?: string;
  fileName?: string;
  mimeType?: DocumentDecorationMimeType;
  alt?: string;
  sizePreset: DocumentDecorationSizePreset;
  customSizeMm?: number;
  fit: DocumentDecorationFit;
  placementMode: "default" | "custom";
  xMm?: number;
  yMm?: number;
};

export type DocumentDecorationPageSizeMm = {
  pageWidthMm: number;
  pageHeightMm: number;
};

export const DOCUMENT_DECORATION_SIZE_PRESETS = [18, 35, 52] as const;
export const DOCUMENT_DECORATION_CUSTOM_PRESET = "custom" as const;
export const DOCUMENT_DECORATION_DEFAULT_SIZE_MM = 35;
export const DOCUMENT_DECORATION_MIN_CUSTOM_SIZE_MM = 12;
export const DOCUMENT_DECORATION_MAX_CUSTOM_SIZE_MM = 105;
export const DOCUMENT_DECORATION_UPLOAD_ACCEPT =
  ".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml";
export const DOCUMENT_DECORATION_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const DEFAULT_DOCUMENT_DECORATION_PLACEMENT = {
  xMm: 17,
  yMm: 35,
} as const;
export const EDITORIAL_TEMPLATE_FLOWER_FILE_NAME = "Flower template mark.svg";
export const EDITORIAL_TEMPLATE_FLOWER_DECORATION_PLACEMENT = {
  xMm: 157,
  yMm: 18,
} as const;
export const DEFAULT_DOCUMENT_DECORATION_PAGE_SIZE_MM = {
  pageWidthMm: 210,
  pageHeightMm: 297,
} as const;

const EDITORIAL_TEMPLATE_FLOWER_MARKUP =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="#111"><path d="M208.35,132.82A50.92,50.92,0,0,0,195.76,128a50.92,50.92,0,0,0,12.59-4.82,36,36,0,0,0-36-62.36,51.54,51.54,0,0,0-10.47,8.5A51.27,51.27,0,0,0,164,56a36,36,0,0,0-72,0,51.27,51.27,0,0,0,2.12,13.32,51.54,51.54,0,0,0-10.47-8.5,36,36,0,1,0-36,62.36A50.92,50.92,0,0,0,60.24,128a50.92,50.92,0,0,0-12.59,4.82,36,36,0,1,0,36,62.36,51.54,51.54,0,0,0,10.47-8.5A51.27,51.27,0,0,0,92,200a36,36,0,0,0,72,0,51.27,51.27,0,0,0-2.12-13.32,51.54,51.54,0,0,0,10.47,8.5,35.85,35.85,0,0,0,18,4.84,36.24,36.24,0,0,0,9.37-1.25,36,36,0,0,0,8.68-66Zm-32-65.07a28,28,0,0,1,28,48.5c-6.95,4-19.82,6.66-37.44,7.74l-3.16-.17a36,36,0,0,0-14.26-24.68c.49-1,1-1.9,1.44-2.84C160.67,81.59,169.4,71.77,176.35,67.75ZM128,156a28,28,0,1,1,28-28A28,28,0,0,1,128,156Zm0-128a28,28,0,0,1,28,28c0,8-4.14,20.5-12,36.3-.58.87-1.15,1.75-1.73,2.65a35.94,35.94,0,0,0-28.52,0c-.58-.9-1.15-1.78-1.73-2.65C104.14,76.5,100,64,100,56A28,28,0,0,1,128,28ZM51.65,116.25a28,28,0,1,1,28-48.5c6.95,4,15.68,13.84,25.42,28.55.47.94,1,1.88,1.44,2.84a36,36,0,0,0-14.26,24.68l-3.16.17C71.47,122.91,58.6,120.26,51.65,116.25Zm28,72a28,28,0,1,1-28-48.5c7-4,19.82-6.66,37.44-7.74l3.16.17a36,36,0,0,0,14.26,24.68c-.49,1-1,1.9-1.44,2.84C95.33,174.41,86.6,184.23,79.65,188.25ZM128,228a28,28,0,0,1-28-28c0-8,4.14-20.5,12-36.3.58-.87,1.15-1.75,1.73-2.65a35.94,35.94,0,0,0,28.52,0c.58.9,1.15,1.78,1.73,2.65,7.87,15.8,12,28.27,12,36.3A28,28,0,0,1,128,228Zm86.6-50a28,28,0,0,1-38.25,10.25c-6.95-4-15.68-13.84-25.42-28.55-.47-.94-1-1.88-1.44-2.84a36,36,0,0,0,14.26-24.68l3.16-.17c17.62,1.08,30.49,3.73,37.44,7.74A28,28,0,0,1,214.6,178Z"/></svg>';

export const EDITORIAL_TEMPLATE_FLOWER_DATA_URL = `data:image/svg+xml,${encodeURIComponent(
  EDITORIAL_TEMPLATE_FLOWER_MARKUP,
)}`;

const SUPPORTED_DOCUMENT_DECORATION_MIME_TYPES: DocumentDecorationMimeType[] = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function roundedIntegerMm(value: number): number {
  return Math.round(value);
}

function clampNumber(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function inferMimeTypeFromDataUrl(value: string | undefined): DocumentDecorationMimeType | null {
  if (!value) return null;
  const match = /^data:([^;,]+)[;,]/i.exec(value.trim());
  if (!match) return null;
  const mimeType = match[1]?.toLowerCase();
  return isSupportedDocumentDecorationMimeType(mimeType) ? mimeType : null;
}

export function isSupportedDocumentDecorationMimeType(
  value: unknown,
): value is DocumentDecorationMimeType {
  return (
    typeof value === "string" &&
    SUPPORTED_DOCUMENT_DECORATION_MIME_TYPES.includes(
      value.toLowerCase() as DocumentDecorationMimeType,
    )
  );
}

export function resolveDocumentDecorationMimeType(
  file: Pick<File, "name" | "type">,
): DocumentDecorationMimeType | null {
  if (isSupportedDocumentDecorationMimeType(file.type)) {
    return file.type.toLowerCase() as DocumentDecorationMimeType;
  }
  const normalizedName = file.name.toLowerCase();
  if (normalizedName.endsWith(".png")) return "image/png";
  if (normalizedName.endsWith(".jpg") || normalizedName.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (normalizedName.endsWith(".svg")) return "image/svg+xml";
  return null;
}

export function clampDocumentDecorationSizeMm(value: number): number {
  return roundedIntegerMm(
    clampNumber(
      value,
      DOCUMENT_DECORATION_MIN_CUSTOM_SIZE_MM,
      DOCUMENT_DECORATION_MAX_CUSTOM_SIZE_MM,
    ),
  );
}

export function getDocumentDecorationRenderedSizeMm(
  decoration: Pick<DocumentDecoration, "sizePreset" | "customSizeMm">,
): number {
  if (decoration.sizePreset === "custom") {
    return clampDocumentDecorationSizeMm(
      finiteNumber(decoration.customSizeMm) ?? DOCUMENT_DECORATION_DEFAULT_SIZE_MM,
    );
  }
  return decoration.sizePreset;
}

export function createDefaultDocumentDecoration(): DocumentDecoration {
  return {
    visible: false,
    source: "upload",
    sizePreset: DOCUMENT_DECORATION_DEFAULT_SIZE_MM,
    fit: "contain",
    placementMode: "default",
    xMm: DEFAULT_DOCUMENT_DECORATION_PLACEMENT.xMm,
    yMm: DEFAULT_DOCUMENT_DECORATION_PLACEMENT.yMm,
  };
}

export function isEditorialTemplateFlowerDecoration(
  input: Pick<DocumentDecoration, "fileName"> | null | undefined,
): boolean {
  return input?.fileName === EDITORIAL_TEMPLATE_FLOWER_FILE_NAME;
}

export function createEditorialTemplateFlowerDecoration(
  base?: DocumentDecoration | null,
): DocumentDecoration {
  return clampDocumentDecorationPlacement(
    {
      ...(base ?? createDefaultDocumentDecoration()),
      visible: true,
      source: "upload",
      dataUrl: EDITORIAL_TEMPLATE_FLOWER_DATA_URL,
      fileName: EDITORIAL_TEMPLATE_FLOWER_FILE_NAME,
      mimeType: "image/svg+xml",
      alt: "Template flower mark",
      sizePreset: 18,
      customSizeMm: undefined,
      fit: "contain",
      placementMode: "default",
      xMm: EDITORIAL_TEMPLATE_FLOWER_DECORATION_PLACEMENT.xMm,
      yMm: EDITORIAL_TEMPLATE_FLOWER_DECORATION_PLACEMENT.yMm,
    },
    DEFAULT_DOCUMENT_DECORATION_PAGE_SIZE_MM,
    { preservePlacementMode: true },
  );
}

export function resolveTemplateDocumentDecoration(
  input: unknown,
  templateId: string | null | undefined,
): DocumentDecoration {
  const normalized = normalizeDocumentDecoration(input);
  const hasAsset = Boolean(normalized.dataUrl || normalized.assetId);
  const isEditorialTemplate = templateId === "editorial_wide";

  if (!isEditorialTemplate) {
    return isEditorialTemplateFlowerDecoration(normalized)
      ? createDefaultDocumentDecoration()
      : normalized;
  }

  return hasAsset ? normalized : createEditorialTemplateFlowerDecoration(normalized);
}

export function normalizeDocumentDecoration(input: unknown): DocumentDecoration {
  const source = isRecord(input) ? input : {};
  if (
    typeof source.fileName === "string" &&
    source.fileName.trim() === "Editorial template logo.svg"
  ) {
    return createDefaultDocumentDecoration();
  }
  const rawDataUrl = typeof source.dataUrl === "string" ? source.dataUrl.trim() : undefined;
  const inferredMimeType = inferMimeTypeFromDataUrl(rawDataUrl);
  const mimeType = isSupportedDocumentDecorationMimeType(source.mimeType)
    ? (source.mimeType.toLowerCase() as DocumentDecorationMimeType)
    : inferredMimeType ?? undefined;
  const sizePreset: DocumentDecorationSizePreset =
    source.sizePreset === 18 ||
    source.sizePreset === 35 ||
    source.sizePreset === 52 ||
    source.sizePreset === "custom"
      ? source.sizePreset
      : DOCUMENT_DECORATION_DEFAULT_SIZE_MM;
  const normalized: DocumentDecoration = {
    visible: typeof source.visible === "boolean" ? source.visible : false,
    source: "upload",
    sizePreset,
    fit: source.fit === "cover" ? "cover" : "contain",
    placementMode: source.placementMode === "custom" ? "custom" : "default",
    xMm:
      finiteNumber(source.xMm) !== null
        ? roundedIntegerMm(finiteNumber(source.xMm) as number)
        : DEFAULT_DOCUMENT_DECORATION_PLACEMENT.xMm,
    yMm:
      finiteNumber(source.yMm) !== null
        ? roundedIntegerMm(finiteNumber(source.yMm) as number)
        : DEFAULT_DOCUMENT_DECORATION_PLACEMENT.yMm,
  };

  if (typeof source.assetId === "string" && source.assetId.trim()) {
    normalized.assetId = source.assetId.trim();
  }
  if (rawDataUrl && inferredMimeType) {
    normalized.dataUrl = rawDataUrl;
  }
  if (typeof source.fileName === "string" && source.fileName.trim()) {
    normalized.fileName = source.fileName.trim().slice(0, 160);
  }
  if (mimeType) {
    normalized.mimeType = mimeType;
  }
  if (typeof source.alt === "string" && source.alt.trim()) {
    normalized.alt = source.alt.trim().slice(0, 160);
  }
  if (sizePreset === "custom") {
    normalized.customSizeMm = clampDocumentDecorationSizeMm(
      finiteNumber(source.customSizeMm) ?? DOCUMENT_DECORATION_DEFAULT_SIZE_MM,
    );
  }

  return clampDocumentDecorationPlacement(normalized, DEFAULT_DOCUMENT_DECORATION_PAGE_SIZE_MM, {
    preservePlacementMode: true,
  });
}

export function shouldPersistDocumentDecoration(
  decoration: DocumentDecoration | null | undefined,
): boolean {
  if (!decoration) return false;
  return Boolean(decoration.dataUrl || decoration.assetId);
}

export function getRenderableDocumentDecoration(
  input: DocumentDecoration | null | undefined,
): DocumentDecoration | null {
  if (!input) return null;
  const decoration = normalizeDocumentDecoration(input);
  if (!decoration.visible || !decoration.dataUrl) return null;
  if (!inferMimeTypeFromDataUrl(decoration.dataUrl) && !decoration.mimeType) return null;
  return decoration;
}

export function clampDocumentDecorationPlacement(
  decoration: DocumentDecoration,
  pageSize: DocumentDecorationPageSizeMm = DEFAULT_DOCUMENT_DECORATION_PAGE_SIZE_MM,
  options: { preservePlacementMode?: boolean } = {},
): DocumentDecoration {
  const sizeMm = Math.min(
    getDocumentDecorationRenderedSizeMm(decoration),
    pageSize.pageWidthMm,
    pageSize.pageHeightMm,
  );
  const maxXMm = Math.max(0, pageSize.pageWidthMm - sizeMm);
  const maxYMm = Math.max(0, pageSize.pageHeightMm - sizeMm);
  const nextXMm = clampNumber(
    roundedIntegerMm(
      finiteNumber(decoration.xMm) ?? DEFAULT_DOCUMENT_DECORATION_PLACEMENT.xMm,
    ),
    0,
    maxXMm,
  );
  const nextYMm = clampNumber(
    roundedIntegerMm(
      finiteNumber(decoration.yMm) ?? DEFAULT_DOCUMENT_DECORATION_PLACEMENT.yMm,
    ),
    0,
    maxYMm,
  );

  return {
    ...decoration,
    placementMode: options.preservePlacementMode ? decoration.placementMode : "custom",
    xMm: nextXMm,
    yMm: nextYMm,
  };
}

export function getDocumentDecorationPlacementMm(
  decoration: DocumentDecoration,
  pageSize: DocumentDecorationPageSizeMm = DEFAULT_DOCUMENT_DECORATION_PAGE_SIZE_MM,
): { xMm: number; yMm: number; sizeMm: number } {
  const clamped = clampDocumentDecorationPlacement(decoration, pageSize, {
    preservePlacementMode: true,
  });
  return {
    xMm: clamped.xMm ?? DEFAULT_DOCUMENT_DECORATION_PLACEMENT.xMm,
    yMm: clamped.yMm ?? DEFAULT_DOCUMENT_DECORATION_PLACEMENT.yMm,
    sizeMm: getDocumentDecorationRenderedSizeMm(clamped),
  };
}

export function applyDocumentDecorationSizePreset(
  decoration: DocumentDecoration,
  sizePreset: Exclude<DocumentDecorationSizePreset, "custom">,
): DocumentDecoration {
  const { customSizeMm: _customSizeMm, ...rest } = decoration;
  return clampDocumentDecorationPlacement(
    {
      ...rest,
      sizePreset,
    },
    DEFAULT_DOCUMENT_DECORATION_PAGE_SIZE_MM,
    { preservePlacementMode: true },
  );
}

export function getDefaultDocumentDecorationPlacementForTemplate(
  templateId: string | null | undefined,
): typeof DEFAULT_DOCUMENT_DECORATION_PLACEMENT {
  if (templateId === "editorial_wide") {
    return EDITORIAL_TEMPLATE_FLOWER_DECORATION_PLACEMENT;
  }
  return DEFAULT_DOCUMENT_DECORATION_PLACEMENT;
}

export function resetDocumentDecorationPlacement(
  decoration: DocumentDecoration,
  templateId?: string | null,
): DocumentDecoration {
  const placement = getDefaultDocumentDecorationPlacementForTemplate(templateId);
  return clampDocumentDecorationPlacement(
    {
      ...decoration,
      placementMode: "default",
      xMm: placement.xMm,
      yMm: placement.yMm,
    },
    DEFAULT_DOCUMENT_DECORATION_PAGE_SIZE_MM,
    { preservePlacementMode: true },
  );
}

export function removeDocumentDecorationAsset(
  decoration: DocumentDecoration,
): DocumentDecoration {
  const {
    assetId: _assetId,
    dataUrl: _dataUrl,
    fileName: _fileName,
    mimeType: _mimeType,
    alt: _alt,
    ...rest
  } = decoration;
  return {
    ...rest,
    assetId: undefined,
    dataUrl: undefined,
    fileName: undefined,
    mimeType: undefined,
    alt: undefined,
    visible: false,
  };
}

export function moveDocumentDecorationByDeltaMm(
  decoration: DocumentDecoration,
  args: DocumentDecorationPageSizeMm & { deltaXMm: number; deltaYMm: number },
): DocumentDecoration {
  const current = getDocumentDecorationPlacementMm(decoration, args);
  return clampDocumentDecorationPlacement(
    {
      ...decoration,
      placementMode: "custom",
      xMm: roundedIntegerMm(current.xMm + args.deltaXMm),
      yMm: roundedIntegerMm(current.yMm + args.deltaYMm),
    },
    args,
  );
}

export function resizeDocumentDecorationByDeltaMm(
  decoration: DocumentDecoration,
  args: DocumentDecorationPageSizeMm & { deltaXMm: number; deltaYMm: number },
): DocumentDecoration {
  const current = getDocumentDecorationPlacementMm(decoration, args);
  const dominantDelta =
    Math.abs(args.deltaXMm) >= Math.abs(args.deltaYMm) ? args.deltaXMm : args.deltaYMm;
  const maxSizeByPage = Math.min(
    DOCUMENT_DECORATION_MAX_CUSTOM_SIZE_MM,
    Math.max(DOCUMENT_DECORATION_MIN_CUSTOM_SIZE_MM, args.pageWidthMm - current.xMm),
    Math.max(DOCUMENT_DECORATION_MIN_CUSTOM_SIZE_MM, args.pageHeightMm - current.yMm),
  );
  const nextSizeMm = roundedIntegerMm(
    clampNumber(
      current.sizeMm + dominantDelta,
      DOCUMENT_DECORATION_MIN_CUSTOM_SIZE_MM,
      maxSizeByPage,
    ),
  );

  return clampDocumentDecorationPlacement(
    {
      ...decoration,
      placementMode: "custom",
      xMm: current.xMm,
      yMm: current.yMm,
      sizePreset: "custom",
      customSizeMm: nextSizeMm,
    },
    args,
  );
}

export function sanitizeSvgDecorationMarkup(markup: string): string | null {
  const normalized = markup.trim();
  if (!/^<svg[\s>]/i.test(normalized)) return null;
  if (/<\/?(script|foreignObject|iframe|object|embed)\b/i.test(normalized)) return null;
  if (/<\/?(animate|animateMotion|animateTransform|set)\b/i.test(normalized)) return null;
  if (/\son[a-z]+\s*=/i.test(normalized)) return null;
  if (/javascript:/i.test(normalized)) return null;
  if (/\b(?:href|xlink:href)\s*=\s*(['"])(?!#)[^'"]+\1/i.test(normalized)) {
    return null;
  }
  if (/\bhttps?:\/\//i.test(normalized)) return null;
  return normalized;
}

export function buildSvgDecorationDataUrl(markup: string): string | null {
  const sanitized = sanitizeSvgDecorationMarkup(markup);
  if (!sanitized) return null;
  return `data:image/svg+xml,${encodeURIComponent(sanitized)}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read image file."));
    };
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read SVG file."));
    };
    reader.onerror = () => reject(new Error("Could not read SVG file."));
    reader.readAsText(file);
  });
}

export async function readDocumentDecorationUpload(file: File): Promise<DocumentDecoration> {
  if (file.size > DOCUMENT_DECORATION_MAX_FILE_BYTES) {
    throw new Error("Decoration image must be 2 MB or smaller.");
  }
  const mimeType = resolveDocumentDecorationMimeType(file);
  if (!mimeType) {
    throw new Error("Use a PNG, JPG, or SVG image.");
  }
  const fileName = file.name.slice(0, 160);
  if (mimeType === "image/svg+xml") {
    const dataUrl = buildSvgDecorationDataUrl(await readFileAsText(file));
    if (!dataUrl) {
      throw new Error("SVG decorations cannot include scripts or external assets.");
    }
    return {
      ...createDefaultDocumentDecoration(),
      visible: true,
      dataUrl,
      fileName,
      mimeType,
      alt: fileName.replace(/\.[^.]+$/, "") || "Document decoration",
    };
  }

  const dataUrl = await readFileAsDataUrl(file);
  if (inferMimeTypeFromDataUrl(dataUrl) !== mimeType) {
    throw new Error("The uploaded image type does not match the selected file.");
  }
  return {
    ...createDefaultDocumentDecoration(),
    visible: true,
    dataUrl,
    fileName,
    mimeType,
    alt: fileName.replace(/\.[^.]+$/, "") || "Document decoration",
  };
}
