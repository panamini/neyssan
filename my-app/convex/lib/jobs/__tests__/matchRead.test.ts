import { describe, expect, it } from "vitest";

import {
  buildMatchReadInputAudit,
  buildMatchReadProfile,
  buildMatchReadTelemetryArgs,
  buildMatchReadSynthesisCacheKey,
  computeMatchRead,
  resolveMatchReadSourceProfile,
} from "../matchRead";

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

  it("returns insufficient when profile signals are only placeholder section text", () => {
    const result = computeMatchRead({
      profile: {
        id: "profile_placeholder",
        skills: [],
        keywords: ["Summary", "Block"],
        raw_text: "3 Summary Block 1 Block 1",
      },
      job: {
        id: "job_1",
        parseStatus: "parsed",
        mustHaves: ["Retail design"],
        keywords: ["Miami"],
      },
      now: 1234,
    });

    expect(result.tier).toBe("unknown");
    expect(result.score).toBeNull();
    expect(result.scoreVisible).toBe(false);
    expect(result.confidence).toBe("low");
    expect(result.fallback).toBe("profile_insufficient");
    expect(result.matched).toEqual([]);
    expect(result.missing).toEqual(["Retail design", "Miami"]);
  });

  it("keeps weak overlap distinct when the profile has real usable content", () => {
    const result = computeMatchRead({
      profile: {
        id: "profile_real_low_overlap",
        skills: ["Warehouse operations", "Inventory control"],
        keywords: ["forklift safety", "cycle counting"],
      },
      job: {
        id: "job_1",
        parseStatus: "parsed",
        mustHaves: ["Retail design"],
        keywords: ["Miami"],
      },
      now: 1234,
    });

    expect(result.tier).toBe("weak");
    expect(result.score).toBe(0);
    expect(result.fallback).toBe("none");
    expect(result.matched).toEqual([]);
    expect(result.missing).toEqual(["Retail design", "Miami"]);
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

  it("switches the method to llm when a matching synthesis cache is ready", () => {
    const baseResult = computeMatchRead({
      now: 1234,
      profile: {
        id: "profile_1",
        version: 3,
        skills: ["Airtable", "Vendor Operations"],
        keywords: ["launch planning", "cross-functional communication"],
      },
      job: {
        id: "job_1",
        parseVersion: "v1",
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

    const cacheKey = buildMatchReadSynthesisCacheKey({
      job: {
        id: "job_1",
        parseVersion: "v1",
      },
      profile: {
        id: "profile_1",
        version: 3,
      },
      matchRead: baseResult,
    });

    const result = computeMatchRead({
      now: 1234,
      profile: {
        id: "profile_1",
        version: 3,
        skills: ["Airtable", "Vendor Operations"],
        keywords: ["launch planning", "cross-functional communication"],
      },
      job: {
        id: "job_1",
        parseVersion: "v1",
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
      synthesis: {
        cacheKey,
        status: "ready",
        provider: "mistral",
        model: "mistral-small-latest",
        computedAt: 2222,
        matched: [
          "Hands-on Airtable workflow ownership",
          "Vendor operations experience",
          "Cross-functional communication in delivery work",
        ],
        missing: ["Program management depth"],
      },
    });

    expect(result.method).toBe("llm");
    expect(result.computedAt).toBe(2222);
    expect(result.matched).toEqual([
      "Hands-on Airtable workflow ownership",
      "Vendor operations experience",
      "Cross-functional communication in delivery work",
    ]);
    expect(result.missing).toEqual(["Program management depth"]);
  });

  it("ignores a stale synthesis cache key and keeps keyword-overlap phrasing", () => {
    const result = computeMatchRead({
      now: 1234,
      profile: {
        id: "profile_1",
        version: 3,
        skills: ["Airtable", "Vendor Operations"],
        keywords: ["launch planning", "cross-functional communication"],
      },
      job: {
        id: "job_1",
        parseVersion: "v1",
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
      synthesis: {
        cacheKey: "stale",
        status: "ready",
        provider: "mistral",
        model: "mistral-small-latest",
        computedAt: 2222,
        matched: ["Rewritten phrase"],
        missing: ["Missing phrase"],
      },
    });

    expect(result.method).toBe("keyword-overlap");
    expect(result.matched).toEqual([
      "Airtable",
      "Vendor operations",
      "Cross-functional communication",
    ]);
    expect(result.missing).toEqual(["Program management"]);
  });

  it("audits the exact normalized profile and job inputs used for overlap", () => {
    const audit = buildMatchReadInputAudit({
      now: 1234,
      profile: {
        id: "profile_1",
        version: 7,
        skills: ["Airtable", "Vendor Operations"],
        keywords: ["Cross-functional communication"],
      },
      job: {
        id: "job_1",
        parseVersion: "v1b",
        parseStatus: "parsed",
        mustHavesExtraction: [
          { value: "Airtable", confidence: 0.9, sourceSpan: null },
          {
            value: "Cross-functional communication",
            confidence: 0.9,
            sourceSpan: null,
          },
        ],
        keywordsExtraction: [
          { value: "Program management", confidence: 0.8, sourceSpan: null },
        ],
      },
    });

    expect(audit.sourceProfile).toEqual({
      id: "profile_1",
      version: 7,
      skills: ["Airtable", "Vendor Operations"],
      keywords: ["Cross-functional communication"],
      normalizedPhrases: [
        "airtable",
        "cross-functional communication",
        "vendor operations",
      ],
      normalizedTokens: [
        "airtable",
        "communication",
        "cross-functional",
        "operations",
        "vendor",
      ],
    });
    expect(audit.job.signals).toEqual([
      {
        value: "Airtable",
        confidence: 0.9,
        normalizedValue: "airtable",
        tokens: ["airtable"],
        matched: true,
      },
      {
        value: "Cross-functional communication",
        confidence: 0.9,
        normalizedValue: "cross-functional communication",
        tokens: ["cross-functional", "communication"],
        matched: true,
      },
      {
        value: "Program management",
        confidence: 0.8,
        normalizedValue: "program management",
        tokens: ["program", "management"],
        matched: false,
      },
    ]);
    expect(audit.overlap).toEqual({
      matched: ["Airtable", "Cross-functional communication"],
      missing: ["Program management"],
      score: 67,
      tier: "partial",
      confidence: "high",
      fallback: "none",
      method: "keyword-overlap",
    });
  });

  it("shows selected local CV keywords are ignored unless persisted to the resolved profile", () => {
    const selectedLocalCvOnlySignals = ["Airtable", "Program management"];
    const staleServerProfileAudit = buildMatchReadInputAudit({
      now: 1234,
      profile: {
        id: "profile_server_stale",
        version: 1,
        skills: ["Customer support"],
        keywords: ["documentation"],
      },
      job: {
        id: "job_1",
        parseVersion: "v1b",
        parseStatus: "parsed",
        mustHavesExtraction: [
          { value: "Airtable", confidence: 0.9, sourceSpan: null },
        ],
        keywordsExtraction: [
          { value: "Program management", confidence: 0.8, sourceSpan: null },
        ],
      },
    });

    expect(selectedLocalCvOnlySignals).toEqual([
      "Airtable",
      "Program management",
    ]);
    expect(staleServerProfileAudit.sourceProfile?.id).toBe(
      "profile_server_stale",
    );
    expect(staleServerProfileAudit.sourceProfile?.normalizedTokens).not.toContain(
      "airtable",
    );
    expect(staleServerProfileAudit.sourceProfile?.normalizedTokens).not.toContain(
      "program",
    );
    expect(staleServerProfileAudit.overlap).toMatchObject({
      matched: [],
      missing: ["Airtable", "Program management"],
      score: 0,
      tier: "weak",
      fallback: "none",
    });

    const persistedProfileAudit = buildMatchReadInputAudit({
      now: 1234,
      profile: {
        id: "profile_server_current",
        version: 2,
        skills: selectedLocalCvOnlySignals,
        keywords: [],
      },
      job: {
        id: "job_1",
        parseVersion: "v1b",
        parseStatus: "parsed",
        mustHavesExtraction: [
          { value: "Airtable", confidence: 0.9, sourceSpan: null },
        ],
        keywordsExtraction: [
          { value: "Program management", confidence: 0.8, sourceSpan: null },
        ],
      },
    });

    expect(persistedProfileAudit.overlap).toMatchObject({
      matched: ["Airtable", "Program management"],
      missing: [],
      score: 100,
      tier: "strong",
      fallback: "none",
    });
  });

  it("uses the attached resume profile instead of stale primary or default profile signals", () => {
    const profiles = [
      {
        _id: "profile_primary",
        profileId: "cv_primary",
        defaultResumeId: "cv_default",
        version: 1,
        skills: ["Customer support"],
        keywords: ["documentation"],
      },
      {
        _id: "profile_default",
        profileId: "cv_default",
        version: 2,
        skills: ["Operations"],
        keywords: ["workflow"],
      },
      {
        _id: "profile_attached",
        profileId: "cv_attached",
        version: 3,
        skills: ["Airtable", "Program management"],
        keywords: ["stakeholder reporting"],
      },
    ];
    const sourceProfile = resolveMatchReadSourceProfile({
      job: {
        lastResumeId: "cv_attached",
        lastResumeName: "Attached resume",
      },
      primaryProfile: profiles[0],
      profiles,
    });

    const audit = buildMatchReadInputAudit({
      now: 1234,
      profile: buildMatchReadProfile(sourceProfile),
      job: {
        id: "job_1",
        parseVersion: "v1b",
        parseStatus: "parsed",
        mustHavesExtraction: [
          { value: "Airtable", confidence: 0.9, sourceSpan: null },
        ],
        keywordsExtraction: [
          { value: "Program management", confidence: 0.8, sourceSpan: null },
        ],
      },
    });

    expect(sourceProfile?.profileId).toBe("cv_attached");
    expect(audit.sourceProfile?.id).toBe("cv_attached");
    expect(audit.sourceProfile?.skills).toEqual([
      "Airtable",
      "Program management",
    ]);
    expect(audit.overlap).toMatchObject({
      matched: ["Airtable", "Program management"],
      missing: [],
      score: 100,
      tier: "strong",
      fallback: "none",
    });
  });

  it("derives attached resume scoring keywords from saved profile content when keywords are empty", () => {
    const sourceProfile = buildMatchReadProfile({
      _id: "profile_attached",
      profileId: "cv_attached",
      version: 4,
      skills: [],
      keywords: [],
      summary:
        "Built Airtable workflow automation and program management dashboards.",
      experience: [
        {
          company: "Acme",
          title: "Operations Lead",
          description:
            "Owned stakeholder reporting and cross-functional workflow planning.",
        },
      ],
    });

    const audit = buildMatchReadInputAudit({
      now: 1234,
      profile: sourceProfile,
      job: {
        id: "job_1",
        parseVersion: "v1b",
        parseStatus: "parsed",
        mustHavesExtraction: [
          { value: "Airtable", confidence: 0.9, sourceSpan: null },
        ],
        keywordsExtraction: [
          { value: "Program management", confidence: 0.8, sourceSpan: null },
        ],
      },
    });

    expect(audit.sourceProfile?.id).toBe("cv_attached");
    expect(audit.sourceProfile?.skills).toEqual([]);
    expect(audit.sourceProfile?.keywords).toEqual(
      expect.arrayContaining(["airtable", "program", "management"]),
    );
    expect(audit.overlap).toMatchObject({
      matched: ["Airtable", "Program management"],
      missing: [],
      score: 100,
      tier: "strong",
      fallback: "none",
    });
  });

  it("does not silently fall back to stale profile data when an attached resume is unresolved", () => {
    const profiles = [
      {
        _id: "profile_primary",
        profileId: "cv_primary",
        defaultResumeId: "cv_default",
        version: 1,
        skills: ["Airtable"],
        keywords: ["Program management"],
      },
      {
        _id: "profile_default",
        profileId: "cv_default",
        version: 2,
        skills: ["Airtable"],
        keywords: ["Program management"],
      },
    ];
    const sourceProfile = resolveMatchReadSourceProfile({
      job: {
        lastResumeId: "cv_missing",
        lastResumeName: "Deleted resume",
      },
      primaryProfile: profiles[0],
      profiles,
    });

    const result = computeMatchRead({
      now: 1234,
      profile: buildMatchReadProfile(sourceProfile),
      job: {
        id: "job_1",
        parseVersion: "v1b",
        parseStatus: "parsed",
        mustHavesExtraction: [
          { value: "Airtable", confidence: 0.9, sourceSpan: null },
        ],
        keywordsExtraction: [
          { value: "Program management", confidence: 0.8, sourceSpan: null },
        ],
      },
    });

    expect(sourceProfile).toBeNull();
    expect(result.fallback).toBe("profile_missing");
    expect(result.score).toBeNull();
    expect(result.tier).toBe("unknown");
    expect(result.matched).toEqual([]);
    expect(result.missing).toEqual(["Airtable", "Program management"]);
  });
});
