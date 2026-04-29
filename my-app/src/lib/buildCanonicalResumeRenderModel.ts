import type { ResumeData } from "../features/verbati/resume/resume.types";
import { mapCvDocumentToResumeData } from "../features/verbati/cvDocumentToResumeData";
import type { CvDocument } from "../types/cvDocument";
import type { AuthoritativeResumeExportModel } from "./authoritative-resume";

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildLinkedId(section: string, index: number): string {
  return `${section}-${index + 1}`;
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

export function buildCanonicalResumeRenderModelFromCv(
  document: CvDocument,
): ResumeData {
  return mapCvDocumentToResumeData(document);
}

export function buildCanonicalResumeRenderModelFromAuthoritative(
  model: AuthoritativeResumeExportModel,
): ResumeData {
  const metadata = [
    { label: "Location", value: cleanString(model.profile.location) },
    {
      label: "Portfolio",
      value:
        cleanString(model.profile.portfolio) || cleanString(model.profile.website),
    },
  ].filter((item) => item.value);

  const contact = [
    { label: "Email", value: cleanString(model.profile.email) },
    { label: "Phone", value: cleanString(model.profile.phone) },
    {
      label: "Web",
      value:
        cleanString(model.profile.website) || cleanString(model.profile.portfolio),
    },
    { label: "LinkedIn", value: cleanString(model.profile.linkedin) },
  ].filter((item) => item.value);

  return {
    name: cleanString(model.profile.name) || "Candidate",
    title: cleanString(model.profile.desiredPosition),
    summary: cleanString(model.summary),
    metadata,
    contact,
    skills: model.skills.map((item) => cleanString(item.name)).filter(Boolean),
    skillItems: [],
    languages: model.languages.map((item, index) => ({
      id: buildLinkedId("authoritative-language", index),
      name: cleanString(item.name),
      level: cleanString(item.level) || "Unspecified",
      sectionId: "authoritative-languages",
      sectionType: "languages",
      sectionTitle: "Languages",
      sectionOrder: 0,
    })),
    experience: model.experience.map((item, index) => ({
      id: buildLinkedId("authoritative-experience", index),
      sectionId: "authoritative-experience",
      sectionType: "experience",
      sectionTitle: "Experience",
      sectionOrder: 0,
      role: cleanString(item.position) || "Experience",
      company: cleanString(item.company) || cleanString(item.position) || "Experience",
      period: [
        cleanString(item.startDate),
        item.isCurrent ? "Present" : cleanString(item.endDate),
      ]
        .filter(Boolean)
        .join(" - "),
      location: cleanString(item.location),
      ...(cleanString(item.description)
        ? { description: cleanString(item.description) }
        : {}),
      bullets: [
        ...item.responsibilityBullets.map((bullet) => cleanString(bullet)),
        ...item.achievements.map((bullet) => cleanString(bullet)),
      ].filter(Boolean),
    })),
    projects: model.projects.map((item, index) => ({
      id: buildLinkedId("authoritative-project", index),
      sectionId: "authoritative-projects",
      sectionType: "projects",
      sectionTitle: "Projects",
      sectionOrder: 0,
      name: cleanString(item.title) || "Project",
      meta: cleanString(item.meta),
      description: cleanString(item.summary),
    })),
    education: model.education.map((item, index) => ({
      id: buildLinkedId("authoritative-education", index),
      sectionId: "authoritative-education",
      sectionType: "education",
      sectionTitle: "Education",
      sectionOrder: 0,
      degree:
        cleanString(item.degree) ||
        cleanString(item.fieldOfStudy) ||
        "Education",
      school: cleanString(item.institution),
      period: [
        cleanString(item.startDate),
        item.isCurrent ? "Present" : cleanString(item.endDate),
      ]
        .filter(Boolean)
        .join(" - "),
    })),
    achievements: model.achievements.map((item) => cleanString(item)).filter(Boolean),
    achievementItems: model.achievements
      .map((item, index) => {
        const text = cleanString(item);
        if (!text) {
          return null;
        }
        return {
          id: buildLinkedId("authoritative-achievement", index),
          text,
          sectionId: "authoritative-achievements",
          sectionType: "achievements" as const,
          sectionTitle: "Achievements",
          sectionOrder: 0,
        };
      })
      .filter(isNotNull),
    hobbies: model.hobbies.map((item) => cleanString(item)).filter(Boolean),
    hobbyItems: model.hobbies
      .map((item, index) => {
        const name = cleanString(item);
        if (!name) {
          return null;
        }
        return {
          id: buildLinkedId("authoritative-hobby", index),
          name,
          sectionId: "authoritative-hobbies",
          sectionType: "hobbies" as const,
          sectionTitle: "Hobbies",
          sectionOrder: 0,
        };
      })
      .filter(isNotNull),
    certifications: model.certifications
      .map((item, index) => {
        const name = cleanString(item.name);
        if (!name) {
          return null;
        }
        const meta = [cleanString(item.issuer), cleanString(item.date)]
          .filter(Boolean)
          .join(" · ");
        return {
          id: buildLinkedId("authoritative-certification", index),
          name,
          ...(cleanString(item.issuer)
            ? { issuer: cleanString(item.issuer) }
            : {}),
          ...(meta ? { meta } : {}),
          sectionId: "authoritative-certifications",
          sectionType: "certifications" as const,
          sectionTitle: "Certifications",
          sectionOrder: 0,
        };
      })
      .filter(isNotNull),
    affiliations: [],
    textSections: [],
  };
}
