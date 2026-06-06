import { jsonToConvex, type ValidatorJSON } from "convex/values";
import { describe, expect, it } from "vitest";

import {
  canonicalizeUserProfileMetadata,
  userProfileMetadataValidator,
} from "../userProfileMetadata";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function matchesValidator(validator: ValidatorJSON, value: unknown): boolean {
  switch (validator.type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    case "literal":
      return value === jsonToConvex(validator.value);
    case "union":
      return validator.value.some((member) => matchesValidator(member, value));
    case "object": {
      if (!isPlainObject(value)) {
        return false;
      }

      const allowedKeys = new Set(Object.keys(validator.value));
      if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
        return false;
      }

      return Object.entries(validator.value).every(([key, field]) => {
        if (!(key in value)) {
          return field.optional;
        }
        return matchesValidator(field.fieldType, value[key]);
      });
    }
    case "record": {
      if (!isPlainObject(value)) {
        return false;
      }
      return Object.entries(value).every(
        ([key, entry]) =>
          matchesValidator(validator.keys, key) &&
          matchesValidator(validator.values.fieldType, entry),
      );
    }
    default:
      throw new Error(
        `Unsupported validator kind in test helper: ${validator.type}`,
      );
  }
}

describe("userProfileMetadata", () => {
  it("accepts metadata with canonical verbatiStyle values", () => {
    expect(
      matchesValidator(userProfileMetadataValidator.json, {
        source: "upload",
        importedAt: 123,
        confidence: 0.82,
        filename: "resume.pdf",
        verbatiStyle: {
          layout: "swiss",
          palette: "bordeaux",
          typography: "soft-serif",
          accentHex: "#8f233b",
        },
      }),
    ).toBe(true);
  });

  it("accepts workshop as a stored layout", () => {
    expect(
      matchesValidator(userProfileMetadataValidator.json, {
        verbatiStyle: {
          layout: "workshop",
          palette: "bordeaux",
          typography: "soft-serif",
        },
      }),
    ).toBe(true);
  });

  it("accepts legacy aliases on read and canonicalizes them for the next write", () => {
    const legacyMetadata = {
      source: "legacy",
      verbatiStyle: {
        layout: "playful-photo",
        palette: "sauge",
        typography: "engaging",
        accentHex: "#336699",
      },
    };

    expect(
      matchesValidator(userProfileMetadataValidator.json, legacyMetadata),
    ).toBe(true);
    expect(canonicalizeUserProfileMetadata(legacyMetadata)).toEqual({
      source: "legacy",
      verbatiStyle: {
        layout: "two-column",
        palette: "sauge",
        typography: "soft-serif",
        accentHex: "#336699",
      },
    });
  });

  it("accepts document style slot metadata and base snapshots", () => {
    expect(
      matchesValidator(userProfileMetadataValidator.json, {
        titleLocked: true,
        verbatiStyleSlotId: 2,
        verbatiStyleSlotSource: "settings",
        verbatiStyleSlotNameSnapshot: "Style 2",
        verbatiStyleBaseSnapshot: {
          familyId: "workshop",
          layout: "workshop",
          palette: "cobalt",
          typography: "civic-correspondence",
        },
        documentStyleVersion: 1,
      }),
    ).toBe(true);

    expect(
      matchesValidator(userProfileMetadataValidator.json, {
        verbatiStyleSlotId: 4,
      }),
    ).toBe(false);
  });

  it("accepts CV document decoration image metadata", () => {
    expect(
      matchesValidator(userProfileMetadataValidator.json, {
        documentDecoration: {
          visible: true,
          source: "upload",
          dataUrl: "data:image/png;base64,AAAA",
          fileName: "portrait.png",
          mimeType: "image/png",
          sizePreset: "custom",
          customSizeMm: 41,
          fit: "cover",
          placementMode: "custom",
          xMm: 42,
          yMm: 56,
        },
      }),
    ).toBe(true);

    expect(
      matchesValidator(userProfileMetadataValidator.json, {
        profileImage: {
          src: "data:image/png;base64,AAAA",
          fileName: "legacy-portrait.png",
          size: "medium",
          fit: "contain",
        },
      }),
    ).toBe(true);
  });

  it("accepts CV document icon metadata saved by style controls", () => {
    expect(
      matchesValidator(userProfileMetadataValidator.json, {
        documentDecoration: {
          visible: true,
          source: "upload",
          assetId: "kg2d4jp1zben95th6293bqftb98832ed",
          fileName: "8f2ac4f0-624b-4bb4-a296-a350ceca02d7.png",
          fit: "contain",
          mimeType: "image/png",
          placementMode: "default",
          sizePreset: 35,
          xMm: 17,
          yMm: 35,
        },
        documentIcons: {
          color: "accent",
          defaultListMarkerKey: "dot",
          listMarkerType: "dot",
          sectionHeadingIconMode: "custom",
          sectionIconMap: {},
          sizePt: 8,
        },
        documentIconOverrides: {
          listItems: {
            "skills|skills|skill-1|item||0": "check",
          },
        },
        documentStyleVersion: 1,
        resumeTemplateId: "workshop_resume_onecol_ats",
        verbatiStyle: {
          layout: "workshop",
          palette: "ink",
          resumeTemplateId: "workshop_resume_onecol_ats",
          typography: "geist-baskervville",
        },
        verbatiStyleBaseSnapshot: {
          familyId: "workshop",
          layout: "workshop",
          palette: "ink",
          resumeTemplateId: "workshop_resume_onecol_ats",
          typography: "geist-baskervville",
        },
        verbatiStyleSlotId: 1,
        verbatiStyleSlotNameSnapshot: "Style 1",
        verbatiStyleSlotSource: "settings",
      }),
    ).toBe(true);
  });

  it("accepts the Maggie resume template metadata emitted by the CV template picker", () => {
    expect(
      matchesValidator(userProfileMetadataValidator.json, {
        resumeTemplateId: "maggie_letter_resume",
        verbatiStyle: {
          layout: "workshop",
          palette: "sauge",
          resumeTemplateId: "maggie_letter_resume",
          typography: "geist-baskervville",
        },
        verbatiStyleBaseSnapshot: {
          familyId: "workshop",
          layout: "workshop",
          palette: "sauge",
          resumeTemplateId: "maggie_letter_resume",
          typography: "geist-baskervville",
        },
      }),
    ).toBe(true);
  });

  it("keeps existing allowed metadata fields valid without verbatiStyle", () => {
    expect(
      matchesValidator(userProfileMetadataValidator.json, {
        source: "pdf",
        importedAt: 99,
        confidence: 0.4,
        filename: "candidate.pdf",
      }),
    ).toBe(true);
  });

  it("rejects invalid verbatiStyle shapes", () => {
    expect(
      matchesValidator(userProfileMetadataValidator.json, {
        verbatiStyle: {
          layout: "unknown-layout",
          palette: "bordeaux",
          typography: "soft-serif",
        },
      }),
    ).toBe(false);

    expect(
      matchesValidator(userProfileMetadataValidator.json, {
        verbatiStyle: {
          layout: "swiss",
          palette: "unknown-palette",
          typography: "soft-serif",
        },
      }),
    ).toBe(false);

    expect(
      matchesValidator(userProfileMetadataValidator.json, {
        verbatiStyle: {
          layout: "swiss",
          palette: "bordeaux",
          typography: "unknown-typography",
        },
      }),
    ).toBe(false);

    expect(
      matchesValidator(userProfileMetadataValidator.json, {
        verbatiStyle: {
          layout: "swiss",
          palette: "bordeaux",
          typography: "soft-serif",
          accentHex: 42,
        },
      }),
    ).toBe(false);
  });
});
