import { describe, expect, it } from "vitest";
import {
  buildCandidateHash,
  buildContextHash,
  buildJobHash,
  buildSettingsHash,
  buildSourceRefHash,
  buildStableHash,
  stableSerialize,
} from "../fingerprints";
import type { ApplicationArtifactV1, ApplicationEventV1, SourceRefV1 } from "../schema";

describe("application-harness fingerprints", () => {
  it("hashes the same object with different key order the same", () => {
    const left = buildStableHash({ b: 2, a: { d: 4, c: 3 } });
    const right = buildStableHash({ a: { c: 3, d: 4 }, b: 2 });

    expect(left).toBe(right);
  });

  it("preserves array order in hash behavior", () => {
    const first = buildStableHash({ values: ["job", "cv", "settings"] });
    const second = buildStableHash({ values: ["cv", "job", "settings"] });

    expect(first).not.toBe(second);
  });

  it("omits undefined object fields consistently", () => {
    expect(stableSerialize({ sourceUrl: undefined, title: "Engineer" })).toBe(
      stableSerialize({ title: "Engineer" }),
    );
  });

  it("changes jobHash when the job text changes", () => {
    const baseHash = buildJobHash({
      jobId: "job_123",
      rawDescription: "Build reliable product workflows.",
      sourceUrl: "https://example.com/jobs/123",
      title: "Product Engineer",
      company: "Acme",
    });

    const changedHash = buildJobHash({
      jobId: "job_123",
      rawDescription: "Build reliable product workflows and data pipelines.",
      sourceUrl: "https://example.com/jobs/123",
      title: "Product Engineer",
      company: "Acme",
    });

    expect(changedHash).not.toBe(baseHash);
  });

  it("changes candidateHash when candidate inputs change", () => {
    const baseHash = buildCandidateHash({
      cvId: "cv_123",
      structuredSectionsHash: "sections_a",
      cvSnapshotHash: "snapshot_a",
    });

    const changedHash = buildCandidateHash({
      cvId: "cv_123",
      structuredSectionsHash: "sections_b",
      cvSnapshotHash: "snapshot_a",
    });

    expect(changedHash).not.toBe(baseHash);
  });

  it("changes settingsHash when settings change", () => {
    const baseHash = buildSettingsHash({ language: "en", market: "US", tone: "direct" });
    const changedHash = buildSettingsHash({ language: "en", market: "US", tone: "warm" });

    expect(changedHash).not.toBe(baseHash);
  });

  it("changes SourceRefV1 hash when sourcePath or sourceHash changes", () => {
    const baseRef: SourceRefV1 = {
      sourceType: "job",
      sourceId: "job_123",
      sourcePath: "rawDescription",
      sourceHash: "hash_a",
    };

    expect(buildSourceRefHash({ ...baseRef, sourcePath: "title" })).not.toBe(
      buildSourceRefHash(baseRef),
    );
    expect(buildSourceRefHash({ ...baseRef, sourceHash: "hash_b" })).not.toBe(
      buildSourceRefHash(baseRef),
    );
  });

  it("helper functions do not mutate input objects", () => {
    const settings = {
      language: "en",
      markets: ["US", "CA"],
      review: { requireApproval: true, unused: undefined as string | undefined },
    };
    const sourceRef: SourceRefV1 = {
      sourceType: "cv",
      sourceId: "cv_123",
      sourcePath: "experience[0]",
      sourceHash: "source_hash",
    };
    const beforeSettings = stableSerialize(settings);
    const beforeSourceRef = stableSerialize(sourceRef);

    buildSettingsHash(settings);
    buildSourceRefHash(sourceRef);

    expect(stableSerialize(settings)).toBe(beforeSettings);
    expect(stableSerialize(sourceRef)).toBe(beforeSourceRef);
    expect(settings.markets).toEqual(["US", "CA"]);
  });

  it("artifact shell fixture compiles and hashes predictably", () => {
    const sourceRef: SourceRefV1 = {
      sourceType: "artifact",
      sourceId: "artifact_123",
      sourcePath: "content",
      sourceHash: "artifact_content_hash",
    };
    const artifact: ApplicationArtifactV1 = {
      id: "artifact_123",
      userId: "user_123",
      contextId: "context_123",
      runId: "run_123",
      type: "cover_letter",
      status: "draft",
      title: "Draft cover letter",
      content: { body: "Hello" },
      textPreview: "Hello",
      sourceHashes: {
        contextHash: "context_hash",
        generatorInputHash: "generator_hash",
      },
      provenance: {
        jobId: "job_123",
        cvId: "cv_123",
        sourceFactIds: ["fact_1", "fact_2"],
      },
      sourceRefs: [sourceRef],
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:00:00.000Z",
      version: 1,
    };

    const equivalentArtifact = {
      version: 1,
      updatedAt: "2026-06-08T00:00:00.000Z",
      createdAt: "2026-06-08T00:00:00.000Z",
      sourceRefs: [sourceRef],
      provenance: {
        sourceFactIds: ["fact_1", "fact_2"],
        cvId: "cv_123",
        jobId: "job_123",
      },
      sourceHashes: {
        generatorInputHash: "generator_hash",
        contextHash: "context_hash",
      },
      textPreview: "Hello",
      content: { body: "Hello" },
      title: "Draft cover letter",
      status: "draft",
      type: "cover_letter",
      runId: "run_123",
      contextId: "context_123",
      userId: "user_123",
      id: "artifact_123",
    } satisfies ApplicationArtifactV1;

    expect(buildStableHash(artifact)).toBe(buildStableHash(equivalentArtifact));
    expect(buildStableHash({ ...artifact, title: "Approved cover letter" })).not.toBe(
      buildStableHash(artifact),
    );
  });

  it("event shell fixture compiles and hashes predictably", () => {
    const event: ApplicationEventV1 = {
      id: "event_123",
      userId: "user_123",
      contextId: "context_123",
      runId: "run_123",
      eventType: "application.context.created",
      payload: { contextHash: "context_hash", sourceRefs: ["job_123", "cv_123"] },
      createdAt: "2026-06-08T00:00:00.000Z",
      version: 1,
    };

    const equivalentEvent = {
      version: 1,
      createdAt: "2026-06-08T00:00:00.000Z",
      payload: { sourceRefs: ["job_123", "cv_123"], contextHash: "context_hash" },
      eventType: "application.context.created",
      runId: "run_123",
      contextId: "context_123",
      userId: "user_123",
      id: "event_123",
    } satisfies ApplicationEventV1;

    expect(buildStableHash(event)).toBe(buildStableHash(equivalentEvent));
    expect(buildStableHash({ ...event, eventType: "application.context.superseded" })).not.toBe(
      buildStableHash(event),
    );
  });

  it("contextHash combines job, candidate, and settings hashes", () => {
    const jobHash = buildJobHash({ jobId: "job_123", rawDescription: "Job text" });
    const candidateHash = buildCandidateHash({ cvId: "cv_123", cvSnapshotHash: "snapshot_hash" });
    const settingsHash = buildSettingsHash({ language: "en" });

    expect(buildContextHash({ jobHash, candidateHash, settingsHash })).toBe(
      buildContextHash({ settingsHash, candidateHash, jobHash }),
    );
    expect(buildContextHash({ jobHash: "different", candidateHash, settingsHash })).not.toBe(
      buildContextHash({ jobHash, candidateHash, settingsHash }),
    );
  });
});
