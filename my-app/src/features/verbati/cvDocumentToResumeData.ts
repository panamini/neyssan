import { formatByPrecision, formatRangeFromItem } from "../../lib/date-utils";
import {
  deriveResponsibilityBullets,
  projectResponsibilitiesForWorkshop,
} from "../../lib/resumeResponsibilityAuthority";
import { remirrorJsonToString } from "../../lib/utils";
import type { RemirrorJSON } from "remirror";
import type {
  CvBlock,
  CvDocument,
  CvSection,
  IAchievementItem,
  IAffiliationItem,
  ICertificationItem,
  IEducationItem,
  IExperienceItem,
  ILanguageItem,
  IProfileItem,
  IProjectItem,
  ISkillItem,
  ISummaryItem,
} from "../../types/cvDocument";
import {
  getCanonicalSectionType,
  type ResumeCanonicalSectionType,
} from "./resumeLinking";
import type {
  ResumeAffiliationItem,
  ResumeCertificationItem,
  ResumeData,
  ResumeEducationItem,
  ResumeExperienceItem,
  ResumeHobbyItem,
  ResumeMetaItem,
  ResumeProjectItem,
  ResumeSkillItem,
  ResumeTextListItem,
  ResumeTextSection,
} from "./resume/resume.types";

type SectionContext = {
  section: CvSection;
  sectionId: string;
  sectionOrder: number;
  sectionType: ResumeCanonicalSectionType;
  sectionTitle: string;
};

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
  if (!text) {
    return [];
  }

  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-\u2013\u2014•*+]\s*/, "").trim())
    .filter(Boolean);
}

function blockToText(block: CvBlock | undefined): string {
  if (!block) {
    return "";
  }

  if (typeof block.plainText === "string" && block.plainText.trim()) {
    return block.plainText.trim();
  }

  return toPlainText(block.content);
}

function omitLeadingLine(lines: string[], leading: string): string[] {
  if (!leading || lines.length === 0) {
    return lines;
  }

  return lines[0]?.trim().toLowerCase() === leading.trim().toLowerCase()
    ? lines.slice(1)
    : lines;
}

function fallbackSectionText(section?: CvSection): string {
  if (!section) {
    return "";
  }

  return (section.blocks ?? [])
    .map((block) => blockToText(block))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function readStructured<T>(section?: CvSection): T[] {
  return Array.isArray(section?.structuredContent)
    ? (section.structuredContent as T[])
    : [];
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

function createSectionContexts(doc: CvDocument): SectionContext[] {
  return (doc.sections ?? [])
    .map((section, sectionOrder) => {
      const sectionType = getCanonicalSectionType(section);
      if (!sectionType) {
        return null;
      }

      return {
        section,
        sectionId:
          typeof section.id === "string" && section.id.trim()
            ? section.id
            : `${sectionType}-section-${sectionOrder}`,
        sectionOrder,
        sectionType,
        sectionTitle: String(section.title ?? "").trim(),
      } satisfies SectionContext;
    })
    .filter((context): context is SectionContext => context !== null);
}

function buildSectionIdMap(
  contexts: SectionContext[],
): ResumeData["sectionIdsByType"] {
  return contexts.reduce<NonNullable<ResumeData["sectionIdsByType"]>>(
    (result, context) => {
      const existing = result[context.sectionType] ?? [];
      result[context.sectionType] = [...existing, context.sectionId];
      return result;
    },
    {},
  );
}

function getFirstContext(
  contexts: SectionContext[],
  sectionType: ResumeCanonicalSectionType,
): SectionContext | undefined {
  return contexts.find((context) => context.sectionType === sectionType);
}

function getContexts(
  contexts: SectionContext[],
  sectionType: ResumeCanonicalSectionType,
): SectionContext[] {
  return contexts.filter((context) => context.sectionType === sectionType);
}

function resolveItemId(args: {
  rawId: unknown;
  blockId?: unknown;
  context: SectionContext;
  family: string;
  index: number;
}): string {
  const { rawId, blockId, context, family, index } = args;

  if (typeof rawId === "string" && rawId.trim()) {
    return rawId;
  }

  if (typeof blockId === "string" && blockId.trim()) {
    return blockId;
  }

  return `${context.sectionId}-${family}-${index}`;
}

function buildLinkedMeta(
  context: SectionContext,
  itemId: string,
): Pick<
  ResumeExperienceItem,
  "id" | "sectionId" | "sectionType" | "sectionTitle" | "sectionOrder"
> {
  return {
    id: itemId,
    sectionId: context.sectionId,
    sectionType: context.sectionType,
    sectionTitle: context.sectionTitle || undefined,
    sectionOrder: context.sectionOrder,
  };
}

function toMetaItem(
  label: string,
  value: string | undefined | null,
  context?: SectionContext,
  itemId?: string,
): ResumeMetaItem | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  return {
    label,
    value: trimmed,
    itemId,
    sectionId: context?.sectionId,
    sectionType: context?.sectionType,
  };
}

function mapProfile(
  profileContext?: SectionContext,
): IProfileItem | undefined {
  return readStructured<IProfileItem>(profileContext?.section)[0];
}

function mapSummary(summaryContext?: SectionContext, doc?: CvDocument): string {
  const summaryItem = readStructured<ISummaryItem>(summaryContext?.section)[0];

  return (
    toPlainText(summaryItem?.summary) ||
    toPlainText(doc?.summary) ||
    fallbackSectionText(summaryContext?.section)
  );
}

function mapExperience(
  experienceContext?: SectionContext,
): ResumeData["experience"] {
  if (!experienceContext) {
    return [];
  }

  const structuredExperience = readStructured<IExperienceItem>(experienceContext.section)
    .map((item, index) => {
      const hasResponsibilitiesField = Object.prototype.hasOwnProperty.call(
        item,
        "responsibilities",
      );
      const responsibilitiesProjection = hasResponsibilitiesField
        ? projectResponsibilitiesForWorkshop(item.responsibilities)
        : {
            prose: "",
            bullets: deriveResponsibilityBullets({
              responsibilities: item.responsibilities,
              hasResponsibilitiesField: false,
              responsibilityBullets: item.responsibilityBullets,
            }),
            rich: { blocks: [] },
          };
      const bullets = responsibilitiesProjection.bullets;
      const description = [
        toPlainText(item.description),
        responsibilitiesProjection.prose,
      ]
        .filter(Boolean)
        .join("\n\n");
      const role = String(item.position ?? "").trim();
      const company = String(item.company ?? "").trim();
      const location = String(item.location ?? "").trim();
      const period = formatRangeFromItem(item);

      if (!role && !company && bullets.length === 0 && !description) {
        return null;
      }

      return {
        ...buildLinkedMeta(
          experienceContext,
          resolveItemId({
            rawId: item.id,
            context: experienceContext,
            family: "experience",
            index,
          }),
        ),
        role: role || company || "Experience",
        company: company || role || "Experience",
        period: period || "Dates not set",
        location: location || "Location not set",
        ...(description ? { description } : {}),
        bullets,
        ...(responsibilitiesProjection.rich.blocks.length > 0
          ? { responsibilitiesRich: responsibilitiesProjection.rich }
          : {}),
      };
    })
    .filter((item): item is ResumeExperienceItem => item !== null);

  if (structuredExperience.length > 0) {
    return structuredExperience;
  }

  return (experienceContext.section.blocks ?? [])
    .map((block, index) => {
      const title = String(block.title ?? "").trim();
      const description = blockToText(block);
      const contentLines = omitLeadingLine(toSentenceList(description), title);
      const role = title || contentLines[0] || `Experience ${index + 1}`;
      const company =
        contentLines.find(
          (line) => line.trim().toLowerCase() !== role.trim().toLowerCase(),
        ) ||
        contentLines[0] ||
        role ||
        "Experience";

      if (!role && !company && !description) {
        return null;
      }

      return {
        ...buildLinkedMeta(
          experienceContext,
          resolveItemId({
            rawId: undefined,
            blockId: block.id,
            context: experienceContext,
            family: "experience",
            index,
          }),
        ),
        role,
        company,
        period: "Dates not set",
        location: "Location not set",
        ...(description ? { description } : {}),
        bullets: contentLines.slice(1),
      };
    })
    .filter((item): item is ResumeExperienceItem => item !== null);
}

function mapProjects(projectsContext?: SectionContext): ResumeData["projects"] {
  if (!projectsContext) {
    return [];
  }

  const structuredProjects = readStructured<IProjectItem>(projectsContext.section)
    .map((item, index) => {
      const name = String(item.name ?? item.title ?? "").trim();
      const meta = String(item.meta ?? item.subtitle ?? "").trim();
      const description = toPlainText(item.description ?? item.summary);

      if (!name && !description) {
        return null;
      }

      return {
        ...buildLinkedMeta(
          projectsContext,
          resolveItemId({
            rawId: item.id,
            context: projectsContext,
            family: "project",
            index,
          }),
        ),
        name: name || `Project ${index + 1}`,
        meta,
        description: description || meta || "Project details pending.",
      };
    })
    .filter((item): item is ResumeProjectItem => item !== null);

  if (structuredProjects.length > 0) {
    return structuredProjects;
  }

  return (projectsContext.section.blocks ?? [])
    .map((block, index) => {
      const title = String(block.title ?? "").trim();
      const description = blockToText(block);

      if (!title && !description) {
        return null;
      }

      return {
        ...buildLinkedMeta(
          projectsContext,
          resolveItemId({
            rawId: undefined,
            blockId: block.id,
            context: projectsContext,
            family: "project",
            index,
          }),
        ),
        name: title || `Project ${index + 1}`,
        meta: "",
        description: description || "Project details pending.",
      };
    })
    .filter((item): item is ResumeProjectItem => item !== null);
}

function mapEducation(
  educationContext?: SectionContext,
): ResumeData["education"] {
  if (!educationContext) {
    return [];
  }

  const structuredEducation = readStructured<IEducationItem>(educationContext.section)
    .map((item, index) => {
      const degree = String(item.degree ?? "").trim();
      const field = String(item.fieldOfStudy ?? "").trim();
      const grade = String(item.grade ?? "").trim();
      const school = String(item.institution ?? "").trim();
      const period = formatRangeFromItem(item);

      if (!degree && !field && !school) {
        return null;
      }

      return {
        ...buildLinkedMeta(
          educationContext,
          resolveItemId({
            rawId: item.id,
            context: educationContext,
            family: "education",
            index,
          }),
        ),
        degree,
        ...(field ? { fieldOfStudy: field } : {}),
        ...(grade ? { grade } : {}),
        school,
        period: period || "Dates not set",
      };
    })
    .filter((item): item is ResumeEducationItem => item !== null);

  if (structuredEducation.length > 0) {
    return structuredEducation;
  }

  return (educationContext.section.blocks ?? [])
    .map((block, index) => {
      const title = String(block.title ?? "").trim();
      const description = blockToText(block);
      const contentLines = omitLeadingLine(toSentenceList(description), title);
      const degree = title || contentLines[0] || `Education ${index + 1}`;
      const school =
        contentLines.find(
          (line) => line.trim().toLowerCase() !== degree.trim().toLowerCase(),
        ) ||
        contentLines[0] ||
        degree ||
        "Institution";

      if (!degree && !school && !description) {
        return null;
      }

      return {
        ...buildLinkedMeta(
          educationContext,
          resolveItemId({
            rawId: undefined,
            blockId: block.id,
            context: educationContext,
            family: "education",
            index,
          }),
        ),
        degree,
        school,
        period: "Dates not set",
      };
    })
    .filter((item): item is ResumeEducationItem => item !== null);
}

function mapSkills(skillsContext?: SectionContext): {
  skills: string[];
  skillItems: ResumeSkillItem[];
} {
  if (!skillsContext) {
    return { skills: [], skillItems: [] };
  }

  const structuredSkills = readStructured<ISkillItem>(skillsContext.section)
    .map((item, index): ResumeSkillItem | null => {
      const name = String(item.name ?? "").trim();
      if (!name) {
        return null;
      }

      return {
        ...buildLinkedMeta(
          skillsContext,
          resolveItemId({
            rawId: item.id,
            context: skillsContext,
            family: "skill",
            index,
          }),
        ),
        name,
        level: String(item.level ?? "").trim() || undefined,
      };
    })
    .filter((item): item is ResumeSkillItem => item !== null);

  if (structuredSkills.length > 0) {
    return {
      skills: structuredSkills.map((item) => item.name),
      skillItems: structuredSkills,
    };
  }

  const fallbackSkills = fallbackSectionText(skillsContext.section)
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((name, index) => ({
      ...buildLinkedMeta(
        skillsContext,
        resolveItemId({
          rawId: undefined,
          context: skillsContext,
          family: "skill",
          index,
        }),
      ),
      name,
    }));

  return {
    skills: fallbackSkills.map((item) => item.name),
    skillItems: fallbackSkills,
  };
}

function mapLanguages(
  languagesContext?: SectionContext,
): ResumeData["languages"] {
  if (!languagesContext) {
    return [];
  }

  const structuredLanguages = readStructured<ILanguageItem>(languagesContext.section)
    .map((item, index) => {
      const name = String(item.name ?? "").trim();
      const level = String(item.level ?? "").trim();
      if (!name) {
        return null;
      }

      return {
        ...buildLinkedMeta(
          languagesContext,
          resolveItemId({
            rawId: item.id,
            context: languagesContext,
            family: "language",
            index,
          }),
        ),
        name,
        level: level || "Proficiency not set",
      };
    })
    .filter((item): item is ResumeData["languages"][number] => item !== null);

  if (structuredLanguages.length > 0) {
    return structuredLanguages;
  }

  return toSentenceList(fallbackSectionText(languagesContext.section)).map(
    (entry, index) => ({
      ...buildLinkedMeta(
        languagesContext,
        resolveItemId({
          rawId: undefined,
          context: languagesContext,
          family: "language",
          index,
        }),
      ),
      name: entry,
      level: "Proficiency not set",
    }),
  );
}

function mapAchievementItems(
  achievementContext?: SectionContext,
): ResumeTextListItem[] {
  if (!achievementContext) {
    return [];
  }

  const structuredAchievements = readStructured<IAchievementItem>(
    achievementContext.section,
  )
    .map((item, index) => {
      const text = String(item.text ?? "").trim();
      if (!text) {
        return null;
      }

      return {
        ...buildLinkedMeta(
          achievementContext,
          resolveItemId({
            rawId: item.id,
            context: achievementContext,
            family: "achievement",
            index,
          }),
        ),
        text,
      };
    })
    .filter((item): item is ResumeTextListItem => item !== null);

  if (structuredAchievements.length > 0) {
    return structuredAchievements;
  }

  return toSentenceList(fallbackSectionText(achievementContext.section)).map(
    (text, index) => ({
      ...buildLinkedMeta(
        achievementContext,
        resolveItemId({
          rawId: undefined,
          context: achievementContext,
          family: "achievement",
          index,
        }),
      ),
      text,
    }),
  );
}

function mapHobbyItems(hobbyContexts: SectionContext[]): ResumeHobbyItem[] {
  return hobbyContexts.flatMap((context) => {
    const structuredHobbies = readStructured<Record<string, unknown>>(context.section)
      .map((item, index) => {
        const name = readRecordText(item, "name", "text");
        if (!name) {
          return null;
        }

        return {
          ...buildLinkedMeta(
            context,
            resolveItemId({
              rawId: item.id,
              context,
              family: "hobby",
              index,
            }),
          ),
          name,
        };
      })
      .filter((item): item is ResumeHobbyItem => item !== null);

    if (structuredHobbies.length > 0) {
      return structuredHobbies;
    }

    return toSentenceList(fallbackSectionText(context.section)).map(
      (name, index) => ({
        ...buildLinkedMeta(
          context,
          resolveItemId({
            rawId: undefined,
            context,
            family: "hobby",
            index,
          }),
        ),
        name,
      }),
    );
  });
}

function mapCertifications(
  certificationsContext?: SectionContext,
): ResumeCertificationItem[] {
  if (!certificationsContext) {
    return [];
  }

  const structuredCertifications = readStructured<ICertificationItem>(
    certificationsContext.section,
  )
    .map((item, index) => {
      const extendedItem = item as ICertificationItem & {
        licenseNumber?: string | null;
      };
      const name = String(item.certificationName ?? "").trim();
      const issuer = String(item.issuingOrganization ?? "").trim();
      const issuedYear = formatByPrecision(item.issueDate, "year");
      const expiryYear = formatByPrecision(item.expirationDate ?? undefined, "year");
      const dateRange =
        issuedYear && expiryYear
          ? `${issuedYear} — ${expiryYear}`
          : issuedYear || (expiryYear ? `Expires ${expiryYear}` : "");
      const credentialId = String(
        item.credentialId ?? extendedItem.licenseNumber ?? "",
      ).trim();
      const meta = [dateRange, credentialId ? `Credential ID: ${credentialId}` : null]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .join(" · ");

      if (!name && !issuer) {
        return null;
      }

      return {
        ...buildLinkedMeta(
          certificationsContext,
          resolveItemId({
            rawId: item.id,
            context: certificationsContext,
            family: "certification",
            index,
          }),
        ),
        name: name || `Certification ${index + 1}`,
        ...(issuer ? { issuer } : {}),
        ...(meta ? { meta } : {}),
      };
    })
    .filter((item): item is ResumeCertificationItem => item !== null);

  if (structuredCertifications.length > 0) {
    return structuredCertifications;
  }

  return (certificationsContext.section.blocks ?? [])
    .map((block, index) => {
      const title = String(block.title ?? "").trim();
      const text = blockToText(block);
      const meta =
        title &&
        text &&
        title.localeCompare(text, undefined, { sensitivity: "accent" }) !== 0
          ? text
          : "";

      if (!title && !text) {
        return null;
      }

      return {
        ...buildLinkedMeta(
          certificationsContext,
          resolveItemId({
            rawId: undefined,
            blockId: block.id,
            context: certificationsContext,
            family: "certification",
            index,
          }),
        ),
        name: title || text || `Certification ${index + 1}`,
        ...(meta ? { meta } : {}),
      };
    })
    .filter((item): item is ResumeCertificationItem => item !== null);
}

function mapAffiliations(
  affiliationContexts: SectionContext[],
): ResumeAffiliationItem[] {
  return affiliationContexts.flatMap((context) => {
    const structuredAffiliations = readStructured<IAffiliationItem>(context.section)
      .map((item, index) => {
        const organizationName = String(item.organizationName ?? "").trim();
        const roleOrMembershipType = String(
          item.roleOrMembershipType ?? "",
        ).trim();
        const notes = toPlainText(item.notes);
        const dateRange = formatRangeFromItem(item);

        if (!organizationName && !roleOrMembershipType && !notes) {
          return null;
        }

        return {
          ...buildLinkedMeta(
            context,
            resolveItemId({
              rawId: item.id,
              context,
              family: "affiliation",
              index,
            }),
          ),
          organizationName: organizationName || `Affiliation ${index + 1}`,
          ...(roleOrMembershipType ? { roleOrMembershipType } : {}),
          ...(dateRange ? { dateRange } : {}),
          ...(notes ? { notes } : {}),
        };
      })
      .filter((item): item is ResumeAffiliationItem => item !== null);

    if (structuredAffiliations.length > 0) {
      return structuredAffiliations;
    }

    return (context.section.blocks ?? [])
      .map((block, index) => {
        const title = String(block.title ?? "").trim();
        const text = blockToText(block);
        const notes =
          title &&
          text &&
          title.localeCompare(text, undefined, { sensitivity: "accent" }) !== 0
            ? text
            : "";

        if (!title && !text) {
          return null;
        }

        return {
          ...buildLinkedMeta(
            context,
            resolveItemId({
              rawId: undefined,
              blockId: block.id,
              context,
              family: "affiliation",
              index,
            }),
          ),
          organizationName: title || text || `Affiliation ${index + 1}`,
          ...(notes ? { notes } : {}),
        };
      })
      .filter((item): item is ResumeAffiliationItem => item !== null);
  });
}

function mapTextSections(textContexts: SectionContext[]): ResumeTextSection[] {
  return textContexts
    .map((context, index) => {
      const text = fallbackSectionText(context.section);
      if (!text) {
        return null;
      }

      return {
        id: resolveItemId({
          rawId: context.section.id,
          context,
          family: "text-section",
          index,
        }),
        sectionId: context.sectionId,
        sectionType:
          context.sectionType === "additional_information"
            ? "additional_information"
            : "custom",
        sectionTitle: context.sectionTitle || "Additional Information",
        sectionOrder: context.sectionOrder,
        text,
      };
    })
    .filter((item): item is ResumeTextSection => item !== null);
}

export function mapCvDocumentToResumeData(doc: CvDocument): ResumeData {
  const contexts = createSectionContexts(doc);
  const profileContext = getFirstContext(contexts, "profile");
  const summaryContext = getFirstContext(contexts, "summary");
  const experienceContext = getFirstContext(contexts, "experience");
  const educationContext = getFirstContext(contexts, "education");
  const skillsContext = getFirstContext(contexts, "skills");
  const languagesContext = getFirstContext(contexts, "languages");
  const projectsContext = getFirstContext(contexts, "projects");
  const achievementsContext = getFirstContext(contexts, "achievements");
  const certificationsContext = getFirstContext(contexts, "certifications");
  const hobbiesContexts = getContexts(contexts, "hobbies");
  const affiliationContexts = getContexts(contexts, "affiliations");
  const textSectionContexts = contexts.filter(
    (context) =>
      context.sectionType === "additional_information" ||
      context.sectionType === "custom",
  );

  const profile = mapProfile(profileContext);
  const summary = mapSummary(summaryContext, doc);
  const { skills, skillItems } = mapSkills(skillsContext);
  const languages = mapLanguages(languagesContext);
  const experience = mapExperience(experienceContext);
  const projects = mapProjects(projectsContext);
  const education = mapEducation(educationContext);
  const achievementItems = mapAchievementItems(achievementsContext);
  const hobbyItems = mapHobbyItems(hobbiesContexts);
  const certifications = mapCertifications(certificationsContext);
  const affiliations = mapAffiliations(affiliationContexts);
  const textSections = mapTextSections(textSectionContexts);

  const metadata = [
    toMetaItem("Location", profile?.location, profileContext, "location"),
    toMetaItem("Portfolio", profile?.website, profileContext, "website"),
  ].filter((item): item is ResumeMetaItem => item !== null);

  const contact = [
    toMetaItem("Email", profile?.email, profileContext, "email"),
    toMetaItem("Phone", profile?.phone, profileContext, "phone"),
    toMetaItem("Web", profile?.website, profileContext, "website"),
    toMetaItem("LinkedIn", profile?.linkedin, profileContext, "linkedin"),
  ].filter((item): item is ResumeMetaItem => item !== null);

  return {
    name: String(profile?.name ?? "").trim() || doc.title || "Candidate name",
    title: String(profile?.desiredPosition ?? "").trim(),
    summary,
    photoUrl: String(profile?.photoUrl ?? "").trim() || undefined,
    metadata,
    contact,
    skills,
    skillItems,
    languages,
    experience,
    projects,
    education,
    achievements: achievementItems.map((item) => item.text),
    achievementItems,
    hobbies: hobbyItems.map((item) => item.name),
    hobbyItems,
    certifications,
    affiliations,
    textSections,
    profileSectionId: profileContext?.sectionId,
    summarySectionId: summaryContext?.sectionId,
    sectionIdsByType: buildSectionIdMap(contexts),
  };
}

export function hasRenderableResumeData(
  data: ResumeData | null | undefined,
): boolean {
  if (!data) {
    return false;
  }

  const hasIdentity = Boolean(String(data.name ?? "").trim());
  const hasBody =
    Boolean(String(data.summary ?? "").trim()) ||
    data.experience.length > 0 ||
    data.education.length > 0 ||
    data.skills.length > 0;

  return hasIdentity && hasBody;
}
