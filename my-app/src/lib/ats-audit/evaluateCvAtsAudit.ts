import {
  buildAuthoritativeResumeExportModel,
  hasTrustedAuthoritativeResume,
  readAuthoritativeResumeFromCv,
  type AuthoritativeResumeExportModel,
} from "../authoritative-resume";
import type { CvDocument, CvSection } from "../../types/cvDocument";
import {
  ATS_AUDIT_CATEGORIES,
  calculateWeightedAtsScore,
  clampAuditScore,
  createPerfectCategoryScores,
} from "./rubric";
import type {
  AtsAuditCategory,
  AtsAuditIssue,
  AtsAuditIssuesByCategory,
  AtsAuditResult,
  AtsAuditSeverity,
  EvaluateCvAtsAuditInput,
} from "./types";

type IssueInput = {
  id: string;
  category: AtsAuditCategory;
  severity: AtsAuditSeverity;
  title: string;
  detail: string;
  priority: AtsAuditIssue["priority"];
  penalty: number;
  blocker?: boolean;
};

type AtsAuditProfileEvidence = {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
};

type AtsAuditExperienceEvidence = {
  company?: string;
  position?: string;
  startDate?: string;
  endDate?: string | null;
  isCurrent?: boolean;
  description?: string;
  responsibilityBullets: string[];
  achievements: string[];
};

type AtsAuditEducationEvidence = {
  institution?: string;
  degree?: string;
  fieldOfStudy?: string;
  description?: string;
};

type AtsAuditCertificationEvidence = {
  name?: string;
  issuer?: string;
  date?: string;
  credentialId?: string;
};

type AtsAuditContentEvidence = {
  profile: AtsAuditProfileEvidence;
  summary?: string;
  experience: AtsAuditExperienceEvidence[];
  education: AtsAuditEducationEvidence[];
  skills: string[];
  certifications: AtsAuditCertificationEvidence[];
};

const STANDARD_SECTION_TITLES = new Map<string, string[]>([
  ["profile", ["profile", "contact", "personal details"]],
  ["summary", ["summary", "profile summary", "professional summary"]],
  ["experience", ["experience", "work experience", "professional experience"]],
  ["education", ["education"]],
  ["skills", ["skills", "technical skills", "core skills"]],
  ["certifications", ["certifications", "certificates", "licenses"]],
  ["projects", ["projects"]],
  ["languages", ["languages"]],
  ["achievements", ["achievements"]],
]);

const PLACEHOLDER_PATTERN =
  /\b(?:lorem ipsum|target title|add (?:experience|education|skill|summary)|to be added|tbd|placeholder|imported notes)\b/i;

function createEmptyIssues(): AtsAuditIssuesByCategory {
  return {
    parsing: [],
    layout: [],
    typography: [],
    sections: [],
    keywords: [],
    content: [],
  };
}

function collectPlainText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(collectPlainText).filter(Boolean).join("\n");
  }
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.text === "string") return record.text;
  if (typeof record.plainText === "string") return record.plainText;
  if (Array.isArray(record.content)) {
    return record.content.map(collectPlainText).filter(Boolean).join("\n");
  }
  return Object.entries(record)
    .filter(([key]) => !["type", "attrs", "id", "order"].includes(key))
    .map(([, entry]) => collectPlainText(entry))
    .filter(Boolean)
    .join("\n");
}

function normalizeTitle(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function getSectionText(section: CvSection): string {
  return [
    collectPlainText(section.structuredContent),
    ...section.blocks.map((block) => collectPlainText(block.plainText ?? block.content)),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function getStructuredItems(section: CvSection | null): Array<Record<string, unknown>> {
  return Array.isArray(section?.structuredContent)
    ? (section.structuredContent as Array<Record<string, unknown>>)
    : [];
}

function readText(record: Record<string, unknown> | null | undefined, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = collectPlainText(record?.[key]).trim();
    if (value) return value;
  }
  return undefined;
}

function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => collectPlainText(entry).trim()).filter(Boolean);
  }
  const text = collectPlainText(value).trim();
  return text
    ? text
        .split(/\n+/)
        .map((entry) => entry.replace(/^[-*•]\s*/, "").trim())
        .filter(Boolean)
    : [];
}

function buildSectionEvidence(cv: CvDocument): AtsAuditContentEvidence {
  const profileSection = findSection(cv, "profile") ?? findSection(cv, "contact");
  const profileItem = getStructuredItems(profileSection)[0];
  const summarySection = findSection(cv, "summary");
  const summaryItem = getStructuredItems(summarySection)[0];

  const experience = getStructuredItems(findSection(cv, "experience")).map((item) => ({
    company: readText(item, "company"),
    position: readText(item, "position"),
    startDate: readText(item, "startDate"),
    endDate: readText(item, "endDate") ?? null,
    isCurrent: item.isCurrent === true || item.currentlyWorking === true,
    description: readText(item, "description", "summary"),
    responsibilityBullets: readStringList(item.responsibilityBullets ?? item.responsibilities),
    achievements: readStringList(item.achievements),
  }));

  const education = getStructuredItems(findSection(cv, "education")).map((item) => ({
    institution: readText(item, "institution"),
    degree: readText(item, "degree"),
    fieldOfStudy: readText(item, "fieldOfStudy"),
    description: readText(item, "description"),
  }));

  const skills = getStructuredItems(findSection(cv, "skills"))
    .map((item) => readText(item, "name"))
    .filter((entry): entry is string => Boolean(entry));

  const certifications = getStructuredItems(findSection(cv, "certifications")).map((item) => ({
    name: readText(item, "certificationName", "name"),
    issuer: readText(item, "issuingOrganization", "issuer"),
    date: readText(item, "issueDate", "date"),
    credentialId: readText(item, "credentialId"),
  }));

  return {
    profile: {
      name: readText(profileItem, "name"),
      email: readText(profileItem, "email"),
      phone: readText(profileItem, "phone"),
      location: readText(profileItem, "location"),
    },
    summary:
      readText(summaryItem, "summary", "text") ??
      (summarySection ? getSectionText(summarySection) : undefined),
    experience,
    education,
    skills,
    certifications,
  };
}

function buildModelEvidence(
  model: AuthoritativeResumeExportModel,
): AtsAuditContentEvidence {
  return {
    profile: model.profile,
    summary: model.summary,
    experience: model.experience,
    education: model.education,
    skills: model.skills.map((skill) => skill.name),
    certifications: model.certifications,
  };
}

function hasStandardTitle(section: CvSection): boolean {
  const expectedTitles = STANDARD_SECTION_TITLES.get(section.type);
  if (!expectedTitles) return true;
  return expectedTitles.includes(normalizeTitle(section.title));
}

function hasText(value: unknown): boolean {
  return collectPlainText(value).trim().length > 0;
}

function textLength(value: unknown): number {
  return collectPlainText(value).trim().length;
}

function hasExperienceNarrative(
  item: AuthoritativeResumeExportModel["experience"][number],
): boolean {
  return (
    item.responsibilityBullets.length > 0 ||
    item.achievements.length > 0 ||
    Boolean(item.description?.trim())
  );
}

function addIssue(
  issues: AtsAuditIssuesByCategory,
  penalties: Record<AtsAuditCategory, number>,
  blockers: AtsAuditIssue[],
  input: IssueInput,
): void {
  const issue: AtsAuditIssue = {
    id: input.id,
    category: input.category,
    severity: input.severity,
    title: input.title,
    detail: input.detail,
    priority: input.priority,
  };
  issues[input.category].push(issue);
  penalties[input.category] += input.penalty;
  if (input.blocker) {
    blockers.push(issue);
  }
}

function findSection(cv: CvDocument, type: CvSection["type"]): CvSection | null {
  return cv.sections.find((section) => section.type === type) ?? null;
}

function hasSection(cv: CvDocument, type: CvSection["type"]): boolean {
  return Boolean(findSection(cv, type));
}

function deriveVerdict(score: number, blockers: AtsAuditIssue[]) {
  if (blockers.length > 0) return "blocked" as const;
  if (score >= 90) return "excellent" as const;
  if (score >= 75) return "good" as const;
  return "needs_review" as const;
}

export function evaluateCvAtsAudit(input: EvaluateCvAtsAuditInput): AtsAuditResult {
  const issues = createEmptyIssues();
  const blockers: AtsAuditIssue[] = [];
  const penalties: Record<AtsAuditCategory, number> = {
    parsing: 0,
    layout: 0,
    typography: 0,
    sections: 0,
    keywords: 0,
    content: 0,
  };
  const cv = input.cv;

  if (!cv) {
    addIssue(issues, penalties, blockers, {
      id: "missing-cv",
      category: "parsing",
      severity: "critical",
      title: "No CV is open",
      detail: "Open or create a CV before running the ATS audit heuristic.",
      priority: "high",
      penalty: 100,
      blocker: true,
    });
    const categoryScores = createPerfectCategoryScores();
    categoryScores.parsing = 0;
    const score = calculateWeightedAtsScore(categoryScores);
    return {
      score,
      verdict: "blocked",
      blockers,
      categoryScores,
      issues,
      priorityFixes: blockers,
    };
  }

  const authoritativeResume = readAuthoritativeResumeFromCv(cv);
  const hasTrustedExportModel = hasTrustedAuthoritativeResume(authoritativeResume);
  const exportModel = buildAuthoritativeResumeExportModel(authoritativeResume);

  if (!hasTrustedExportModel || !exportModel) {
    addIssue(issues, penalties, blockers, {
      id: "missing-trusted-export-model",
      category: "parsing",
      severity: "warning",
      title: "Trusted normalized export model is missing",
      detail:
        "The audit can still inspect the editable CV, but export trust is lower until a trusted normalized model exists.",
      priority: "high",
      penalty: 60,
    });
  }

  const importIssueCount = Math.max(0, input.importIssueCount ?? 0);
  if (importIssueCount > 0) {
    addIssue(issues, penalties, blockers, {
      id: "unresolved-import-review",
      category: "parsing",
      severity: "critical",
      title: "Unresolved import review",
      detail: `${importIssueCount} imported ${importIssueCount === 1 ? "section needs" : "sections need"} confirmation before this CV should be treated as ready.`,
      priority: "high",
      penalty: 55,
      blocker: true,
    });
  }

  const evidence = exportModel
    ? buildModelEvidence(exportModel)
    : buildSectionEvidence(cv);
  const profile = evidence.profile;
  if (!profile?.name || profile.name === "Candidate") {
    addIssue(issues, penalties, blockers, {
      id: "missing-profile-name",
      category: "content",
      severity: "critical",
      title: "Candidate name is missing",
      detail: "The profile needs a real candidate name.",
      priority: "high",
      penalty: 18,
    });
  }

  if (!profile?.email && !profile?.phone) {
    addIssue(issues, penalties, blockers, {
      id: "missing-contact-method",
      category: "content",
      severity: "critical",
      title: "Contact method is missing",
      detail: "Add at least an email address or phone number.",
      priority: "high",
      penalty: 20,
    });
  }

  if (!profile?.location) {
    addIssue(issues, penalties, blockers, {
      id: "missing-location",
      category: "content",
      severity: "info",
      title: "Location is missing",
      detail: "Adding location context helps recruiters understand availability.",
      priority: "low",
      penalty: 4,
    });
  }

  if (!evidence.summary || evidence.summary.trim().length < 40) {
    addIssue(issues, penalties, blockers, {
      id: "weak-summary",
      category: "content",
      severity: "warning",
      title: "Summary is missing or too short",
      detail: "Add a concise professional summary with role, scope, and strengths.",
      priority: "medium",
      penalty: 8,
    });
  }

  const requiredSections: Array<[CvSection["type"], string]> = [
    ["profile", "Profile"],
    ["summary", "Summary"],
    ["experience", "Experience"],
    ["education", "Education"],
    ["skills", "Skills"],
  ];
  for (const [type, label] of requiredSections) {
    if (!hasSection(cv, type)) {
      addIssue(issues, penalties, blockers, {
        id: `missing-section-${type}`,
        category: "sections",
        severity: type === "experience" || type === "skills" ? "critical" : "warning",
        title: `${label} section is missing`,
        detail: `Add a standard ${label.toLocaleLowerCase()} section.`,
        priority: type === "experience" || type === "skills" ? "high" : "medium",
        penalty: type === "experience" || type === "skills" ? 18 : 8,
      });
    }
  }

  for (const section of cv.sections) {
    if (!hasStandardTitle(section)) {
      addIssue(issues, penalties, blockers, {
        id: `nonstandard-section-title-${section.id ?? section.type}`,
        category: "sections",
        severity: "info",
        title: "Section name may be non-standard",
        detail: `"${section.title}" is not a common label for a ${section.type} section.`,
        priority: "low",
        penalty: 3,
      });
    }

    const sectionText = getSectionText(section);
    if (!sectionText) {
      addIssue(issues, penalties, blockers, {
        id: `empty-section-${section.id ?? section.type}`,
        category: "content",
        severity: "warning",
        title: "Empty section",
        detail: `${section.title} has no readable content.`,
        priority: "medium",
        penalty: 8,
      });
    } else if (PLACEHOLDER_PATTERN.test(sectionText)) {
      addIssue(issues, penalties, blockers, {
        id: `placeholder-section-${section.id ?? section.type}`,
        category: "content",
        severity: "warning",
        title: "Placeholder-like content detected",
        detail: `${section.title} contains draft or placeholder text.`,
        priority: "medium",
        penalty: 8,
      });
    }
  }

  if (evidence.experience.length === 0) {
    addIssue(issues, penalties, blockers, {
      id: "missing-experience-data",
      category: "content",
      severity: "critical",
      title: "Experience data is missing",
      detail: "Add at least one structured experience entry.",
      priority: "high",
      penalty: 22,
    });
  } else {
    evidence.experience.forEach((item, index) => {
      if (!item.company || !item.position) {
        addIssue(issues, penalties, blockers, {
          id: `experience-heading-${index}`,
          category: "content",
          severity: "critical",
          title: "Experience role or company is incomplete",
          detail: "Each experience entry should include both a company and a position.",
          priority: "high",
          penalty: 10,
        });
      }
      if (!item.startDate || (!item.endDate && !item.isCurrent)) {
        addIssue(issues, penalties, blockers, {
          id: `experience-dates-${index}`,
          category: "content",
          severity: "warning",
          title: "Experience dates are incomplete",
          detail: "Each experience entry should include a start date and either an end date or current-role status.",
          priority: "medium",
          penalty: 9,
        });
      }
      if (!hasExperienceNarrative(item)) {
        addIssue(issues, penalties, blockers, {
          id: `experience-detail-${index}`,
          category: "content",
          severity: "warning",
          title: "Experience detail is missing",
          detail: "Add bullets, achievements, or a short description for each experience entry.",
          priority: "medium",
          penalty: 10,
        });
      }
    });
  }

  if (evidence.education.length === 0) {
    addIssue(issues, penalties, blockers, {
      id: "missing-education-data",
      category: "content",
      severity: "warning",
      title: "Education data is missing",
      detail: "Add education or training details when relevant.",
      priority: "medium",
      penalty: 8,
    });
  } else {
    evidence.education.forEach((item, index) => {
      if (!item.institution) {
        addIssue(issues, penalties, blockers, {
          id: `education-institution-${index}`,
          category: "content",
          severity: "warning",
          title: "Education institution is missing",
          detail: "Each education entry should identify the institution or provider.",
          priority: "medium",
          penalty: 7,
        });
      }
      if (!item.degree && !item.fieldOfStudy && !item.description) {
        addIssue(issues, penalties, blockers, {
          id: `education-detail-${index}`,
          category: "content",
          severity: "warning",
          title: "Education detail is missing",
          detail: "Add a degree, field of study, qualification, or short description.",
          priority: "medium",
          penalty: 7,
        });
      }
    });
  }

  if (evidence.skills.length === 0) {
    addIssue(issues, penalties, blockers, {
      id: "missing-skills",
      category: "sections",
      severity: "critical",
      title: "Skills are missing",
      detail: "Add structured skill names so the CV can be scanned quickly.",
      priority: "high",
      penalty: 18,
    });
  } else if (evidence.skills.length < 4) {
    addIssue(issues, penalties, blockers, {
      id: "thin-skills",
      category: "content",
      severity: "info",
      title: "Skills section is thin",
      detail: "Consider adding more concrete skill names if they are supported by the CV.",
      priority: "low",
      penalty: 4,
    });
  }

  evidence.certifications.forEach((item, index) => {
    if (!item.name) {
      addIssue(issues, penalties, blockers, {
        id: `certification-name-${index}`,
        category: "content",
        severity: "warning",
        title: "Certification name is missing",
        detail: "Each certification should include a clear certificate or license name.",
        priority: "medium",
        penalty: 6,
      });
    }
    if (!item.issuer && !item.date && !item.credentialId) {
      addIssue(issues, penalties, blockers, {
        id: `certification-detail-${index}`,
        category: "content",
        severity: "info",
        title: "Certification detail is sparse",
        detail: "Issuer, date, or credential ID improves certification structure when available.",
        priority: "low",
        penalty: 3,
      });
    }
  });

  if (typeof input.pageCount === "number" && input.pageCount > 1) {
    addIssue(issues, penalties, blockers, {
      id: input.pageCount > 2 ? "layout-page-count-high" : "layout-page-count",
      category: "layout",
      severity: input.pageCount > 2 ? "critical" : "warning",
      title: input.pageCount > 2 ? "CV is longer than two pages" : "CV is longer than one page",
      detail:
        input.pageCount > 2
          ? "A CV over two pages is a stronger length risk for quick screening."
          : "Two pages may be acceptable, but one page is usually easier to scan.",
      priority: input.pageCount > 2 ? "high" : "medium",
      penalty: input.pageCount > 2 ? 35 : 18,
    });
  }

  const categoryScores = createPerfectCategoryScores();
  for (const category of ATS_AUDIT_CATEGORIES) {
    categoryScores[category] = clampAuditScore(
      categoryScores[category] - penalties[category],
    );
  }

  const score = calculateWeightedAtsScore(categoryScores);
  const priorityFixes = ATS_AUDIT_CATEGORIES.flatMap(
    (category) => issues[category],
  )
    .filter((issue) => issue.priority === "high" || issue.severity === "critical")
    .slice(0, 5);

  return {
    score,
    verdict: deriveVerdict(score, blockers),
    blockers,
    categoryScores,
    issues,
    priorityFixes,
  };
}
