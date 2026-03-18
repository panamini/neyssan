import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const proposalInputFormSource = readFileSync(
  resolve(process.cwd(), "src/components/ProposalInputForm.tsx"),
  "utf8",
);

describe("ProposalInputForm request-state contract", () => {
  it("guards duplicate submits while a generation is already in flight", () => {
    expect(proposalInputFormSource).toContain(
      "if (isGenerating) {\n      return;\n    }",
    );
  });

  it("disables the submit button while generation is running", () => {
    expect(proposalInputFormSource).toContain(
      'disabled={isGenerating || watchedJobDescription.length < 10}',
    );
  });

  it("uses a loading spinner instead of a stop icon while generating", () => {
    expect(proposalInputFormSource).toContain("Loader2");
    expect(proposalInputFormSource).toContain("animate-spin");
    expect(proposalInputFormSource).not.toContain("Square");
  });
});
