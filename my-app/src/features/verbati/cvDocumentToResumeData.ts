import { formatRangeFromItem } from "../../lib/date-utils";
import { remirrorJsonToString } from "../../lib/utils";
import type { RemirrorJSON } from "remirror";
import type {
  CvBlock,
  CvDocument,
  CvSection,
  IAchievementItem,
  IEducationItem,
  IExperienceItem,
  ILanguageItem,
  IProfileItem,
  ISkillItem,
  ISummaryItem,
} from "../../types/cvDocument";
import type { ResumeData, ResumeMetaItem } from "./resume/resume.types";

function findSection(doc: CvDocument, type: CvSection["type"]): CvSection | undefined {
  return doc.sections.find((section) => section.type === type);
}

function findTextSectionByTitle(doc: CvDocument, title: string): CvSection | undefined {
  const normalizedTitle = title.trim().toLowerCase();
  return doc.sections.find(
    (section) =>
      String(section.type ?? "") === "text" &&
      String(section.title ?? "").trim().toLowerCase() === normalizedTitle,
  );
}

function readStructured<T>(section?: CvSection): T[] {
  return Array.isArray(section?.structuredContent) ? (section?.structuredContent as T[]) : [];
}

function isRemirrorLike(value: unknown): value is RemirrorJSON {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in (value as Record<string, unknown>),
  );
}

function toPlainText(value: unknown): string {
  const source: string | RemirrorJSON | null | undefined =
    typeof value === "string" || value == null || isRemirrorLike(value)
      ? value
      : undefined;
  const text = remirrorJsonToString(source);
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toSentenceList(value: unknown): string[] {
  const text = toPlainText(value);
  if (!text) return [];

  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-\u2013\u2014•*+]\s*/, "").trim())
    .filter(Boolean);
}

function toMetaItem(label: string, value: string | undefined | null): ResumeMetaItem | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return { label, value: trimmed };
}

function fallbackSectionText(section?: CvSection): string {
  if (!section) return "";

  const fromBlocks = (section.blocks ?? [])
    .map((block) => blockToText(block))
    .filter(Boolean)
    .join("\n\n");

  return fromBlocks.trim();
}

function blockToText(block: CvBlock | undefined): string {
  if (!block) return "";
  if (typeof block.plainText === "string" && block.plainText.trim()) {
    return block.plainText.trim();
  }

  return toPlainText(block.content);
}

function readRecordText(
  record: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function readRecordValue(
  record: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    if (record[key] != null) {
      return record[key];
    }
  }

  return undefined;
}

function mapProfile(doc: CvDocument): IProfileItem | undefined {
  return readStructured<IProfileItem>(findSection(doc, "profile"))[0];
}

function mapSummary(doc: CvDocument): string {
  const summarySection = findSection(doc, "summary");
  const summaryItem = readStructured<ISummaryItem>(summarySection)[0];

  return (
    toPlainText(summaryItem?.summary) ||
    toPlainText(doc.summary) ||
    fallbackSectionText(summarySection)
  );
}

function mapExperience(doc: CvDocument): ResumeData["experience"] {
  return readStructured<IExperienceItem>(findSection(doc, "experience"))
    .map((item) => {
      const bullets = Array.isArray(item.responsibilityBullets)
        ? item.responsibilityBullets
            .map((value) => String(value ?? "").trim())
            .filter(Boolean)
        : [];
      const description = toPlainText(item.description);
      const role = String(item.position ?? "").trim();
      const company = String(item.company ?? "").trim();
      const location = String(item.location ?? "").trim();
      const period = formatRangeFromItem(item);

      if (!role && !company && bullets.length === 0 && !description) {
        return null;
      }

      return {
        role: role || company || "Experience",
        company: company || role || "Experience",
        period: period || "Dates not set",
        location: location || "Location not set",
        ...(description ? { description } : {}),
        bullets,
      };
    })
    .filter((item): item is ResumeData["experience"][number] => item !== null);
}

function mapProjects(doc: CvDocument): ResumeData["projects"] {
  const projectsSection = findSection(doc, "projects");

  if (!projectsSection) return [];

  const structuredProjects = readStructured<Record<string, unknown>>(projectsSection)
    .map((item, index) => {
      const name = readRecordText(item, "name", "title");
      const meta = readRecordText(item, "meta", "subtitle");
      const description = toPlainText(
        readRecordValue(item, "description", "summary", "content"),
      );

      if (!name && !description) {
        return null;
      }

      return {
        name: name || `Project ${index + 1}`,
        meta,
        description: description || meta || "Project details pending.",
      };
    })
    .filter((item): item is ResumeData["projects"][number] => item !== null);

  if (structuredProjects.length > 0) {
    return structuredProjects;
  }

  return (projectsSection.blocks ?? [])
    .map((block, index) => {
      const title = String(block.title ?? "").trim();
      const description = blockToText(block);

      if (!title && !description) {
        return null;
      }

      return {
        name: title || `Project ${index + 1}`,
        meta: "",
        description: description || "Project details pending.",
      };
    })
    .filter((item): item is ResumeData["projects"][number] => item !== null);
}

function mapEducation(doc: CvDocument): ResumeData["education"] {
  return readStructured<IEducationItem>(findSection(doc, "education"))
    .map((item) => {
      const degree = String(item.degree ?? "").trim();
      const field = String(item.fieldOfStudy ?? "").trim();
      const school = String(item.institution ?? "").trim();
      const period = formatRangeFromItem(item);

      if (!degree && !field && !school) {
        return null;
      }

      return {
        degree: degree || field || school || "Education",
        school: school || field || degree || "Institution",
        period: period || "Dates not set",
      };
    })
    .filter((item): item is ResumeData["education"][number] => item !== null);
}

function mapSkills(doc: CvDocument): string[] {
  const skillSection = findSection(doc, "skills");
  const structuredSkills = readStructured<ISkillItem>(skillSection)
    .map((item) => String(item.name ?? "").trim())
    .filter(Boolean);

  if (structuredSkills.length > 0) {
    return structuredSkills;
  }

  return fallbackSectionText(skillSection)
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function mapLanguages(doc: CvDocument): ResumeData["languages"] {
  const languageSection = findSection(doc, "languages");
  const structuredLanguages = readStructured<ILanguageItem>(languageSection)
    .map((item) => {
      const name = String(item.name ?? "").trim();
      const level = String(item.level ?? "").trim();
      if (!name) return null;
      return {
        name,
        level: level || "Proficiency not set",
      };
    })
    .filter((item): item is ResumeData["languages"][number] => item !== null);

  if (structuredLanguages.length > 0) {
    return structuredLanguages;
  }

  return toSentenceList(fallbackSectionText(languageSection)).map((entry) => ({
    name: entry,
    level: "Proficiency not set",
  }));
}

function mapAchievements(doc: CvDocument): string[] {
  const achievementSection = findSection(doc, "achievements");
  const structuredAchievements = readStructured<IAchievementItem>(achievementSection)
    .map((item) => String(item.text ?? "").trim())
    .filter(Boolean);

  if (structuredAchievements.length > 0) {
    return structuredAchievements;
  }

  return toSentenceList(fallbackSectionText(achievementSection));
}

function mapHobbies(doc: CvDocument): string[] {
  const hobbiesSection = findTextSectionByTitle(doc, "Hobbies");
  if (!hobbiesSection) {
    return [];
  }

  const structuredHobbies = readStructured<Record<string, unknown>>(hobbiesSection)
    .map((item) => readRecordText(item, "name", "text"))
    .filter(Boolean);

  if (structuredHobbies.length > 0) {
    return structuredHobbies;
  }

  return toSentenceList(fallbackSectionText(hobbiesSection));
}

export function mapCvDocumentToResumeData(doc: CvDocument): ResumeData {
  const profile = mapProfile(doc);
  const summary = mapSummary(doc);
  const metadata = [
    toMetaItem("Location", profile?.location),
    toMetaItem("Portfolio", profile?.website),
  ].filter((item): item is ResumeMetaItem => item !== null);

  const contact = [
    toMetaItem("Email", profile?.email),
    toMetaItem("Phone", profile?.phone),
    toMetaItem("Web", profile?.website),
    toMetaItem("LinkedIn", profile?.linkedin),
  ].filter((item): item is ResumeMetaItem => item !== null);

  return {
    name: String(profile?.name ?? "").trim() || doc.title || "Candidate name",
    title:
      String(profile?.desiredPosition ?? "").trim() ||
      doc.title ||
      "Professional profile",
    summary:
      summary ||
      "Add a summary in CvForge to replace this placeholder and feed the live renderer.",
    photoUrl: String(profile?.photoUrl ?? "").trim() || undefined,
    metadata,
    contact,
    skills: mapSkills(doc),
    languages: mapLanguages(doc),
    experience: mapExperience(doc),
    projects: mapProjects(doc),
    education: mapEducation(doc),
    achievements: mapAchievements(doc),
    hobbies: mapHobbies(doc),
  };
}

export function hasRenderableResumeData(data: ResumeData | null | undefined): boolean {
  if (!data) return false;

  const hasIdentity = Boolean(String(data.name ?? "").trim());
  const hasBody =
    Boolean(String(data.summary ?? "").trim()) ||
    data.experience.length > 0 ||
    data.education.length > 0 ||
    data.skills.length > 0;

  return hasIdentity && hasBody;
}
