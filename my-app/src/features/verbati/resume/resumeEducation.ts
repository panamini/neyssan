import type { ResumeEducationItem } from "./resume.types";

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function joinParts(parts: Array<string | undefined>, separator: string): string {
  return parts.map((part) => cleanString(part)).filter(Boolean).join(separator);
}

export type ResumeEducationDisplay = {
  title: string;
  subtitle: string;
  period: string;
  previewMeta: string;
};

export function buildResumeEducationDisplay(
  item: Pick<ResumeEducationItem, "degree" | "fieldOfStudy" | "grade" | "school" | "period">,
): ResumeEducationDisplay {
  const degree = cleanString(item.degree);
  const fieldOfStudy = cleanString(item.fieldOfStudy);
  const school = cleanString(item.school);
  const grade = cleanString(item.grade);
  const period = cleanString(item.period);
  const title = joinParts([degree, fieldOfStudy], ", ") || school || "Education";
  const schoolFallsBackToTitle = Boolean(school) && title === school;
  const subtitle = joinParts(
    [
      schoolFallsBackToTitle ? "" : school,
      grade ? `Grade: ${grade}` : "",
    ],
    " · ",
  );

  return {
    title,
    subtitle,
    period,
    previewMeta: joinParts([subtitle, period], " · "),
  };
}
