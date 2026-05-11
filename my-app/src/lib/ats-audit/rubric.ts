import type { AtsAuditCategory, AtsAuditCategoryScores } from "./types";

export const ATS_AUDIT_CATEGORIES: AtsAuditCategory[] = [
  "parsing",
  "layout",
  "typography",
  "sections",
  "keywords",
  "content",
];

export const ATS_AUDIT_CATEGORY_WEIGHTS: AtsAuditCategoryScores = {
  parsing: 20,
  layout: 15,
  typography: 5,
  sections: 20,
  keywords: 10,
  content: 30,
};

export const ATS_AUDIT_NEUTRAL_CATEGORY_SCORE = 100;

export function clampAuditScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function createPerfectCategoryScores(): AtsAuditCategoryScores {
  return {
    parsing: 100,
    layout: 100,
    typography: ATS_AUDIT_NEUTRAL_CATEGORY_SCORE,
    sections: 100,
    keywords: ATS_AUDIT_NEUTRAL_CATEGORY_SCORE,
    content: 100,
  };
}

export function calculateWeightedAtsScore(
  categoryScores: AtsAuditCategoryScores,
): number {
  const totalWeight = ATS_AUDIT_CATEGORIES.reduce(
    (sum, category) => sum + ATS_AUDIT_CATEGORY_WEIGHTS[category],
    0,
  );
  const weighted = ATS_AUDIT_CATEGORIES.reduce(
    (sum, category) =>
      sum + categoryScores[category] * ATS_AUDIT_CATEGORY_WEIGHTS[category],
    0,
  );
  return clampAuditScore(weighted / totalWeight);
}
