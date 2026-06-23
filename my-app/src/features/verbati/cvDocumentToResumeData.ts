/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unused-vars -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { formatByPrecision, formatRangeFromItem } from "../../lib/date-utils";
import {
  deriveResponsibilityBullets,
  projectResponsibilitiesForWorkshop,
  projectRichTextForWorkshop,
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
  SkillCategory,
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
  WorkshopResponsibilitiesRichContent,
} from "./resume/resume.types";

type ResumeDataMappingOptions = {
  includeDrafts?: boolean;
};

function readProfileImageMetadata(doc: CvDocument): {
  photoSize?: ResumeData["photoSize"];
  photoFit?: ResumeData["photoFit"];
} {
  const source =
    doc.metadata &&
    typeof doc.metadata.profileImage === "object" &&
    doc.metadata.profileImage
      ? (doc.metadata.profileImage as Record<string, unknown>)
      : {};
  return {
    photoSize:
      source.size === "small" || source.size === "medium" || source.size === "large"
        ? source.size
        : undefined,
    photoFit:
      source.fit === "contain" || source.fit === "cover" ? source.fit : undefined,
  };
}

const DRAFT_EMPTY_RESPONSIBILITY_BULLET = "__draft_empty_responsibility_bullet__";
const DRAFT_EMPTY_EXPERIENCE_DESCRIPTION =
  "__draft_empty_experience_description__";

type ResponsibilityProjection = ReturnType<typeof projectResponsibilitiesForWorkshop>;

function isDraftResponsibilityBullet(value: unknown): boolean {
  const text = String(value ?? "");
  return text === DRAFT_EMPTY_RESPONSIBILITY_BULLET || !text.trim();
}

function richWithDraftResponsibilityBullets(args: {
  projection: ResponsibilityProjection;
  draftBullets: string[] | null;
  includeDrafts?: boolean;
}): WorkshopResponsibilitiesRichContent {
  const rich = { blocks: [...args.projection.rich.blocks] };
  if (!args.includeDrafts || !args.draftBullets || args.draftBullets.length === 0) {
    return rich;
  }

  const canonicalBulletCount = args.projection.bullets.length;
  const missingDrafts = args.draftBullets
    .slice(canonicalBulletCount)
    .filter(isDraftResponsibilityBullet);
  if (missingDrafts.length === 0) {
    return rich;
  }

  const draftItems = missingDrafts.map(() => ({ runs: [{ text: "" }] }));
  const lastBlock = rich.blocks[rich.blocks.length - 1];
  if (lastBlock?.kind === "bullet_list") {
    rich.blocks[rich.blocks.length - 1] = {
      ...lastBlock,
      items: [...lastBlock.items, ...draftItems],
    };
    return rich;
  }

  rich.blocks.push({
    kind: "bullet_list",
    items: draftItems,
  });
  return rich;
}

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
  draftFieldKey?: string,
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
    ...(draftFieldKey ? { draftFieldKey } : {}),
  };
}

function toDraftableMetaItem(
  label: string,
  value: string | undefined | null,
  context: SectionContext | undefined,
  itemId: string,
  draftContactFields: ReadonlySet<string>,
): ResumeMetaItem | null {
  const item = toMetaItem(label, value, context, itemId);
  if (item) {
    return item;
  }

  if (!draftContactFields.has(itemId)) {
    return null;
  }

  return {
    label,
    value: "",
    itemId,
    sectionId: context?.sectionId,
    sectionType: context?.sectionType,
    draftFieldKey: itemId,
  };
}

function readProfileWebsite(profile: IProfileItem | null | undefined): string | undefined {
  const canonical = String(profile?.website ?? "").trim();
  if (canonical) return canonical;
  const profileRecord = profile as Record<string, unknown> | null | undefined;
  const legacyAliases = ["portfolio", "web", "site"] as const;
  for (const alias of legacyAliases) {
    const value = String(profileRecord?.[alias] ?? "").trim();
    if (value) return value;
  }
  return undefined;
}

function mapProfile(
  profileContext?: SectionContext,
): IProfileItem | undefined {
  return readStructured<IProfileItem>(profileContext?.section)[0];
}

function readSummarySource(
  summaryContext?: SectionContext,
  doc?: CvDocument,
): unknown {
  const summaryItem = readStructured<ISummaryItem>(summaryContext?.section)[0];
  return summaryItem?.summary ?? doc?.summary ?? summaryContext?.section?.blocks[0]?.content;
}

function mapSummary(summaryContext?: SectionContext, doc?: CvDocument): string {
  return (
    toPlainText(readSummarySource(summaryContext, doc)) ||
    fallbackSectionText(summaryContext?.section)
  );
}

function mapRichTextContent(value: unknown): WorkshopResponsibilitiesRichContent | undefined {
  const rich = projectResponsibilitiesForWorkshop(value).rich;
  return rich.blocks.length > 0 ? rich : undefined;
}

function isSectionDraftEmpty(section: CvSection): boolean {
  return (
    !fallbackSectionText(section) &&
    readStructured<Record<string, unknown>>(section).every((item) =>
      Object.entries(item)
        .filter(([key]) => key !== "id")
        .every(([, value]) => !toPlainText(value)),
    )
  );
}

function mapExperience(
  experienceContext?: SectionContext,
  options: ResumeDataMappingOptions = {},
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
      const fallbackBullets = deriveResponsibilityBullets({
        hasResponsibilitiesField: false,
        responsibilityBullets: item.responsibilityBullets,
      });
      const draftResponsibilityBulletCount = Number(
        (item as unknown as Record<string, unknown>).__draftResponsibilityBulletCount ?? 0,
      );
      const draftResponsibilityBullets =
        options.includeDrafts && Array.isArray(item.responsibilityBullets)
          ? item.responsibilityBullets.map((entry) => {
              const text = String(entry ?? "");
              return text === DRAFT_EMPTY_RESPONSIBILITY_BULLET ? "" : text;
            })
          : null;
      if (
        draftResponsibilityBullets &&
        Number.isFinite(draftResponsibilityBulletCount) &&
        draftResponsibilityBulletCount > draftResponsibilityBullets.length
      ) {
        while (draftResponsibilityBullets.length < draftResponsibilityBulletCount) {
          draftResponsibilityBullets.push("");
        }
      }
      const responsibilitiesRich = richWithDraftResponsibilityBullets({
        projection: responsibilitiesProjection,
        draftBullets: draftResponsibilityBullets,
        includeDrafts: options.includeDrafts,
      });
      const bullets =
        draftResponsibilityBullets && draftResponsibilityBullets.length > 0
          ? draftResponsibilityBullets
          : responsibilitiesProjection.bullets.length > 0 ||
              responsibilitiesProjection.prose ||
              fallbackBullets.length === 0
            ? responsibilitiesProjection.bullets
            : fallbackBullets;
      const visibleBullets = options.includeDrafts
        ? bullets
        : bullets.filter(
            (bullet) =>
              bullet !== DRAFT_EMPTY_RESPONSIBILITY_BULLET &&
              String(bullet ?? "").trim(),
          );
      const hasDraftDescription = Boolean(
        (item as unknown as Record<string, unknown>).__draftDescription,
      );
      const description = [
        toPlainText(item.description),
        responsibilitiesProjection.prose,
      ]
        .filter(Boolean)
        .join("\n\n");
      const visibleDescription =
        description || (options.includeDrafts && hasDraftDescription
          ? DRAFT_EMPTY_EXPERIENCE_DESCRIPTION
          : "");
      const role = String(item.position ?? "").trim();
      const company = String(item.company ?? "").trim();
      const location = String(item.location ?? "").trim();
      const period = formatRangeFromItem(item);

      const includeDraftItem = Boolean(options.includeDrafts);

      if (!includeDraftItem && !role && !company && visibleBullets.length === 0 && !visibleDescription) {
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
        role,
        company,
        period,
        location,
        ...(visibleDescription ? { description: visibleDescription } : {}),
        bullets: visibleBullets.length > 0 || !includeDraftItem ? visibleBullets : [""],
        ...(responsibilitiesRich.blocks.length > 0
          ? { responsibilitiesRich }
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

function mapProjects(
  projectsContext?: SectionContext,
  options: ResumeDataMappingOptions = {},
): ResumeData["projects"] {
  if (!projectsContext) {
    return [];
  }

  const structuredProjects = readStructured<IProjectItem>(projectsContext.section)
    .map((item, index) => {
      const name = String(item.name ?? item.title ?? "").trim();
      const meta = String(item.meta ?? item.subtitle ?? "").trim();
      const descriptionSource = item.description ?? item.summary;
      const descriptionProjection = projectRichTextForWorkshop(descriptionSource);
      const description = [
        descriptionProjection.prose,
        ...descriptionProjection.bullets,
      ]
        .filter(Boolean)
        .join("\n") || toPlainText(descriptionSource);
      const descriptionRich = descriptionProjection.rich;

      if (!options.includeDrafts && !name && !description) {
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
        name,
        meta,
        description,
        ...(descriptionRich.blocks.length > 0 ? { descriptionRich } : {}),
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
  options: ResumeDataMappingOptions = {},
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

      if (!options.includeDrafts && !degree && !field && !school) {
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
        period,
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

function mapSkills(
  skillsContext?: SectionContext,
  options: ResumeDataMappingOptions = {},
): {
  skills: string[];
  skillCategories: NonNullable<ResumeData["skillCategories"]>;
  skillItems: ResumeSkillItem[];
} {
  if (!skillsContext) {
    return { skills: [], skillCategories: [], skillItems: [] };
  }

  const skillCategories = Array.isArray(skillsContext.section.skillCategories)
    ? (skillsContext.section.skillCategories as SkillCategory[])
        .map((category, order) => ({
          id: String(category.id ?? "").trim(),
          label: String(category.label ?? "").trim(),
          order,
          ...(category.source ? { source: category.source } : {}),
          ...(typeof category.locked === "boolean" ? { locked: category.locked } : {}),
        }))
        .filter((category) => category.id && category.label)
    : [];
  const categoryById = new Map(skillCategories.map((category) => [category.id, category]));

  const structuredSkills = readStructured<ISkillItem>(skillsContext.section)
    .map((item, index): ResumeSkillItem | null => {
      const name = String(item.name ?? "").trim();
      const category = item.categoryId ? categoryById.get(item.categoryId) : undefined;
      if (!options.includeDrafts && !name) {
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
        ...(item.bucket ? { bucket: item.bucket } : {}),
        ...(category
          ? {
              categoryId: category.id,
              categoryLabel: category.label,
              categoryOrder: category.order,
            }
          : {}),
      };
    })
    .filter((item): item is ResumeSkillItem => item !== null);

  if (structuredSkills.length > 0) {
    return {
      skills: structuredSkills.map((item) => item.name),
      skillCategories,
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
    skillCategories,
    skillItems: fallbackSkills,
  };
}

function mapLanguages(
  languagesContext?: SectionContext,
  options: ResumeDataMappingOptions = {},
): ResumeData["languages"] {
  if (!languagesContext) {
    return [];
  }

  const structuredLanguages = readStructured<ILanguageItem>(languagesContext.section)
    .map((item, index) => {
      const name = String(item.name ?? "").trim();
      const level = String(item.level ?? "").trim();
      if (!options.includeDrafts && !name) {
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
        level,
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
  options: ResumeDataMappingOptions = {},
): ResumeTextListItem[] {
  if (!achievementContext) {
    return [];
  }

  const structuredAchievements = readStructured<IAchievementItem>(
    achievementContext.section,
  )
    .map((item, index) => {
      const text = String(item.text ?? "").trim();
      if (!options.includeDrafts && !text) {
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

function mapHobbyItems(
  hobbyContexts: SectionContext[],
  options: ResumeDataMappingOptions = {},
): ResumeHobbyItem[] {
  return hobbyContexts.flatMap((context) => {
    const structuredHobbies = readStructured<Record<string, unknown>>(context.section)
      .map((item, index) => {
        const name = readRecordText(item, "name", "text");
        if (!options.includeDrafts && !name) {
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
  options: ResumeDataMappingOptions = {},
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

      if (!options.includeDrafts && !name && !issuer) {
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
        name,
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
  options: ResumeDataMappingOptions = {},
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

        if (!options.includeDrafts && !organizationName && !roleOrMembershipType && !notes) {
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
          organizationName,
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

function mapTextSections(
  textContexts: SectionContext[],
  options: ResumeDataMappingOptions = {},
): ResumeTextSection[] {
  return textContexts
    .map((context, index) => {
      const text = fallbackSectionText(context.section);
      if (!options.includeDrafts && !text) {
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

export function mapCvDocumentToResumeData(
  doc: CvDocument,
  options: ResumeDataMappingOptions = {},
): ResumeData {
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
  const summarySource = readSummarySource(summaryContext, doc);
  const summary = mapSummary(summaryContext, doc);
  const summaryRich = mapRichTextContent(summarySource);
  const { skills, skillCategories, skillItems } = mapSkills(skillsContext, options);
  const languages = mapLanguages(languagesContext, options);
  const experience = mapExperience(experienceContext, options);
  const projects = mapProjects(projectsContext, options);
  const education = mapEducation(educationContext, options);
  const achievementItems = mapAchievementItems(achievementsContext, options);
  const hobbyItems = mapHobbyItems(hobbiesContexts, options);
  const certifications = mapCertifications(certificationsContext, options);
  const affiliations = mapAffiliations(affiliationContexts, options);
  const textSections = mapTextSections(textSectionContexts, options);
  const draftSectionIds = options.includeDrafts
    ? contexts
        .filter((context) => isSectionDraftEmpty(context.section))
        .map((context) => context.sectionId)
    : [];
  const profileDraftContactFields =
    profile && Array.isArray((profile as Record<string, unknown>).__draftContactFields)
      ? ((profile as Record<string, unknown>).__draftContactFields as unknown[])
      : [];
  const draftContactFields: ReadonlySet<string> =
    options.includeDrafts && profileDraftContactFields.length > 0
      ? new Set(
          profileDraftContactFields.map((field: unknown) => String(field)).filter(Boolean),
        )
      : new Set<string>();

  const metadata: ResumeMetaItem[] = [];

  const contact = [
    toDraftableMetaItem(
      "Email",
      profile?.email,
      profileContext,
      "email",
      draftContactFields,
    ),
    toDraftableMetaItem(
      "Phone",
      profile?.phone,
      profileContext,
      "phone",
      draftContactFields,
    ),
    toDraftableMetaItem(
      "Location",
      profile?.location,
      profileContext,
      "location",
      draftContactFields,
    ),
    toDraftableMetaItem(
      "LinkedIn",
      profile?.linkedin,
      profileContext,
      "linkedin",
      draftContactFields,
    ),
    toDraftableMetaItem(
      "Website",
      readProfileWebsite(profile),
      profileContext,
      "website",
      draftContactFields,
    ),
  ].filter((item): item is ResumeMetaItem => item !== null);

  const profileName = String(profile?.name ?? "").trim();
  const profileImageMetadata = readProfileImageMetadata(doc);
  const profilePhotoUrl = String(profile?.photoUrl ?? "").trim();

  return {
    name: profileName || (!profileContext ? doc.title || "Candidate name" : ""),
    title: String(profile?.desiredPosition ?? "").trim(),
    summary,
    ...(summaryRich ? { summaryRich } : {}),
    photoUrl: profilePhotoUrl || undefined,
    ...profileImageMetadata,
    metadata,
    contact,
    skills,
    skillCategories,
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
    draftSectionIds,
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
