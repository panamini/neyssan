import type { ResumeLayoutVariantId } from "../features/verbati/resume/resume.types";
import { buildVerbatiThemeVars, resolveVerbatiStyle } from "../features/verbati/style";
import type { VerbatiStylePreset } from "../features/verbati/types";

export type ResumeFontDebugSnapshot = {
  layout: VerbatiStylePreset["layout"];
  typography: VerbatiStylePreset["typography"];
  palette: VerbatiStylePreset["palette"];
  accentHex?: string;
  rendererVariantId: ResumeLayoutVariantId;
  headingFontFamily: string;
  bodyFontFamily: string;
  editorialFontFamily: string;
  headingFontFamilyComputed: string;
  bodyFontFamilyComputed: string;
  inheritedBodyFontFamilyComputed: string;
  surfaceFontFamilyComputed: string;
  fontHeadingCssVar: string;
  fontBodyCssVar: string;
  fontEditorialCssVar: string;
  documentFontsStatus: string;
  headingFontCheck: boolean | null;
  bodyFontCheck: boolean | null;
  inheritedBodyFontCheck: boolean | null;
  loadedFontFamilies: string[];
  headingPrimaryFamilyLikely: boolean | null;
  bodyPrimaryFamilyLikely: boolean | null;
  headingMeasurementSample: string;
  bodyMeasurementSample: string;
  headingComputedTextWidth: number | null;
  headingPrimaryTextWidth: number | null;
  headingFallbackTextWidth: number | null;
  bodyComputedTextWidth: number | null;
  bodyPrimaryTextWidth: number | null;
  bodyFallbackTextWidth: number | null;
  localFontFaceStylePresent: boolean;
  localFontFaceCssLength: number;
  localFontFaceCssIncludesHeadingPrimaryFamily: boolean;
  localFontFaceCssIncludesBodyPrimaryFamily: boolean;
};

type CollectResumeFontDebugSnapshotArgs = {
  stylePreset: VerbatiStylePreset;
  rendererVariantId: ResumeLayoutVariantId;
  root?: ParentNode | null;
};

function readTrimmedProperty(
  styles: CSSStyleDeclaration,
  property: string,
): string {
  return String(styles.getPropertyValue(property) ?? "").trim();
}

function checkDocumentFontFamily(fontFamily: string): boolean | null {
  const trimmed = fontFamily.trim();
  if (!trimmed || typeof document === "undefined") {
    return null;
  }

  try {
    return typeof document.fonts?.check === "function"
      ? document.fonts.check(`16px ${trimmed}`)
      : null;
  } catch {
    return null;
  }
}

function readLoadedFontFamilies(): string[] {
  if (typeof document === "undefined" || !document.fonts) {
    return [];
  }

  try {
    const families = Array.from(document.fonts, (face) =>
      String(face.family ?? "").replace(/^['"]|['"]$/g, "").trim(),
    ).filter(Boolean);

    return Array.from(new Set(families)).sort((left, right) =>
      left.localeCompare(right),
    );
  } catch {
    return [];
  }
}

function readFallbackFontFamily(fontFamily: string): string {
  const parts = fontFamily
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.slice(1).join(", ");
}

function readResolvedFontShorthand(
  styles: CSSStyleDeclaration | null,
  fontFamily: string,
): string {
  const fontSize = styles?.fontSize?.trim() || "16px";
  const fontStyle = styles?.fontStyle?.trim() || "normal";
  const fontVariant = styles?.fontVariant?.trim() || "normal";
  const fontWeight = styles?.fontWeight?.trim() || "400";
  const fontStretch = styles?.fontStretch?.trim() || "normal";
  const lineHeight = styles?.lineHeight?.trim() || "normal";

  return `${fontStyle} ${fontVariant} ${fontWeight} ${fontStretch} ${fontSize}/${lineHeight} ${fontFamily}`.trim();
}

function measureTextWidth(
  font: string,
  sample: string,
): number | null {
  if (typeof document === "undefined") {
    return null;
  }

  let context: CanvasRenderingContext2D | null = null;

  try {
    const canvas = document.createElement("canvas");
    context = canvas.getContext("2d");
  } catch {
    return null;
  }

  if (!context) {
    return null;
  }

  context.font = font;
  return Math.round(context.measureText(sample).width * 1000) / 1000;
}

function inferPrimaryFamilyUsage(args: {
  computedWidth: number | null;
  primaryWidth: number | null;
  fallbackWidth: number | null;
}): boolean | null {
  const { computedWidth, primaryWidth, fallbackWidth } = args;
  if (
    computedWidth === null ||
    primaryWidth === null ||
    fallbackWidth === null
  ) {
    return null;
  }

  const primaryDelta = Math.abs(computedWidth - primaryWidth);
  const fallbackDelta = Math.abs(computedWidth - fallbackWidth);
  const separation = Math.abs(primaryWidth - fallbackWidth);

  if (separation < 0.25) {
    return null;
  }

  return primaryDelta <= fallbackDelta;
}

function readLocalFontFaceStyleState(args: {
  headingFontFamily: string;
  bodyFontFamily: string;
}): Pick<
  ResumeFontDebugSnapshot,
  | "localFontFaceStylePresent"
  | "localFontFaceCssLength"
  | "localFontFaceCssIncludesHeadingPrimaryFamily"
  | "localFontFaceCssIncludesBodyPrimaryFamily"
> {
  if (typeof document === "undefined") {
    return {
      localFontFaceStylePresent: false,
      localFontFaceCssLength: 0,
      localFontFaceCssIncludesHeadingPrimaryFamily: false,
      localFontFaceCssIncludesBodyPrimaryFamily: false,
    };
  }

  const styleTag = document.getElementById("dasti-local-font-faces");
  const cssText = String(styleTag?.textContent ?? "");
  const headingPrimaryFamily = readPrimaryFontFamilyToken(args.headingFontFamily);
  const bodyPrimaryFamily = readPrimaryFontFamilyToken(args.bodyFontFamily);

  return {
    localFontFaceStylePresent: Boolean(styleTag),
    localFontFaceCssLength: cssText.length,
    localFontFaceCssIncludesHeadingPrimaryFamily: headingPrimaryFamily
      ? cssText.includes(headingPrimaryFamily)
      : false,
    localFontFaceCssIncludesBodyPrimaryFamily: bodyPrimaryFamily
      ? cssText.includes(bodyPrimaryFamily)
      : false,
  };
}

export function buildResumeFontDebugSnapshot(args: {
  stylePreset: VerbatiStylePreset;
  rendererVariantId: ResumeLayoutVariantId;
}): ResumeFontDebugSnapshot {
  const stylePreset = resolveVerbatiStyle(args.stylePreset);
  const themeVars = buildVerbatiThemeVars(stylePreset) as Record<
    string,
    string | undefined
  >;
  const headingFontFamily = String(
    themeVars["--font-heading-family"] ?? "",
  ).trim();
  const bodyFontFamily = String(themeVars["--font-body-family"] ?? "").trim();
  const editorialFontFamily = String(
    themeVars["--font-editorial-family"] ?? "",
  ).trim();

  return {
    layout: stylePreset.layout,
    typography: stylePreset.typography,
    palette: stylePreset.palette,
    accentHex: stylePreset.accentHex,
    rendererVariantId: args.rendererVariantId,
    headingFontFamily,
    bodyFontFamily,
    editorialFontFamily,
    headingFontFamilyComputed: "",
    bodyFontFamilyComputed: "",
    inheritedBodyFontFamilyComputed: "",
    surfaceFontFamilyComputed: "",
    fontHeadingCssVar: headingFontFamily,
    fontBodyCssVar: bodyFontFamily,
    fontEditorialCssVar: editorialFontFamily,
    documentFontsStatus: typeof document === "undefined" ? "unknown" : document.fonts?.status ?? "unavailable",
    headingFontCheck: checkDocumentFontFamily(headingFontFamily),
    bodyFontCheck: checkDocumentFontFamily(bodyFontFamily),
    inheritedBodyFontCheck: null,
    loadedFontFamilies: readLoadedFontFamilies(),
    headingPrimaryFamilyLikely: null,
    bodyPrimaryFamilyLikely: null,
    headingMeasurementSample: "ROBERT COOPER SECURITY",
    bodyMeasurementSample:
      "Employee of the Month 2021 at SecureIt Ltd",
    headingComputedTextWidth: null,
    headingPrimaryTextWidth: null,
    headingFallbackTextWidth: null,
    bodyComputedTextWidth: null,
    bodyPrimaryTextWidth: null,
    bodyFallbackTextWidth: null,
    localFontFaceStylePresent: false,
    localFontFaceCssLength: 0,
    localFontFaceCssIncludesHeadingPrimaryFamily: false,
    localFontFaceCssIncludesBodyPrimaryFamily: false,
  };
}

export function collectResumeFontDebugSnapshot(
  args: CollectResumeFontDebugSnapshotArgs,
): ResumeFontDebugSnapshot {
  const snapshot = buildResumeFontDebugSnapshot({
    stylePreset: args.stylePreset,
    rendererVariantId: args.rendererVariantId,
  });
  const root = args.root ?? document;
  const surface =
    (root.querySelector?.(".resume-page") as HTMLElement | null) ??
    (root instanceof HTMLElement ? root : null);
  const headingProbe = root.querySelector?.(
    '[data-font-probe="heading"]',
  ) as HTMLElement | null;
  const bodyProbe = root.querySelector?.(
    '[data-font-probe="body"]',
  ) as HTMLElement | null;
  const inheritedBodyProbe = root.querySelector?.(
    '[data-font-probe="body-inherited"]',
  ) as HTMLElement | null;
  const headingStyles = headingProbe ? getComputedStyle(headingProbe) : null;
  const bodyStyles = bodyProbe ? getComputedStyle(bodyProbe) : null;

  if (surface) {
    const surfaceStyles = getComputedStyle(surface);
    snapshot.fontHeadingCssVar =
      readTrimmedProperty(surfaceStyles, "--font-heading-family") ||
      snapshot.headingFontFamily;
    snapshot.fontBodyCssVar =
      readTrimmedProperty(surfaceStyles, "--font-body-family") ||
      snapshot.bodyFontFamily;
    snapshot.fontEditorialCssVar =
      readTrimmedProperty(surfaceStyles, "--font-editorial-family") ||
      snapshot.editorialFontFamily;
    snapshot.surfaceFontFamilyComputed = surfaceStyles.fontFamily;
  }

  if (headingProbe) {
    snapshot.headingFontFamilyComputed = getComputedStyle(headingProbe).fontFamily;
  }

  if (bodyProbe) {
    snapshot.bodyFontFamilyComputed = getComputedStyle(bodyProbe).fontFamily;
  }

  if (inheritedBodyProbe) {
    snapshot.inheritedBodyFontFamilyComputed =
      getComputedStyle(inheritedBodyProbe).fontFamily;
  }

  if (!snapshot.inheritedBodyFontFamilyComputed && surface) {
    snapshot.inheritedBodyFontFamilyComputed =
      snapshot.surfaceFontFamilyComputed ||
      snapshot.bodyFontFamilyComputed ||
      snapshot.fontBodyCssVar;
  }

  snapshot.documentFontsStatus =
    typeof document === "undefined" ? "unknown" : document.fonts?.status ?? "unavailable";
  snapshot.loadedFontFamilies = readLoadedFontFamilies();
  Object.assign(
    snapshot,
    readLocalFontFaceStyleState({
      headingFontFamily: snapshot.fontHeadingCssVar,
      bodyFontFamily: snapshot.fontBodyCssVar,
    }),
  );
  snapshot.headingFontCheck =
    checkDocumentFontFamily(
      snapshot.headingFontFamilyComputed || snapshot.fontHeadingCssVar,
    ) ?? snapshot.headingFontCheck;
  snapshot.bodyFontCheck =
    checkDocumentFontFamily(
      snapshot.bodyFontFamilyComputed || snapshot.fontBodyCssVar,
    ) ?? snapshot.bodyFontCheck;
  snapshot.inheritedBodyFontCheck =
    checkDocumentFontFamily(
      snapshot.inheritedBodyFontFamilyComputed ||
      snapshot.surfaceFontFamilyComputed ||
        snapshot.fontBodyCssVar,
    ) ?? snapshot.inheritedBodyFontCheck;

  const headingPrimaryFamily = readPrimaryFontFamilyToken(
    snapshot.fontHeadingCssVar,
  );
  const headingFallbackFamily = readFallbackFontFamily(
    snapshot.fontHeadingCssVar,
  );
  const bodyPrimaryFamily = readPrimaryFontFamilyToken(snapshot.fontBodyCssVar);
  const bodyFallbackFamily = readFallbackFontFamily(snapshot.fontBodyCssVar);

  snapshot.headingComputedTextWidth = measureTextWidth(
    readResolvedFontShorthand(
      headingStyles,
      snapshot.headingFontFamilyComputed || snapshot.fontHeadingCssVar,
    ),
    snapshot.headingMeasurementSample,
  );
  snapshot.headingPrimaryTextWidth = headingPrimaryFamily
    ? measureTextWidth(
        readResolvedFontShorthand(headingStyles, `"${headingPrimaryFamily}"`),
        snapshot.headingMeasurementSample,
      )
    : null;
  snapshot.headingFallbackTextWidth = headingFallbackFamily
    ? measureTextWidth(
        readResolvedFontShorthand(headingStyles, headingFallbackFamily),
        snapshot.headingMeasurementSample,
      )
    : null;
  snapshot.bodyComputedTextWidth = measureTextWidth(
    readResolvedFontShorthand(
      bodyStyles,
      snapshot.bodyFontFamilyComputed || snapshot.fontBodyCssVar,
    ),
    snapshot.bodyMeasurementSample,
  );
  snapshot.bodyPrimaryTextWidth = bodyPrimaryFamily
    ? measureTextWidth(
        readResolvedFontShorthand(bodyStyles, `"${bodyPrimaryFamily}"`),
        snapshot.bodyMeasurementSample,
      )
    : null;
  snapshot.bodyFallbackTextWidth = bodyFallbackFamily
    ? measureTextWidth(
        readResolvedFontShorthand(bodyStyles, bodyFallbackFamily),
        snapshot.bodyMeasurementSample,
      )
    : null;
  snapshot.headingPrimaryFamilyLikely = inferPrimaryFamilyUsage({
    computedWidth: snapshot.headingComputedTextWidth,
    primaryWidth: snapshot.headingPrimaryTextWidth,
    fallbackWidth: snapshot.headingFallbackTextWidth,
  });
  snapshot.bodyPrimaryFamilyLikely = inferPrimaryFamilyUsage({
    computedWidth: snapshot.bodyComputedTextWidth,
    primaryWidth: snapshot.bodyPrimaryTextWidth,
    fallbackWidth: snapshot.bodyFallbackTextWidth,
  });

  return snapshot;
}

export function readPrimaryFontFamilyToken(fontFamily: string): string {
  const trimmed = fontFamily.trim();
  if (!trimmed) {
    return "";
  }

  const firstToken = trimmed.split(",")[0]?.trim() ?? "";
  return firstToken.replace(/^['"]|['"]$/g, "");
}
