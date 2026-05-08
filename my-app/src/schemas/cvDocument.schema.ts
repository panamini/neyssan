// my-app/src/schemas/cvDocument.schema.ts
import { z } from "zod";
// Zod runtime schemas for CV documents.
// Import the TypeScript CvDocument type only for return/annotation to avoid name collisions
import type { CvDocument as CvDocumentType } from "../types/cvDocument";
import type { RemirrorJSON } from "remirror";

/* -------------------------------------------------------------------------- */
/* Primitive / Utility Schemas                                                */
/* -------------------------------------------------------------------------- */

// ISODateString: permissive ISO 8601 string
export const ISODateStringSchema = z
  .string()
  .refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "Invalid ISO 8601 date string",
  });
export type ISODateStringType = z.infer<typeof ISODateStringSchema>;

// Remirror JSON node schema (recursive, permissive)
const RemirrorNodeSchema: z.ZodTypeAny = z.lazy(() =>
  z
    .object({
      type: z.string(),
      attrs: z.record(z.any()).optional(),
      content: z.array(RemirrorNodeSchema).optional(),
      marks: z.array(z.any()).optional(),
      text: z.string().optional(),
    })
    .passthrough(),
);
export const RemirrorJSONSchema = RemirrorNodeSchema;
export type RemirrorJSONType = z.infer<typeof RemirrorJSONSchema>;

/* -------------------------------------------------------------------------- */
/* Enums / Primitive Strings                                                   */
/* -------------------------------------------------------------------------- */
export const BlockTypeSchema = z.enum([
  "text",
  "heading",
  "list-item",
  "code",
  "image",
  "embed",
  "quote",
  "divider",
  "custom",
]);
export type BlockType = z.infer<typeof BlockTypeSchema>;

export const SectionTypeSchema = z.enum([
  "text",
  "experience",
  "education",
  "skills",
  "languages",
  "projects",
  "certifications",
  "summary",
  "achievements",
  "contact",
  "profile",
]);
export type SectionType = z.infer<typeof SectionTypeSchema>;

/* Auxiliary runtime enums as string unions via Zod (maps over enums for flexibility) */
export const DatePrecisionSchema = z.enum(["year", "month", "day"]);
export type DatePrecision = z.infer<typeof DatePrecisionSchema>;

export const LevelSchema = z.enum([
  "Beginner",
  "Elementary",
  "Intermediate",
  "Advanced",
  "Fluent",
]);
export type Level = z.infer<typeof LevelSchema>;

export const SkillBucketSchema = z.enum(["core", "secondary", "familiar"]);
export type SkillBucket = z.infer<typeof SkillBucketSchema>;

/* -------------------------------------------------------------------------- */
/* CvBlock (lenient & strict)                                                 */
/* -------------------------------------------------------------------------- */
const _CvBlockBase = z.object({
  id: z.string().optional(),
  title: z.string().optional(), // restored human-readable title
  type: BlockTypeSchema,
  content: RemirrorJSONSchema,
  plainText: z.string().optional(),
  order: z.number().int().optional(),
  attributes: z.record(z.any()).optional(),
});

export const CvBlockSchema = _CvBlockBase.passthrough(); // lenient
export const CvBlockSchemaStrict = _CvBlockBase.strict(); // strict
export type CvBlockSchemaOutput = z.infer<typeof CvBlockSchema>;
export type CvBlockSchemaStrictOutput = z.infer<typeof CvBlockSchemaStrict>;

/* -------------------------------------------------------------------------- */
/* Experience / Education Items                                               */
/* -------------------------------------------------------------------------- */
const _IExperienceItemBase = z.object({
  id: z.string().optional(),
  company: z.string(),
  position: z.string(),
  startDate: ISODateStringSchema,
  endDate: ISODateStringSchema.optional().nullable(),
  /* Precision metadata to preserve user intent (not required for legacy) */
  startDatePrecision: DatePrecisionSchema.optional(),
  endDatePrecision: DatePrecisionSchema.optional(),
  /* Canonical ongoing flag */
  isCurrent: z.boolean().optional(),
  /* Back-compat alias retained for old data */
  currentlyWorking: z.boolean().optional(),
  location: z.string().optional(),
  responsibilities: z
    .union([RemirrorJSONSchema, z.string(), z.array(z.string())])
    .optional(),
  responsibilityBullets: z.array(z.string()).optional(),
  __draftResponsibilityBulletCount: z.number().optional(),
  achievements: z.array(z.string()).optional(),
});
export const IExperienceItemSchema = _IExperienceItemBase.passthrough();
export const IExperienceItemSchemaStrict = _IExperienceItemBase.strict();
export type IExperienceItemSchemaOutput = z.infer<typeof IExperienceItemSchema>;

const _IEducationItemBase = z.object({
  id: z.string().optional(),
  institution: z.string(),
  degree: z.string().optional(),
  fieldOfStudy: z.string().optional(),
  startDate: ISODateStringSchema.optional(),
  endDate: ISODateStringSchema.optional().nullable(),
  /* Precision metadata to preserve user intent (not required for legacy) */
  startDatePrecision: DatePrecisionSchema.optional(),
  endDatePrecision: DatePrecisionSchema.optional(),
  /* Allow ongoing studies (optional) */
  isCurrent: z.boolean().optional(),
  grade: z.string().optional(),
  description: z.union([RemirrorJSONSchema, z.string()]).optional(),
});
export const IEducationItemSchema = _IEducationItemBase.passthrough();
export const IEducationItemSchemaStrict = _IEducationItemBase.strict();
export type IEducationItemSchemaOutput = z.infer<typeof IEducationItemSchema>;
// Backwards-compatible aliases (some files expect these names)
export const ExperienceItemSchema = IExperienceItemSchema;
export const EducationItemSchema = IEducationItemSchema;

/* -------------------------------------------------------------------------- */
/* Structured Content Union                                                   */
/* -------------------------------------------------------------------------- */
export const SummaryItemSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    label: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    linkedin: z.string().optional(),
    website: z.string().optional(),
    location: z.string().optional(),
    summary: z.union([RemirrorJSONSchema, z.string()]).optional(),
  })
  .passthrough();
export const SummaryItemSchemaStrict = SummaryItemSchema.strict();
export type SummaryItemSchemaOutput = z.infer<typeof SummaryItemSchema>;

/* Profile (personal details) */
export const ProfileItemSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    photoUrl: z.string().url().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    linkedin: z.string().optional(),
    website: z.string().optional(),
    desiredPosition: z.string().optional(),
    location: z.string().optional(),
    __draftContactFields: z.array(z.string()).optional(),
  })
  .passthrough();
export const ProfileItemSchemaStrict = ProfileItemSchema.strict();

/* Skill and Language items (name + 5-level string union) */
export const SkillItemSchema = z
  .object({
    id: z.string().optional(),
    name: z.string(),
    level: LevelSchema,
    bucket: SkillBucketSchema.optional(),
  })
  .passthrough();
export const SkillItemSchemaStrict = SkillItemSchema.strict();

export const HobbyItemSchema = z
  .object({
    id: z.string().optional(),
    name: z.string(),
  })
  .passthrough();
export const HobbyItemSchemaStrict = HobbyItemSchema.strict();

export const LanguageItemSchema = z
  .object({
    id: z.string().optional(),
    name: z.string(),
    level: LevelSchema,
  })
  .passthrough();
export const LanguageItemSchemaStrict = LanguageItemSchema.strict();

export const CertificationItemSchema = z
  .object({
    id: z.string().optional(),
    certificationName: z.string(),
    issuingOrganization: z.string().optional(),
    issueDate: ISODateStringSchema.optional(),
    expirationDate: ISODateStringSchema.optional().nullable(),
    credentialId: z.string().optional(),
  })
  .passthrough();
export const CertificationItemSchemaStrict = CertificationItemSchema.strict();

export const AffiliationItemSchema = z
  .object({
    id: z.string().optional(),
    organizationName: z.string(),
    roleOrMembershipType: z.string().optional(),
    startDate: ISODateStringSchema.optional(),
    endDate: ISODateStringSchema.optional().nullable(),
    isCurrent: z.boolean().optional(),
    notes: z.union([RemirrorJSONSchema, z.string()]).optional(),
  })
  .passthrough();
export const AffiliationItemSchemaStrict = AffiliationItemSchema.strict();

export const ProjectItemSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    name: z.string().optional(),
    meta: z.string().optional(),
    subtitle: z.string().optional(),
    description: z.union([RemirrorJSONSchema, z.string()]).optional(),
    summary: z.union([RemirrorJSONSchema, z.string()]).optional(),
  })
  .passthrough();
export const ProjectItemSchemaStrict = ProjectItemSchema.strict();

/* Achievements: structured items { id, text } */
export const AchievementItemSchema = z
  .object({
    id: z.string().optional(),
    text: z.string(),
  })
  .passthrough();
export const AchievementItemSchemaStrict = AchievementItemSchema.strict();

/* StructuredContent unions (per-section arrays) */
export const StructuredContentSchema = z.union([
  z.array(IExperienceItemSchema),
  z.array(IEducationItemSchema),
  z.array(SkillItemSchema),
  z.array(HobbyItemSchema),
  z.array(CertificationItemSchema),
  z.array(AffiliationItemSchema),
  z.array(ProjectItemSchema),
  z.array(LanguageItemSchema),
  z.array(ProfileItemSchema),
  z.array(SummaryItemSchema),
  z.array(AchievementItemSchema), // achievements as structured objects
]);

export const StructuredContentSchemaStrict = z.union([
  z.array(IExperienceItemSchemaStrict),
  z.array(IEducationItemSchemaStrict),
  z.array(SkillItemSchemaStrict),
  z.array(HobbyItemSchemaStrict),
  z.array(CertificationItemSchemaStrict),
  z.array(AffiliationItemSchemaStrict),
  z.array(ProjectItemSchemaStrict),
  z.array(LanguageItemSchemaStrict),
  z.array(ProfileItemSchemaStrict),
  z.array(SummaryItemSchemaStrict),
  z.array(AchievementItemSchemaStrict),
]);

/* -------------------------------------------------------------------------- */
/* CvSection (lenient & strict)                                               */
/* -------------------------------------------------------------------------- */
const _CvSectionBase = z.object({
  id: z.string().optional(),
  title: z.string(),
  type: SectionTypeSchema,
  blocks: z.array(CvBlockSchema),
  structuredContent: StructuredContentSchema.optional().nullable(),
  collapsed: z.boolean().optional(),
  order: z.number().int().optional(),
});
export const CvSectionSchema = _CvSectionBase.passthrough();
const _CvSectionBaseStrict = z.object({
  id: z.string().optional(),
  title: z.string(),
  type: SectionTypeSchema,
  blocks: z.array(CvBlockSchemaStrict),
  structuredContent: StructuredContentSchemaStrict.optional().nullable(),
  collapsed: z.boolean().optional(),
  order: z.number().int().optional(),
});
export const CvSectionSchemaStrict = _CvSectionBaseStrict.strict();
export type CvSectionSchemaOutput = z.infer<typeof CvSectionSchema>;
export type CvSectionSchemaStrictOutput = z.infer<typeof CvSectionSchemaStrict>;

/* -------------------------------------------------------------------------- */
/* CvMetadata (lenient & strict)                                              */
/* -------------------------------------------------------------------------- */
const _CvMetadataBase = z.object({
  createdAt: ISODateStringSchema,
  updatedAt: ISODateStringSchema,
  version: z.number().int(),
  locale: z.string().optional(),
  authorId: z.string().optional(),
  lastEditedBy: z.string().optional(),
  authoritativeResume: z
    .object({
      source: z.literal("mistral_v3"),
      trusted: z.boolean(),
      fallbackToLegacy: z.boolean(),
      normalized: z.record(z.unknown()).nullable(),
    })
    .optional(),
  importRecoverySession: z
    .object({
      status: z.enum(["pending", "completed"]),
      updatedAt: ISODateStringSchema,
      items: z.array(z.record(z.any())),
      overflowCount: z.number().int(),
      reviewLimit: z.number().int(),
      baseSectionsSnapshot: z.array(CvSectionSchema).optional(),
    })
    .passthrough()
    .optional(),
  verbatiStyle: z
    .object({
      familyId: z.string().optional(),
      layout: z.string().optional(),
      typography: z.string().optional(),
      palette: z.string().optional(),
      accentHex: z.string().optional(),
      resumeTemplateId: z.string().optional(),
    })
    .strict()
    .optional(),
  verbatiStyleSlotId: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional(),
  verbatiStyleSlotSource: z
    .union([z.literal("factory"), z.literal("settings")])
    .optional(),
  verbatiStyleSlotNameSnapshot: z.string().optional(),
  verbatiStyleBaseSnapshot: z
    .object({
      familyId: z.string().optional(),
      layout: z.string(),
      typography: z.string(),
      palette: z.string(),
      accentHex: z.string().optional(),
      resumeTemplateId: z.string().optional(),
    })
    .strict()
    .optional(),
  documentStyleVersion: z.literal(1).optional(),
});
export const CvMetadataSchema = _CvMetadataBase.passthrough();
export const CvMetadataSchemaStrict = _CvMetadataBase.strict();
export type CvMetadataSchemaOutput = z.infer<typeof CvMetadataSchema>;

/* -------------------------------------------------------------------------- */
/* CvDocument (lenient & strict)                                              */
/* -------------------------------------------------------------------------- */
const _CvDocumentBase = z.object({
  id: z.string(),
  title: z.string(),
  metadata: CvMetadataSchema,
  sections: z.array(CvSectionSchema),
  tags: z.array(z.string()).optional(),
  summary: z.union([RemirrorJSONSchema, z.string()]).optional(),
});
const _CvDocumentBaseStrict = z.object({
  id: z.string(),
  title: z.string(),
  metadata: CvMetadataSchemaStrict,
  sections: z.array(CvSectionSchemaStrict),
  tags: z.array(z.string()).optional(),
  summary: z.union([RemirrorJSONSchema, z.string()]).optional(),
});
export const CvDocumentSchema: z.ZodType<CvDocumentType> =
  _CvDocumentBase.passthrough() as z.ZodType<CvDocumentType>;
export const CvDocumentSchemaStrict: z.ZodType<CvDocumentType> =
  _CvDocumentBaseStrict.strict() as z.ZodType<CvDocumentType>;
// Schema output types (avoid exporting names that clash with application TS interfaces)
export type CvDocumentSchemaOutput = z.infer<typeof CvDocumentSchema>;
export type CvDocumentSchemaStrictOutput = z.infer<
  typeof CvDocumentSchemaStrict
>;

/* -------------------------------------------------------------------------- */
/* Helper Parser Functions                                                     */
/* -------------------------------------------------------------------------- */

// Safe parse (returns { ok, value, error })
export function safeParseCvDocument(
  input: unknown,
): { ok: true; value: CvDocumentType } | { ok: false; error: z.ZodError } {
  const res = CvDocumentSchema.safeParse(input);
  if (res.success)
    return { ok: true, value: res.data as unknown as CvDocumentType };
  return { ok: false, error: res.error };
}
export function safeParseCvSection(input: unknown) {
  return CvSectionSchema.safeParse(input);
}
export function safeParseCvBlock(input: unknown) {
  return CvBlockSchema.safeParse(input);
}

// Strict parse (throws on invalid)
export function parseCvDocumentStrict(input: unknown): CvDocumentType {
  const parsed = CvDocumentSchemaStrict.parse(input);
  return parsed as unknown as CvDocumentType;
}
export function parseCvSectionStrict(input: unknown) {
  return CvSectionSchemaStrict.parse(input);
}
export function parseCvBlockStrict(input: unknown) {
  return CvBlockSchemaStrict.parse(input);
}

// Backwards-compatible aliases
export const validateCvDocument = safeParseCvDocument;
export const validateCvSection = safeParseCvSection;
export const validateCvBlock = safeParseCvBlock;

// Re-export TypeScript interfaces from the centralized types file so older imports
// that reference `../schemas/cvDocument.schema` for types continue to work.
// Prefer importing types from ../types/cvDocument in new code.
export type CvDocument = import("../types/cvDocument").CvDocument;
export type CvSection = import("../types/cvDocument").CvSection;
export type CvBlock = import("../types/cvDocument").CvBlock;
export type IExperienceItem = import("../types/cvDocument").IExperienceItem;
export type IEducationItem = import("../types/cvDocument").IEducationItem;
// SummaryItem isn't present in the TS types file; export it from the schema output
export type SummaryItem = SummaryItemSchemaOutput;
// Provide a permissive alias for "strict" TS consumers — in practice we use runtime parsing.
export type CvDocumentStrict = CvDocument;
export type CvSectionStrict = CvSection;
export type CvBlockStrict = CvBlock;
