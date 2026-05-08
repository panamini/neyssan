export type ProposalSignatureMode = "auto" | "font" | "image";

export type ProposalSignatureFontId =
  | "chaumont"
  | "fd-garamond"
  | "parisienne";

export type ProposalSignatureSettings = {
  mode: ProposalSignatureMode;
  fontId: ProposalSignatureFontId | null;
  imageDataUrl: string | null;
};

export type ProposalSignatureRender =
  | {
      kind: "text";
      fontFamily: string;
      imageDataUrl?: string | null;
    }
  | {
      kind: "image";
      imageDataUrl: string;
    };

export const DEFAULT_PROPOSAL_SIGNATURE_SETTINGS: ProposalSignatureSettings = {
  mode: "auto",
  fontId: null,
  imageDataUrl: null,
};

export const PROPOSAL_SIGNATURE_FONT_OPTIONS: Array<{
  id: ProposalSignatureFontId;
  label: string;
  fontFamily: string;
}> = [
  {
    id: "chaumont",
    label: "Chaumont",
    fontFamily: `"Chaumont Script", "Snell Roundhand", "Apple Chancery", cursive`,
  },
  {
    id: "fd-garamond",
    label: "FD Garamond",
    fontFamily: `"FD Garamond", Garamond, "Times New Roman", serif`,
  },
  {
    id: "parisienne",
    label: "Parisienne",
    fontFamily: `Parisienne, "Snell Roundhand", "Apple Chancery", cursive`,
  },
];

const SIGNATURE_IMAGE_DATA_URL_PATTERN =
  /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i;

export function sanitizeProposalSignatureImageDataUrl(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return SIGNATURE_IMAGE_DATA_URL_PATTERN.test(trimmed) ? trimmed : null;
}

export function sanitizeProposalSignatureFontId(
  value: unknown,
): ProposalSignatureFontId | null {
  return PROPOSAL_SIGNATURE_FONT_OPTIONS.some((option) => option.id === value)
    ? (value as ProposalSignatureFontId)
    : null;
}

export function sanitizeProposalSignatureSettings(
  value: unknown,
): ProposalSignatureSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_PROPOSAL_SIGNATURE_SETTINGS;
  }

  const record = value as Partial<ProposalSignatureSettings>;
  const imageDataUrl = sanitizeProposalSignatureImageDataUrl(
    record.imageDataUrl,
  );

  if (record.mode === "image" && imageDataUrl) {
    return {
      mode: "image",
      fontId: null,
      imageDataUrl,
    };
  }

  const fontId = sanitizeProposalSignatureFontId(record.fontId);
  if (record.mode === "font" && fontId) {
    return {
      mode: "font",
      fontId,
      imageDataUrl,
    };
  }

  if (record.mode === "auto") {
    return {
      mode: "auto",
      fontId: null,
      imageDataUrl,
    };
  }

  return DEFAULT_PROPOSAL_SIGNATURE_SETTINGS;
}

export function resolveProposalSignatureRender(args: {
  settings?: ProposalSignatureSettings | null;
  bodyFontFamily: string;
}): ProposalSignatureRender {
  const settings = sanitizeProposalSignatureSettings(args.settings);

  if (settings.mode === "image" && settings.imageDataUrl) {
    return {
      kind: "image",
      imageDataUrl: settings.imageDataUrl,
    };
  }

  if (settings.mode === "font" && settings.fontId) {
    const option = PROPOSAL_SIGNATURE_FONT_OPTIONS.find(
      (candidate) => candidate.id === settings.fontId,
    );
    if (option) {
      return {
        kind: "text",
        fontFamily: option.fontFamily,
        imageDataUrl: settings.imageDataUrl,
      };
    }
  }

  return {
    kind: "text",
    fontFamily: args.bodyFontFamily,
    imageDataUrl: settings.imageDataUrl,
  };
}
