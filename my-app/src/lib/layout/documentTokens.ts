export const A4_PAGE_WIDTH_MM = 210;
export const A4_PAGE_HEIGHT_MM = 297;
export const BASE_PROPOSAL_TITLE_SCALE_MM = 7.0;

const MM_TO_PT = 72 / 25.4;
const PT_TO_MM = 25.4 / 72;
const PT_TO_TWIP = 20;

export type CanonicalTextRoleToken = {
  sizePt?: number;
  lineHeight?: number;
  resolvedTrackingEm?: number;
};

export type CanonicalDocumentTokens = {
  geometry: {
    page: {
      widthMm: number;
      heightMm: number;
      radiusMm?: number;
      margin: {
        topMm: number;
        rightMm: number;
        bottomMm: number;
        leftMm: number;
      };
      liveArea?: {
        widthMm: number;
        heightMm: number;
      };
    };
    columns?: {
      sidebarMm: number;
      gutterMm: number;
      mainMm: number;
    };
    template?: {
      leftZoneMm?: number;
      topOffsetMm?: number;
      bodyStartMm?: number;
      rightMarginMm?: number;
      bottomMarginMm?: number;
    };
    primitives?: {
      robialStep?: {
        stepAMm?: number;
        stepBMm?: number;
        halfStepMm?: number;
      };
      volkGrid?: Record<string, number>;
    };
  };
  flow: {
    type: {
      display: CanonicalTextRoleToken;
      title: CanonicalTextRoleToken;
      subtitle: CanonicalTextRoleToken;
      summary: CanonicalTextRoleToken;
      body: CanonicalTextRoleToken;
      bodySm: CanonicalTextRoleToken;
      label: CanonicalTextRoleToken;
      meta: CanonicalTextRoleToken;
    };
    measure: {
      summaryWidthMm?: number;
      resumeReadingWidthMm?: number;
      proposalReadingWidthCh?: number;
      resumeEntryMetaWidthMm?: number;
      proposalMetaWidthMm?: number;
    };
    header: {
      titleMarginTopMm?: number;
      bottomPaddingMm?: number;
    };
    template: {
      titleScaleMultiplier?: number;
    };
    rhythm: {
      headerGapMm?: number;
      sectionGapMm?: number;
      stackGapMm?: number;
      entryGapMm?: number;
      entryHeadGapMm?: number;
      listGapMm?: number;
      sidebarPadTopMm?: number;
      rulePadTopMm?: number;
      closingGapMm?: number;
      closingNameGapMm?: number;
    };
    component: {
      sidebar?: {
        rightPaddingMm?: number;
        sectionGapMm?: number;
        titleMarginBottomMm?: number;
        titlePaddingBottomMm?: number;
        contentGapMm?: number;
      };
      main?: {
        leftPaddingMm?: number;
        sectionGapMm?: number;
        headingGapMm?: number;
        headingMarginBottomMm?: number;
        sectionTitleReductionMm?: number;
      };
      experience?: {
        dateColumnWidthMm?: number;
        columnGapMm?: number;
        itemGapMm?: number;
        orgMarginBottomMm?: number;
        bulletsPaddingLeftMm?: number;
        bulletsGapMm?: number;
        headingSizeAdjustMm?: number;
        headingLineHeight?: number;
      };
      project?: {
        gapMm?: number;
        paddingMm?: number;
      };
      education?: {
        itemGapMm?: number;
      };
      skill?: {
        gapMm?: number;
        padInlineMm?: number;
        padBlockMm?: number;
      };
      tag?: {
        gapMm?: number;
        rowGapMm?: number;
        padInlineMm?: number;
        padBlockMm?: number;
      };
    };
    pagination: {
      bottomFitSafetyMm?: number;
      [key: string]: number | string | boolean | undefined;
    };
    density: {
      displayAdjustPt?: number;
      titleAdjustPt?: number;
      bodyAdjustPt?: number;
      bodySmAdjustPt?: number;
      sectionGapAdjustMm?: number;
      headingMarginAdjustMm?: number;
      bulletGapAdjustMm?: number;
      projectGapAdjustMm?: number;
      projectPaddingAdjustMm?: number;
    };
  };
  appearance: {
    font: {
      heading: {
        family?: string;
        weight?: number;
      };
      body: {
        family?: string;
        weight?: number;
      };
      editorial: {
        family?: string;
      };
      authoredTrackingEm?: number;
      kerning?: string;
      ligatures?: string;
      featureSettings?: string;
    };
    theme: {
      canvas?: string;
      surface?: string;
      surfaceMuted?: string;
      surfaceRaised?: string;
      paper?: string;
      accent?: string;
      ink?: string;
      mutedInk?: string;
      textSubtle?: string;
      border?: string;
      borderStrong?: string;
      borderContrast?: string;
      line?: string;
      headerRule?: string;
      ruleStrong?: string;
      sidebarFill?: string;
      tagFill?: string;
      onAccent?: string;
      proposalDocumentInk?: string;
      proposalDocumentMetaInk?: string;
      proposalDocumentAccentInk?: string;
      proposalJoellaMarkColor?: string;
      proposalJoellaStructureColor?: string;
    };
    decor: {
      preview?: {
        accentHover?: string;
        accentPressed?: string;
        accentSoft?: string;
        accentMuted?: string;
        interactionRing?: string;
        interactionFill?: string;
        interactionShadow?: string;
      };
      export?: {
        pageBackground?: string;
        headerBackground?: string;
        headerBorderColor?: string;
        headerBorderWidth?: string;
        headerShadow?: string;
        headerAuxShadow?: string;
        sidebarBackground?: string;
        sidebarRuleWidth?: string;
        sidebarShadow?: string;
        sectionRuleBorderColor?: string;
        sectionRuleWidth?: string;
        sectionRuleShadow?: string;
        sectionTitleColor?: string;
        metaLabelColor?: string;
        tagBorderColor?: string;
        tagBorderWidth?: string;
        tagBackground?: string;
        tagShadow?: string;
        tagBorderRadius?: string;
        sectionTitleFontFamily?: string;
        metaLabelFontFamily?: string;
        docNameColor?: string;
        docNameFontWeight?: string;
        docNameLetterSpacing?: string;
        docTitleColor?: string;
        docTitleFontStyle?: string;
        docSummaryColor?: string;
        entryTitleColor?: string;
        entryTitleFontFamily?: string;
        entryTitleFontWeight?: string;
        entryMetaColor?: string;
        entryMetaFontStyle?: string;
        supportTextPrimaryColor?: string;
        supportTextSecondaryColor?: string;
        supportAccentColor?: string;
        supportRuleColor?: string;
        sectionTitleFontWeight?: string;
        sectionTitleTextTransform?: string;
        sectionTitleLetterSpacing?: string;
        metaLabelTextTransform?: string;
        metaLabelLetterSpacing?: string;
        proposalTitleColor?: string;
        proposalTitleFontWeight?: string;
        proposalTitleLetterSpacing?: string;
        proposalTitleFontStyle?: string;
        proposalMetaColor?: string;
        proposalMetaFontStyle?: string;
        metaValueColor?: string;
        subjectBackground?: string;
        subjectShadow?: string;
        signoffColor?: string;
        signoffFontStyle?: string;
        signatureColor?: string;
        signatureFontWeight?: string;
        signatureTextTransform?: string;
        signatureLetterSpacing?: string;
        signatureFontVariantCaps?: string;
      };
    };
  };
  runtime: {
    previewFit: Record<string, string | number>;
    derived: Record<string, string | number>;
    rendererCompensation: Record<string, string | number>;
  };
};

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function mmToPt(valueMm: number): number {
  return round(valueMm * MM_TO_PT, 3);
}

export function ptToMm(valuePt: number): number {
  return round(valuePt * PT_TO_MM, 3);
}

export function ptToHalfPoint(valuePt: number): number {
  return Math.round(valuePt * 2);
}

export function ptLineHeightToTwip(
  sizePt: number | undefined,
  lineHeight: number | undefined,
): number {
  const resolvedSizePt = sizePt ?? 0;
  const resolvedLineHeight = lineHeight ?? 1;
  return Math.round(resolvedSizePt * resolvedLineHeight * PT_TO_TWIP);
}

export function mmToTwip(valueMm: number): number {
  return Math.round(mmToPt(valueMm) * PT_TO_TWIP);
}

export function formatMm(
  valueMm: number | undefined,
  precision = 2,
): string | undefined {
  if (valueMm === undefined || !Number.isFinite(valueMm)) {
    return undefined;
  }

  return `${round(valueMm, precision)
    .toString()
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1")}mm`;
}

export function formatPt(
  valuePt: number | undefined,
  precision = 2,
): string | undefined {
  if (valuePt === undefined || !Number.isFinite(valuePt)) {
    return undefined;
  }

  return `${round(valuePt, precision)
    .toString()
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1")}pt`;
}

export function formatUnitless(
  value: number | undefined,
  precision = 3,
): string | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return round(value, precision)
    .toString()
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

export function formatEm(
  value: number | undefined,
  precision = 4,
): string | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return `${round(value, precision)
    .toString()
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1")}em`;
}

export function parseMm(
  value: string | number | null | undefined,
): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)mm$/i);
  return match ? Number.parseFloat(match[1]) : undefined;
}

export function parsePt(
  value: string | number | null | undefined,
): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)pt$/i);
  return match ? Number.parseFloat(match[1]) : undefined;
}

export function parseUnitless(
  value: string | number | null | undefined,
): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(normalized)) {
    return undefined;
  }

  return Number.parseFloat(normalized);
}

export function parseEm(value: string | null | undefined): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)em$/i);
  return match ? Number.parseFloat(match[1]) : undefined;
}

export function parsePercent(
  value: string | null | undefined,
): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)%$/);
  return match ? Number.parseFloat(match[1]) : undefined;
}

export function createEmptyCanonicalTokens(): CanonicalDocumentTokens {
  return {
    geometry: {
      page: {
        widthMm: A4_PAGE_WIDTH_MM,
        heightMm: A4_PAGE_HEIGHT_MM,
        margin: {
          topMm: 0,
          rightMm: 0,
          bottomMm: 0,
          leftMm: 0,
        },
      },
    },
    flow: {
      type: {
        display: {},
        title: {},
        subtitle: {},
        summary: {},
        body: {},
        bodySm: {},
        label: {},
        meta: {},
      },
      measure: {},
      header: {},
      template: {},
      rhythm: {},
      component: {},
      pagination: {},
      density: {},
    },
    appearance: {
      font: {
        heading: {},
        body: {},
        editorial: {},
      },
      theme: {},
      decor: {},
    },
    runtime: {
      previewFit: {},
      derived: {},
      rendererCompensation: {},
    },
  };
}

export function stripRuntimeTokens(
  tokens: CanonicalDocumentTokens,
): Omit<CanonicalDocumentTokens, "runtime"> {
  const { runtime: _runtime, ...rest } = tokens;
  return rest;
}
