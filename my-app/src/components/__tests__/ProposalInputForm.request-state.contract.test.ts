import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const proposalInputFormSource = readFileSync(
  resolve(process.cwd(), "src/components/ProposalInputForm.tsx"),
  "utf8",
);

describe("ProposalInputForm request-state contract", () => {
  it("marks bottom compose toolbar triggers so tooltips render above the frame with trigger-based spacing", () => {
    expect(proposalInputFormSource).toContain(
      "dasti-toolbar-tooltip-trigger--above",
    );
  });

  it("guards duplicate submits while a generation is already in flight", () => {
    expect(proposalInputFormSource).toContain(
      "if (isGenerating) {\n      return;\n    }",
    );
  });

  it("keeps the submit button non-submittable while generation is running", () => {
    expect(proposalInputFormSource).toContain(
      'type={canSubmitGeneration ? "submit" : "button"}',
    );
  });

  it("uses the canonical primary button with a static proposal glyph for generate and stop states", () => {
    expect(proposalInputFormSource).toContain("ProposalGenerateButtonGlyph");
    expect(proposalInputFormSource).toContain('"dasti-button--primary"');
    expect(proposalInputFormSource).toContain('"dasti-button--pill"');
    expect(proposalInputFormSource).toContain('"dasti-button--sm"');
    expect(proposalInputFormSource).toContain('"loading-stop"');
    expect(proposalInputFormSource).toContain("canStopGeneration");
    expect(proposalInputFormSource).not.toContain("dasti-proposal-submit-token");
    expect(proposalInputFormSource).not.toContain("dasti-proposal-submit--pop");
  });

  it("navigates back to Resume through the router instead of raw history pushState", () => {
    expect(proposalInputFormSource).toContain("useNavigate");
    expect(proposalInputFormSource).toContain("navigate(`/cv?id=${encodeURIComponent(id)}`)");
    expect(proposalInputFormSource).not.toContain("window.history.pushState");
    expect(proposalInputFormSource).not.toContain("new PopStateEvent");
  });
});
