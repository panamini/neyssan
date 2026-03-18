import { describe, it, expect } from "vitest";
import { pickBestCandidate } from "../strictProfileAdapter";

type CandidateLike = NonNullable<Parameters<typeof pickBestCandidate>[0]>;

describe("strictProfileAdapter section bonus", () => {
  it("prefers candidates aligned with the experience section", () => {
    const llmCandidate: CandidateLike = {
      value: "Security Officer",
      conf: 0.6,
      source: "llm",
      section: null,
      bonusApplied: false,
    };

    const heurCandidate: CandidateLike = {
      value: "Security Officer",
      conf: 0.6,
      source: "heuristic",
      section: "ROLE",
      bonusApplied: false,
    };

    const result = pickBestCandidate(llmCandidate, heurCandidate, 0.7, "experience");

    expect(result.source).toBe("heuristic");
    expect(result.section).toBe("ROLE");
    expect(result.bonusApplied).toBe(true);
    expect(result.conf).not.toBeNull();
    expect(result.conf).toBeCloseTo(0.75, 5);
  });
});
