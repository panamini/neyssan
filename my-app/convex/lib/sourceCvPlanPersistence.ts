import type { QueryCtx } from "../_generated/server";
import type { SourceCvPlanPersistencePortV1 } from "./sourceCvPlanOrchestrator";

export function buildSourceCvPlanPersistence(
  db: QueryCtx["db"],
): SourceCvPlanPersistencePortV1 {
  return {
    async getApplicationContextForUser({ userId, contextId }) {
      return await db
        .query("applicationContexts")
        .withIndex("by_user_id", (q) =>
          q.eq("userId", userId).eq("id", contextId),
        )
        .unique();
    },
    async getUserProfileById({ userId }) {
      const profileId = db.normalizeId("userProfiles", userId);
      return profileId ? await db.get(profileId) : null;
    },
    async getSourceCvProfileForOwner({ ownerUserId, canonicalCvId }) {
      const ownerProfileId = db.normalizeId("userProfiles", ownerUserId);
      const ownerProfile = ownerProfileId
        ? await db.get(ownerProfileId)
        : null;
      if (!ownerProfile?.clerkId) {
        return null;
      }

      const profiles = await db
        .query("userProfiles")
        .withIndex("by_clerk_id", (q) =>
          q.eq("clerkId", ownerProfile.clerkId),
        )
        .collect();
      return (
        profiles.find((profile) => {
          const profileKey = String(
            profile.profileId ?? profile._id,
          );
          const cvDocumentId =
            profile.cvDocument &&
            typeof profile.cvDocument === "object" &&
            !Array.isArray(profile.cvDocument)
              ? String(profile.cvDocument.id ?? "")
              : "";
          return (
            profileKey === canonicalCvId &&
            cvDocumentId === canonicalCvId
          );
        }) ?? null
      );
    },
    async getJobById({ jobId }) {
      const normalizedJobId = db.normalizeId("jobs", jobId);
      return normalizedJobId ? await db.get(normalizedJobId) : null;
    },
    async listSourceDocumentsForCanonicalCv({ userId, canonicalCvId }) {
      return await db
        .query("candidateSourceDocuments")
        .withIndex("by_user_id_canonical_cv_id", (q) =>
          q.eq("userId", userId).eq("canonicalCvId", canonicalCvId),
        )
        .collect();
    },
    async listFactsForSourceDocument({ userId, sourceDocumentId }) {
      return await db
        .query("candidateFacts")
        .withIndex("by_user_id_source_document_id", (q) =>
          q
            .eq("userId", userId)
            .eq("sourceDocumentId", sourceDocumentId),
        )
        .collect();
    },
  };
}
