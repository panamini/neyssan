import { buildStableHash } from "../../../src/modules/application-harness/fingerprints";
import type {
  JobDemandKindV1,
  JobDemandRequiredStateV1,
  JobDemandV1,
} from "../../../src/modules/evidence-graph/schema";
import { inferRequirementType } from "./canonicalJobs";

const DEMAND_NAMESPACE = "job-brief-demands";

type CanonicalJobBriefDemandFieldV1 =
  | "mustHaves"
  | "responsibilities"
  | "keywords";

type JobBriefDemandCandidateV1 = Readonly<{
  field: CanonicalJobBriefDemandFieldV1;
  kind: JobDemandKindV1;
  label: string;
  normalizedLabel: string;
  required: JobDemandRequiredStateV1;
  priority: number;
}>;

export type CanonicalJobBriefDemandInputV1 = Readonly<{
  jobId: string;
  mustHaves?: readonly string[];
  responsibilities?: readonly string[];
  keywords?: readonly string[];
}>;

export async function buildJobDemandsFromCanonicalJobBrief(
  input: CanonicalJobBriefDemandInputV1,
): Promise<readonly JobDemandV1[]> {
  assertInput(input);

  const candidates = [
    ...collectCandidates(input.mustHaves, "mustHaves"),
    ...collectCandidates(input.responsibilities, "responsibilities"),
    ...collectCandidates(input.keywords, "keywords"),
  ];
  const selectedByLabel = new Map<string, JobBriefDemandCandidateV1>();

  for (const candidate of candidates.sort(compareCandidates)) {
    if (!selectedByLabel.has(candidate.normalizedLabel)) {
      selectedByLabel.set(candidate.normalizedLabel, candidate);
    }
  }

  const demands = await Promise.all(
    [...selectedByLabel.values()].map(async (candidate) => {
      const hash = await buildStableHash({
        namespace: DEMAND_NAMESPACE,
        type: "job-demand",
        version: 1,
        input: {
          jobId: input.jobId.trim(),
          field: candidate.field,
          kind: candidate.kind,
          normalizedLabel: candidate.normalizedLabel,
          required: candidate.required,
        },
      });

      return {
        id: `job-demand:${hash}`,
        kind: candidate.kind,
        label: candidate.label,
        required: candidate.required,
        source: "job",
        sourcePath: `job.${candidate.field}`,
        version: 1,
      } satisfies JobDemandV1;
    }),
  );

  return demands.sort((left, right) => left.id.localeCompare(right.id));
}

function assertInput(input: CanonicalJobBriefDemandInputV1): void {
  if (!input || typeof input !== "object") {
    throw new TypeError(
      "buildJobDemandsFromCanonicalJobBrief requires an input object",
    );
  }
  if (typeof input.jobId !== "string" || !input.jobId.trim()) {
    throw new TypeError(
      "buildJobDemandsFromCanonicalJobBrief requires jobId",
    );
  }
  for (const field of [
    "mustHaves",
    "responsibilities",
    "keywords",
  ] as const) {
    if (input[field] !== undefined && !Array.isArray(input[field])) {
      throw new TypeError(
        `buildJobDemandsFromCanonicalJobBrief requires ${field} to be an array`,
      );
    }
  }
}

function collectCandidates(
  values: readonly string[] | undefined,
  field: CanonicalJobBriefDemandFieldV1,
): JobBriefDemandCandidateV1[] {
  if (!values) {
    return [];
  }

  return values.flatMap((value) => {
    if (typeof value !== "string") {
      return [];
    }
    const label = normalizeLabel(value);
    if (!label) {
      return [];
    }

    const semantics = resolveFieldSemantics(field, label);
    return [
      {
        field,
        label,
        normalizedLabel: label.normalize("NFKC").toLowerCase(),
        ...semantics,
      },
    ];
  });
}

function resolveFieldSemantics(
  field: CanonicalJobBriefDemandFieldV1,
  label: string,
): Pick<
  JobBriefDemandCandidateV1,
  "kind" | "required" | "priority"
> {
  if (field === "mustHaves") {
    return {
      kind: mapRequirementKind(inferRequirementType(label)),
      required: "required",
      priority: 0,
    };
  }
  if (field === "responsibilities") {
    return {
      kind: "responsibility",
      required: "unknown",
      priority: 1,
    };
  }
  return {
    kind: mapRequirementKind(inferRequirementType(label)),
    required: "preferred",
    priority: 2,
  };
}

function mapRequirementKind(
  type: ReturnType<typeof inferRequirementType>,
): JobDemandKindV1 {
  switch (type) {
    case "certification":
    case "education":
    case "experience":
    case "language":
    case "skill":
      return type;
    case "constraint":
      return "availability";
    case "tool":
      return "skill";
  }
}

function compareCandidates(
  left: JobBriefDemandCandidateV1,
  right: JobBriefDemandCandidateV1,
): number {
  return (
    left.normalizedLabel.localeCompare(right.normalizedLabel) ||
    left.priority - right.priority ||
    compareCodePoints(left.label, right.label)
  );
}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeLabel(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}
