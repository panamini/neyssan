import { beforeEach, describe, expect, it, vi } from "vitest";

const { clearProposalPersonalizationCachesMock } = vi.hoisted(() => ({
  clearProposalPersonalizationCachesMock: vi.fn(),
}));

vi.mock("../proposal-personalization", () => ({
  clearProposalPersonalizationCaches: clearProposalPersonalizationCachesMock,
}));

import {
  ACCOUNT_LOCAL_DATA_OWNER_STORAGE_KEY,
  ACCOUNT_LOCAL_DATA_SESSION_OWNER_STORAGE_KEY,
  clearAccountLocalDataForSignedOut,
  prepareAccountLocalDataScope,
} from "../account-local-data";

const PRIVATE_LOCAL_VALUES = {
  cvDocuments: "private cv library",
  cvLibrary: "legacy private cv library",
  cvActiveId: "cv-private",
  "cv:cv-private": "private cv document",
  "cv-doc:cv-private": "legacy private cv document",
  "cv-backup-private": "private cv backup",
  "dasti:proposal-compose-draft:v1": "private proposal draft",
  "twoweeks:last-saved-proposal-path": "/proposal?id=private",
};

const PRIVATE_SESSION_VALUES = {
  "dasti:proposal-output-draft:session:v1": "private proposal output",
  "dasti:cv-import-recovery-draft:cv-private": "private import draft",
  "twoweeks:last-saved-proposal-path": "/proposal?id=private",
  pdf_ingest_last_parsed: "private parsed resume",
  "mcp-oauth-continuation-document-request:/oauth/continue": "working:v2",
};

function seedPrivateBrowserData(): void {
  for (const [key, value] of Object.entries(PRIVATE_LOCAL_VALUES)) {
    window.localStorage.setItem(key, value);
  }
  for (const [key, value] of Object.entries(PRIVATE_SESSION_VALUES)) {
    window.sessionStorage.setItem(key, value);
  }
}

describe("account-local-data", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearProposalPersonalizationCachesMock.mockClear();
  });

  it("purges account data on sign-out while preserving display preferences", () => {
    seedPrivateBrowserData();
    window.localStorage.setItem(ACCOUNT_LOCAL_DATA_OWNER_STORAGE_KEY, "user-a");
    window.sessionStorage.setItem(
      ACCOUNT_LOCAL_DATA_SESSION_OWNER_STORAGE_KEY,
      "user-a",
    );
    window.localStorage.setItem("theme", "dark");
    window.localStorage.setItem("twoweeks:ui-language", "fr");
    window.localStorage.setItem("twoweeks:document-language", "en");
    window.localStorage.setItem("twoweeks:motion-preference", "reduced");
    window.localStorage.setItem("dasti:cv-forge-workspace-mode:v1", "preview");
    window.localStorage.setItem("dasti:style-forge-render-mode:v1", "proposal");
    window.localStorage.setItem("dasti:proposal-preview-zoom-index:v1", "4");
    window.localStorage.setItem("unrelated", "preserve me");

    clearAccountLocalDataForSignedOut();

    for (const key of Object.keys(PRIVATE_LOCAL_VALUES)) {
      expect(window.localStorage.getItem(key)).toBeNull();
    }
    for (const key of Object.keys(PRIVATE_SESSION_VALUES)) {
      expect(window.sessionStorage.getItem(key)).toBeNull();
    }
    expect(
      window.localStorage.getItem(ACCOUNT_LOCAL_DATA_OWNER_STORAGE_KEY),
    ).toBeNull();
    expect(
      window.sessionStorage.getItem(
        ACCOUNT_LOCAL_DATA_SESSION_OWNER_STORAGE_KEY,
      ),
    ).toBeNull();
    expect(window.localStorage.getItem("theme")).toBe("dark");
    expect(window.localStorage.getItem("twoweeks:ui-language")).toBe("fr");
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("en");
    expect(window.localStorage.getItem("twoweeks:motion-preference")).toBe(
      "reduced",
    );
    expect(
      window.localStorage.getItem("dasti:cv-forge-workspace-mode:v1"),
    ).toBe("preview");
    expect(
      window.localStorage.getItem("dasti:style-forge-render-mode:v1"),
    ).toBe("proposal");
    expect(
      window.localStorage.getItem("dasti:proposal-preview-zoom-index:v1"),
    ).toBe("4");
    expect(window.localStorage.getItem("unrelated")).toBe("preserve me");
    expect(clearProposalPersonalizationCachesMock).toHaveBeenCalledTimes(1);
  });

  it("purges unowned legacy data and purges again before another account mounts", () => {
    seedPrivateBrowserData();

    expect(prepareAccountLocalDataScope("user-a")).toEqual({
      ownerChanged: true,
      purged: true,
    });
    expect(window.localStorage.getItem("cvDocuments")).toBeNull();
    expect(
      window.localStorage.getItem(ACCOUNT_LOCAL_DATA_OWNER_STORAGE_KEY),
    ).toBe("user-a");

    window.localStorage.setItem("cvDocuments", "user-a private cv library");

    expect(prepareAccountLocalDataScope("user-b")).toEqual({
      ownerChanged: true,
      purged: true,
    });
    expect(window.localStorage.getItem("cvDocuments")).toBeNull();
    expect(
      window.localStorage.getItem(ACCOUNT_LOCAL_DATA_OWNER_STORAGE_KEY),
    ).toBe("user-b");
    expect(clearProposalPersonalizationCachesMock).toHaveBeenCalledTimes(2);
  });

  it("purges stale session data in every tab without deleting the new owner's local data", () => {
    window.localStorage.setItem(
      ACCOUNT_LOCAL_DATA_OWNER_STORAGE_KEY,
      "user-b",
    );
    window.localStorage.setItem("cvDocuments", "user-b private cv library");
    window.sessionStorage.setItem(
      ACCOUNT_LOCAL_DATA_SESSION_OWNER_STORAGE_KEY,
      "user-a",
    );
    window.sessionStorage.setItem(
      "dasti:proposal-output-draft:session:v1",
      "user-a private proposal",
    );

    expect(prepareAccountLocalDataScope("user-b")).toEqual({
      ownerChanged: true,
      purged: true,
    });
    expect(window.localStorage.getItem("cvDocuments")).toBe(
      "user-b private cv library",
    );
    expect(
      window.sessionStorage.getItem("dasti:proposal-output-draft:session:v1"),
    ).toBeNull();
    expect(
      window.sessionStorage.getItem(
        ACCOUNT_LOCAL_DATA_SESSION_OWNER_STORAGE_KEY,
      ),
    ).toBe("user-b");
    expect(clearProposalPersonalizationCachesMock).toHaveBeenCalledTimes(1);
  });

  it("keeps same-account data stable after both owner markers are prepared", () => {
    expect(prepareAccountLocalDataScope("user-a")).toEqual({
      ownerChanged: true,
      purged: true,
    });
    window.localStorage.setItem("cvDocuments", "user-a private cv library");
    window.sessionStorage.setItem(
      "dasti:proposal-output-draft:session:v1",
      "user-a private proposal",
    );
    clearProposalPersonalizationCachesMock.mockClear();

    expect(prepareAccountLocalDataScope("user-a")).toEqual({
      ownerChanged: false,
      purged: false,
    });
    expect(window.localStorage.getItem("cvDocuments")).toBe(
      "user-a private cv library",
    );
    expect(
      window.sessionStorage.getItem("dasti:proposal-output-draft:session:v1"),
    ).toBe("user-a private proposal");
    expect(clearProposalPersonalizationCachesMock).not.toHaveBeenCalled();
  });
});
