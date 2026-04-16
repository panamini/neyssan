import { describe, expect, it } from "vitest";

import { DEFAULT_VERBATI_STYLE } from "../style";
import {
  canonicalizeVisualStyle,
  deriveDirtyFields,
  deriveVisualStyleDiff,
  resolveProposalStyle,
  resolveProposalStyleStatus,
  resolveAppliedVisualStyleState,
} from "../styleState";

describe("verbati visual style state", () => {
  it("canonicalizes style candidates before comparison and diffing", () => {
    expect(
      canonicalizeVisualStyle({
        layout: "modernist",
        typography: "expert",
        palette: "encre",
      }),
    ).toEqual({
      layout: "modernist",
      typography: "mono-signal",
      palette: "encre",
      accentHex: undefined,
    });
  });

  it("returns an inherited state when the proposal still matches the attached cv style", () => {
    const state = resolveAppliedVisualStyleState({
      currentStyle: {
        layout: "modernist",
        typography: "expert",
        palette: "encre",
      },
      source: {
        kind: "cv_inherited",
        inheritedFromCvId: "cv_123",
        style: {
          layout: "modernist",
          typography: "mono-signal",
          palette: "encre",
        },
      },
    });

    expect(state.provenance).toEqual({
      kind: "cv_inherited",
      inheritedFromCvId: "cv_123",
    });
    expect(state.diff).toBeNull();
    expect(state.dirty).toBe(false);
  });

  it("keeps detached provenance explicit and exposes a typed diff from the cv source", () => {
    const state = resolveAppliedVisualStyleState({
      currentStyle: {
        layout: "two-column",
        typography: "mono-signal",
        palette: "custom",
        accentHex: "#AA7733",
      },
      source: {
        kind: "detached",
        inheritedFromCvId: "cv_123",
        style: {
          layout: "two-column",
          typography: "mono-signal",
          palette: "encre",
        },
      },
    });

    expect(state.provenance).toEqual({
      kind: "detached",
      inheritedFromCvId: "cv_123",
    });
    expect(state.diff).toEqual({
      palette: { from: "encre", to: "custom" },
      accentHex: { from: undefined, to: "#aa7733" },
    });
    expect(state.dirty).toBe(true);
  });

  it("marks standalone workspace styles as custom_no_preset", () => {
    const state = resolveAppliedVisualStyleState({
      currentStyle: {
        layout: "swiss",
        typography: "signature",
        palette: "pierre",
      },
      source: {
        kind: "custom_no_preset",
      },
    });

    expect(state.provenance).toEqual({
      kind: "custom_no_preset",
    });
    expect(state.diff).toBeNull();
    expect(state.dirty).toBe(false);
  });

  it("derives dirty fields from the typed visual diff", () => {
    const diff = deriveVisualStyleDiff(
      {
        layout: "swiss",
        typography: "signature",
        palette: "sauge",
      },
      {
        layout: "swiss",
        typography: "engaging",
        palette: "custom",
        accentHex: "#1155AA",
      },
    );

    expect(diff).toEqual({
      typography: { from: "quiet-editorial", to: "soft-serif" },
      palette: { from: "sauge", to: "custom" },
      accentHex: { from: undefined, to: "#1155aa" },
    });
    expect(deriveDirtyFields(diff)).toEqual(["typography", "palette", "accentHex"]);
  });

  it("follows the attached cv style until a direct workspace edit detaches it", () => {
    expect(
      resolveProposalStyle({
        workspaceStyle: null,
        metadataStyle: {
          layout: "swiss",
          typography: "signature",
          palette: "pierre",
        },
        cvStyle: {
          layout: "modernist",
          typography: "expert",
          palette: "encre",
        },
        hasUserEditedStyle: false,
        isCvAttached: true,
      }),
    ).toEqual({
      style: {
        layout: "modernist",
        typography: "mono-signal",
        palette: "encre",
        accentHex: undefined,
      },
      source: "cv",
    });

    expect(
      resolveProposalStyle({
        workspaceStyle: {
          layout: "swiss",
          typography: "engaging",
          palette: "bordeaux",
        },
        metadataStyle: {
          layout: "swiss",
          typography: "signature",
          palette: "pierre",
        },
        cvStyle: {
          layout: "modernist",
          typography: "expert",
          palette: "encre",
        },
        hasUserEditedStyle: true,
        isCvAttached: true,
      }),
    ).toEqual({
      style: {
        layout: "swiss",
        typography: "soft-serif",
        palette: "bordeaux",
        accentHex: undefined,
      },
      source: "custom",
    });

    expect(
      resolveProposalStyle({
        workspaceStyle: null,
        metadataStyle: null,
        cvStyle: null,
        hasUserEditedStyle: false,
        isCvAttached: false,
      }),
    ).toEqual({
      style: DEFAULT_VERBATI_STYLE,
      source: "default",
    });
  });

  it("reports reset availability from the proposal source cv relationship", () => {
    expect(
      resolveProposalStyleStatus({
        sourceCvId: "cv_123",
        sourceCvLabel: "Alex Martin Resume",
        styleSource: "custom",
        hasSourceCvStyle: true,
      }),
    ).toEqual({
      sourceCvId: "cv_123",
      sourceCvLabel: "Alex Martin Resume",
      styleSource: "custom",
      canResetToCv: true,
    });
  });

  it("keeps inherited cv style authoritative over stored metadata when link mode stays inherited", () => {
    expect(
      resolveProposalStyle({
        workspaceStyle: null,
        metadataStyle: {
          layout: "swiss",
          typography: "signature",
          palette: "bordeaux",
        },
        cvStyle: {
          layout: "editorial",
          typography: "engaging",
          palette: "encre",
        },
        hasUserEditedStyle: false,
        isCvAttached: true,
      }),
    ).toEqual({
      style: {
        layout: "editorial",
        typography: "soft-serif",
        palette: "encre",
        accentHex: undefined,
      },
      source: "cv",
    });
  });
});
