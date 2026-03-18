import { z } from "zod";

/**
 * Strict experience item schema with optional per-field confidences.
 * Defaults: empty strings for required text fields, nulls for nullable fields,
 * arrays default to [].
 */
// pipeline-note: strictProfileAdapter.ts and canonicalize.ts must conform to
// this schema. Any new profile fields/confidence slots belong here first so the
// rest of the pipeline compiles against the same contract.
const ConfidenceNullable = z.number().min(0).max(1).nullable().default(null);

const CandidateSourceSchema = z.enum([
  "llm",
  "heuristic",
  "ner",
  "validator",
  "manual",
  "fallback",
  "unknown",
]);

const FieldProvenanceSchema = z
  .object({
    source: CandidateSourceSchema.nullable().optional(),
    section: z.string().nullable().optional(),
    bonusApplied: z.boolean().optional(),
  })
  .partial();

export const StrictExperienceItemSchema = z.object({
  company: z.string().default(""),
  position: z.string().default(""),
  startDate: z.string().nullable().default(null),
  endDate: z.string().nullable().default(null),
  isCurrent: z.boolean().default(false),
  achievements: z.array(z.string()).default([]),
  responsibilities: z.string().nullable().default(null),
  confidences: z
    .object({
      company: ConfidenceNullable,
      position: ConfidenceNullable,
      startDate: ConfidenceNullable,
      endDate: ConfidenceNullable,
      isCurrent: ConfidenceNullable,
      achievements: ConfidenceNullable,
      responsibilities: ConfidenceNullable,
    })
    .optional(),
  provenance: z
    .object({
      company: FieldProvenanceSchema.optional(),
      position: FieldProvenanceSchema.optional(),
      startDate: FieldProvenanceSchema.optional(),
      endDate: FieldProvenanceSchema.optional(),
      isCurrent: FieldProvenanceSchema.optional(),
      achievements: FieldProvenanceSchema.optional(),
      responsibilities: FieldProvenanceSchema.optional(),
    })
    .optional(),
});

export const StrictEducationItemSchema = z.object({
  institution: z.string().default(""),
  area: z.string().default(""),
  studyType: z.string().default(""),
  startDate: z.string().nullable().default(null),
  endDate: z.string().nullable().default(null),
  score: z.string().default(""),
  location: z.string().default(""),
  achievements: z.array(z.string()).default([]),
  confidences: z
    .object({
      institution: ConfidenceNullable,
      area: ConfidenceNullable,
      studyType: ConfidenceNullable,
      startDate: ConfidenceNullable,
      endDate: ConfidenceNullable,
      score: ConfidenceNullable,
      location: ConfidenceNullable,
      achievements: ConfidenceNullable,
    })
    .optional(),
  provenance: z
    .object({
      institution: FieldProvenanceSchema.optional(),
      area: FieldProvenanceSchema.optional(),
      studyType: FieldProvenanceSchema.optional(),
      startDate: FieldProvenanceSchema.optional(),
      endDate: FieldProvenanceSchema.optional(),
      score: FieldProvenanceSchema.optional(),
      location: FieldProvenanceSchema.optional(),
      achievements: FieldProvenanceSchema.optional(),
    })
    .optional(),
});

export const StrictSkillItemSchema = z.object({
  name: z.string().default(""),
  level: z.string().nullable().default(null),
  confidences: z
    .object({
      name: ConfidenceNullable,
      level: ConfidenceNullable,
    })
    .optional(),
  provenance: z
    .object({
      name: FieldProvenanceSchema.optional(),
      level: FieldProvenanceSchema.optional(),
    })
    .optional(),
});

export const StrictLanguageItemSchema = z.object({
  language: z.string().default(""),
  fluency: z.string().default(""),
  confidences: z
    .object({
      language: ConfidenceNullable,
      fluency: ConfidenceNullable,
    })
    .optional(),
  provenance: z
    .object({
      language: FieldProvenanceSchema.optional(),
      fluency: FieldProvenanceSchema.optional(),
    })
    .optional(),
});

export const StrictProfileSchema = z.object({
  name: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
  experience: z.array(StrictExperienceItemSchema).default([]),
  achievements: z.array(z.string()).default([]),
  education: z.array(StrictEducationItemSchema).default([]),
  skills: z.array(StrictSkillItemSchema).default([]),
  languages: z.array(StrictLanguageItemSchema).default([]),
  confidences: z.object({
    name: ConfidenceNullable,
    email: ConfidenceNullable,
    phone: ConfidenceNullable,
    location: ConfidenceNullable,
  }),
  provenance: z
    .object({
      name: FieldProvenanceSchema.optional(),
      email: FieldProvenanceSchema.optional(),
      phone: FieldProvenanceSchema.optional(),
      location: FieldProvenanceSchema.optional(),
      achievements: FieldProvenanceSchema.optional(),
    })
    .optional(),
});

export type StrictProfile = z.infer<typeof StrictProfileSchema>;
export type StrictExperienceItem = z.infer<typeof StrictExperienceItemSchema>;
export type StrictEducationItem = z.infer<typeof StrictEducationItemSchema>;
export type StrictSkillItem = z.infer<typeof StrictSkillItemSchema>;
export type StrictLanguageItem = z.infer<typeof StrictLanguageItemSchema>;
export type CandidateSource = z.infer<typeof CandidateSourceSchema>;
export type FieldProvenance = z.infer<typeof FieldProvenanceSchema>;
