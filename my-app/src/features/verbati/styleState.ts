import {
  resolveVerbatiStyle,
  sanitizePersistedVerbatiStyle,
  serializeVerbatiStyle,
} from "./style";
import type { VerbatiStylePreset } from "./types";

type VisualStyleCandidate =
  | Partial<VerbatiStylePreset>
  | VerbatiStylePreset
  | null
  | undefined;

export type VisualStyleDiff = {
  layout?: {
    from: VerbatiStylePreset["layout"];
    to: VerbatiStylePreset["layout"];
  };
  typography?: {
    from: VerbatiStylePreset["typography"];
    to: VerbatiStylePreset["typography"];
  };
  palette?: {
    from: VerbatiStylePreset["palette"];
    to: VerbatiStylePreset["palette"];
  };
  accentHex?: {
    from?: string;
    to?: string;
  };
  resumeTemplateId?: {
    from?: VerbatiStylePreset["resumeTemplateId"];
    to?: VerbatiStylePreset["resumeTemplateId"];
  };
};

export type VisualStyleDirtyField = keyof VisualStyleDiff;
export type StyleSource = "cv" | "custom" | "default";
export type ProposalStyleStatus = {
  sourceCvId?: string | null;
  sourceCvLabel?: string | null;
  styleSource: StyleSource;
  canResetToCv: boolean;
};

export type VisualStyleProvenance =
  | {
      kind: "cv_inherited";
      inheritedFromCvId?: string;
    }
  | {
      kind: "detached";
      inheritedFromCvId?: string;
    }
  | {
      kind: "preset";
      presetId?: string;
      presetNameSnapshot?: string;
    }
  | {
      kind: "preset_custom";
      presetId?: string;
      presetNameSnapshot?: string;
    }
  | {
      kind: "custom_no_preset";
    };

type VisualStyleSource =
  | ({
      kind: "cv_inherited" | "detached";
      inheritedFromCvId?: string;
    } & {
      style: VisualStyleCandidate;
    })
  | ({
      kind: "preset" | "preset_custom";
      presetId?: string;
      presetNameSnapshot?: string;
    } & {
      style: VisualStyleCandidate;
    })
  | {
      kind: "custom_no_preset";
    };

export type ResolvedVisualStyleState = {
  style: VerbatiStylePreset;
  provenance: VisualStyleProvenance;
  diff: VisualStyleDiff | null;
  dirty: boolean;
};

export type ResolveProposalStyleArgs = {
  workspaceStyle?: VisualStyleCandidate;
  metadataStyle?: VisualStyleCandidate;
  cvStyle?: VisualStyleCandidate;
  hasUserEditedStyle: boolean;
  isCvAttached: boolean;
};

export type ResolveProposalStyleStatusArgs = {
  sourceCvId?: string | null;
  sourceCvLabel?: string | null;
  styleSource: StyleSource;
  hasSourceCvStyle?: boolean;
};

export function canonicalizeVisualStyle(
  candidate: VisualStyleCandidate,
): VerbatiStylePreset {
  return (
    sanitizePersistedVerbatiStyle(candidate) ??
    serializeVerbatiStyle(resolveVerbatiStyle(candidate))
  );
}

export function deriveVisualStyleDiff(
  fromStyle: VisualStyleCandidate,
  toStyle: VisualStyleCandidate,
): VisualStyleDiff | null {
  const from = canonicalizeVisualStyle(fromStyle);
  const to = canonicalizeVisualStyle(toStyle);
  const diff: VisualStyleDiff = {};

  if (from.layout !== to.layout) {
    diff.layout = { from: from.layout, to: to.layout };
  }

  if (from.typography !== to.typography) {
    diff.typography = { from: from.typography, to: to.typography };
  }

  if (from.palette !== to.palette) {
    diff.palette = { from: from.palette, to: to.palette };
  }

  if ((from.accentHex ?? undefined) !== (to.accentHex ?? undefined)) {
    diff.accentHex = {
      from: from.accentHex ?? undefined,
      to: to.accentHex ?? undefined,
    };
  }

  if ((from.resumeTemplateId ?? undefined) !== (to.resumeTemplateId ?? undefined)) {
    diff.resumeTemplateId = {
      from: from.resumeTemplateId ?? undefined,
      to: to.resumeTemplateId ?? undefined,
    };
  }

  return Object.keys(diff).length > 0 ? diff : null;
}

export function deriveDirtyFields(
  diff: VisualStyleDiff | null,
): VisualStyleDirtyField[] {
  if (!diff) {
    return [];
  }

  return (
    ["layout", "typography", "palette", "accentHex", "resumeTemplateId"] as const
  ).filter((field) => Boolean(diff[field]));
}

export function resolveProposalStyle({
  workspaceStyle,
  metadataStyle,
  cvStyle,
  hasUserEditedStyle,
  isCvAttached,
}: ResolveProposalStyleArgs): {
  style: VerbatiStylePreset;
  source: StyleSource;
} {
  if (hasUserEditedStyle && workspaceStyle) {
    return {
      style: canonicalizeVisualStyle(workspaceStyle),
      source: "custom",
    };
  }

  if (!hasUserEditedStyle && isCvAttached && cvStyle) {
    return {
      style: canonicalizeVisualStyle(cvStyle),
      source: "cv",
    };
  }

  if (metadataStyle) {
    return {
      style: canonicalizeVisualStyle(metadataStyle),
      source: hasUserEditedStyle ? "custom" : "default",
    };
  }

  return {
    style: canonicalizeVisualStyle(undefined),
    source: "default",
  };
}

export function resolveProposalStyleStatus({
  sourceCvId = null,
  sourceCvLabel = null,
  styleSource,
  hasSourceCvStyle = false,
}: ResolveProposalStyleStatusArgs): ProposalStyleStatus {
  return {
    sourceCvId,
    sourceCvLabel,
    styleSource,
    canResetToCv: Boolean(sourceCvId && hasSourceCvStyle),
  };
}

export function resolveAppliedVisualStyleState(args: {
  currentStyle: VisualStyleCandidate;
  source: VisualStyleSource;
}): ResolvedVisualStyleState {
  const style = canonicalizeVisualStyle(args.currentStyle);

  if (args.source.kind === "custom_no_preset") {
    return {
      style,
      provenance: { kind: "custom_no_preset" },
      diff: null,
      dirty: false,
    };
  }

  const diff = deriveVisualStyleDiff(args.source.style, style);
  const dirty = diff !== null;

  if (args.source.kind === "cv_inherited") {
    return {
      style,
      provenance: dirty
        ? {
            kind: "detached",
            inheritedFromCvId: args.source.inheritedFromCvId,
          }
        : {
            kind: "cv_inherited",
            inheritedFromCvId: args.source.inheritedFromCvId,
          },
      diff,
      dirty,
    };
  }

  if (args.source.kind === "preset") {
    return {
      style,
      provenance: dirty
        ? {
            kind: "preset_custom",
            presetId: args.source.presetId,
            presetNameSnapshot: args.source.presetNameSnapshot,
          }
        : {
            kind: "preset",
            presetId: args.source.presetId,
            presetNameSnapshot: args.source.presetNameSnapshot,
          },
      diff,
      dirty,
    };
  }

  if (args.source.kind === "detached") {
    return {
      style,
      provenance: {
        kind: "detached",
        inheritedFromCvId: args.source.inheritedFromCvId,
      },
      diff,
      dirty,
    };
  }

  if (args.source.kind === "preset_custom") {
    return {
      style,
      provenance: {
        kind: "preset_custom",
        presetId: args.source.presetId,
        presetNameSnapshot: args.source.presetNameSnapshot,
      },
      diff,
      dirty,
    };
  }

  return {
    style,
    provenance: { kind: "custom_no_preset" },
    diff,
    dirty,
  };
}
