import { describe, expect, it } from "vitest";

import { computeMatchRead } from "../matchRead";
import { buildMatchReadTelemetryArgs } from "../telemetry";

describe("matchRead", () => {
  it("returns a strong match for high-overlap profile signals", () => {
    const result = computeMatchRead({
      now: 1234,
      profile: {
        id: "profile_1",
        skills: ["Airtable", "Vendor Operations"],
        keywords: ["launch planning", "cross-functional communication"],
      },
      job: {
        id: "job_1",
        parseStatus: "parsed",
        mustHavesExtraction: [
          { value: "Airtable", confidence: 0.9, sourceSpan: null },
          {
            value: "Vendor operations",
            confidence: 0.9,
            sourceSpan: null,
          },
        ],
        keywordsExtraction: [
          {
            value: "Cross-functional communication",
            confidence: 0.82,
            sourceSpan: null,
          },
          { value: "Program management", confidence: 0.8, sourceSpan: null },
        ],
      },
    });

    expect(result.tier).toBe("strong");
    expect(result.score).toBe(75);
    expect(result.scoreVisible).toBe(true);
    expect(result.confidence).toBe("high");
    expect(result.matched).toEqual([
      "Airtable",
      "Vendor operations",
      "Cross-functional communication",
    ]);
    expect(result.missing).toEqual(["Program management"]);
    expect(result.fallback).toBe("none");
    expect(result.computedAt).toBe(1234);
  });

  it("returns unknown when the profile is missing actionable signals", () => {
    const result = computeMatchRead({
      profile: {
        id: "profile_1",
        skills: [],
        keywords: [],
      },
      job: {
        id: "job_1",
        parseStatus: "parsed",
        mustHaves: ["Airtable", "Vendor operations"],
        keywords: ["Communication"],
      },
      now: 1234,
    });

    expect(result.tier).toBe("unknown");
    expect(result.score).toBeNull();
    expect(result.scoreVisible).toBe(false);
    expect(result.confidence).toBe("low");
    expect(result.fallback).toBe("profile_missing");
    expect(result.missing).toEqual([
      "Airtable",
      "Vendor operations",
      "Communication",
    ]);
  });

  it("returns unknown when the job parse failed", () => {
    const result = computeMatchRead({
      profile: {
        id: "profile_1",
        skills: ["Airtable"],
        keywords: ["operations"],
      },
      job: {
        id: "job_1",
        parseStatus: "failed",
        mustHaves: ["Airtable"],
      },
    });

    expect(result.tier).toBe("unknown");
    expect(result.fallback).toBe("parse_failed");
    expect(result.scoreVisible).toBe(false);
    expect(result.matched).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  it("hides the score when the match confidence is low", () => {
    const result = computeMatchRead({
      profile: {
        id: "profile_1",
        skills: ["communication"],
        keywords: [],
      },
      job: {
        id: "job_1",
        parseStatus: "parsed",
        mustHavesExtraction: [
          {
            value: "Cross-functional communication",
            confidence: 0.52,
            sourceSpan: null,
          },
        ],
        keywordsExtraction: [
          { value: "Documentation", confidence: 0.4, sourceSpan: null },
        ],
      },
    });

    expect(result.tier).toBe("partial");
    expect(result.score).toBe(50);
    expect(result.confidence).toBe("low");
    expect(result.scoreVisible).toBe(false);
  });

  it("builds a jobs-v2 metric payload for computed match reads", () => {
    const result = computeMatchRead({
      now: 1234,
      profile: {
        id: "profile_1",
        skills: ["Airtable"],
        keywords: ["vendor operations"],
      },
      job: {
        id: "job_1",
        parseStatus: "parsed",
        mustHavesExtraction: [
          { value: "Airtable", confidence: 0.9, sourceSpan: null },
        ],
        keywordsExtraction: [
          { value: "Vendor operations", confidence: 0.82, sourceSpan: null },
        ],
      },
    });

    expect(buildMatchReadTelemetryArgs(result)).toEqual({
      name: "jobs-v2:match_read_computed",
      value: 1,
      metadata: {
        namespace: "jobs-v2",
        event: "match_read_computed",
        jobId: "job_1",
        tier: "strong",
        confidence: "medium",
        method: "keyword-overlap",
        fallback: "none",
      },
      labels: {
        namespace: "jobs-v2",
        event: "match_read_computed",
        tier: "strong",
        confidence: "medium",
        method: "keyword-overlap",
        fallback: "none",
      },
    });
  });
});
