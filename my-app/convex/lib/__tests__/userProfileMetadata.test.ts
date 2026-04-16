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
    default:
      throw new Error(`Unsupported validator kind in test helper: ${validator.type}`);
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
