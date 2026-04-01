export const LOCAL_SAVED_PROPOSALS_FIXTURE_KEY =
  "dasti:proposal-saved-fixtures:v1";

type SavedProposalFixtureRecord = {
  _id: string;
  _creationTime?: number;
  title?: string;
  content?: string;
  status?: string;
  updatedAt?: number;
  createdAt?: number;
  sections?: Array<{
    type: "text" | "code" | "image";
    content: string;
  }>;
  metadata?: Record<string, unknown>;
};

function isSavedProposalFixtureRecord(
  value: unknown,
): value is SavedProposalFixtureRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { _id?: unknown })._id === "string",
  );
}

export function readStoredSavedProposalFixtures(): SavedProposalFixtureRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_SAVED_PROPOSALS_FIXTURE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isSavedProposalFixtureRecord);
  } catch {
    return [];
  }
}
