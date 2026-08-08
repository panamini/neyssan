import { describe, expect, it, vi } from "vitest";

import createProposalPublic from "../createProposalPublic";
import { storeProposal, updateProposal } from "../proposals";
import saveJobAndProposalPublic, {
  saveJobAndProposal,
} from "../saveJobAndProposal";
import updateProposalPublic from "../updateProposalPublic";

const OWNER_PROFILE_ID = "profile_owner";
const FOREIGN_PROFILE_ID = "profile_foreign";
const SECONDARY_PROFILE_ID = "profile_secondary";

function buildJob(
  id: string,
  userId = OWNER_PROFILE_ID,
): Record<string, unknown> {
  return { _id: id, userId };
}

function createProfileQuery() {
  const profiles = [
    {
      _id: OWNER_PROFILE_ID,
      profileId: "cv_owner",
      clerkId: "clerk_owner",
      updatedAt: 10,
      createdAt: 10,
    },
  ];

  return (table: string) => {
    if (table !== "userProfiles") {
      throw new Error(`Unexpected query table: ${table}`);
    }

    return {
      withIndex: (_indexName: string, buildIndex: (query: any) => unknown) => {
        buildIndex({
          eq() {
            return this;
          },
        });
        return {
          filter: () => ({
            first: async () => profiles[0] ?? null,
          }),
          first: async () => profiles[0] ?? null,
          collect: async () => profiles,
        };
      },
    };
  };
}

function createContext({
  jobs = {},
  existingProposal,
}: {
  jobs?: Record<string, Record<string, unknown>>;
  existingProposal?: Record<string, unknown>;
} = {}) {
  const insert = vi.fn().mockResolvedValue("proposal_new");
  const patch = vi.fn().mockResolvedValue(undefined);
  const get = vi.fn(async (id: string) => {
    if (id === "proposal_existing") {
      return existingProposal ?? null;
    }
    if (id === OWNER_PROFILE_ID) {
      return buildProfile(OWNER_PROFILE_ID, "clerk_owner");
    }
    return jobs[id] ?? null;
  });

  return {
    insert,
    patch,
    ctx: {
      auth: {
        getUserIdentity: async () => ({ subject: "clerk_owner" }),
      },
      db: {
        query: createProfileQuery(),
        normalizeId: (table: string, id: string) => {
          if (table === "jobs") {
            return id.startsWith("job_") ? id : null;
          }
          if (table === "userProfiles") {
            return id.startsWith("profile_") ? id : null;
          }
          return null;
        },
        get,
        insert,
        patch,
      },
      runMutation: vi.fn(),
    } as any,
  };
}

function withAuthoritativeProfiles(
  ctx: any,
  profiles: Record<string, Record<string, unknown>>,
) {
  const get = ctx.db.get;
  ctx.db.get = async (id: string) => profiles[id] ?? (await get(id));
  return ctx;
}

function buildProfile(id: string, clerkId: string) {
  return {
    _id: id,
    clerkId,
    profileId: `cv_${id}`,
    updatedAt: 10,
    createdAt: 10,
  };
}

function buildStoredProposal(
  jobId = "job_existing",
): Record<string, unknown> {
  return {
    _id: "proposal_existing",
    userId: OWNER_PROFILE_ID,
    jobId,
    title: "Existing proposal",
    content: "Existing body",
    status: "draft",
    version: 1,
    sections: [{ type: "text", content: "Existing body" }],
    metrics: { score: 0, confidence: 0 },
    metadata: { proposalType: "cover_letter" },
  };
}

function buildStoredProposalArgs(jobId?: string) {
  return {
    userId: OWNER_PROFILE_ID,
    ...(jobId === undefined ? {} : { jobId }),
    title: "Generated proposal",
    content: "Proposal body",
    status: "saved",
    version: 1,
    createdAt: 1,
    updatedAt: 1,
    sections: [{ type: "text" as const, content: "Proposal body" }],
    metrics: { score: 0, confidence: 0 },
    metadata: {},
  };
}

function buildSaveArgs(jobId?: string) {
  return {
    jobData: {
      platform: "manual",
      title: "Saved job proposal",
      url: "https://example.test/jobs/owner",
      ...(jobId === undefined ? {} : { jobId }),
    },
    proposalText: "Proposal body",
  };
}

describe("proposal job-link ownership", () => {
  it("allows unlinked and same-owner public proposal creation", async () => {
    const { ctx, insert } = createContext({
      jobs: { job_owner: buildJob("job_owner") },
    });

    await createProposalPublic._handler(ctx, {
      title: "Unlinked",
      content: "Proposal body",
      metadata: {},
    });
    await createProposalPublic._handler(ctx, {
      title: "Linked",
      content: "Proposal body",
      metadata: { jobId: "job_owner" },
    });

    expect(insert).toHaveBeenNthCalledWith(
      1,
      "proposals",
      expect.objectContaining({ jobId: undefined, userId: OWNER_PROFILE_ID }),
    );
    expect(insert).toHaveBeenNthCalledWith(
      2,
      "proposals",
      expect.objectContaining({ jobId: "job_owner", userId: OWNER_PROFILE_ID }),
    );
  });

  it("allows a primary-profile Proposal to link a secondary same-Clerk Job across write boundaries", async () => {
    const job = buildJob("job_secondary", SECONDARY_PROFILE_ID);
    const profiles = {
      [OWNER_PROFILE_ID]: buildProfile(OWNER_PROFILE_ID, "clerk_owner"),
      [SECONDARY_PROFILE_ID]: buildProfile(
        SECONDARY_PROFILE_ID,
        "clerk_owner",
      ),
    };

    const create = createContext({ jobs: { job_secondary: job } });
    await createProposalPublic._handler(
      withAuthoritativeProfiles(create.ctx, profiles),
      {
        title: "Public cross-profile",
        content: "Proposal body",
        metadata: { jobId: "job_secondary" },
      },
    );
    expect(create.insert).toHaveBeenCalledWith(
      "proposals",
      expect.objectContaining({
        jobId: "job_secondary",
        userId: OWNER_PROFILE_ID,
      }),
    );

    const publicUpdate = createContext({
      jobs: { job_secondary: job },
      existingProposal: buildStoredProposal(),
    });
    await updateProposalPublic._handler(
      withAuthoritativeProfiles(publicUpdate.ctx, profiles),
      {
        id: "proposal_existing",
        metadata: { jobId: "job_secondary" },
      },
    );
    expect(publicUpdate.patch).toHaveBeenCalledWith(
      "proposal_existing",
      expect.objectContaining({ jobId: "job_secondary" }),
    );

    const store = createContext({ jobs: { job_secondary: job } });
    await storeProposal._handler(
      withAuthoritativeProfiles(store.ctx, profiles),
      buildStoredProposalArgs("job_secondary"),
    );
    expect(store.insert).toHaveBeenCalledWith(
      "proposals",
      expect.objectContaining({
        jobId: "job_secondary",
        userId: OWNER_PROFILE_ID,
      }),
    );

    const internalUpdate = createContext({
      jobs: { job_secondary: job },
      existingProposal: buildStoredProposal(),
    });
    await updateProposal._handler(
      withAuthoritativeProfiles(internalUpdate.ctx, profiles),
      {
        id: "proposal_existing",
        jobId: "job_secondary",
        sections: [{ type: "text", content: "Updated body" }],
        metrics: { score: 0, confidence: 0 },
        metadata: {},
      },
    );
    expect(internalUpdate.patch).toHaveBeenCalledWith(
      "proposal_existing",
      expect.objectContaining({ jobId: "job_secondary" }),
    );

    for (const handler of [saveJobAndProposal, saveJobAndProposalPublic]) {
      const save = createContext({ jobs: { job_secondary: job } });
      await (handler as any)._handler(
        withAuthoritativeProfiles(save.ctx, profiles),
        buildSaveArgs("job_secondary"),
      );
      expect(save.insert).toHaveBeenCalledWith(
        "proposals",
        expect.objectContaining({
          jobId: "job_secondary",
          userId: OWNER_PROFILE_ID,
        }),
      );
    }
  });

  it("rejects a foreign-Clerk Job before a public write", async () => {
    const { ctx, insert } = createContext({
      jobs: {
        job_foreign: buildJob("job_foreign", FOREIGN_PROFILE_ID),
      },
    });

    await expect(
      createProposalPublic._handler(
        withAuthoritativeProfiles(ctx, {
          [OWNER_PROFILE_ID]: buildProfile(OWNER_PROFILE_ID, "clerk_owner"),
          [FOREIGN_PROFILE_ID]: buildProfile(
            FOREIGN_PROFILE_ID,
            "clerk_foreign",
          ),
        }),
        {
          title: "Rejected",
          content: "Proposal body",
          metadata: { jobId: "job_foreign" },
        },
      ),
    ).rejects.toThrow("Job not found");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an exact-profile Job whose owner profile is missing before a public write", async () => {
    const { ctx, insert } = createContext({
      jobs: { job_orphaned: buildJob("job_orphaned") },
    });
    const get = ctx.db.get;
    ctx.db.get = async (id: string) =>
      id === OWNER_PROFILE_ID ? null : await get(id);

    await expect(
      createProposalPublic._handler(ctx, {
        title: "Rejected",
        content: "Proposal body",
        metadata: { jobId: "job_orphaned" },
      }),
    ).rejects.toThrow("Job not found");
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed", "not-a-job", "Invalid jobId"],
    ["nonexistent", "job_missing", "Job not found"],
    ["deleted", "job_deleted", "Job not found"],
    ["foreign", "job_foreign", "Job not found"],
  ])(
    "rejects %s public proposal links before insert",
    async (_caseName, jobId, message) => {
      const { ctx, insert } = createContext({
        jobs: { job_foreign: buildJob("job_foreign", FOREIGN_PROFILE_ID) },
      });

      await expect(
        createProposalPublic._handler(ctx, {
          title: "Rejected",
          content: "Proposal body",
          metadata: { jobId },
        }),
      ).rejects.toThrow(message);

      expect(insert).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["malformed", "not-a-job", "Invalid jobId"],
    ["nonexistent", "job_missing", "Job not found"],
    ["deleted", "job_deleted", "Job not found"],
    ["foreign", "job_foreign", "Job not found"],
  ])(
    "rejects explicit %s public reassignment before patch",
    async (_caseName, jobId, message) => {
      const { ctx, patch } = createContext({
        jobs: { job_foreign: buildJob("job_foreign", FOREIGN_PROFILE_ID) },
        existingProposal: buildStoredProposal(),
      });

      await expect(
        updateProposalPublic._handler(ctx, {
          id: "proposal_existing",
          metadata: { jobId },
        }),
      ).rejects.toThrow(message);

      expect(patch).not.toHaveBeenCalled();
    },
  );

  it("preserves an existing public link for unrelated metadata edits", async () => {
    const { ctx, patch } = createContext({
      existingProposal: buildStoredProposal(),
    });

    await updateProposalPublic._handler(ctx, {
      id: "proposal_existing",
      metadata: { templateBundleId: "magazine_editorial" },
    });

    expect(patch).toHaveBeenCalledWith(
      "proposal_existing",
      expect.objectContaining({ jobId: "job_existing" }),
    );
  });

  it("enforces owner-bound links for internal store and update mutations", async () => {
    const foreignJob = buildJob("job_foreign", FOREIGN_PROFILE_ID);
    const store = createContext({ jobs: { job_foreign: foreignJob } });
    const update = createContext({
      jobs: { job_foreign: foreignJob },
      existingProposal: buildStoredProposal(),
    });

    await expect(
      storeProposal._handler(store.ctx, buildStoredProposalArgs("job_foreign")),
    ).rejects.toThrow("Job not found");
    await expect(
      updateProposal._handler(update.ctx, {
        id: "proposal_existing",
        jobId: "job_foreign",
        sections: [{ type: "text", content: "Updated body" }],
        metrics: { score: 0, confidence: 0 },
        metadata: {},
      }),
    ).rejects.toThrow("Job not found");

    expect(store.insert).not.toHaveBeenCalled();
    expect(update.patch).not.toHaveBeenCalled();
  });

  it("allows a same-owner internal store link", async () => {
    const { ctx, insert } = createContext({
      jobs: { job_owner: buildJob("job_owner") },
    });

    await storeProposal._handler(ctx, buildStoredProposalArgs("job_owner"));

    expect(insert).toHaveBeenCalledWith(
      "proposals",
      expect.objectContaining({ jobId: "job_owner", userId: OWNER_PROFILE_ID }),
    );
  });

  it.each([
    ["internal", saveJobAndProposal],
    ["public", saveJobAndProposalPublic],
  ])(
    "rejects foreign links in the %s saveJobAndProposal handler",
    async (_handlerName, handler) => {
      const { ctx, insert } = createContext({
        jobs: { job_foreign: buildJob("job_foreign", FOREIGN_PROFILE_ID) },
      });

      await expect(
        (handler as any)._handler(ctx, buildSaveArgs("job_foreign")),
      ).rejects.toThrow("Job not found");

      expect(insert).not.toHaveBeenCalled();
    },
  );
});
