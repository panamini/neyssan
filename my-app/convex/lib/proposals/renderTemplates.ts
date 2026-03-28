export const PROPOSAL_ACTIVE_TEMPLATE_IDS = [
  "swiss_margin",
  "two_column_rail",
  "editorial_wide",
  "modernist_signal",
  "quire_margin",
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

export const DEFAULT_PROPOSAL_TEMPLATE_ID: ProposalTemplateId =
  "editorial_wide";

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
  leftZoneMm: 35 | 52;
  topOffsetMm: 35 | 52;
  bodyStartMm: number;
  bottomMarginMm: 18;
  rightMarginMm: 18;
  readingMeasureCh: 54 | 56 | 58 | 60 | 64;
  titleScaleMm: 6.4 | 6.6 | 7 | 7.1 | 7.8;
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
      leftZoneMm: 35,
      topOffsetMm: 35,
      bodyStartMm: 94.5,
      bottomMarginMm: 18,
      rightMarginMm: 18,
      readingMeasureCh: 56,
      titleScaleMm: 6.6,
    },
    {
      id: "two_column_rail",
      name: "Two Column Rail",
      shortLabel: "52 mm rail",
      description:
        "A proposal twin for the split-rail resume layouts, with a wider left signal column and an open document body.",
      twinLabel: "Two Column",
      leftZoneMm: 52,
      topOffsetMm: 35,
      bodyStartMm: 95.5,
      bottomMarginMm: 18,
      rightMarginMm: 18,
      readingMeasureCh: 60,
      titleScaleMm: 7.1,
    },
    {
      id: "editorial_wide",
      name: "Editorial Wide",
      shortLabel: "52 mm editorial",
      description:
        "A calmer editorial letter twin with a broader rail, a slower title cadence, and the longest measure in the set.",
      twinLabel: "Editorial Wide",
      leftZoneMm: 52,
      topOffsetMm: 35,
      bodyStartMm: 97,
      bottomMarginMm: 18,
      rightMarginMm: 18,
      readingMeasureCh: 64,
      titleScaleMm: 7.8,
    },
    {
      id: "modernist_signal",
      name: "Modernist Signal",
      shortLabel: "35 mm signal",
      description:
        "A stricter grid twin with a narrower measure, earlier body drop, and less ornamental rail treatment.",
      twinLabel: "Modernist Grid",
      leftZoneMm: 35,
      topOffsetMm: 35,
      bodyStartMm: 93.5,
      bottomMarginMm: 18,
      rightMarginMm: 18,
      readingMeasureCh: 54,
      titleScaleMm: 6.4,
    },
    {
      id: "quire_margin",
      name: "Quire Margin",
      shortLabel: "35 mm quire",
      description:
        "A bookish twin with a quieter upper field, a later body entry, and the most literary title position.",
      twinLabel: "Quire",
      leftZoneMm: 35,
      topOffsetMm: 52,
      bodyStartMm: 98.5,
      bottomMarginMm: 18,
      rightMarginMm: 18,
      readingMeasureCh: 58,
      titleScaleMm: 7,
    },
  ] as const;

export function isProposalTemplateId(
  value: unknown,
): value is ProposalTemplateId {
  return (
    typeof value === "string" &&
    (PROPOSAL_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export function resolveProposalTemplateId(
  value: unknown,
): ProposalTemplateId {
  if (isProposalTemplateId(value)) {
    return PROPOSAL_TEMPLATE_ALIASES[value] ?? value;
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
