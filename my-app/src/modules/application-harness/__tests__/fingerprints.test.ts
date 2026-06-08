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

const CREATED_AT_MS = Date.UTC(2026, 5, 8, 0, 0, 0, 0);

class UnsupportedClassValue {
  constructor(readonly value: string) {}
}

describe("application-harness fingerprints", () => {
  it("builds SHA-256-length stable hashes", async () => {
    await expect(buildStableHash({ value: "application-harness" })).resolves.toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashes the same object with different key order the same", async () => {
    const left = await buildStableHash({ b: 2, a: { d: 4, c: 3 } });
    const right = await buildStableHash({ a: { c: 3, d: 4 }, b: 2 });

    expect(left).toBe(right);
  });

  it("preserves array order in hash behavior", async () => {
    const first = await buildStableHash({ values: ["job", "cv", "settings"] });
    const second = await buildStableHash({ values: ["cv", "job", "settings"] });

    expect(first).not.toBe(second);
  });

  it("omits undefined object fields consistently", () => {
    expect(stableSerialize({ sourceUrl: undefined, title: "Engineer" })).toBe(
      stableSerialize({ title: "Engineer" }),
    );
  });

  it("serializes supported Date values deterministically", () => {
    expect(stableSerialize(new Date("2026-06-08T00:00:00.000Z"))).toBe(
      stableSerialize(new Date(CREATED_AT_MS)),
    );
  });

  it("throws on unsupported serializer inputs", () => {
    expect(() => stableSerialize(() => undefined)).toThrow(/functions/);
    expect(() => stableSerialize(Symbol("source"))).toThrow(/symbols/);
    expect(() => stableSerialize(new Map([["key", "value"]]))).toThrow(/Map/);
    expect(() => stableSerialize(new Set(["value"]))).toThrow(/Set/);
    expect(() => stableSerialize(/application-harness/)).toThrow(/RegExp/);
    expect(() => stableSerialize(Promise.resolve("value"))).toThrow(/Promise/);
    expect(() => stableSerialize(new UnsupportedClassValue("value"))).toThrow(/plain objects/);
  });

  it("throws on circular arrays and objects", () => {
    const circularArray: unknown[] = [];
    circularArray.push(circularArray);

    const circularObject: Record<string, unknown> = {};
    circularObject.self = circularObject;

    expect(() => stableSerialize(circularArray)).toThrow(/circular arrays/);
    expect(() => stableSerialize(circularObject)).toThrow(/circular objects/);
  });

  it("changes jobHash when the job text changes", async () => {
    const baseHash = await buildJobHash({
      jobId: "job_123",
      rawDescription: "Build reliable product workflows.",
      sourceUrl: "https://example.com/jobs/123",
      title: "Product Engineer",
      company: "Acme",
    });

    const changedHash = await buildJobHash({
      jobId: "job_123",
      rawDescription: "Build reliable product workflows and data pipelines.",
      sourceUrl: "https://example.com/jobs/123",
      title: "Product Engineer",
      company: "Acme",
    });

    expect(changedHash).not.toBe(baseHash);
  });

  it("changes candidateHash when candidate inputs change", async () => {
    const baseHash = await buildCandidateHash({
      cvId: "cv_123",
      structuredSectionsHash: "sections_a",
      cvSnapshotHash: "snapshot_a",
    });

    const changedHash = await buildCandidateHash({
      cvId: "cv_123",
      structuredSectionsHash: "sections_b",
      cvSnapshotHash: "snapshot_a",
    });

    expect(changedHash).not.toBe(baseHash);
  });

  it("changes settingsHash when settings change", async () => {
    const baseHash = await buildSettingsHash({ language: "en", market: "US", tone: "direct" });
    const changedHash = await buildSettingsHash({ language: "en", market: "US", tone: "warm" });

    expect(changedHash).not.toBe(baseHash);
  });

  it("changes SourceRefV1 hash when sourcePath or sourceHash changes", async () => {
    const baseRef: SourceRefV1 = {
      sourceType: "job",
      sourceId: "job_123",
      sourcePath: "rawDescription",
      sourceHash: "hash_a",
    };
    const baseHash = await buildSourceRefHash(baseRef);

    await expect(buildSourceRefHash({ ...baseRef, sourcePath: "title" })).resolves.not.toBe(
      baseHash,
    );
    await expect(buildSourceRefHash({ ...baseRef, sourceHash: "hash_b" })).resolves.not.toBe(
      baseHash,
    );
  });

  it("helper functions do not mutate input objects", async () => {
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

    await buildSettingsHash(settings);
    await buildSourceRefHash(sourceRef);

    expect(stableSerialize(settings)).toBe(beforeSettings);
    expect(stableSerialize(sourceRef)).toBe(beforeSourceRef);
    expect(settings.markets).toEqual(["US", "CA"]);
  });

  it("artifact shell fixture compiles and hashes predictably", async () => {
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
      createdAt: CREATED_AT_MS,
      updatedAt: CREATED_AT_MS,
      version: 1,
    };

    const equivalentArtifact = {
      version: 1,
      updatedAt: CREATED_AT_MS,
      createdAt: CREATED_AT_MS,
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

    expect(await buildStableHash(artifact)).toBe(await buildStableHash(equivalentArtifact));
    await expect(buildStableHash({ ...artifact, title: "Approved cover letter" })).resolves.not.toBe(
      await buildStableHash(artifact),
    );
  });

  it("event shell fixture compiles and hashes predictably", async () => {
    const event: ApplicationEventV1 = {
      id: "event_123",
      userId: "user_123",
      contextId: "context_123",
      runId: "run_123",
      eventType: "application.context.created",
      payload: { contextHash: "context_hash", sourceRefs: ["job_123", "cv_123"] },
      createdAt: CREATED_AT_MS,
      version: 1,
    };

    const equivalentEvent = {
      version: 1,
      createdAt: CREATED_AT_MS,
      payload: { sourceRefs: ["job_123", "cv_123"], contextHash: "context_hash" },
      eventType: "application.context.created",
      runId: "run_123",
      contextId: "context_123",
      userId: "user_123",
      id: "event_123",
    } satisfies ApplicationEventV1;

    expect(await buildStableHash(event)).toBe(await buildStableHash(equivalentEvent));
    await expect(buildStableHash({ ...event, eventType: "application.context.superseded" })).resolves.not.toBe(
      await buildStableHash(event),
    );
  });

  it("contextHash combines job, candidate, and settings hashes", async () => {
    const jobHash = await buildJobHash({ jobId: "job_123", rawDescription: "Job text" });
    const candidateHash = await buildCandidateHash({ cvId: "cv_123", cvSnapshotHash: "snapshot_hash" });
    const settingsHash = await buildSettingsHash({ language: "en" });

    expect(await buildContextHash({ jobHash, candidateHash, settingsHash })).toBe(
      await buildContextHash({ settingsHash, candidateHash, jobHash }),
    );
    await expect(buildContextHash({ jobHash: "different", candidateHash, settingsHash })).resolves.not.toBe(
      await buildContextHash({ jobHash, candidateHash, settingsHash }),
    );
  });
});
