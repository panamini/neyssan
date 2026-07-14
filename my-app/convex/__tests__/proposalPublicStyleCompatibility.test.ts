import { afterEach, describe, expect, it, vi } from "vitest";

import createProposalPublic from "../createProposalPublic";
import proposalsPublic from "../proposalsPublic";
import updateProposalPublic from "../updateProposalPublic";

const STYLE_METADATA = {
  templateBundleId: "magazine_editorial" as const,
  verbatiStyleSlotId: 2 as const,
  verbatiStyleSlotSource: "settings" as const,
  verbatiStyleSlotNameSnapshot: "Style 2",
  verbatiStyleBaseSnapshot: {
    familyId: "workshop",
    layout: "workshop",
    typography: "civic-correspondence",
    palette: "cobalt",
  },
  documentStyleVersion: 1 as const,
};

function createQuery(profiles: any[]) {
  return (table: string) => {
    if (table !== "userProfiles") {
      throw new Error(`Unexpected query table: ${table}`);
    }

    return {
      withIndex: () => ({
        collect: async () => profiles,
        filter: () => ({
          first: async () => profiles[0] ?? null,
        }),
      }),
    };
  };
}

function createUpdateContext(existingProposal: Record<string, unknown>) {
  const patch = vi.fn().mockResolvedValue(undefined);
  return {
    patch,
    ctx: {
      auth: {
        getUserIdentity: async () => ({ subject: "clerk_1" }),
      },
      db: {
        query: createQuery([{ _id: "user_1", clerkId: "clerk_1" }]),
        get: vi.fn().mockResolvedValue(existingProposal),
        patch,
      },
    } as any,
  };
}

describe("proposal public document style compatibility metadata", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists document style slot metadata on create", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const insert = vi.fn().mockResolvedValue("proposal_new");
    const insertedProposal = {
      _id: "proposal_new",
      title: "Generated proposal",
      status: "saved",
      metadata: STYLE_METADATA,
    };
    const ctx = {
      auth: {
        getUserIdentity: async () => ({ subject: "clerk_1" }),
      },
      db: {
        query: createQuery([{ _id: "user_1", profileId: "profile_1" }]),
        insert,
        get: vi.fn().mockResolvedValue(insertedProposal),
      },
      runMutation: vi.fn(),
    } as any;

    await createProposalPublic._handler(ctx, {
      title: " Generated proposal ",
      content: " Proposal body ",
      profileId: "profile_1",
      metadata: {
        proposalType: "cover_letter",
        ...STYLE_METADATA,
      },
    });

    expect(insert).toHaveBeenCalledWith(
      "proposals",
      expect.objectContaining({
        userId: "user_1",
        title: "Generated proposal",
        content: "Proposal body",
        metadata: expect.objectContaining(STYLE_METADATA),
      }),
    );
  });

  it("strips proposal decoration runtime image URLs on create while keeping asset metadata", async () => {
    const insert = vi.fn().mockResolvedValue("proposal_new");
    const ctx = {
      auth: {
        getUserIdentity: async () => ({ subject: "clerk_1" }),
      },
      db: {
        query: createQuery([{ _id: "user_1", profileId: "profile_1" }]),
        insert,
        get: vi.fn(),
      },
      runMutation: vi.fn(),
    } as any;

    await createProposalPublic._handler(ctx, {
      title: "Generated proposal",
      content: "Proposal body",
      profileId: "profile_1",
      metadata: {
        documentDecoration: {
          visible: true,
          source: "upload",
          assetId: "storage_proposal_1",
          dataUrl: `data:image/jpeg;base64,${"A".repeat(680 * 1024)}`,
          resolvedUrl: "https://files.example.test/proposal",
          fileName: "proposal-mark.jpg",
          mimeType: "image/jpeg",
          alt: "Proposal mark",
          sizePreset: 35,
          fit: "contain",
          placementMode: "custom",
          xMm: 17,
          yMm: 35,
        } as any,
      },
    });

    const metadata = insert.mock.calls[0][1].metadata;
    expect(metadata.documentDecoration).toMatchObject({
      assetId: "storage_proposal_1",
      fileName: "proposal-mark.jpg",
      mimeType: "image/jpeg",
      alt: "Proposal mark",
    });
    expect(metadata.documentDecoration.dataUrl).toBeUndefined();
    expect(metadata.documentDecoration.resolvedUrl).toBeUndefined();
  });

  it("merges document style slot metadata on update", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const existingProposal = {
      _id: "proposal_1",
      userId: "user_1",
      jobId: "job_old",
      title: "Existing proposal",
      content: "Existing body",
      status: "draft",
      version: 3,
      metadata: {
        sourceCvId: "cv_1",
        proposalType: "cover_letter",
        templateBundleId: "swiss_serif",
      },
    };
    const get = vi
      .fn()
      .mockResolvedValueOnce(existingProposal)
      .mockResolvedValueOnce({
        ...existingProposal,
        metadata: {
          ...existingProposal.metadata,
          ...STYLE_METADATA,
        },
      });
    const patch = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      auth: {
        getUserIdentity: async () => ({ subject: "clerk_1" }),
      },
      db: {
        query: createQuery([{ _id: "user_1", clerkId: "clerk_1" }]),
        get,
        patch,
      },
    } as any;

    await updateProposalPublic._handler(ctx, {
      id: "proposal_1",
      metadata: STYLE_METADATA,
    });

    expect(patch).toHaveBeenCalledWith(
      "proposal_1",
      expect.objectContaining({
        version: 4,
        metadata: expect.objectContaining({
          sourceCvId: "cv_1",
          proposalType: "cover_letter",
          ...STYLE_METADATA,
        }),
      }),
    );
  });

  it("explicitly clears a saved page size while preserving other metadata", async () => {
    const existingProposal = {
      _id: "proposal_1",
      userId: "user_1",
      title: "Existing proposal",
      content: "Existing body",
      status: "draft",
      version: 3,
      metadata: {
        sourceCvId: "cv_1",
        pageSize: "letter",
        proposalType: "cover_letter",
      },
    };
    const { ctx, patch } = createUpdateContext(existingProposal);

    await updateProposalPublic._handler(ctx, {
      id: "proposal_1",
      metadata: { proposalType: "cover_letter" },
      clearMetadata: { pageSize: true },
    });

    const metadata = patch.mock.calls[0][1].metadata;
    expect(metadata).toEqual(
      expect.objectContaining({
        sourceCvId: "cv_1",
        proposalType: "cover_letter",
      }),
    );
    expect(metadata).not.toHaveProperty("pageSize");
  });

  it("explicitly clears a stale structured document and its revisions", async () => {
    const existingProposal = {
      _id: "proposal_1",
      userId: "user_1",
      title: "Existing proposal",
      content: "Original structured body",
      status: "draft",
      version: 3,
      metadata: {
        proposalType: "cover_letter",
        proposalDocument: {
          schemaVersion: 1,
          kind: "letter",
          source: "structured",
          blocks: [
            {
              id: "paragraph-1",
              type: "paragraph",
              text: "Original structured body",
            },
          ],
        },
        proposalDocumentRevision: 10,
        proposalDocumentUpdatedAt: 10,
      },
    };
    const patch = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      auth: {
        getUserIdentity: async () => ({ subject: "clerk_1" }),
      },
      db: {
        query: createQuery([{ _id: "user_1", clerkId: "clerk_1" }]),
        get: vi.fn().mockResolvedValue(existingProposal),
        patch,
      },
    } as any;

    await updateProposalPublic._handler(ctx, {
      id: "proposal_1",
      content: "Whole draft rewritten as text",
      metadata: { proposalType: "cover_letter" },
      clearMetadata: { proposalDocument: true },
    });

    const metadata = patch.mock.calls[0][1].metadata;
    expect(metadata).not.toHaveProperty("proposalDocument");
    expect(metadata).not.toHaveProperty("proposalDocumentRevision");
    expect(metadata).not.toHaveProperty("proposalDocumentUpdatedAt");
    expect(patch).toHaveBeenCalledWith(
      "proposal_1",
      expect.objectContaining({
        content: "Whole draft rewritten as text",
      }),
    );
  });

  it("explicitly clears stale proposal template bundle provenance", async () => {
    const existingProposal = {
      _id: "proposal_1",
      userId: "user_1",
      title: "Existing proposal",
      content: "Existing body",
      status: "draft",
      version: 3,
      metadata: {
        proposalType: "cover_letter",
        templateBundleId: "magazine_editorial",
        verbatiStyleSlotId: 3,
        verbatiStyleSlotSource: "settings",
        verbatiStyleSlotNameSnapshot: "Style 3",
        verbatiStyleBaseSnapshot: {
          typography: "quiet-editorial",
          palette: "ink",
        },
        documentStyleVersion: 1,
      },
    };
    const { ctx, patch } = createUpdateContext(existingProposal);

    await updateProposalPublic._handler(ctx, {
      id: "proposal_1",
      metadata: { templateId: "modernist_signal" },
      clearMetadata: { templateBundle: true, documentStyleSlot: true },
    } as any);

    const metadata = patch.mock.calls[0][1].metadata;
    expect(metadata).toEqual(
      expect.objectContaining({ templateId: "modernist_signal" }),
    );
    expect(metadata).not.toHaveProperty("templateBundleId");
    expect(metadata).not.toHaveProperty("verbatiStyleSlotId");
    expect(metadata).not.toHaveProperty("verbatiStyleSlotSource");
    expect(metadata).not.toHaveProperty("verbatiStyleSlotNameSnapshot");
    expect(metadata).not.toHaveProperty("verbatiStyleBaseSnapshot");
    expect(metadata).not.toHaveProperty("documentStyleVersion");
  });

  it("strips proposal decoration runtime image URLs on update while keeping asset metadata", async () => {
    const existingProposal = {
      _id: "proposal_1",
      userId: "user_1",
      title: "Existing proposal",
      content: "Existing body",
      status: "draft",
      version: 3,
      metadata: {
        sourceCvId: "cv_1",
        documentDecoration: {
          visible: true,
          source: "upload",
          assetId: "storage_old",
          dataUrl: "data:image/jpeg;base64,OLD",
          resolvedUrl: "https://files.example.test/old",
          fileName: "old.jpg",
          mimeType: "image/jpeg",
          alt: "Old",
          sizePreset: 35,
          fit: "contain",
          placementMode: "custom",
          xMm: 17,
          yMm: 35,
        },
      },
    };
    const patch = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      auth: {
        getUserIdentity: async () => ({ subject: "clerk_1" }),
      },
      db: {
        query: createQuery([{ _id: "user_1", clerkId: "clerk_1" }]),
        get: vi.fn().mockResolvedValue(existingProposal),
        patch,
      },
    } as any;

    await updateProposalPublic._handler(ctx, {
      id: "proposal_1",
      metadata: {
        documentDecoration: {
          visible: true,
          source: "upload",
          assetId: "storage_new",
          dataUrl: `data:image/jpeg;base64,${"A".repeat(680 * 1024)}`,
          resolvedUrl: "https://files.example.test/new",
          fileName: "new.jpg",
          mimeType: "image/jpeg",
          alt: "New",
          sizePreset: 52,
          fit: "cover",
          placementMode: "custom",
          xMm: 21,
          yMm: 39,
        } as any,
      },
    });

    const metadata = patch.mock.calls[0][1].metadata;
    expect(metadata.documentDecoration).toMatchObject({
      assetId: "storage_new",
      fileName: "new.jpg",
      mimeType: "image/jpeg",
      alt: "New",
      sizePreset: 52,
      fit: "cover",
    });
    expect(metadata.documentDecoration.dataUrl).toBeUndefined();
    expect(metadata.documentDecoration.resolvedUrl).toBeUndefined();
  });

  it("resolves proposal decoration asset ids to runtime URLs on list", async () => {
    const profile = {
      _id: "user_1",
      _creationTime: 10,
      clerkId: "clerk_1",
      updatedAt: 10,
    };
    const proposal = {
      _id: "proposal_1",
      _creationTime: 20,
      userId: "user_1",
      title: "Generated proposal",
      content: "Proposal body",
      status: "draft",
      updatedAt: 20,
      createdAt: 20,
      sections: [],
      metadata: {
        documentDecoration: {
          visible: true,
          source: "upload",
          assetId: "storage_proposal_1",
          dataUrl: "data:image/png;base64,STALE",
          resolvedUrl: "https://stale.example.test/proposal.png",
          fileName: "proposal-mark.png",
          mimeType: "image/png",
          alt: "Proposal mark",
          sizePreset: 35,
          fit: "contain",
          placementMode: "custom",
          xMm: 17,
          yMm: 35,
        },
      },
      metrics: {},
      version: 1,
    };
    const ctx = {
      auth: {
        getUserIdentity: async () => ({ subject: "clerk_1" }),
      },
      db: {
        query: (table: string) => ({
          withIndex: () => ({
            collect: async () => {
              if (table === "userProfiles") return [profile];
              if (table === "proposals") return [proposal];
              throw new Error(`Unexpected query table: ${table}`);
            },
          }),
        }),
      },
      storage: {
        getUrl: vi
          .fn()
          .mockResolvedValue("https://files.example.test/proposal.png"),
      },
    } as any;

    const result = await proposalsPublic._handler(ctx, {});
    const decoration = result[0]?.metadata.documentDecoration as any;

    expect(ctx.storage.getUrl).toHaveBeenCalledWith("storage_proposal_1");
    expect(decoration).toMatchObject({
      assetId: "storage_proposal_1",
      resolvedUrl: "https://files.example.test/proposal.png",
      fileName: "proposal-mark.png",
    });
    expect(decoration.dataUrl).toBeUndefined();
  });

  it("does not emit proposal style trace logs by default on update", async () => {
    const previousTraceFlag = process.env.ENABLE_PROPOSAL_STYLE_TRACE;
    delete process.env.ENABLE_PROPOSAL_STYLE_TRACE;
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const existingProposal = {
      _id: "proposal_1",
      userId: "user_1",
      jobId: "job_old",
      title: "Existing proposal",
      content: "Existing body",
      status: "draft",
      version: 3,
      metadata: {
        sourceCvId: "cv_1",
        proposalType: "cover_letter",
      },
    };
    const patch = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      auth: {
        getUserIdentity: async () => ({ subject: "clerk_1" }),
      },
      db: {
        query: createQuery([{ _id: "user_1", clerkId: "clerk_1" }]),
        get: vi.fn().mockResolvedValue(existingProposal),
        patch,
      },
    } as any;

    try {
      await updateProposalPublic._handler(ctx, {
        id: "proposal_1",
        metadata: {
          templateBundleId: "magazine_editorial",
        },
      });
    } finally {
      if (previousTraceFlag === undefined) {
        delete process.env.ENABLE_PROPOSAL_STYLE_TRACE;
      } else {
        process.env.ENABLE_PROPOSAL_STYLE_TRACE = previousTraceFlag;
      }
    }

    expect(info).not.toHaveBeenCalled();
    expect(patch).toHaveBeenCalled();
  });

  it("preserves generation routing tags when UI metadata is patched later", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const existingProposal = {
      _id: "proposal_1",
      userId: "user_1",
      jobId: "job_old",
      title: "Existing proposal",
      content: "Existing body",
      status: "draft",
      version: 3,
      metadata: {
        tags: [
          "model:mistral-medium-latest",
          "premium_cover_letter_path_v1",
          "generation_path:premium_success",
        ],
        planned_path: "structured",
        executed_path: "structured",
        fallback_reason: "not_applicable",
        validator_outcome: "structured_success",
        save_outcome: "structured_saved",
      },
    };
    const get = vi
      .fn()
      .mockResolvedValueOnce(existingProposal)
      .mockResolvedValueOnce({
        ...existingProposal,
        metadata: {
          ...existingProposal.metadata,
          tags: [...existingProposal.metadata.tags, "ui_metadata_patch"],
          templateBundleId: "magazine_editorial",
        },
      });
    const patch = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      auth: {
        getUserIdentity: async () => ({ subject: "clerk_1" }),
      },
      db: {
        query: createQuery([{ _id: "user_1", clerkId: "clerk_1" }]),
        get,
        patch,
      },
    } as any;

    await updateProposalPublic._handler(ctx, {
      id: "proposal_1",
      metadata: {
        tags: ["ui_metadata_patch"],
        templateBundleId: "magazine_editorial",
      },
    });

    expect(patch).toHaveBeenCalledWith(
      "proposal_1",
      expect.objectContaining({
        metadata: expect.objectContaining({
          tags: expect.arrayContaining([
            "model:mistral-medium-latest",
            "premium_cover_letter_path_v1",
            "generation_path:premium_success",
            "ui_metadata_patch",
          ]),
          planned_path: "structured",
          executed_path: "structured",
          fallback_reason: "not_applicable",
          validator_outcome: "structured_success",
          save_outcome: "structured_saved",
          templateBundleId: "magazine_editorial",
        }),
      }),
    );
  });
});
