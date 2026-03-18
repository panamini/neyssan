import { z } from "zod";

export const CandidateSourceSchema = z.enum([
  "llm",
  "heuristic",
  "ner",
  "validator",
  "manual",
  "fallback",
  "unknown",
]);

export const SpanSchema = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    text: z.string().optional(),
  })
  .refine((s) => s.end >= s.start, "span.end must be >= span.start");

export const CandidateTraceSchema = z.object({
  value: z.string().nullable(),
  conf: z.number().min(0).max(1).nullable(),
  source: CandidateSourceSchema,
  section: z.string().nullable().optional(),
  bonusApplied: z.boolean().optional(),
  span: SpanSchema.optional(),
});

export const FieldMetaSchema = z.object({
  conf: z.number().min(0).max(1).nullable().optional(),
  source: CandidateSourceSchema.optional(),
  section: z.string().nullable().optional(),
  span: SpanSchema.optional(),
  bonusApplied: z.boolean().optional(),
  collectedAt: z.string().datetime().optional(),
  traces: z.array(CandidateTraceSchema).optional(),
});

type FieldSchemaFactory = <T extends z.ZodTypeAny>(
  valueSchema: T
) => z.ZodObject<{
  value: z.ZodOptional<z.ZodNullable<T>>;
  meta: z.ZodOptional<typeof FieldMetaSchema>;
}>;

const makeFieldSchema: FieldSchemaFactory = (valueSchema) =>
  z.object({
    value: valueSchema.nullable().optional(),
    meta: FieldMetaSchema.optional(),
  });

const IdentifierSchema = z.string().min(1).optional();
const FieldStringSchema = makeFieldSchema(z.string().min(1));
const FieldLooseStringSchema = makeFieldSchema(z.string());
const FieldUrlSchema = makeFieldSchema(z.string().url());
const ISODateSchema = z.string().regex(/^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$/);
const FieldDateSchema = makeFieldSchema(ISODateSchema);
const FieldBooleanSchema = makeFieldSchema(z.boolean());

const BasicsSchema = z.object({
  name: FieldStringSchema,
  headline: FieldLooseStringSchema.optional(),
  email: FieldLooseStringSchema,
  phone: FieldLooseStringSchema,
  location: z
    .object({
      formatted: FieldLooseStringSchema.optional(),
      locality: FieldLooseStringSchema.optional(),
      region: FieldLooseStringSchema.optional(),
      country: FieldLooseStringSchema.optional(),
      postalCode: FieldLooseStringSchema.optional(),
      geo: z
        .object({
          latitude: FieldLooseStringSchema.optional(),
          longitude: FieldLooseStringSchema.optional(),
        })
        .optional(),
    })
    .optional(),
  summary: FieldLooseStringSchema.optional(),
  website: FieldUrlSchema.optional(),
  photoUrl: FieldUrlSchema.optional(),
  profiles: z
    .array(
      z.object({
        id: IdentifierSchema,
        network: FieldLooseStringSchema,
        username: FieldLooseStringSchema.optional(),
        url: FieldUrlSchema.optional(),
      })
    )
    .optional(),
});

const WorkItemSchema = z.object({
  id: IdentifierSchema,
  company: FieldLooseStringSchema,
  position: FieldLooseStringSchema,
  employmentType: FieldLooseStringSchema.optional(),
  location: FieldLooseStringSchema.optional(),
  startDate: FieldDateSchema.optional(),
  endDate: FieldDateSchema.optional(),
  isCurrent: FieldBooleanSchema.optional(),
  remote: FieldBooleanSchema.optional(),
  summary: FieldLooseStringSchema.optional(),
  highlights: z.array(FieldLooseStringSchema).optional(),
  achievements: z.array(FieldLooseStringSchema).optional(),
  url: FieldUrlSchema.optional(),
});

const VolunteerItemSchema = z.object({
  id: IdentifierSchema,
  organization: FieldLooseStringSchema,
  position: FieldLooseStringSchema.optional(),
  startDate: FieldDateSchema.optional(),
  endDate: FieldDateSchema.optional(),
  summary: FieldLooseStringSchema.optional(),
  highlights: z.array(FieldLooseStringSchema).optional(),
});

const EducationItemSchema = z.object({
  id: IdentifierSchema,
  institution: FieldLooseStringSchema,
  area: FieldLooseStringSchema.optional(),
  studyType: FieldLooseStringSchema.optional(),
  startDate: FieldDateSchema.optional(),
  endDate: FieldDateSchema.optional(),
  score: FieldLooseStringSchema.optional(),
  location: FieldLooseStringSchema.optional(),
  achievements: z.array(FieldLooseStringSchema).optional(),
});

const ProjectItemSchema = z.object({
  id: IdentifierSchema,
  name: FieldLooseStringSchema,
  role: FieldLooseStringSchema.optional(),
  startDate: FieldDateSchema.optional(),
  endDate: FieldDateSchema.optional(),
  url: FieldUrlSchema.optional(),
  summary: FieldLooseStringSchema.optional(),
  highlights: z.array(FieldLooseStringSchema).optional(),
  technologies: z.array(FieldLooseStringSchema).optional(),
});

const PublicationItemSchema = z.object({
  id: IdentifierSchema,
  name: FieldLooseStringSchema,
  publisher: FieldLooseStringSchema.optional(),
  releaseDate: FieldDateSchema.optional(),
  url: FieldUrlSchema.optional(),
  summary: FieldLooseStringSchema.optional(),
});

const AwardItemSchema = z.object({
  id: IdentifierSchema,
  title: FieldLooseStringSchema,
  awarder: FieldLooseStringSchema.optional(),
  date: FieldDateSchema.optional(),
  summary: FieldLooseStringSchema.optional(),
});

const CertificateItemSchema = z.object({
  id: IdentifierSchema,
  title: FieldLooseStringSchema,
  issuer: FieldLooseStringSchema.optional(),
  date: FieldDateSchema.optional(),
  credentialId: FieldLooseStringSchema.optional(),
  url: FieldUrlSchema.optional(),
});

const SkillGroupSchema = z.object({
  id: IdentifierSchema,
  name: FieldLooseStringSchema,
  level: FieldLooseStringSchema.optional(),
  keywords: z.array(FieldLooseStringSchema).optional(),
});

const LanguageItemSchema = z.object({
  id: IdentifierSchema,
  language: FieldLooseStringSchema,
  fluency: FieldLooseStringSchema.optional(),
});

const InterestItemSchema = z.object({
  id: IdentifierSchema,
  name: FieldLooseStringSchema,
  keywords: z.array(FieldLooseStringSchema).optional(),
});

const ReferenceItemSchema = z.object({
  id: IdentifierSchema,
  name: FieldLooseStringSchema,
  position: FieldLooseStringSchema.optional(),
  company: FieldLooseStringSchema.optional(),
  email: FieldLooseStringSchema.optional(),
  phone: FieldLooseStringSchema.optional(),
  summary: FieldLooseStringSchema.optional(),
});

export const TelemetryEventSchema = z.object({
  slot: z.string(),
  winnerSource: CandidateSourceSchema.optional(),
  winnerConf: z.number().min(0).max(1).nullable().optional(),
  bonusApplied: z.boolean().optional(),
  section: z.string().optional(),
  collectedAt: z.string().datetime().optional(),
});

export const ConfidenceSummarySchema = z.object({
  slot: z.string(),
  conf: z.number().min(0).max(1).nullable(),
  source: CandidateSourceSchema.optional(),
  lastUpdatedAt: z.string().datetime().optional(),
});

const MetaSchema = z.object({
  generatedAt: z.string().datetime().optional(),
  revisionId: z.string().optional(),
  confidenceSummary: z.array(ConfidenceSummarySchema).optional(),
  telemetry: z.array(TelemetryEventSchema).optional(),
});

export const CanonicalCVSchema = z.object({
  basics: BasicsSchema,
  work: z.array(WorkItemSchema).optional(),
  volunteer: z.array(VolunteerItemSchema).optional(),
  education: z.array(EducationItemSchema).optional(),
  projects: z.array(ProjectItemSchema).optional(),
  publications: z.array(PublicationItemSchema).optional(),
  awards: z.array(AwardItemSchema).optional(),
  certificates: z.array(CertificateItemSchema).optional(),
  skills: z.array(SkillGroupSchema).optional(),
  languages: z.array(LanguageItemSchema).optional(),
  interests: z.array(InterestItemSchema).optional(),
  references: z.array(ReferenceItemSchema).optional(),
  achievements: z.array(FieldLooseStringSchema).optional(),
  meta: MetaSchema.optional(),
});

export type CanonicalCV = z.infer<typeof CanonicalCVSchema>;
