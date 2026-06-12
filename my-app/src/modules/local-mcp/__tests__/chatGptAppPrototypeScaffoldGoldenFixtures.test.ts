import { describe, expect, it } from "vitest";
import {
  assertLocalOnlyChatGptAppPrototypeScaffold,
} from "../chatGptAppPrototypeScaffold";
import { assertLocalMcpPrivacySafeOutput } from "../privacyRedactionFixtures";
import type { LocalMcpToolIdV1 } from "../schema";
import source from "../chatGptAppPrototypeScaffoldGoldenFixtures.ts?raw";
import {
  LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_GOLDEN_SCENARIOS_V1,
  assertLocalOnlyChatGptAppPrototypeGoldenFixture,
  buildLocalOnlyChatGptAppPrototypeGoldenFixture,
  isLocalOnlyChatGptAppPrototypeGoldenScenario,
  listLocalOnlyChatGptAppPrototypeGoldenFixtures,
} from "../chatGptAppPrototypeScaffoldGoldenFixtures";
import type {
  LocalOnlyChatGptAppPrototypeGoldenFixtureV1,
  LocalOnlyChatGptAppPrototypeGoldenScenarioV1,
  LocalOnlyChatGptAppPrototypeGoldenToolStateV1,
} from "../chatGptAppPrototypeScaffoldGoldenFixtures";

const EXPECTED_SCENARIOS: readonly LocalOnlyChatGptAppPrototypeGoldenScenarioV1[] = [
  "default_hidden",
  "all_blocked",
  "all_review_required",
  "all_ready_for_internal_review",
  "mixed_gate_states",
] as const;

const EXPECTED_LOCAL_TOOL_IDS: readonly LocalMcpToolIdV1[] = [
  "local_mcp.application_package.summarize",
  "local_mcp.evidence_graph.summarize",
  "local_mcp.resume_variant_plan.summarize",
  "local_mcp.review_cockpit.summarize",
] as const;

const FORBIDDEN_RUNTIME_PHRASES = [
  "ready_for_production",
  "ready_to_execute",
  "ready_for_chatgpt",
  "approved_for_remote",
  "safe_to_run",
  "production ready",
  "runtime approved",
  "handler approved",
  "transport approved",
  "connected to chatgpt",
] as const;

describe("chatGptAppPrototypeScaffoldGoldenFixtures", () => {
  describe("scenario listing", () => {
    it("lists exactly five golden scenarios in stable order", () => {
      expect(LOCAL_ONLY_CHATGPT_APP_PROTOTYPE_GOLDEN_SCENARIOS_V1).toEqual(EXPECTED_SCENARIOS);
      expect(listLocalOnlyChatGptAppPrototypeGoldenFixtures().map((fixture) => fixture.scenario)).toEqual(
        EXPECTED_SCENARIOS,
      );
      expect(isLocalOnlyChatGptAppPrototypeGoldenScenario("mixed_gate_states")).toBe(true);
      expect(isLocalOnlyChatGptAppPrototypeGoldenScenario("unknown")).toBe(false);
    });

    it("returns equal fixture values without sharing object or array references", () => {
      const first = listLocalOnlyChatGptAppPrototypeGoldenFixtures();
      const second = listLocalOnlyChatGptAppPrototypeGoldenFixtures();

      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expect(first[0]).not.toBe(second[0]);
      expect(first[0].scaffold).not.toBe(second[0].scaffold);
      expect(first[0].scaffold.tools).not.toBe(second[0].scaffold.tools);
      expect(first[0].expectedToolStates).not.toBe(second[0].expectedToolStates);
    });
  });

  describe("fixture validity", () => {
    it("keeps every golden fixture privacy-safe and non-runnable", () => {
      for (const fixture of listLocalOnlyChatGptAppPrototypeGoldenFixtures()) {
        assertLocalOnlyChatGptAppPrototypeGoldenFixture(fixture);
        assertLocalOnlyChatGptAppPrototypeScaffold(fixture.scaffold);
        assertLocalMcpPrivacySafeOutput(fixture);
        expect(JSON.stringify(fixture).toLowerCase()).not.toSatisfy((serialized: string) =>
          FORBIDDEN_RUNTIME_PHRASES.some((phrase) => serialized.includes(phrase)),
        );
        expect(fixture.scaffold.tools.every((tool) => tool.callable === false)).toBe(true);
        expect(fixture.scaffold.tools.every((tool) => tool.runnable === false)).toBe(true);
        expect(fixture.scaffold.tools.every((tool) => tool.reviewOnly === true)).toBe(true);
        expect(fixture.scaffold.tools.every((tool) => typeof tool.fixtureOutput.status === "string")).toBe(
          true,
        );
        expect(fixture.scaffold.tools.every((tool) => typeof tool.fixtureOutput.summary === "string")).toBe(
          true,
        );
      }
    });
  });

  describe("default hidden", () => {
    it("freezes every default tool as hidden and missing-gate", () => {
      const fixture = buildLocalOnlyChatGptAppPrototypeGoldenFixture("default_hidden");

      expect(fixture.scaffold.tools.map((tool) => tool.localToolId)).toEqual(EXPECTED_LOCAL_TOOL_IDS);
      expect(fixture.expectedToolStates).toHaveLength(EXPECTED_LOCAL_TOOL_IDS.length);
      fixture.expectedToolStates.forEach((expected, index) => {
        expect(expected).toMatchObject({
          localToolId: EXPECTED_LOCAL_TOOL_IDS[index],
          exposureState: "hidden",
          gateStatus: "missing",
          gatePassedForInternalReview: false,
          userFacingCopy: "Tool disabled.",
          safeSummary: "Hidden by default.",
          fixtureStatus: "hidden",
          fixtureSummary: "Hidden by default.",
          refId: `fixture:${EXPECTED_LOCAL_TOOL_IDS[index]}`,
          callable: false,
          runnable: false,
          reviewOnly: true,
          version: 1,
        });
        expectToolMatchesExpected(fixture, expected, index);
      });
    });
  });

  describe("blocked, review-required, and ready scenarios", () => {
    it("freezes all blocked cards", () => {
      const fixture = buildLocalOnlyChatGptAppPrototypeGoldenFixture("all_blocked");

      expectEveryToolState(fixture, {
        exposureState: "blocked",
        gateStatus: "blocked",
        gatePassedForInternalReview: false,
        userFacingCopy: "Blocked. Review privacy.",
        safeSummary: "Blocked. Review privacy.",
      });
    });

    it("freezes all review-required cards", () => {
      const fixture = buildLocalOnlyChatGptAppPrototypeGoldenFixture("all_review_required");

      expectEveryToolState(fixture, {
        exposureState: "review_required",
        gateStatus: "review_required",
        gatePassedForInternalReview: false,
        userFacingCopy: "Approval required.",
        safeSummary: "Approval required.",
      });
    });

    it("freezes all ready-for-internal-review cards as review-only", () => {
      const fixture = buildLocalOnlyChatGptAppPrototypeGoldenFixture("all_ready_for_internal_review");

      expectEveryToolState(fixture, {
        exposureState: "ready_for_internal_review",
        gateStatus: "ready_for_internal_review",
        gatePassedForInternalReview: true,
        userFacingCopy: "Review first. Nothing runs.",
        safeSummary: "Ready for internal review. No handler executed.",
      });
      expect(JSON.stringify(fixture)).not.toMatch(/ready_for_production|ready_to_execute|ready_for_chatgpt/u);
    });
  });

  describe("mixed gate states", () => {
    it("freezes canonical tool order without cross-tool leakage", () => {
      const fixture = buildLocalOnlyChatGptAppPrototypeGoldenFixture("mixed_gate_states");

      expect(fixture.scaffold.tools.map((tool) => tool.localToolId)).toEqual(EXPECTED_LOCAL_TOOL_IDS);
      expect(fixture.scaffold.tools.map((tool) => tool.exposureState)).toEqual([
        "hidden",
        "blocked",
        "review_required",
        "ready_for_internal_review",
      ]);
      expect(fixture.scaffold.tools.map((tool) => tool.gateStatus)).toEqual([
        "missing",
        "blocked",
        "review_required",
        "ready_for_internal_review",
      ]);
      fixture.expectedToolStates.forEach((expected, index) => {
        expectToolMatchesExpected(fixture, expected, index);
      });
      expect(fixture.scaffold.tools.filter((tool) => tool.gatePassedForInternalReview)).toHaveLength(1);
      expect(JSON.stringify(fixture.scaffold)).not.toContain("\"runnable\":true");
      expect(fixture.scaffold.tools.every((tool) => tool.callable === false)).toBe(true);
    });
  });

  describe("invalid fixture rejection", () => {
    it("rejects non-object fixtures", () => {
      expect(() => assertLocalOnlyChatGptAppPrototypeGoldenFixture(null as never)).toThrow(
        /golden fixture must be an object/u,
      );
      expect(() => assertLocalOnlyChatGptAppPrototypeGoldenFixture([] as never)).toThrow(
        /golden fixture must be an object/u,
      );
    });

    it("rejects invalid fixture identity", () => {
      expect(() =>
        assertLocalOnlyChatGptAppPrototypeGoldenFixture(
          fixtureWithPatch({ kind: "local_only_chatgpt_app_prototype_scaffold" }) as never,
        ),
      ).toThrow(/kind is invalid/u);
      expect(() =>
        assertLocalOnlyChatGptAppPrototypeGoldenFixture(fixtureWithPatch({ version: 2 }) as never),
      ).toThrow(/version must be 1/u);
    });

    it("rejects unknown scenarios", () => {
      expect(() =>
        buildLocalOnlyChatGptAppPrototypeGoldenFixture("unknown" as never),
      ).toThrow(/scenario is invalid/u);
      expect(() =>
        assertLocalOnlyChatGptAppPrototypeGoldenFixture(
          fixtureWithPatch({ scenario: "unknown" }) as never,
        ),
      ).toThrow(/scenario is invalid/u);
    });

    it("rejects scaffold mismatch against expected tool states", () => {
      const invalid = fixtureWithExpectedToolStatePatch(0, { exposureState: "blocked" });

      expect(() => assertLocalOnlyChatGptAppPrototypeGoldenFixture(invalid as never)).toThrow(
        /exposureState drifted/u,
      );
    });

    it.each([
      {
        name: "gateStatus",
        patch: { gateStatus: "blocked" },
        expectedError: /gateStatus drifted/u,
      },
      {
        name: "safeSummary",
        patch: { safeSummary: "Blocked. Review privacy." },
        expectedError: /safe summary drifted/u,
      },
      {
        name: "fixture status",
        patch: { fixtureStatus: "blocked" },
        expectedError: /output status drifted/u,
      },
      {
        name: "refId",
        patch: { refId: "fixture:local_mcp.evidence_graph.summarize" },
        expectedError: /output refId drifted/u,
      },
    ])("rejects expected tool state drift: $name", ({ patch, expectedError }) => {
      const invalid = fixtureWithExpectedToolStatePatch(0, patch);

      expect(() => assertLocalOnlyChatGptAppPrototypeGoldenFixture(invalid as never)).toThrow(
        expectedError,
      );
    });

    it("rejects fixture output summary drift", () => {
      const invalid = fixtureWithFirstToolPatch({
        fixtureOutput: {
          ...buildLocalOnlyChatGptAppPrototypeGoldenFixture("default_hidden").scaffold.tools[0]
            .fixtureOutput,
          summary: "Blocked. Review privacy.",
        },
      });

      expect(() => assertLocalOnlyChatGptAppPrototypeGoldenFixture(invalid as never)).toThrow(
        /fixture output summary is inconsistent|output summary drifted/u,
      );
    });

    it("rejects fixture output status drift", () => {
      const invalid = fixtureWithFirstToolPatch({
        fixtureOutput: {
          ...buildLocalOnlyChatGptAppPrototypeGoldenFixture("default_hidden").scaffold.tools[0]
            .fixtureOutput,
          status: "blocked",
        },
      });

      expect(() => assertLocalOnlyChatGptAppPrototypeGoldenFixture(invalid as never)).toThrow(
        /fixture output status is inconsistent|output status drifted/u,
      );
    });

    it("rejects fixture output refIds drift", () => {
      const invalid = fixtureWithFirstToolPatch({
        fixtureOutput: {
          ...buildLocalOnlyChatGptAppPrototypeGoldenFixture("default_hidden").scaffold.tools[0]
            .fixtureOutput,
          refIds: ["fixture:local_mcp.evidence_graph.summarize"],
        },
      });

      expect(() => assertLocalOnlyChatGptAppPrototypeGoldenFixture(invalid as never)).toThrow(
        /fixture output refIds are inconsistent|output refId drifted/u,
      );
    });

    it("rejects missing tool state", () => {
      const fixture = buildLocalOnlyChatGptAppPrototypeGoldenFixture("default_hidden");
      const invalid = {
        ...fixture,
        expectedToolStates: fixture.expectedToolStates.slice(1),
      };

      expect(() => assertLocalOnlyChatGptAppPrototypeGoldenFixture(invalid as never)).toThrow(
        /cover every tool/u,
      );
    });

    it("rejects duplicate tool state", () => {
      const fixture = buildLocalOnlyChatGptAppPrototypeGoldenFixture("default_hidden");
      const invalid = {
        ...fixture,
        expectedToolStates: [
          fixture.expectedToolStates[0],
          fixture.expectedToolStates[0],
          fixture.expectedToolStates[2],
          fixture.expectedToolStates[3],
        ],
      };

      expect(() => assertLocalOnlyChatGptAppPrototypeGoldenFixture(invalid as never)).toThrow(
        /tool order is invalid/u,
      );
    });

    it("rejects tool order drift", () => {
      const fixture = buildLocalOnlyChatGptAppPrototypeGoldenFixture("default_hidden");
      const invalid = {
        ...fixture,
        expectedToolStates: [
          fixture.expectedToolStates[1],
          fixture.expectedToolStates[0],
          fixture.expectedToolStates[2],
          fixture.expectedToolStates[3],
        ],
      };

      expect(() => assertLocalOnlyChatGptAppPrototypeGoldenFixture(invalid as never)).toThrow(
        /tool order is invalid/u,
      );
    });

    it.each([
      { name: "callable", patch: { callable: true }, expectedError: /callable drifted|must stay non-runnable/u },
      { name: "runnable", patch: { runnable: true }, expectedError: /runnable drifted|must stay non-runnable/u },
      { name: "reviewOnly", patch: { reviewOnly: false }, expectedError: /reviewOnly drifted|must stay non-runnable/u },
    ])("rejects scaffold non-runnable drift: $name", ({ patch, expectedError }) => {
      const invalid = fixtureWithFirstToolPatch(patch);

      expect(() => assertLocalOnlyChatGptAppPrototypeGoldenFixture(invalid as never)).toThrow(expectedError);
    });
  });

  describe("source guard", () => {
    it("keeps golden fixtures free from SDK, transport, runtime, and outbound action code", () => {
      expect(source).not.toMatch(
        /(?:from\s+["']|import\s+["'])(?:@openai(?:\/[^"']*)?|openai|@modelcontextprotocol(?:\/[^"']*)?|next\/server|convex)["']/u,
      );
      expect(source).not.toMatch(/\b(?:fetch|WebSocket|EventSource)\b|registerTool|registerResource|server\.connect/u);
      expect(source).not.toMatch(
        /\b(?:exportFile|downloadFile|sendEmail|submitApplication|applyToJob)\b/u,
      );
    });
  });
});

function expectEveryToolState(
  fixture: LocalOnlyChatGptAppPrototypeGoldenFixtureV1,
  expected: Pick<
    LocalOnlyChatGptAppPrototypeGoldenToolStateV1,
    | "exposureState"
    | "gateStatus"
    | "gatePassedForInternalReview"
    | "userFacingCopy"
    | "safeSummary"
  >,
): void {
  fixture.expectedToolStates.forEach((toolState, index) => {
    expect(toolState).toMatchObject({
      localToolId: EXPECTED_LOCAL_TOOL_IDS[index],
      ...expected,
      fixtureStatus: expected.exposureState,
      fixtureSummary: expected.safeSummary,
      refId: `fixture:${EXPECTED_LOCAL_TOOL_IDS[index]}`,
      callable: false,
      runnable: false,
      reviewOnly: true,
      version: 1,
    });
    expectToolMatchesExpected(fixture, toolState, index);
  });
}

function expectToolMatchesExpected(
  fixture: LocalOnlyChatGptAppPrototypeGoldenFixtureV1,
  expected: LocalOnlyChatGptAppPrototypeGoldenToolStateV1,
  index: number,
): void {
  const tool = fixture.scaffold.tools[index];
  expect(tool.localToolId).toBe(expected.localToolId);
  expect(tool.exposureState).toBe(expected.exposureState);
  expect(tool.gateStatus).toBe(expected.gateStatus);
  expect(tool.gatePassedForInternalReview).toBe(expected.gatePassedForInternalReview);
  expect(tool.userFacingCopy).toBe(expected.userFacingCopy);
  expect(tool.safeSummary).toBe(expected.safeSummary);
  expect(tool.fixtureOutput.status).toBe(expected.fixtureStatus);
  expect(tool.fixtureOutput.summary).toBe(expected.fixtureSummary);
  expect(tool.fixtureOutput.refIds).toEqual([expected.refId]);
  expect(tool.callable).toBe(false);
  expect(tool.runnable).toBe(false);
  expect(tool.reviewOnly).toBe(true);
}

function fixtureWithPatch(patch: Readonly<Record<string, unknown>>): unknown {
  return {
    ...buildLocalOnlyChatGptAppPrototypeGoldenFixture("default_hidden"),
    ...patch,
  };
}

function fixtureWithExpectedToolStatePatch(
  indexToPatch: number,
  patch: Readonly<Record<string, unknown>>,
): unknown {
  const fixture = buildLocalOnlyChatGptAppPrototypeGoldenFixture("default_hidden");
  return {
    ...fixture,
    expectedToolStates: fixture.expectedToolStates.map((expected, index) =>
      index === indexToPatch
        ? {
            ...expected,
            ...patch,
          }
        : expected,
    ),
  };
}

function fixtureWithFirstToolPatch(patch: Readonly<Record<string, unknown>>): unknown {
  const fixture = buildLocalOnlyChatGptAppPrototypeGoldenFixture("default_hidden");
  return {
    ...fixture,
    scaffold: {
      ...fixture.scaffold,
      tools: fixture.scaffold.tools.map((tool, index) =>
        index === 0
          ? {
              ...tool,
              ...patch,
            }
          : tool,
      ),
    },
  };
}
