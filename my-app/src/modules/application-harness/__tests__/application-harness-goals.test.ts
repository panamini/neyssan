import { describe, expect, it } from "vitest";
import {
  buildCandidateHash,
  buildContextHash,
  buildJobHash,
  buildSettingsHash,
  buildSourceRefHash,
  buildStableHash,
} from "../fingerprints";
import { buildApplicationRunIdempotencyKey } from "../idempotency";
import type { ApplicationArtifactV1, ApplicationContextV1, ApplicationEventV1, ApplicationRunV1, SourceRefV1 } from "../schema";

describe("application-harness PR 1 goals", () => {
  it("keeps context, run, artifact, event, source-ref, hash, and idempotency primitives local and deterministic", () => {
    const jobHash = buildJobHash({
      jobId: "job_123",
      rawDescription: "Build deterministic application workflows.",
      sourceUrl: "https://example.com/jobs/123",
      title: "Product Engineer",
      company: "Acme",
    });
    const candidateHash = buildCandidateHash({
      cvId: "cv_123",
      structuredSectionsHash: "structured_sections_hash",
      cvSnapshotHash: "cv_snapshot_hash",
    });
    const settingsHash = buildSettingsHash({ selectedLanguage: "en", market: "US" });
    const contextHash = buildContextHash({ jobHash, candidateHash, settingsHash });
    const sourceRef: SourceRefV1 = {
      sourceType: "job",
      sourceId: "job_123",
      sourcePath: "rawDescription",
      sourceHash: jobHash,
    };
    const sourceRefHash = buildSourceRefHash(sourceRef);

    const context: ApplicationContextV1 = {
      id: "context_123",
      userId: "user_123",
      job: {
        jobId: "job_123",
        sourceUrl: "https://example.com/jobs/123",
        title: "Product Engineer",
        company: "Acme",
        rawTextHash: jobHash,
      },
      candidate: {
        sourceKind: "cv",
        cvId: "cv_123",
        candidateHash,
        selectedLanguage: "en",
        market: "US",
      },
      settingsHash,
      contextHash,
      reviewState: "draft",
      sourceRefs: [sourceRef],
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:00:00.000Z",
      version: 1,
    };
    const idempotencyKey = buildApplicationRunIdempotencyKey({
      userId: context.userId,
      operation: "draft_cover_letter",
      contextHash: context.contextHash,
      inputHash: buildStableHash({ contextHash, sourceRefHash }),
    });
    const run: ApplicationRunV1 = {
      id: "run_123",
      userId: context.userId,
      contextId: context.id,
      operation: "draft_cover_letter",
      inputHash: buildStableHash({ contextHash, sourceRefHash }),
      idempotencyKey,
      status: "queued",
      attemptCount: 0,
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:00:00.000Z",
      version: 1,
    };
    const artifact: ApplicationArtifactV1 = {
      id: "artifact_123",
      userId: context.userId,
      contextId: context.id,
      runId: run.id,
      type: "cover_letter",
      status: "draft",
      title: "Draft cover letter",
      content: { body: "Draft" },
      sourceHashes: { contextHash: context.contextHash, generatorInputHash: run.inputHash },
      provenance: { jobId: "job_123", cvId: "cv_123" },
      sourceRefs: [sourceRef],
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:00:00.000Z",
      version: 1,
    };
    const event: ApplicationEventV1 = {
      id: "event_123",
      userId: context.userId,
      contextId: context.id,
      runId: run.id,
      eventType: "application.run.queued",
      payload: { idempotencyKey },
      createdAt: "2026-06-08T00:00:00.000Z",
      version: 1,
    };

    expect(context.version).toBe(1);
    expect(run.version).toBe(1);
    expect(artifact.version).toBe(1);
    expect(event.version).toBe(1);
    expect(buildStableHash(context)).toBe(buildStableHash({ ...context, sourceRefs: [{ ...sourceRef }] }));
    expect(buildApplicationRunIdempotencyKey({
      userId: context.userId,
      operation: "draft_cover_letter",
      contextHash: context.contextHash,
      inputHash: run.inputHash,
    })).toBe(idempotencyKey);
  });
});
