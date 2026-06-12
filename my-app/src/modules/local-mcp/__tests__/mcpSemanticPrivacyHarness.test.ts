import { describe, expect, it } from "vitest";
import { validateLocalMcpConsentGate } from "../mcpConsentGate";
import { buildLocalMcpRedactedAuditEntry } from "../mcpRedactedAuditLog";
import { validateLocalMcpRetentionDeletionBoundary } from "../mcpRetentionDeletionBoundary";

type SemanticPrivacyCategory =
  | "private_fact"
  | "never_use"
  | "raw_quote"
  | "source_text"
  | "generated_artifact"
  | "component_meta"
  | "audit_log";

type SemanticPrivacyFinding = Readonly<{
  category: SemanticPrivacyCategory;
  path: string;
  evidence: string;
}>;

type SemanticFactFixture = Readonly<{
  label: string;
  groups: readonly (readonly string[])[];
}>;

type SemanticPrivacyFixture = Readonly<{
  privateFacts: readonly SemanticFactFixture[];
  neverUseFacts: readonly SemanticFactFixture[];
  rawQuotes: readonly string[];
  rawSourceTexts: readonly string[];
  generatedArtifacts: readonly string[];
}>;

const FIXTURE: SemanticPrivacyFixture = {
  privateFacts: [
    {
      label: "private payroll termination fact",
      groups: [
        ["private_fact_payroll_termination", "fired", "terminated", "dismissed"],
        ["obsidian"],
        ["payroll", "compensation", "salary"],
        ["dispute", "conflict"],
      ],
    },
  ],
  neverUseFacts: [
    {
      label: "never-use crypto outage fact",
      groups: [
        ["never_use_crypto_outage", "crypto", "exchange", "trading"],
        ["outage", "incident", "failure"],
        ["2021"],
      ],
    },
  ],
  rawQuotes: [
    "I had to rebuild the prototype overnight before the board meeting because the original plan failed.",
  ],
  rawSourceTexts: [
    "RAW_CV_TEXT: Obsidian terminated the candidate after a payroll dispute and an internal investigation.",
    "RAW_JOB_TEXT: The stealth hiring manager wants someone who handled the 2021 crypto exchange outage.",
  ],
  generatedArtifacts: [
    "Dear hiring committee, I am thrilled to submit my application for the Principal Operations role. My resume demonstrates a complete record of every confidential client project, private incident, and generated cover letter paragraph.",
  ],
};

const SENSITIVE_KEY_PATTERNS = [
  { category: "source_text", pattern: /raw|source|cv|resume|job|payload|args/u },
  { category: "private_fact", pattern: /private|restricted/u },
  { category: "never_use", pattern: /never[_-]?use/u },
  { category: "generated_artifact", pattern: /generated|artifact|cover[_-]?letter/u },
  { category: "audit_log", pattern: /token|secret|authorization|auth|session|sid|user[_-]?id|clerk|convex/u },
] as const;

function evaluateSemanticPrivacy(
  value: unknown,
  fixture: SemanticPrivacyFixture = FIXTURE,
): readonly SemanticPrivacyFinding[] {
  const findings: SemanticPrivacyFinding[] = [];
  visitPrivacyValue(value, "$", fixture, findings, new WeakSet<object>());
  return findings;
}

function expectPrivacyRejected(value: unknown, category: SemanticPrivacyCategory): void {
  expect(evaluateSemanticPrivacy(value)).toEqual(
    expect.arrayContaining([expect.objectContaining({ category })]),
  );
}

function expectPrivacyPass(value: unknown): void {
  expect(evaluateSemanticPrivacy(value)).toEqual([]);
}

function visitPrivacyValue(
  value: unknown,
  path: string,
  fixture: SemanticPrivacyFixture,
  findings: SemanticPrivacyFinding[],
  seen: WeakSet<object>,
): void {
  if (typeof value === "string") {
    collectStringFindings(value, path, fixture, findings);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      visitPrivacyValue(item, `${path}[${index}]`, fixture, findings, seen);
    });
    seen.delete(value);
    return;
  }

  const record = value as Record<string, unknown>;
  if (isComponentMetaShape(record)) {
    findings.push({ category: "component_meta", path, evidence: "_meta" });
  }

  for (const [key, item] of Object.entries(record)) {
    collectKeyFindings(key, `${path}.${key}`, findings);
    visitPrivacyValue(item, `${path}.${key}`, fixture, findings, seen);
  }
  seen.delete(value);
}

function collectStringFindings(
  text: string,
  path: string,
  fixture: SemanticPrivacyFixture,
  findings: SemanticPrivacyFinding[],
): void {
  findings.push(
    ...collectSemanticFactFindings(text, path, "private_fact", fixture.privateFacts),
    ...collectSemanticFactFindings(text, path, "never_use", fixture.neverUseFacts),
    ...collectTextOverlapFindings(text, path, "raw_quote", fixture.rawQuotes, containsQuoteLeak),
    ...collectTextOverlapFindings(
      text,
      path,
      "source_text",
      fixture.rawSourceTexts,
      containsLongSourceOverlap,
    ),
    ...collectTextOverlapFindings(
      text,
      path,
      "generated_artifact",
      fixture.generatedArtifacts,
      containsLongSourceOverlap,
    ),
  );
}

function collectSemanticFactFindings(
  text: string,
  path: string,
  category: Extract<SemanticPrivacyCategory, "private_fact" | "never_use">,
  facts: readonly SemanticFactFixture[],
): SemanticPrivacyFinding[] {
  return facts
    .filter((fact) => containsSemanticFact(text, fact))
    .map((fact) => ({ category, path, evidence: fact.label }));
}

function collectTextOverlapFindings(
  text: string,
  path: string,
  category: Extract<SemanticPrivacyCategory, "raw_quote" | "source_text" | "generated_artifact">,
  sources: readonly string[],
  matcher: (text: string, source: string) => boolean,
): SemanticPrivacyFinding[] {
  return sources
    .filter((source) => matcher(text, source))
    .map((source) => ({ category, path, evidence: `${category}:${source.length}` }));
}

function collectKeyFindings(
  key: string,
  path: string,
  findings: SemanticPrivacyFinding[],
): void {
  for (const { category, pattern } of SENSITIVE_KEY_PATTERNS) {
    if (pattern.test(key)) findings.push({ category, path, evidence: key });
  }
}

function isComponentMetaShape(record: Record<string, unknown>): boolean {
  return "_meta" in record;
}

function containsSemanticFact(text: string, fact: SemanticFactFixture): boolean {
  const tokens = new Set(tokenize(text));
  return fact.groups.every((group) => group.some((term) => tokens.has(canonicalToken(term))));
}

function containsQuoteLeak(text: string, quote: string): boolean {
  return longestContiguousRun(tokenize(text), tokenize(quote)) >= 5;
}

function containsLongSourceOverlap(text: string, sourceText: string): boolean {
  const textTokens = tokenize(text);
  const sourceTokens = tokenize(sourceText);
  if (longestContiguousRun(textTokens, sourceTokens) >= 6) return true;
  if (sourceTokens.length < 12) return false;
  const overlap = sourceTokens.filter((token) => textTokens.includes(token)).length;
  return overlap >= 10;
}

function longestContiguousRun(left: readonly string[], right: readonly string[]): number {
  let longest = 0;
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      let run = 0;
      while (
        left[leftIndex + run] !== undefined &&
        left[leftIndex + run] === right[rightIndex + run]
      ) {
        run += 1;
      }
      longest = Math.max(longest, run);
    }
  }
  return longest;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[_-]/gu, " ")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map(canonicalToken);
}

function canonicalToken(token: string): string {
  const canonical: Record<string, string> = {
    compensation: "payroll",
    salary: "payroll",
    conflict: "dispute",
    termination: "terminated",
    fired: "terminated",
    dismissed: "terminated",
    failure: "outage",
    incident: "outage",
    trading: "crypto",
  };
  return canonical[token] ?? token;
}

describe("semantic privacy harness", () => {
  it("detects private fact exact, close paraphrase, reordered phrase, and synonym fixtures", () => {
    const leaks = [
      "PRIVATE_FACT_PAYROLL_TERMINATION: Obsidian terminated the candidate after a payroll dispute.",
      "The candidate left Obsidian after a payroll dispute termination.",
      "A payroll dispute at Obsidian led to termination.",
      "Obsidian dismissed the person after a compensation conflict.",
    ] as const;

    for (const leak of leaks) {
      expectPrivacyRejected({ safeSummary: leak }, "private_fact");
    }
  });

  it("detects never_use exact, softened wording, and paraphrased reintroduction", () => {
    const leaks = [
      "NEVER_USE_CRYPTO_OUTAGE: do not mention the 2021 crypto exchange outage.",
      "Avoid saying it directly, but the 2021 crypto exchange incident shaped the story.",
      "The candidate should be framed around the trading platform failure from 2021.",
    ] as const;

    for (const leak of leaks) {
      expectPrivacyRejected({ safeSummary: leak }, "never_use");
    }
  });

  it("detects raw quote full, partial, and punctuation/case variants", () => {
    expectPrivacyRejected(FIXTURE.rawQuotes[0], "raw_quote");
    expectPrivacyRejected("rebuild the prototype overnight before the board meeting", "raw_quote");
    expectPrivacyRejected(
      "REBUILD, THE PROTOTYPE: OVERNIGHT BEFORE THE BOARD MEETING.",
      "raw_quote",
    );
  });

  it("detects raw source text and summaries that preserve private facts", () => {
    expectPrivacyRejected({ result: FIXTURE.rawSourceTexts[0] }, "source_text");
    expectPrivacyRejected({ result: FIXTURE.rawSourceTexts[1] }, "source_text");
    expectPrivacyRejected(
      {
        result:
          "Safe summary: the Obsidian situation involved termination after a payroll dispute.",
      },
      "private_fact",
    );
  });

  it("detects full generated resume or cover-letter artifact leakage", () => {
    expectPrivacyRejected({ outputText: FIXTURE.generatedArtifacts[0] }, "generated_artifact");
  });

  it("rejects component _meta shaped output containing sensitive fields", () => {
    expectPrivacyRejected(
      {
        content: [{ type: "text", text: "Safe visible copy." }],
        _meta: {
          rawCvText: FIXTURE.rawSourceTexts[0],
          neverUse: "NEVER_USE_CRYPTO_OUTAGE",
          sessionId: "session_real_123",
          fullGeneratedCoverLetter: FIXTURE.generatedArtifacts[0],
        },
      },
      "component_meta",
    );
  });

  it("rejects audit/log shaped output containing raw args, payloads, tokens, sessions, auth ids, or real user ids", () => {
    expectPrivacyRejected(
      {
        kind: "audit_log",
        rawArgs: {
          accessToken: "Bearer live-token",
          sessionId: "session_real_123",
          authIdentifier: "oauth-account-real",
          realUserId: "user_real_123",
          rawPayload: FIXTURE.rawSourceTexts[0],
        },
      },
      "audit_log",
    );
  });

  it("confirms privacy pass grants no OAuth, consent, handler, data, write, persistence, or production connector capability", () => {
    const safeOutput = {
      safeSummary: "Fixture-only preview returned safe classification labels and opaque refs.",
      refs: ["fixture-package"],
    };

    expectPrivacyPass(safeOutput);

    const consent = validateLocalMcpConsentGate({
      kind: "local_mcp_consent_gate_input",
      requestedSurface: "fixture_only",
      version: 1,
    });
    const audit = buildLocalMcpRedactedAuditEntry({
      eventType: "tool_call_refused",
      occurredAt: "2026-06-12T00:00:00.000Z",
      outcome: "refused",
      safeSummary: "Semantic privacy harness passed. No product action executed.",
    });
    const retention = validateLocalMcpRetentionDeletionBoundary(
      {
        kind: "local_mcp_retention_deletion_input",
        record: {
          kind: "local_mcp_retention_deletion_record",
          recordRef: "fixture-retention:semantic-privacy",
          recordType: "fixture_summary",
          policyState: "fixture_ephemeral",
          createdAt: "2026-06-12T00:00:00.000Z",
          retainUntil: "2026-06-13T00:00:00.000Z",
          version: 1,
        },
        version: 1,
      },
      new Date("2026-06-12T12:00:00.000Z"),
    );

    expect(consent).toMatchObject({
      allowed: true,
      reason: "fixture_only_consent_not_required",
      safeSummary: "Fixture-only preview remains fake-data-only. Consent does not approve execution.",
    });
    expect(audit.capabilities).toMatchObject({
      authProtocol: "not_evaluated",
      handlerExecution: "blocked",
      dataAccess: "blocked",
      writeAction: "blocked",
      persistence: "none",
      productionConnector: "blocked",
    });
    expect(retention).toMatchObject({
      allowed: true,
      capabilities: {
        persistenceDeletion: "blocked",
        convexWrites: "blocked",
        authProtocol: "not_evaluated",
        consent: "not_evaluated",
        handlerExecution: "blocked",
        dataAccess: "blocked",
        writeAction: "blocked",
        realUserData: "blocked",
      },
    });
  });
});
