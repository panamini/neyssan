import { Buffer } from "node:buffer";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import * as path from "node:path";

import { buildStableHash } from "../../src/modules/application-harness/fingerprints";

export type CoverLetterEvalPricedWriterModel =
  | "gpt-5.5"
  | "gpt-5.6-sol"
  | "gpt-5.6-terra"
  | "gpt-5.6-luna"
  | "mistral-medium-latest";

export type CoverLetterEvalTokenUsage = Readonly<{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}>;

export type CoverLetterEvalSdkVersions = Readonly<{
  openai: string;
  mistral: string;
  langchainMistral: string;
}>;

export type CoverLetterEvalSchemaEnforcementMode =
  | "openai_responses_json_schema_strict"
  | "mistral_prompt_contract_with_local_parser";

export type CoverLetterEvalPromptContract =
  | "provider_native_v1"
  | "quality_eval_2d_shared_v1";

export type CoverLetterEvalTransportInput = Readonly<{
  serializedRequest: string;
  systemPrompt: string | null;
  schemaTarget: Record<string, unknown>;
  schemaEnforcementMode: CoverLetterEvalSchemaEnforcementMode;
  promptContract: CoverLetterEvalPromptContract;
}>;

export type CoverLetterEvalTransportMetadata = Readonly<{
  version: "cover_letter_eval_transport_metadata_v1";
  requestProjectionHash: string;
  requestProjectionByteLength: number;
  requestProjectionScope: "application_controlled_request_projection_without_credentials_or_signal";
  systemPromptHash: string | null;
  schemaTargetHash: string;
  schemaEnforcementMode: CoverLetterEvalSchemaEnforcementMode;
  promptContract: CoverLetterEvalPromptContract;
}>;

export type CoverLetterEvalRunManifestEntry = Readonly<{
  version: "cover_letter_eval_run_manifest_entry_v1";
  caseId: string;
  provider: "openai" | "mistral";
  requestedModel: CoverLetterEvalPricedWriterModel;
  returnedModel: string | null;
  promptHash: string;
  promptHashScope: "effective_user_prompt";
  transport: CoverLetterEvalTransportMetadata;
  reasoningEffort: string | null;
  writerMaxOutputTokens: number;
  providerMaxRetries: number;
  tokenUsage: CoverLetterEvalTokenUsage | null;
  observedCostUpperBoundUsd: number | null;
  sdkVersions: CoverLetterEvalSdkVersions;
  artifactHash: string;
  provenanceHash: string | null;
}>;

export type CoverLetterEvalRunManifest = Readonly<{
  version: "cover_letter_eval_run_manifest_v1";
  cohortId: string;
  runId: string;
  sourceRef: string;
  plannedProviderCalls: number;
  providerMaxRetries: number;
  maxRepairs: number;
  writerMaxOutputTokens: number;
  entries: readonly CoverLetterEvalRunManifestEntry[];
}>;

const SHORT_CONTEXT_RATES_USD_PER_MILLION = Object.freeze({
  "gpt-5.5": { input: 5, output: 30 },
  "gpt-5.6-sol": { input: 5, output: 30 },
  "gpt-5.6-terra": { input: 2.5, output: 15 },
  "gpt-5.6-luna": { input: 1, output: 6 },
  "mistral-medium-latest": { input: 1.5, output: 7.5 },
} as const satisfies Record<
  CoverLetterEvalPricedWriterModel,
  Readonly<{ input: number; output: number }>
>);

function roundUsd(value: number): number {
  return Number(value.toFixed(12));
}

export function calculateCoverLetterEvalObservedCostUpperBound(args: {
  writerModel: CoverLetterEvalPricedWriterModel;
  tokenUsage: CoverLetterEvalTokenUsage | null;
}): number | null {
  if (!args.tokenUsage) return null;
  const rates = SHORT_CONTEXT_RATES_USD_PER_MILLION[args.writerModel];
  return roundUsd(
    (args.tokenUsage.inputTokens * rates.input +
      args.tokenUsage.outputTokens * rates.output) /
      1_000_000,
  );
}

export function calculateCoverLetterEvalConservativeCallCeiling(args: {
  writerModel: CoverLetterEvalPricedWriterModel;
  serializedInputByteUpperBound: number;
  writerMaxOutputTokens: number;
}): number {
  const rates = SHORT_CONTEXT_RATES_USD_PER_MILLION[args.writerModel];
  return roundUsd(
    (args.serializedInputByteUpperBound * rates.input +
      args.writerMaxOutputTokens * rates.output) /
      1_000_000,
  );
}

export async function buildCoverLetterEvalTransportMetadata(
  input: CoverLetterEvalTransportInput,
): Promise<CoverLetterEvalTransportMetadata> {
  return {
    version: "cover_letter_eval_transport_metadata_v1",
    requestProjectionHash: await buildStableHash({
      namespace: "cover-letter-eval-transport",
      type: "application-request-projection",
      version: 1,
      serializedRequest: input.serializedRequest,
    }),
    requestProjectionByteLength: Buffer.byteLength(
      input.serializedRequest,
      "utf8",
    ),
    requestProjectionScope:
      "application_controlled_request_projection_without_credentials_or_signal",
    systemPromptHash: input.systemPrompt
      ? await buildStableHash({
          namespace: "cover-letter-eval-transport",
          type: "system-prompt",
          version: 1,
          systemPrompt: input.systemPrompt,
        })
      : null,
    schemaTargetHash: await buildStableHash({
      namespace: "cover-letter-eval-transport",
      type: "writer-schema-target",
      version: 1,
      schema: input.schemaTarget,
    }),
    schemaEnforcementMode: input.schemaEnforcementMode,
    promptContract: input.promptContract,
  };
}

export async function buildCoverLetterEvalRunManifestEntry(args: {
  caseId: string;
  provider: "openai" | "mistral";
  requestedModel: CoverLetterEvalPricedWriterModel;
  returnedModel: string | null;
  prompt: string;
  transport: CoverLetterEvalTransportInput;
  reasoningEffort: string | null;
  writerMaxOutputTokens: number;
  providerMaxRetries: number;
  tokenUsage: CoverLetterEvalTokenUsage | null;
  sdkVersions: CoverLetterEvalSdkVersions;
  artifactHash: string;
  provenanceHash: string | null;
}): Promise<CoverLetterEvalRunManifestEntry> {
  return {
    version: "cover_letter_eval_run_manifest_entry_v1",
    caseId: args.caseId,
    provider: args.provider,
    requestedModel: args.requestedModel,
    returnedModel: args.returnedModel,
    promptHash: await buildStableHash({
      namespace: "cover-letter-eval-writer-prompt",
      type: "production-writer-prompt",
      version: 1,
      prompt: args.prompt,
    }),
    promptHashScope: "effective_user_prompt",
    transport: await buildCoverLetterEvalTransportMetadata(args.transport),
    reasoningEffort: args.reasoningEffort,
    writerMaxOutputTokens: args.writerMaxOutputTokens,
    providerMaxRetries: args.providerMaxRetries,
    tokenUsage: args.tokenUsage,
    observedCostUpperBoundUsd: calculateCoverLetterEvalObservedCostUpperBound({
      writerModel: args.requestedModel,
      tokenUsage: args.tokenUsage,
    }),
    sdkVersions: args.sdkVersions,
    artifactHash: args.artifactHash,
    provenanceHash: args.provenanceHash,
  };
}

const require = createRequire(import.meta.url);
let installedSdkVersionsPromise: Promise<CoverLetterEvalSdkVersions> | null =
  null;

async function resolveInstalledPackageVersion(
  packageName: string,
): Promise<string> {
  let directory = path.dirname(require.resolve(packageName));
  while (directory !== path.dirname(directory)) {
    const packageJsonPath = path.join(directory, "package.json");
    try {
      const parsed = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
        name?: unknown;
        version?: unknown;
      };
      if (
        parsed.name === packageName &&
        typeof parsed.version === "string" &&
        parsed.version.trim()
      ) {
        return parsed.version;
      }
    } catch {
      // Continue toward the package root.
    }
    directory = path.dirname(directory);
  }
  throw new Error(`Could not resolve installed version for ${packageName}.`);
}

export function resolveCoverLetterEvalInstalledSdkVersions(): Promise<CoverLetterEvalSdkVersions> {
  installedSdkVersionsPromise ??= Promise.all([
    resolveInstalledPackageVersion("openai"),
    resolveInstalledPackageVersion("@mistralai/mistralai"),
    resolveInstalledPackageVersion("@langchain/mistralai"),
  ]).then(([openai, mistral, langchainMistral]) => ({
    openai,
    mistral,
    langchainMistral,
  }));
  return installedSdkVersionsPromise;
}

export async function writeCoverLetterEvalRunManifest(args: {
  outputDirectory: string;
  manifest: CoverLetterEvalRunManifest;
}): Promise<string> {
  const privateDirectory = path.join(
    path.resolve(args.outputDirectory),
    "private-reveal",
  );
  await mkdir(privateDirectory, { recursive: true });
  const manifestPath = path.join(
    privateDirectory,
    "cover-letter-eval-run-manifest.json",
  );
  await writeFile(
    manifestPath,
    `${JSON.stringify(args.manifest, null, 2)}\n`,
    "utf8",
  );
  return manifestPath;
}
