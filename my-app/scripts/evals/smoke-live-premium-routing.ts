import * as path from "node:path";
import { pathToFileURL } from "node:url";
import type { ProposalExecutionRoutingSummary } from "../../convex/generateProposalMutation";

type PremiumRoutingSmokeModel =
  | "chatgpt"
  | "mistral-medium-latest"
  | "mistral-large-latest"
  | "qwen3.7-max";

type SmokeCredentials = {
  openai: boolean;
  mistral: boolean;
  qwen: boolean;
  qwenUrl: boolean;
};

type SmokeRecord =
  | {
      status: "skipped";
      model: PremiumRoutingSmokeModel;
      reason: string;
    }
  | {
      status: "ok";
      model: PremiumRoutingSmokeModel;
      proposalId: string;
      requestedModelType: string | null;
      actualModelType: string | null;
      actualModelName: string | null;
      fallbackTriggerCode: string | null;
      routing: ProposalExecutionRoutingSummary | null;
      savedMetadata: unknown;
      contentPreview: string;
    }
  | {
      status: "failed";
      model: PremiumRoutingSmokeModel;
      error: string;
    };

function getSmokeRecordMetadataTags(record: SmokeRecord): string[] {
  if (record.status !== "ok") return [];
  const tags = (record.savedMetadata as { tags?: unknown } | null)?.tags;
  return Array.isArray(tags)
    ? tags.filter((tag): tag is string => typeof tag === "string")
    : [];
}

function getSmokeRecordMetadata(record: SmokeRecord): Record<string, unknown> {
  if (record.status !== "ok") return {};
  return record.savedMetadata && typeof record.savedMetadata === "object"
    ? (record.savedMetadata as Record<string, unknown>)
    : {};
}

const SUPPORTED_MODELS = [
  "chatgpt",
  "mistral-medium-latest",
  "mistral-large-latest",
  "qwen3.7-max",
] as const satisfies readonly PremiumRoutingSmokeModel[];

function isPremiumRoutingSmokeModel(
  value: string,
): value is PremiumRoutingSmokeModel {
  return SUPPORTED_MODELS.includes(value as PremiumRoutingSmokeModel);
}

function parseCsvList(rawValue: string): string[] {
  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parsePremiumRoutingSmokeModels(
  argv: string[],
): PremiumRoutingSmokeModel[] {
  const modelsArg = argv.find((arg) => arg.startsWith("--models="));
  if (!modelsArg) {
    return [...SUPPORTED_MODELS];
  }

  const requested = Array.from(
    new Set(parseCsvList(modelsArg.slice("--models=".length))),
  );
  const invalid = requested.filter((item) => !isPremiumRoutingSmokeModel(item));
  if (invalid.length > 0) {
    throw new Error(
      `Unsupported smoke model(s): ${invalid.join(", ")}. Supported models: ${SUPPORTED_MODELS.join(", ")}`,
    );
  }

  return requested as PremiumRoutingSmokeModel[];
}

export function parseRequirePremiumSuccess(argv: string[]): boolean {
  return argv.includes("--require-premium-success");
}

export function smokeRecordProvesPremiumSuccess(record: SmokeRecord): boolean {
  if (record.status !== "ok") return false;

  const tags = getSmokeRecordMetadataTags(record);
  const metadata = getSmokeRecordMetadata(record);
  return (
    record.routing?.attemptedPath === "premium path saved" &&
    record.routing?.executedPath === "structured" &&
    record.routing?.saveOutcome === "structured_saved" &&
    metadata.executed_path === "structured" &&
    metadata.save_outcome === "structured_saved" &&
    tags.includes("premium_cover_letter_path_v1") &&
    tags.includes("generation_path:premium_path_saved") &&
    metadata.premium_path_saved === true &&
    metadata.premium_validation_passed === true &&
    Object.prototype.hasOwnProperty.call(
      metadata,
      "premium_quality_shadow_passed",
    )
  );
}

export function resolvePremiumRoutingSmokeCredentials(
  env: NodeJS.ProcessEnv,
): SmokeCredentials {
  return {
    openai: Boolean(env.OPENAI_API_KEY?.trim()),
    mistral: Boolean(env.MISTRAL_API_KEY?.trim()),
    qwen: Boolean(env.QWEN_API_KEY?.trim()),
    qwenUrl: Boolean(
      env.QWEN_CHAT_COMPLETIONS_URL?.trim() || env.QWEN_BASE_URL?.trim(),
    ),
  };
}

export function getMissingCredentialReason(
  model: PremiumRoutingSmokeModel,
  credentials: SmokeCredentials,
): string | null {
  if (model === "chatgpt") {
    return credentials.openai ? null : "OPENAI_API_KEY unset";
  }

  if (model === "mistral-medium-latest" || model === "mistral-large-latest") {
    return credentials.mistral ? null : "MISTRAL_API_KEY unset";
  }

  if (!credentials.qwen) {
    return "QWEN_API_KEY unset";
  }
  if (!credentials.qwenUrl) {
    return "QWEN_CHAT_COMPLETIONS_URL/QWEN_BASE_URL unset";
  }
  return null;
}

function buildSyntheticProposalArgs(model: PremiumRoutingSmokeModel) {
  return {
    jobTitle: "Senior Frontend Engineer",
    jobDescription:
      "Lead React and TypeScript development across customer-facing product surfaces, maintain a shared design system, partner with product teams, and improve release consistency.",
    proposalType: "cover_letter" as const,
    modelType: model,
    voicePreset: "signature" as const,
    personalizationMode: "explicit_only" as const,
    personalizationRichness: "rich" as const,
    requestedLanguage: "auto" as const,
    resolvedLanguage: "en" as const,
    languageSource: "ui-fallback" as const,
    personalizationContext: {
      name: "Alex Martin",
      summary: "Frontend engineer focused on design systems.",
      topSkills: ["React", "TypeScript", "Design systems"],
      recentExperience: [
        {
          company: "Acme",
          position: "Senior Frontend Engineer",
          highlights: [
            "Led a design system migration used across four product squads.",
            "Improved release consistency across shared interface work.",
          ],
        },
      ],
      standoutAchievements: [
        "Improved release consistency across shared interface work.",
      ],
    },
  };
}

function createNoDbSmokeContext() {
  const mutationCalls: Array<{ ref: unknown; args: any }> = [];
  const profile = {
    _id: "profile_premium_routing_smoke",
    proposalVoicePreset: "signature",
    experience: [],
    skills: [],
    achievements: [],
  };

  return {
    ctx: {
      auth: {
        getUserIdentity: async () => ({
          subject: "premium-routing-smoke",
        }),
      },
      runQuery: async () => profile,
      runMutation: async (ref: unknown, args: any) => {
        mutationCalls.push({ ref, args });
        return "proposal_premium_routing_smoke";
      },
    },
    mutationCalls,
  };
}

async function runCredentialedModelSmoke(
  model: PremiumRoutingSmokeModel,
): Promise<SmokeRecord> {
  const { handleGenerateProposal } = await import(
    "../../convex/generateProposalMutation"
  );
  const { ctx, mutationCalls } = createNoDbSmokeContext();
  const result = await handleGenerateProposal(
    ctx,
    buildSyntheticProposalArgs(model),
  );
  const storeMutation = mutationCalls.at(-1)?.args;

  return {
    status: "ok",
    model,
    proposalId: result.proposalId,
    requestedModelType: result.requestedModelType ?? null,
    actualModelType: result.actualModelType ?? null,
    actualModelName: result.actualModelName ?? null,
    fallbackTriggerCode: result.fallbackTriggerCode ?? null,
    routing: result.routing ?? null,
    savedMetadata: storeMutation?.metadata ?? null,
    contentPreview: result.proposalContent.slice(0, 240),
  };
}

export async function runPremiumRoutingSmoke(args: {
  models: PremiumRoutingSmokeModel[];
  env?: NodeJS.ProcessEnv;
}): Promise<SmokeRecord[]> {
  const env = args.env ?? process.env;
  if (env.PROPOSAL_PREMIUM_ROUTING_LIVE !== "1") {
    return args.models.map((model) => ({
      status: "skipped",
      model,
      reason: "PROPOSAL_PREMIUM_ROUTING_LIVE=1 required",
    }));
  }

  const credentials = resolvePremiumRoutingSmokeCredentials(env);
  const records: SmokeRecord[] = [];
  for (const model of args.models) {
    const missingCredentialReason = getMissingCredentialReason(
      model,
      credentials,
    );
    if (missingCredentialReason) {
      records.push({
        status: "skipped",
        model,
        reason: missingCredentialReason,
      });
      continue;
    }

    try {
      records.push(await runCredentialedModelSmoke(model));
    } catch (error) {
      records.push({
        status: "failed",
        model,
        error: error instanceof Error ? error.stack ?? error.message : String(error),
      });
    }
  }

  return records;
}

function printHelp(): void {
  console.log(
    [
      "Live premium proposal routing smoke",
      "",
      "Usage:",
      "  PROPOSAL_PREMIUM_ROUTING_LIVE=1 rtk npx tsx scripts/evals/smoke-live-premium-routing.ts [--models=chatgpt,mistral-medium-latest,mistral-large-latest,qwen3.7-max] [--require-premium-success]",
      "",
      "This script does not load .env and does not touch Convex DB data.",
      "It only uses provider credentials already present in process.env.",
      "When --require-premium-success is passed, the command exits non-zero unless every requested model proves premium success in routing and saved metadata.",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) {
    printHelp();
    return;
  }

  const models = parsePremiumRoutingSmokeModels(argv);
  const requirePremiumSuccess = parseRequirePremiumSuccess(argv);
  const records = await runPremiumRoutingSmoke({ models });
  console.log(
    JSON.stringify(
      {
        records,
        ...(requirePremiumSuccess
          ? {
              premiumSuccessAssertions: records.map((record) => ({
                model: record.model,
                passed: smokeRecordProvesPremiumSuccess(record),
              })),
            }
          : {}),
      },
      null,
      2,
    ),
  );

  if (
    records.some((record) => record.status === "failed") ||
    (requirePremiumSuccess &&
      records.some((record) => !smokeRecordProvesPremiumSuccess(record)))
  ) {
    process.exitCode = 1;
  }
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  void main().catch((error) => {
    console.error(
      "Premium routing smoke failed:",
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
    process.exit(1);
  });
}
