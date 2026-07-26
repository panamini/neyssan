import type {
  InternalToolContractRegistryV1,
  InternalToolContractStatusV1,
  InternalToolContractV1,
  InternalToolEffectV1,
  InternalToolIdV1,
  InternalToolInputKindV1,
  InternalToolOutputKindV1,
  InternalToolParameterV1,
  InternalToolResultShapeV1,
  InternalToolRiskLevelV1,
} from "./schema";

export const INTERNAL_TOOL_EFFECTS: readonly InternalToolEffectV1[] = [
  "read_only",
  "pure_compute",
] as const;

export const INTERNAL_TOOL_RISK_LEVELS: readonly InternalToolRiskLevelV1[] = [
  "low",
  "medium",
  "blocked",
] as const;

export const INTERNAL_TOOL_INPUT_KINDS: readonly InternalToolInputKindV1[] = [
  "application_context_ref",
  "evidence_graph_ref",
  "resume_variant_plan_ref",
  "review_cockpit_ref",
  "resume_variant_artifact_ref",
  "cover_letter_artifact_ref",
  "application_package_ref",
  "application_package_content",
  "tool_contract_ref",
] as const;

export const INTERNAL_TOOL_OUTPUT_KINDS: readonly InternalToolOutputKindV1[] = [
  "application_context_summary",
  "evidence_graph_summary",
  "resume_variant_plan_summary",
  "review_cockpit_summary",
  "resume_variant_artifact_summary",
  "cover_letter_artifact_summary",
  "application_package_summary",
  "application_package_validation",
  "tool_contract_summary",
] as const;

export const INTERNAL_TOOL_IDS: readonly InternalToolIdV1[] = [
  "application_context.describe",
  "application_package.summarize",
  "application_package.validate",
  "cover_letter_artifact.summarize",
  "evidence_graph.summarize",
  "internal_tool_contracts.describe",
  "internal_tool_contracts.list",
  "resume_variant_artifact.summarize",
  "resume_variant_plan.summarize",
  "review_cockpit.summarize",
] as const;

export const INTERNAL_TOOL_CONTRACT_STATUSES: readonly InternalToolContractStatusV1[] = [
  "active",
  "draft",
  "blocked",
] as const;

const FORBIDDEN_ID_TERMS: readonly string[] = [
  "export",
  "send",
  "submit",
  "apply",
  "track",
  "generation",
  "generate",
  "generated",
  "mcp",
  "scout",
  "scrape",
  "crawl",
] as const;

const FORBIDDEN_ACTIVE_METADATA_TERMS: readonly RegExp[] = [
  /\bexport\b/u,
  /\bpdf\b/u,
  /\bdocx\b/u,
  /\bdownload\b/u,
  /\bsend\b/u,
  /\bsent\b/u,
  /\bsubmit\b/u,
  /\bsubmitted\b/u,
  /\bapply\b/u,
  /\bapplied\b/u,
  /\btrack\b/u,
  /\btracked\b/u,
  /\btracking\b/u,
  /\bgeneration\b/u,
  /\bgenerate\b/u,
  /\bgenerated\b/u,
  /\bnetwork\b/u,
  /\bremote\b/u,
  /\bhttp\b/u,
  /\burl\b/u,
  /\bscrape\b/u,
  /\bscraping\b/u,
  /\bcrawl\b/u,
  /\bcrawler\b/u,
  /\bmcp\b/u,
  /\bscout\b/u,
  /\bllm\b/u,
  /\bembedding\b/u,
  /\bpersist\b/u,
  /\bpersistence\b/u,
  /\bmutation\b/u,
  /\bwrite\b/u,
] as const;

const GENERATED_TEXT_PATTERNS: readonly RegExp[] = [
  /\bdear hiring manager\b/u,
  /\bi am excited to apply\b/u,
  /\bthank you for your consideration\b/u,
  /\bsincerely\b/u,
  /\bbest regards\b/u,
  /\bproven track record\b/u,
  /\bresults-driven\b/u,
  /\bworld-class\b/u,
  /\b(increased|reduced|improved|boosted|grew|scaled)\b[^.]{0,120}\b\d+\s*%/u,
] as const;

export function isInternalToolEffect(value: unknown): value is InternalToolEffectV1 {
  return includesString(INTERNAL_TOOL_EFFECTS, value);
}

export function isInternalToolRiskLevel(value: unknown): value is InternalToolRiskLevelV1 {
  return includesString(INTERNAL_TOOL_RISK_LEVELS, value);
}

export function isInternalToolInputKind(value: unknown): value is InternalToolInputKindV1 {
  return includesString(INTERNAL_TOOL_INPUT_KINDS, value);
}

export function isInternalToolOutputKind(value: unknown): value is InternalToolOutputKindV1 {
  return includesString(INTERNAL_TOOL_OUTPUT_KINDS, value);
}

export function isInternalToolId(value: unknown): value is InternalToolIdV1 {
  return includesString(INTERNAL_TOOL_IDS, value);
}

export function isInternalToolContractStatus(value: unknown): value is InternalToolContractStatusV1 {
  return includesString(INTERNAL_TOOL_CONTRACT_STATUSES, value);
}

export function assertInternalToolContract(contract: InternalToolContractV1): void {
  const record = asPlainRecord(contract, "InternalToolContract must be an object");

  assertInternalToolIdText(record.id);
  if (!isInternalToolId(record.id)) throw new TypeError("InternalToolContract id is not registered in V1");
  if (!isNonEmptyString(record.title)) throw new TypeError("InternalToolContract requires title");
  if (!isNonEmptyString(record.description)) throw new TypeError("InternalToolContract requires description");
  if (!isInternalToolEffect(record.effect)) throw new TypeError("InternalToolContract requires a known effect");
  if (!isInternalToolRiskLevel(record.riskLevel)) {
    throw new TypeError("InternalToolContract requires a known riskLevel");
  }
  if (!isInternalToolContractStatus(record.status)) {
    throw new TypeError("InternalToolContract requires a known status");
  }
  if (!Array.isArray(record.input)) throw new TypeError("InternalToolContract requires input parameters");
  if (!isInternalToolResultShape(record.output)) {
    throw new TypeError("InternalToolContract requires a known output shape");
  }
  if (typeof record.requiresApproval !== "boolean") {
    throw new TypeError("InternalToolContract requires requiresApproval boolean");
  }
  if (record.forbiddenUntil !== undefined && !isNonEmptyString(record.forbiddenUntil)) {
    throw new TypeError("InternalToolContract forbiddenUntil must be non-empty when present");
  }
  if (record.version !== 1) throw new TypeError("InternalToolContract version must be 1");

  assertInternalToolParameters(record.input);
  assertActiveContractSafety(record as unknown as InternalToolContractV1);
  assertInternalToolContractDoesNotContainGeneratedText(record as unknown as InternalToolContractV1);
}

export function assertInternalToolContractRegistry(registry: InternalToolContractRegistryV1): void {
  const record = asPlainRecord(registry, "InternalToolContractRegistry must be an object");
  if (!Array.isArray(record.contracts)) {
    throw new TypeError("InternalToolContractRegistry requires contracts array");
  }
  if (!Array.isArray(record.contractIds)) {
    throw new TypeError("InternalToolContractRegistry requires contractIds array");
  }
  if (record.version !== 1) throw new TypeError("InternalToolContractRegistry version must be 1");

  for (const contract of record.contracts) {
    assertInternalToolContract(contract as InternalToolContractV1);
  }

  const contractIds = record.contracts.map((contract) => (contract as InternalToolContractV1).id);
  const declaredIds = record.contractIds;

  for (const id of declaredIds) {
    assertInternalToolIdText(id);
    if (!isInternalToolId(id)) throw new TypeError("InternalToolContractRegistry contractIds contains unknown id");
  }

  assertNoDuplicateStrings(contractIds, "InternalToolContractRegistry duplicate contract id");
  assertSameStringArray(contractIds, sortAscii(contractIds), "InternalToolContractRegistry contracts must be sorted by id");
  assertSameStringArray(declaredIds, sortAscii(declaredIds), "InternalToolContractRegistry contractIds must be sorted by id");
  assertSameStringArray(declaredIds, contractIds, "InternalToolContractRegistry contractIds must match contracts");
  assertInternalToolContractsDoNotContainGeneratedText(record as unknown as InternalToolContractRegistryV1);
}

export function assertInternalToolContractsDoNotContainGeneratedText(
  registry: InternalToolContractRegistryV1,
): void {
  const record = asPlainRecord(registry, "InternalToolContractRegistry must be an object");
  if (!Array.isArray(record.contracts)) return;

  for (const contract of record.contracts) {
    if (!isPlainRecord(contract)) continue;
    const values = collectContractMetadataStrings(contract);
    for (const value of values) {
      assertMetadataDoesNotLookGenerated(value);
      if (contract.status === "active") assertActiveMetadataDoesNotImplyForbiddenBehavior(value);
    }
  }
}

export function compareInternalToolIds(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function assertInternalToolParameters(input: readonly unknown[]): void {
  const names = new Set<string>();
  for (let index = 0; index < input.length; index += 1) {
    const parameter = asPlainRecord(input[index], `InternalToolContract input[${index}] must be an object`);
    if (!isNonEmptyString(parameter.name)) {
      throw new TypeError(`InternalToolContract input[${index}] requires name`);
    }
    if (names.has(parameter.name)) {
      throw new TypeError(`InternalToolContract duplicate input parameter ${parameter.name}`);
    }
    names.add(parameter.name);
    if (!isInternalToolInputKind(parameter.kind)) {
      throw new TypeError(`InternalToolContract input[${index}] requires a known kind`);
    }
    if (typeof parameter.required !== "boolean") {
      throw new TypeError(`InternalToolContract input[${index}] requires required boolean`);
    }
    if (!isNonEmptyString(parameter.description)) {
      throw new TypeError(`InternalToolContract input[${index}] requires description`);
    }
    if (parameter.version !== 1) throw new TypeError(`InternalToolContract input[${index}] version must be 1`);
    assertParameterMetadataIsSafe(parameter as unknown as InternalToolParameterV1);
  }
}

function isInternalToolResultShape(value: unknown): value is InternalToolResultShapeV1 {
  if (!isPlainRecord(value)) return false;
  return isInternalToolOutputKind(value.kind) && isNonEmptyString(value.description) && value.version === 1;
}

function assertActiveContractSafety(contract: InternalToolContractV1): void {
  if (contract.status !== "active") return;
  if (contract.riskLevel === "blocked") throw new TypeError("Active internal tool contract cannot be blocked risk");
  if (contract.requiresApproval) throw new TypeError("Active internal tool contract cannot require approval");
  if (contract.forbiddenUntil !== undefined) {
    throw new TypeError("Active internal tool contract cannot define forbiddenUntil");
  }
}

function assertInternalToolContractDoesNotContainGeneratedText(contract: InternalToolContractV1): void {
  const values = collectContractMetadataStrings(contract as unknown as Record<string, unknown>);
  for (const value of values) {
    assertMetadataDoesNotLookGenerated(value);
    if (contract.status === "active") assertActiveMetadataDoesNotImplyForbiddenBehavior(value);
  }
}

function assertParameterMetadataIsSafe(parameter: InternalToolParameterV1): void {
  assertMetadataDoesNotLookGenerated(parameter.name);
  assertMetadataDoesNotLookGenerated(parameter.description);
}

function collectContractMetadataStrings(contract: Record<string, unknown>): readonly string[] {
  const output = isPlainRecord(contract.output) ? contract.output : undefined;
  const input = Array.isArray(contract.input) ? contract.input : [];

  return [
    contract.title,
    contract.description,
    contract.forbiddenUntil,
    output?.description,
    ...input.flatMap((parameter) => {
      if (!isPlainRecord(parameter)) return [];
      return [parameter.name, parameter.description];
    }),
  ].filter((value): value is string => typeof value === "string");
}

function assertMetadataDoesNotLookGenerated(value: string): void {
  const normalized = normalizeForSearch(value);
  if (GENERATED_TEXT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new TypeError("InternalToolContract metadata contains generated resume or cover-letter text");
  }
}

function assertActiveMetadataDoesNotImplyForbiddenBehavior(value: string): void {
  const normalized = normalizeForSearch(value);
  if (FORBIDDEN_ACTIVE_METADATA_TERMS.some((pattern) => pattern.test(normalized))) {
    throw new TypeError("Active internal tool contract metadata implies forbidden behavior");
  }
}

function assertInternalToolIdText(value: unknown): asserts value is string {
  if (!isNonEmptyString(value)) throw new TypeError("InternalToolContract id must be non-empty");
  if (value !== value.toLowerCase()) throw new TypeError("InternalToolContract id must be lowercase");
  if (!/^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/u.test(value)) {
    throw new TypeError("InternalToolContract id must use lowercase dot notation");
  }
  if (FORBIDDEN_ID_TERMS.some((term) => value.includes(term))) {
    throw new TypeError("InternalToolContract id contains forbidden tool behavior");
  }
}

function assertNoDuplicateStrings(values: readonly string[], message: string): void {
  if (new Set(values).size !== values.length) throw new TypeError(message);
}

function assertSameStringArray(actual: readonly string[], expected: readonly string[], message: string): void {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new TypeError(message);
  }
}

function sortAscii<T extends string>(values: readonly T[]): readonly T[] {
  return [...values].sort(compareInternalToolIds);
}

function includesString<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function asPlainRecord(value: unknown, message: string): Record<string, unknown> {
  if (!isPlainRecord(value)) throw new TypeError(message);
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeForSearch(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}
