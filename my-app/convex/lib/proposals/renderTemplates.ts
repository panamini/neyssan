export const PROPOSAL_ACTIVE_TEMPLATE_IDS = [
  "swiss_margin",
  "volk_register",
  "two_column_rail",
  "editorial_wide",
  "modernist_signal",
  "quire_margin",
  "workshop_proposal_margin",
  "director-letterhead",
  "volk-letterhead",
  "film-foto-letterhead",
  "moma-bauhaus-letterhead",
] as const;

export const PROPOSAL_LEGACY_TEMPLATE_IDS = [
  "editorial_left_rail",
  "quiet_margin",
] as const;

export const PROPOSAL_TEMPLATE_IDS = [
  ...PROPOSAL_ACTIVE_TEMPLATE_IDS,
  ...PROPOSAL_LEGACY_TEMPLATE_IDS,
] as const;

export type ProposalTemplateId = (typeof PROPOSAL_TEMPLATE_IDS)[number];
type LegacyProposalTemplateId = (typeof PROPOSAL_LEGACY_TEMPLATE_IDS)[number];
export type ProposalTemplateExportShell = "onecol" | "rail";

export const CANONICAL_PROPOSAL_TEMPLATE_ID = "workshop_proposal_margin";

export const DEFAULT_PROPOSAL_TEMPLATE_ID: ProposalTemplateId =
  CANONICAL_PROPOSAL_TEMPLATE_ID;

export const ROBIAL_PROPOSAL_GRID = {
  stepAMm: 17,
  stepBMm: 18,
  halfStepMm: 8.5,
  gutterMm: 18,
} as const;

export const CANONICAL_PROPOSAL_LAYOUT = {
  templateId: CANONICAL_PROPOSAL_TEMPLATE_ID,
  leftMarginMm: 35,
  topOffsetMm: 35,
  rightMarginMm: 18,
  bottomMarginMm: 18,
  bodyStartMm: 96,
  readingMeasureCh: 58,
  titleScaleMm: 7,
  exportShell: "onecol",
  grid: ROBIAL_PROPOSAL_GRID,
} as const;

const PROPOSAL_TEMPLATE_ALIASES: Partial<
  Record<
    (typeof PROPOSAL_LEGACY_TEMPLATE_IDS)[number],
    (typeof PROPOSAL_ACTIVE_TEMPLATE_IDS)[number]
  >
> = {
  editorial_left_rail: "editorial_wide",
  quiet_margin: "quire_margin",
};

export type ProposalTemplateDefinition = {
  id: (typeof PROPOSAL_ACTIVE_TEMPLATE_IDS)[number];
  name: string;
  shortLabel: string;
  description: string;
  twinLabel: string;
  exportShell: ProposalTemplateExportShell;
  leftMarginMm: number;
  leftZoneMm: number;
  gutterMm: number;
  topOffsetMm: number;
  bodyStartMm: number;
  bottomMarginMm: number;
  rightMarginMm: number;
  readingMeasureCh: number;
  titleScaleMm: number;
  gridStepAMm: number;
  gridStepBMm: number;
  gridHalfStepMm: number;
};

export const PROPOSAL_TEMPLATE_DEFINITIONS: readonly ProposalTemplateDefinition[] =
  [
    {
      id: "swiss_margin",
      name: "Swiss Margin",
      shortLabel: "35 mm register",
      description:
        "A disciplined proposal sheet with the Swiss twin's lean civic margin and a tighter reading line.",
      twinLabel: "Swiss Minima",
      exportShell: "rail",
      leftMarginMm: 17,
      leftZoneMm: 35,
      gutterMm: ROBIAL_PROPOSAL_GRID.gutterMm,
      topOffsetMm: 35,
      bodyStartMm: 94.5,
      bottomMarginMm: 18,
      rightMarginMm: 18,
      readingMeasureCh: 56,
      titleScaleMm: 6.6,
      gridStepAMm: ROBIAL_PROPOSAL_GRID.stepAMm,
      gridStepBMm: ROBIAL_PROPOSAL_GRID.stepBMm,
      gridHalfStepMm: ROBIAL_PROPOSAL_GRID.halfStepMm,
    },
    {
      id: "volk_register",
      name: "Volk Register",
      shortLabel: "register canon",
      description:
        "An archival civic-letter twin with a narrower register rail, slower vertical cadence, and stronger paper-field pause.",
      twinLabel: "Volk Register",
      exportShell: "rail",
      leftMarginMm: 17,
      leftZoneMm: 35,
      gutterMm: ROBIAL_PROPOSAL_GRID.gutterMm,
      topOffsetMm: 35,
      bodyStartMm: 99,
      bottomMarginMm: 18,
      rightMarginMm: 18,
      readingMeasureCh: 58,
      titleScaleMm: 7,
      gridStepAMm: ROBIAL_PROPOSAL_GRID.stepAMm,
      gridStepBMm: ROBIAL_PROPOSAL_GRID.stepBMm,
      gridHalfStepMm: ROBIAL_PROPOSAL_GRID.halfStepMm,
    },
    {
      id: "two_column_rail",
      name: "Two Column Rail",
      shortLabel: "52 mm rail",
      description:
        "A proposal twin for the split-rail resume layouts, with a wider left signal column and an open document body.",
      twinLabel: "Two Column",
      exportShell: "rail",
      leftMarginMm: 17,
      leftZoneMm: 52,
      gutterMm: ROBIAL_PROPOSAL_GRID.gutterMm,
      topOffsetMm: 35,
      bodyStartMm: 95.5,
      bottomMarginMm: 18,
      rightMarginMm: 18,
      readingMeasureCh: 60,
      titleScaleMm: 7.1,
      gridStepAMm: ROBIAL_PROPOSAL_GRID.stepAMm,
      gridStepBMm: ROBIAL_PROPOSAL_GRID.stepBMm,
      gridHalfStepMm: ROBIAL_PROPOSAL_GRID.halfStepMm,
    },
    {
      id: "editorial_wide",
      name: "Editorial Wide",
      shortLabel: "52 mm editorial",
      description:
        "A calmer editorial letter twin with a broader rail, a slower title cadence, and the longest measure in the set.",
      twinLabel: "Editorial Wide",
      exportShell: "rail",
      leftMarginMm: 17,
      leftZoneMm: 52,
      gutterMm: ROBIAL_PROPOSAL_GRID.gutterMm,
      topOffsetMm: 35,
      bodyStartMm: 97,
      bottomMarginMm: 18,
      rightMarginMm: 18,
      readingMeasureCh: 64,
      titleScaleMm: 7.8,
      gridStepAMm: ROBIAL_PROPOSAL_GRID.stepAMm,
      gridStepBMm: ROBIAL_PROPOSAL_GRID.stepBMm,
      gridHalfStepMm: ROBIAL_PROPOSAL_GRID.halfStepMm,
    },
    {
      id: "modernist_signal",
      name: "Modernist Signal",
      shortLabel: "35 mm signal",
      description:
        "A stricter grid twin with a narrower measure, earlier body drop, and less ornamental rail treatment.",
      twinLabel: "Modernist Grid",
      exportShell: "rail",
      leftMarginMm: 17,
      leftZoneMm: 35,
      gutterMm: ROBIAL_PROPOSAL_GRID.gutterMm,
      topOffsetMm: 35,
      bodyStartMm: 93.5,
      bottomMarginMm: 18,
      rightMarginMm: 18,
      readingMeasureCh: 54,
      titleScaleMm: 6.4,
      gridStepAMm: ROBIAL_PROPOSAL_GRID.stepAMm,
      gridStepBMm: ROBIAL_PROPOSAL_GRID.stepBMm,
      gridHalfStepMm: ROBIAL_PROPOSAL_GRID.halfStepMm,
    },
    {
      id: "quire_margin",
      name: "Quire Margin",
      shortLabel: "35 mm quire",
      description:
        "A bookish twin with a quieter upper field, a later body entry, and the most literary title position.",
      twinLabel: "Quire",
      exportShell: "onecol",
      leftMarginMm: 17,
      leftZoneMm: 35,
      gutterMm: ROBIAL_PROPOSAL_GRID.gutterMm,
      topOffsetMm: 52,
      bodyStartMm: 98.5,
      bottomMarginMm: 18,
      rightMarginMm: 18,
      readingMeasureCh: 58,
      titleScaleMm: 7,
      gridStepAMm: ROBIAL_PROPOSAL_GRID.stepAMm,
      gridStepBMm: ROBIAL_PROPOSAL_GRID.stepBMm,
      gridHalfStepMm: ROBIAL_PROPOSAL_GRID.halfStepMm,
    },
    {
      id: CANONICAL_PROPOSAL_TEMPLATE_ID,
      name: "Workshop",
      shortLabel: "35 mm Robial",
      description:
        "A generic workshop proposal sheet on the Robial 17/18 grid with a 35 mm left margin and a content-first body cadence.",
      twinLabel: "Workshop ATS",
      exportShell: CANONICAL_PROPOSAL_LAYOUT.exportShell,
      leftMarginMm: CANONICAL_PROPOSAL_LAYOUT.leftMarginMm,
      leftZoneMm: 35,
      gutterMm: CANONICAL_PROPOSAL_LAYOUT.grid.gutterMm,
      topOffsetMm: CANONICAL_PROPOSAL_LAYOUT.topOffsetMm,
      bodyStartMm: CANONICAL_PROPOSAL_LAYOUT.bodyStartMm,
      bottomMarginMm: CANONICAL_PROPOSAL_LAYOUT.bottomMarginMm,
      rightMarginMm: CANONICAL_PROPOSAL_LAYOUT.rightMarginMm,
      readingMeasureCh: CANONICAL_PROPOSAL_LAYOUT.readingMeasureCh,
      titleScaleMm: CANONICAL_PROPOSAL_LAYOUT.titleScaleMm,
      gridStepAMm: CANONICAL_PROPOSAL_LAYOUT.grid.stepAMm,
      gridStepBMm: CANONICAL_PROPOSAL_LAYOUT.grid.stepBMm,
      gridHalfStepMm: CANONICAL_PROPOSAL_LAYOUT.grid.halfStepMm,
    },
    {
      id: "director-letterhead",
      name: "Director Letterhead",
      shortLabel: "25 mm letterhead",
      description:
        "A strong institutional masthead cover-letter sheet with a precise sender block, phone register, meta row, and open body field.",
      twinLabel: "Cover letter",
      exportShell: "onecol",
      leftMarginMm: 25,
      leftZoneMm: 0,
      gutterMm: 0,
      topOffsetMm: 0,
      bodyStartMm: 118,
      bottomMarginMm: 18,
      rightMarginMm: 25,
      readingMeasureCh: 62,
      titleScaleMm: 6.15,
      gridStepAMm: ROBIAL_PROPOSAL_GRID.stepAMm,
      gridStepBMm: ROBIAL_PROPOSAL_GRID.stepBMm,
      gridHalfStepMm: ROBIAL_PROPOSAL_GRID.halfStepMm,
    },
    {
      id: "volk-letterhead",
      name: "Volk Letterhead",
      shortLabel: "24 mm register",
      description:
        "An asymmetric orange civic-letter cover sheet with a Swiss active margin, sender line, meta row, subject register, and lower red dot.",
      twinLabel: "Cover letter",
      exportShell: "onecol",
      leftMarginMm: 24,
      leftZoneMm: 0,
      gutterMm: 0,
      topOffsetMm: 0,
      bodyStartMm: 122,
      bottomMarginMm: 18,
      rightMarginMm: 26,
      readingMeasureCh: 62,
      titleScaleMm: 5.95,
      gridStepAMm: ROBIAL_PROPOSAL_GRID.stepAMm,
      gridStepBMm: ROBIAL_PROPOSAL_GRID.stepBMm,
      gridHalfStepMm: ROBIAL_PROPOSAL_GRID.halfStepMm,
    },
    {
      id: "film-foto-letterhead",
      name: "Film und Foto Letterhead",
      shortLabel: "20 mm header rule",
      description:
        "A horizontal-rule cover-letter sheet with compact top information blocks, a large right title, meta row, and measured body field.",
      twinLabel: "Cover letter",
      exportShell: "onecol",
      leftMarginMm: 20,
      leftZoneMm: 0,
      gutterMm: 0,
      topOffsetMm: 0,
      bodyStartMm: 120,
      bottomMarginMm: 18,
      rightMarginMm: 22,
      readingMeasureCh: 66,
      titleScaleMm: 8.1,
      gridStepAMm: ROBIAL_PROPOSAL_GRID.stepAMm,
      gridStepBMm: ROBIAL_PROPOSAL_GRID.stepBMm,
      gridHalfStepMm: ROBIAL_PROPOSAL_GRID.halfStepMm,
    },
    {
      id: "moma-bauhaus-letterhead",
      name: "MoMA Bauhaus Letterhead",
      shortLabel: "5 mm blue frame",
      description:
        "A Bauhaus archive cover-letter sheet with a fixed blue A4 frame, compact sender/recipient register, and measured body field.",
      twinLabel: "Cover letter",
      exportShell: "onecol",
      leftMarginMm: 32,
      leftZoneMm: 0,
      gutterMm: 0,
      topOffsetMm: 0,
      bodyStartMm: 116,
      bottomMarginMm: 18,
      rightMarginMm: 8,
      readingMeasureCh: 62,
      titleScaleMm: 8.6,
      gridStepAMm: ROBIAL_PROPOSAL_GRID.stepAMm,
      gridStepBMm: ROBIAL_PROPOSAL_GRID.stepBMm,
      gridHalfStepMm: ROBIAL_PROPOSAL_GRID.halfStepMm,
    },
  ] as const;

export function isProposalLetterheadTemplateId(
  value: unknown,
): value is Extract<
  ProposalTemplateId,
  | "director-letterhead"
  | "volk-letterhead"
  | "film-foto-letterhead"
  | "moma-bauhaus-letterhead"
> {
  return (
    value === "director-letterhead" ||
    value === "volk-letterhead" ||
    value === "film-foto-letterhead" ||
    value === "moma-bauhaus-letterhead"
  );
}

export function isProposalTemplateId(
  value: unknown,
): value is ProposalTemplateId {
  return (
    typeof value === "string" &&
    (PROPOSAL_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

function isLegacyProposalTemplateId(
  value: ProposalTemplateId,
): value is LegacyProposalTemplateId {
  return (PROPOSAL_LEGACY_TEMPLATE_IDS as readonly string[]).includes(value);
}

export function resolveProposalTemplateId(
  value: unknown,
): ProposalTemplateId {
  if (isProposalTemplateId(value)) {
    return isLegacyProposalTemplateId(value)
      ? PROPOSAL_TEMPLATE_ALIASES[value] ?? value
      : value;
  }

  return DEFAULT_PROPOSAL_TEMPLATE_ID;
}

export function getProposalTemplateDefinition(
  templateId: ProposalTemplateId | null | undefined,
): ProposalTemplateDefinition {
  const resolvedTemplateId = resolveProposalTemplateId(templateId);

  return (
    PROPOSAL_TEMPLATE_DEFINITIONS.find(
      (definition) => definition.id === resolvedTemplateId,
    ) ?? PROPOSAL_TEMPLATE_DEFINITIONS[0]
  );
}
