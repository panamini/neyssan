import { describe, expect, it } from "vitest";
import {
  buildProposalOutputLanguageInstruction,
  resolveProposalOutputLanguageFromCode,
  resolveProposalPlannerOutputLanguageFromCode,
} from "../proposalOutput";

describe("proposal output language", () => {
  it("maps document language codes to writer and planner language contracts", () => {
    expect(resolveProposalOutputLanguageFromCode("fr")).toBe("French");
    expect(resolveProposalOutputLanguageFromCode("ru")).toBe("Russian");
    expect(resolveProposalOutputLanguageFromCode("ar")).toBe("Arabic");
    expect(resolveProposalPlannerOutputLanguageFromCode("de")).toBe("de");
    expect(resolveProposalPlannerOutputLanguageFromCode("ga")).toBeNull();
  });

  it("builds explicit non-UI language instructions for generated documents", () => {
    expect(buildProposalOutputLanguageInstruction("Russian")).toContain(
      "Write the generated text in Russian.",
    );
    expect(buildProposalOutputLanguageInstruction("Arabic")).toContain(
      "Use natural right-to-left Arabic prose",
    );
  });
});
