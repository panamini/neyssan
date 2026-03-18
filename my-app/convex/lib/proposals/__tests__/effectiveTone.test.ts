import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROPOSAL_TONE_PRESET,
  SIGNATURE_TONE_BASELINE,
  resolveEffectiveProposalTone,
} from "../effectiveTone";

describe("resolveEffectiveProposalTone", () => {
  it("fills missing values with the Signature baseline", () => {
    expect(resolveEffectiveProposalTone({})).toEqual(SIGNATURE_TONE_BASELINE);
  });

  it("treats Signature as the default backend-owned preset", () => {
    expect(
      resolveEffectiveProposalTone({
        tonePreset: DEFAULT_PROPOSAL_TONE_PRESET,
      }),
    ).toEqual(SIGNATURE_TONE_BASELINE);
  });

  it("preserves valid explicit user-selected values", () => {
    expect(
      resolveEffectiveProposalTone({
        tonePreset: DEFAULT_PROPOSAL_TONE_PRESET,
        formalityLevel: "formal",
        creativity: "high",
      }),
    ).toEqual({
      formalityLevel: "formal",
      creativity: "high",
    });
  });

  it("maps expert to a conservative formal baseline", () => {
    expect(
      resolveEffectiveProposalTone({
        tonePreset: "expert",
      }),
    ).toEqual({
      formalityLevel: "formal",
      creativity: "low",
    });
  });

  it("maps direct to a neutral low baseline", () => {
    expect(
      resolveEffectiveProposalTone({
        tonePreset: "direct",
      }),
    ).toEqual({
      formalityLevel: "neutral",
      creativity: "low",
    });
  });

  it("maps engaging to the shared neutral medium baseline", () => {
    expect(
      resolveEffectiveProposalTone({
        tonePreset: "engaging",
      }),
    ).toEqual({
      formalityLevel: "neutral",
      creativity: "medium",
    });
  });

  it("keeps storyteller grounded on a neutral medium baseline", () => {
    expect(
      resolveEffectiveProposalTone({
        tonePreset: "storyteller",
      }),
    ).toEqual({
      formalityLevel: "neutral",
      creativity: "medium",
    });
  });

  it("lets explicit advanced controls override a preset baseline", () => {
    expect(
      resolveEffectiveProposalTone({
        tonePreset: "expert",
        formalityLevel: "informal",
        creativity: "high",
      }),
    ).toEqual({
      formalityLevel: "informal",
      creativity: "high",
    });
  });

  it("narrowly normalizes legacy extension creativity values", () => {
    expect(
      resolveEffectiveProposalTone({
        formalityLevel: "neutral",
        creativity: "standard",
      }),
    ).toEqual({
      formalityLevel: "neutral",
      creativity: "medium",
    });
  });

  it("falls back only for invalid or blank inputs", () => {
    expect(
      resolveEffectiveProposalTone({
        formalityLevel: "  ",
        creativity: "unexpected",
      }),
    ).toEqual(SIGNATURE_TONE_BASELINE);
  });

  it("falls back to signature for invalid presets", () => {
    expect(
      resolveEffectiveProposalTone({
        tonePreset: "unknown",
      }),
    ).toEqual(SIGNATURE_TONE_BASELINE);
  });
});
