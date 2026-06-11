export type LocalMcpPrivacyFixtureCategoryV1 =
  | "private_fact"
  | "never_use_fact"
  | "raw_source_document"
  | "raw_resume_text"
  | "source_quote_dump"
  | "raw_arguments"
  | "secret"
  | "session_detail"
  | "stack_trace"
  | "generated_full_text";

export type LocalMcpPrivacySentinelV1 = Readonly<{
  category: LocalMcpPrivacyFixtureCategoryV1;
  label: string;
  val: string;
  version: 1;
}>;

export type LocalMcpPrivacyLeakFindingV1 = Readonly<{
  category: LocalMcpPrivacyFixtureCategoryV1;
  label: string;
  path: string;
  version: 1;
}>;

export type LocalMcpPrivacyRedactionCheckResultV1 = Readonly<{
  kind: "local_mcp_privacy_redaction_check_result";
  safe: boolean;
  findings: readonly LocalMcpPrivacyLeakFindingV1[];
  checkedPathCount: number;
  version: 1;
}>;

export type LocalMcpPrivacyFixtureSetV1 = Readonly<{
  kind: "local_mcp_privacy_fixture_set";
  sentinels: readonly LocalMcpPrivacySentinelV1[];
  version: 1;
}>;

export type LocalMcpPrivacyFixtureScopeV1 = Readonly<{
  kind: "local_mcp_privacy_fixture_scope";
  appliesOnlyTo: readonly string[];
  notGlobalProductBan: true;
  allowedFutureProductArtifactFlow: readonly string[];
  genericSafeOutputForbiddenMaterial: readonly LocalMcpPrivacyFixtureCategoryV1[];
  artifactBoundaryRequirement: "future_dedicated_artifact_boundary_required";
  version: 1;
}>;

export type LocalMcpSafeTextFixtureOutputV1 = Readonly<{
  kind: "local_mcp_safe_text_fixture_output";
  status: string;
  summary: string;
  refIds: readonly string[];
  version: 1;
}>;

export const LOCAL_MCP_PRIVACY_FIXTURE_CATEGORIES_V1: readonly LocalMcpPrivacyFixtureCategoryV1[] = [
  "private_fact",
  "never_use_fact",
  "raw_source_document",
  "raw_resume_text",
  "source_quote_dump",
  "raw_arguments",
  "secret",
  "session_detail",
  "stack_trace",
  "generated_full_text",
] as const;

export const LOCAL_MCP_PRIVACY_FIXTURE_SCOPE_V1: LocalMcpPrivacyFixtureScopeV1 = {
  kind: "local_mcp_privacy_fixture_scope",
  appliesOnlyTo: [
    "local_mcp_safe_outputs",
    "outside_twoweeks_output_like_summaries",
    "safe_errors",
    "audit_safe_messages",
    "dry_run_results",
    "schema_previews",
    "diagnostic_output",
    "fixture_output",
  ],
  notGlobalProductBan: true,
  allowedFutureProductArtifactFlow: [
    "user_requested_job_search",
    "approved_career_context_and_selected_job_context",
    "complete_tailored_resume_cv_generation",
    "complete_cover_letter_generation",
    "user_view_edit_copy_export_or_send_in_dedicated_future_pr",
    "bounded_tool_results_or_artifact_refs_for_approved_integrations",
  ],
  genericSafeOutputForbiddenMaterial: [...LOCAL_MCP_PRIVACY_FIXTURE_CATEGORIES_V1],
  artifactBoundaryRequirement: "future_dedicated_artifact_boundary_required",
  version: 1,
} as const;

const LOCAL_MCP_PRIVACY_SENTINELS_V1: readonly LocalMcpPrivacySentinelV1[] = [
  {
    category: "private_fact",
    label: "private fact sentinel",
    val: "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE",
    version: 1,
  },
  {
    category: "never_use_fact",
    label: "never use fact sentinel",
    val: "NEVER_USE_SENTINEL_DO_NOT_EXPOSE",
    version: 1,
  },
  {
    category: "raw_source_document",
    label: "raw source document sentinel",
    val: "RAW_SOURCE_DOCUMENT_SENTINEL_DO_NOT_EXPOSE",
    version: 1,
  },
  {
    category: "raw_resume_text",
    label: "raw resume text sentinel",
    val: "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE",
    version: 1,
  },
  {
    category: "source_quote_dump",
    label: "source quote dump sentinel",
    val: "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE",
    version: 1,
  },
  {
    category: "raw_arguments",
    label: "raw arguments sentinel",
    val: "RAW_ARGUMENTS_SENTINEL_DO_NOT_EXPOSE",
    version: 1,
  },
  {
    category: "secret",
    label: "secret sentinel",
    val: "SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
    version: 1,
  },
  {
    category: "session_detail",
    label: "session detail sentinel",
    val: "SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE",
    version: 1,
  },
  {
    category: "stack_trace",
    label: "stack trace sentinel",
    val: "STACK_TRACE_SENTINEL_DO_NOT_EXPOSE",
    version: 1,
  },
  {
    category: "generated_full_text",
    label: "generated full text sentinel",
    val: "GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE",
    version: 1,
  },
] as const;

const DEFAULT_SAFE_STATUS = "safe_summary";
const DEFAULT_SAFE_SUMMARY = "Safe summary only.";
const MAX_STATUS_LENGTH = 80;
const MAX_SUMMARY_LENGTH = 500;
const MAX_REF_ID_LENGTH = 120;
const MAX_REF_IDS = 25;

export function buildLocalMcpPrivacyFixtureSet(): LocalMcpPrivacyFixtureSetV1 {
  return {
    kind: "local_mcp_privacy_fixture_set",
    sentinels: LOCAL_MCP_PRIVACY_SENTINELS_V1.map(cloneSentinel),
    version: 1,
  };
}

export function collectLocalMcpPrivacyLeakFindings(
  val: unknown,
  fixtureSet: LocalMcpPrivacyFixtureSetV1 = buildLocalMcpPrivacyFixtureSet(),
): LocalMcpPrivacyRedactionCheckResultV1 {
  const sentinels = fixtureSet.sentinels.map(cloneSentinel);
  const findings: LocalMcpPrivacyLeakFindingV1[] = [];
  let checkedPathCount = 0;

  function checkString(text: string, path: string): void {
    for (const sentinel of sentinels) {
      if (text.includes(sentinel.val)) {
        findings.push({
          category: sentinel.category,
          label: sentinel.label,
          path,
          version: 1,
        });
      }
    }
  }

  function visit(current: unknown, path: string, seen: WeakSet<object>): void {
    checkedPathCount += 1;
    if (typeof current === "string") {
      checkString(current, path);
      return;
    }
    if (isTerminalValue(current)) return;
    if (Array.isArray(current)) {
      visitArray(current, path, seen);
      return;
    }
    if (isPlainRecord(current)) {
      visitRecord(current, path, seen);
    }
  }

  function visitArray(current: readonly unknown[], path: string, seen: WeakSet<object>): void {
    if (seen.has(current)) return;
    seen.add(current);
    current.forEach((item, index) => visit(item, `${path}[${index}]`, seen));
    seen.delete(current);
  }

  function visitRecord(
    current: Record<string, unknown>,
    path: string,
    seen: WeakSet<object>,
  ): void {
    if (seen.has(current)) return;
    seen.add(current);
    Object.keys(current)
      .sort(compareStrings)
      .forEach((key, index) => {
        const childPath = appendPathKey(path, key, index, sentinels);
        checkedPathCount += 1;
        checkString(key, `${childPath}<key>`);
        visit(current[key], childPath, seen);
      });
    seen.delete(current);
  }

  visit(val, "$", new WeakSet<object>());

  const sortedFindings = findings.sort(
    (a, b) =>
      compareStrings(a.path, b.path) ||
      compareStrings(a.category, b.category) ||
      compareStrings(a.label, b.label),
  );

  return {
    kind: "local_mcp_privacy_redaction_check_result",
    safe: sortedFindings.length === 0,
    findings: sortedFindings,
    checkedPathCount,
    version: 1,
  };
}

export function assertLocalMcpPrivacySafeOutput(
  val: unknown,
  fixtureSet: LocalMcpPrivacyFixtureSetV1 = buildLocalMcpPrivacyFixtureSet(),
): void {
  const result = collectLocalMcpPrivacyLeakFindings(val, fixtureSet);
  if (result.safe) return;
  const categories = [...new Set(result.findings.map((finding) => finding.category))].sort(
    compareStrings,
  );
  throw new TypeError(`Local MCP privacy fixture detected forbidden categories: ${categories.join(", ")}`);
}

export function redactLocalMcpFixtureSentinelsFromText(
  text: string,
  fixtureSet: LocalMcpPrivacyFixtureSetV1 = buildLocalMcpPrivacyFixtureSet(),
): string {
  if (typeof text !== "string") {
    throw new TypeError("Local MCP fixture redaction requires text");
  }
  return fixtureSet.sentinels.reduce(
    (output, sentinel) => output.split(sentinel.val).join(`[redacted:${sentinel.category}]`),
    text,
  );
}

export function buildLocalMcpSafeTextFixtureOutput(
  input: Readonly<{
    status?: string;
    summary?: string;
    refIds?: readonly string[];
  }> = {},
): LocalMcpSafeTextFixtureOutputV1 {
  const output: LocalMcpSafeTextFixtureOutputV1 = {
    kind: "local_mcp_safe_text_fixture_output",
    status: boundText(input.status, DEFAULT_SAFE_STATUS, MAX_STATUS_LENGTH),
    summary: boundText(input.summary, DEFAULT_SAFE_SUMMARY, MAX_SUMMARY_LENGTH),
    refIds: (input.refIds ?? [])
      .filter((refId): refId is string => typeof refId === "string" && refId.trim().length > 0)
      .slice(0, MAX_REF_IDS)
      .map((refId) => boundText(refId, "ref", MAX_REF_ID_LENGTH)),
    version: 1,
  };
  assertLocalMcpPrivacySafeOutput(output);
  return output;
}

export function buildLocalMcpUnsafeFixtureOutput(
  category: LocalMcpPrivacyFixtureCategoryV1,
): Readonly<Record<string, unknown>> {
  if (!isLocalMcpPrivacyFixtureCategory(category)) {
    throw new TypeError("Local MCP privacy fixture category is unknown");
  }
  const sentinel = sentinelForCategory(category);
  switch (category) {
    case "private_fact":
      return { structuredContent: { facts: [{ visibility: "private", text: sentinel.val }] } };
    case "never_use_fact":
      return { structuredContent: { facts: [{ policy: "never_use", text: sentinel.val }] } };
    case "raw_source_document":
      return { content: [{ type: "text", text: sentinel.val }] };
    case "raw_resume_text":
      return { structuredContent: { resumeText: sentinel.val } };
    case "source_quote_dump":
      return { structuredContent: { sourceQuotes: [sentinel.val] } };
    case "raw_arguments":
      return { arguments: { rawText: sentinel.val } };
    case "secret":
      return { structuredContent: { tokenHint: sentinel.val } };
    case "session_detail":
      return { metadata: { session: sentinel.val } };
    case "stack_trace":
      return { err: { message: "failed safely", detail: sentinel.val } };
    case "generated_full_text":
      return { structuredContent: { generatedText: sentinel.val } };
  }
}

export function isLocalMcpPrivacyFixtureCategory(
  val: unknown,
): val is LocalMcpPrivacyFixtureCategoryV1 {
  return (
    typeof val === "string" &&
    (LOCAL_MCP_PRIVACY_FIXTURE_CATEGORIES_V1 as readonly string[]).includes(val)
  );
}

function sentinelForCategory(
  category: LocalMcpPrivacyFixtureCategoryV1,
): LocalMcpPrivacySentinelV1 {
  const sentinel = LOCAL_MCP_PRIVACY_SENTINELS_V1.find((item) => item.category === category);
  if (!sentinel) throw new TypeError("Local MCP privacy fixture category is unknown");
  return cloneSentinel(sentinel);
}

function cloneSentinel(sentinel: LocalMcpPrivacySentinelV1): LocalMcpPrivacySentinelV1 {
  return { ...sentinel };
}

function boundText(val: unknown, fallback: string, maxLength: number): string {
  if (typeof val !== "string") return fallback;
  const normalized = val.trim();
  if (normalized.length === 0) return fallback;
  return normalized.slice(0, maxLength);
}

function appendPathKey(
  basePath: string,
  key: string,
  index: number,
  sentinels: readonly LocalMcpPrivacySentinelV1[],
): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(key) && !containsSentinel(key, sentinels)) {
    return `${basePath}.${key}`;
  }
  return `${basePath}.[key#${index}]`;
}

function containsSentinel(
  text: string,
  sentinels: readonly LocalMcpPrivacySentinelV1[],
): boolean {
  return sentinels.some((sentinel) => text.includes(sentinel.val));
}

function isTerminalValue(val: unknown): boolean {
  return (
    val === null ||
    typeof val === "number" ||
    typeof val === "boolean" ||
    typeof val === "bigint" ||
    typeof val === "symbol" ||
    typeof val === "undefined" ||
    typeof val === "function"
  );
}

function isPlainRecord(val: unknown): val is Record<string, unknown> {
  if (!val || typeof val !== "object" || Array.isArray(val)) return false;
  const prototype = Object.getPrototypeOf(val);
  return prototype === Object.prototype || prototype === null;
}

function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
