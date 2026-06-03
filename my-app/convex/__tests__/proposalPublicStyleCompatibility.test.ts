import { afterEach, describe, expect, it, vi } from "vitest";

import createProposalPublic from "../createProposalPublic";
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
          tags: [
            ...existingProposal.metadata.tags,
            "ui_metadata_patch",
          ],
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
