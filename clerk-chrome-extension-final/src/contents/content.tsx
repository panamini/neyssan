import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { PlasmoContentScript } from 'plasmo';
import { hasUsableExtensionAuth, readExtensionAuthSnapshot } from '../lib/extension-auth-state';

export const config: PlasmoContentScript = {
  matches: [
    "https://*.upwork.com/*",
    "https://*.indeed.com/*",
    "https://*.linkedin.com/*",
    "https://*.ziprecruiter.com/*",
    "https://*.ziprecruiter.fr/*",
    "https://www.hellowork.com/fr-fr/emplois/*",
    "https://*.hellowork.com/fr-fr/emplois/*"
  ]
};

interface JobData {
  platform: string;
  title: string;
  description?: string;
  url: string;
  proposalType?: "technical" | "creative" | "cover_letter" | "application_message" | "freelance_proposal";
}

interface ActiveCvSnapshot {
  title: string;
  personalizationContext: {
    name?: string;
    summary?: string;
    desiredPosition?: string;
    topSkills?: string[];
    recentExperience?: Array<{
      company?: string;
      position?: string;
      highlights?: string[];
    }>;
    standoutAchievements?: string[];
  } | null;
  updatedAt?: string;
}

type ProfilePayload = {
  summary?: string;
  skills?: string[];
  experience?: {
    company: string;
    title: string;
    startDate?: number;
    endDate?: number;
    description?: string;
  }[];
  education?: {
    school: string;
    degree?: string;
    fieldOfStudy?: string;
    startDate?: number;
    endDate?: number;
  }[];
};

const USE_CURRENT_CV_CONTEXT_STORAGE_KEY = "useCurrentCvContext";

function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div style={{
      position: 'fixed',
      right: 24,
      bottom: 24,
      background: '#0f172a',
      color: 'white',
      padding: '10px 14px',
      borderRadius: 8,
      boxShadow: '0 6px 18px rgba(2,6,23,0.6)',
      zIndex: 99999
    }}>
      {message}
    </div>
  );
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function renderLetterLikePreview(content: string) {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((part) => stripInlineMarkdown(part))
    .map((part) => part.replace(/\n{3,}/g, "\n\n").trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return (
      <p style={{ margin: 0, whiteSpace: "pre-line", fontSize: 15, lineHeight: 1.75, color: "#111827" }}>
        {stripInlineMarkdown(content)}
      </p>
    );
  }

  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p
          key={index}
          style={{
            margin: 0,
            marginBottom: index === paragraphs.length - 1 ? 0 : 16,
            whiteSpace: "pre-line",
            fontSize: 15,
            lineHeight: 1.75,
            color: "#111827"
          }}
        >
          {paragraph}
        </p>
      ))}
    </>
  );
}

export function ProposalPreview() {
  const [jobData, setJobData] = useState<JobData>({
    platform: "manual",
    title: "Untitled",
    url: window.location.href,
  });
  const [proposal, setProposal] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [inlineStatus, setInlineStatus] = useState<{ kind: "error" | "success" | "info"; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isOpeningInApp, setIsOpeningInApp] = useState(false);
  const [activeCvSnapshot, setActiveCvSnapshot] = useState<ActiveCvSnapshot | null>(null);
  const [useCurrentCvContext, setUseCurrentCvContext] = useState(false);
  const nextGenerateRunIdRef = useRef(0);
  const activeGenerateRunIdRef = useRef<number | null>(null);
  const isAuthSyncInFlightRef = useRef(false);
  const lastAuthSyncAtRef = useRef(0);
  const isEffectivelySignedIn = hasUsableExtensionAuth(token);
  const AUTH_SYNC_THROTTLE_MS = 1200;

  const applyStoredAuthSnapshot = useCallback(async () => {
    const result = await readExtensionAuthSnapshot();
    setToken(result.authToken);
    setUserName(result.userName);
    setUserEmail(result.userEmail);
  }, []);

  const refreshActiveCvSnapshot = useCallback(() => {
    chrome.runtime.sendMessage({ action: "getActiveCvSnapshot" }, (response) => {
      if (chrome.runtime.lastError) {
        setActiveCvSnapshot(null);
        return;
      }

      if (response?.success) {
        setActiveCvSnapshot(response.snapshot || null);
        return;
      }

      setActiveCvSnapshot(null);
    });
  }, []);

  const syncAuthFromBackgroundSilently = useCallback((reason: string) => {
    const now = Date.now();
    if (isAuthSyncInFlightRef.current) {
      return;
    }
    if (now - lastAuthSyncAtRef.current < AUTH_SYNC_THROTTLE_MS) {
      return;
    }

    lastAuthSyncAtRef.current = now;
    isAuthSyncInFlightRef.current = true;
    chrome.runtime.sendMessage({ action: "checkSession", reason }, () => {
      void applyStoredAuthSnapshot()
        .then(() => {
          refreshActiveCvSnapshot();
        })
        .finally(() => {
          isAuthSyncInFlightRef.current = false;
        });
    });
  }, [applyStoredAuthSnapshot, refreshActiveCvSnapshot]);

  const authMessage = useMemo(() => {
    if (isEffectivelySignedIn) {
      return {
        title: "Signed in",
        detail: userEmail || userName || "Authenticated in the extension popup"
      };
    }
    return {
      title: "Not signed in",
      detail: "Open the extension popup to sign in or refresh the synced Clerk session."
    };
  }, [isEffectivelySignedIn, userEmail, userName]);

  const proposalType = jobData.proposalType || "cover_letter";
  const isLetterLikeProposal =
    proposalType === "cover_letter" || proposalType === "application_message";

  useEffect(() => {
    const platform = detectPlatform(window.location.href);
    let urlPollId: number | null = null;
    let scrapeRetryIds: number[] = [];
    let mutationObserver: MutationObserver | null = null;
    let observerTimeoutId: number | null = null;
    let observerDebounceId: number | null = null;
    let lastObservedUrl = window.location.href;

    const applyScrape = (mode: "replace" | "merge" = "merge") => {
      const activePlatform = detectPlatform(window.location.href);
      if (!activePlatform) return null;
      const nextJobData = scrapeJobData(activePlatform);
      setJobData((current) => {
        if (mode === "replace" || current.platform === "manual") {
          return nextJobData;
        }
        return mergeJobData(current, nextJobData);
      });
      return nextJobData;
    };

    const scheduleDeferredScrapes = (activePlatform: string, initialJobData?: JobData | null) => {
      if (!shouldScheduleDeferredScrapes(activePlatform, initialJobData?.description)) {
        return;
      }

      scrapeRetryIds.forEach((id) => window.clearTimeout(id));
      scrapeRetryIds = [400, 1200, 2500, 5000].map((delay) =>
        window.setTimeout(() => {
          const refreshed = applyScrape("merge");
          if (refreshed && hasUsefulDescription(refreshed.platform, refreshed.description)) {
            scrapeRetryIds.forEach((id) => window.clearTimeout(id));
            scrapeRetryIds = [];
          }
        }, delay)
      );

      if (!shouldObserveDeferredScrapes(activePlatform)) {
        return;
      }

      mutationObserver?.disconnect();
      if (observerTimeoutId !== null) {
        window.clearTimeout(observerTimeoutId);
      }
      if (observerDebounceId !== null) {
        window.clearTimeout(observerDebounceId);
      }

      mutationObserver = new MutationObserver(() => {
        if (observerDebounceId !== null) {
          window.clearTimeout(observerDebounceId);
        }

        observerDebounceId = window.setTimeout(() => {
          void applyScrape("merge");
        }, 250);
      });

      const observerRoot = document.querySelector("main") || document.body;
      mutationObserver.observe(observerRoot, { childList: true, subtree: true, characterData: true });
      observerTimeoutId = window.setTimeout(() => {
        mutationObserver?.disconnect();
        mutationObserver = null;
      }, 8000);
    };

    if (platform) {
      const initialJobData = applyScrape("replace");
      scheduleDeferredScrapes(platform, initialJobData);
    }

    void applyStoredAuthSnapshot().then(() => {
      refreshActiveCvSnapshot();
    });
    syncAuthFromBackgroundSilently("content-mount");

    chrome.storage.local.get([USE_CURRENT_CV_CONTEXT_STORAGE_KEY], (result) => {
      setUseCurrentCvContext(Boolean(result?.[USE_CURRENT_CV_CONTEXT_STORAGE_KEY]));
    });

    const updateAuth = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== "local") return;
      if (changes.authToken) setToken(changes.authToken.newValue || null);
      if (changes.userName) setUserName(changes.userName.newValue || null);
      if (changes.userEmail) setUserEmail(changes.userEmail.newValue || null);
      if (changes.authToken || changes.userName || changes.userEmail) {
        refreshActiveCvSnapshot();
      }
      if (changes[USE_CURRENT_CV_CONTEXT_STORAGE_KEY]) {
        setUseCurrentCvContext(Boolean(changes[USE_CURRENT_CV_CONTEXT_STORAGE_KEY].newValue));
      }
    };
    chrome.storage.onChanged.addListener(updateAuth);

    const handleFocus = () => {
      syncAuthFromBackgroundSilently("content-focus");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncAuthFromBackgroundSilently("content-visible");
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    urlPollId = window.setInterval(() => {
      if (window.location.href === lastObservedUrl) {
        return;
      }

      lastObservedUrl = window.location.href;
      const nextPlatform = detectPlatform(lastObservedUrl);
      if (!nextPlatform) {
        return;
      }

      const nextJobData = applyScrape("replace");
      scheduleDeferredScrapes(nextPlatform, nextJobData);
    }, 1000);

    return () => {
      chrome.storage.onChanged.removeListener(updateAuth);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      scrapeRetryIds.forEach((id) => window.clearTimeout(id));
      mutationObserver?.disconnect();
      if (observerTimeoutId !== null) {
        window.clearTimeout(observerTimeoutId);
      }
      if (observerDebounceId !== null) {
        window.clearTimeout(observerDebounceId);
      }
      if (urlPollId !== null) {
        window.clearInterval(urlPollId);
      }
    };
  }, [applyStoredAuthSnapshot, refreshActiveCvSnapshot, syncAuthFromBackgroundSilently]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const showInlineStatus = (kind: "error" | "success" | "info", message: string) => {
    setInlineStatus({ kind, message });
  };

  const getRuntimeErrorMessage = () => chrome.runtime.lastError?.message || "Could not reach the extension background process.";

  const handleCurrentCvContextToggle = (nextChecked: boolean) => {
    setUseCurrentCvContext(nextChecked);
    chrome.storage.local.set({ [USE_CURRENT_CV_CONTEXT_STORAGE_KEY]: nextChecked });
  };

  const handleGenerate = () => {
    const runId = ++nextGenerateRunIdRef.current;
    activeGenerateRunIdRef.current = runId;
    setIsLoading(true);
    setInlineStatus(null);
    chrome.runtime.sendMessage({ action: "generateProposal", jobData, useCurrentCvContext }, (response) => {
      if (activeGenerateRunIdRef.current !== runId) {
        return;
      }

      activeGenerateRunIdRef.current = null;
      setIsLoading(false);
      if (chrome.runtime.lastError) {
        const err = getRuntimeErrorMessage();
        showToast(`Failed to generate: ${err}`);
        showInlineStatus("error", `Generate failed: ${err}`);
        return;
      }
      if (response && response.success) {
        setProposal(response.proposal);
        showToast("Proposal generated");
        showInlineStatus("success", "Proposal generated successfully.");
      } else {
        const err = response?.error || 'Unknown error';
        showToast(`Failed to generate: ${err}`);
        showInlineStatus("error", `Generate failed: ${err}`);
      }
    });
  };

  const handleStopGenerate = () => {
    if (activeGenerateRunIdRef.current === null) {
      return;
    }

    activeGenerateRunIdRef.current = null;
    setIsLoading(false);
    showToast("Generation stopped.");
    showInlineStatus("info", "Generation stopped. Any late result from the background will be ignored.");
  };

  const handleSave = () => {
    if (!proposal) {
      showToast("Generate a proposal first.");
      showInlineStatus("error", "Save failed: generate a proposal first.");
      return;
    }
    setIsSaving(true);
    setInlineStatus(null);
    chrome.runtime.sendMessage({ action: "saveProposal", jobData, proposalText: proposal }, (response) => {
      setIsSaving(false);
      if (chrome.runtime.lastError) {
        const err = getRuntimeErrorMessage();
        showToast(`Failed to save: ${err}`);
        showInlineStatus("error", `Save failed: ${err}`);
        return;
      }
      if (response && response.success) {
        showToast("Proposal saved successfully!");
        showInlineStatus("success", "Proposal saved successfully.");
      } else {
        const err = response?.error || 'Unknown error';
        showToast(`Failed to save: ${err}`);
        showInlineStatus("error", `Save failed: ${err}`);
      }
    });
  };

  const handleOpenInProposalForge = () => {
    setIsOpeningInApp(true);
    setInlineStatus(null);
    chrome.runtime.sendMessage({ action: "openProposalForge", jobData }, (response) => {
      setIsOpeningInApp(false);
      if (chrome.runtime.lastError) {
        const err = getRuntimeErrorMessage();
        showToast(`Failed to open Proposal Forge: ${err}`);
        showInlineStatus("error", `Open in Proposal Forge failed: ${err}`);
        return;
      }
      if (response && response.success) {
        showToast("Opened Proposal Forge");
        showInlineStatus("success", "Opened Proposal Forge in a new tab.");
      } else {
        const err = response?.error || "Unknown error";
        showToast(`Failed to open Proposal Forge: ${err}`);
        showInlineStatus("error", `Open in Proposal Forge failed: ${err}`);
      }
    });
  };

  const cleanCopiedJobDescription = (description?: string) => {
    if (!description) return "";

    const lines = description.replace(/\r\n/g, "\n").split("\n");
    while (lines.length > 0 && lines[0].trim().length === 0) {
      lines.shift();
    }

    const firstLine = lines[0]?.trim().replace(/^[\s\-:•.]+/, "").replace(/[\s:.-]+$/, "") ?? "";
    if (firstLine.toLowerCase() === "job post") {
      lines.shift();
      while (lines.length > 0 && lines[0].trim().length === 0) {
        lines.shift();
      }
    }

    return lines.join("\n").trim();
  };

  const handleCopyJob = async () => {
    const copiedJobText = [jobData.title, cleanCopiedJobDescription(jobData.description)]
      .map((value) => value.trim())
      .filter(Boolean)
      .join("\n\n");

    if (!copiedJobText) {
      showToast("No job content to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(copiedJobText);
      showToast("Job copied to clipboard.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Clipboard write failed.";
      showToast(`Failed to copy job: ${errorMessage}`);
      showInlineStatus("error", `Copy job failed: ${errorMessage}`);
    }
  };

  const handleExportText = () => {
    if (proposal) {
      navigator.clipboard.writeText(proposal);
      showToast("Proposal copied to clipboard!");
    }
  };

  const handleClearProposal = () => {
    setProposal(null);
  };

  const handleExportPDF = () => {
    if (proposal) {
      const win = window.open();
      if (win) {
        win.document.write(`<html><body><pre>${escapeHtml(proposal)}</pre></body></html>`);
        win.document.close();
        win.print();
      }
    }
  };

  // NEW: Save profile flow
  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setInlineStatus(null);
    try {
      const profile = extractProfileFromPage();
      if (!profile || (Object.keys(profile).length === 0)) {
        showToast("No profile data detected on this page.");
        showInlineStatus("info", "No profile data was detected on this page.");
        setIsSavingProfile(false);
        return;
      }
      chrome.runtime.sendMessage({ action: "ingestProfile", profile }, (response) => {
        setIsSavingProfile(false);
        if (chrome.runtime.lastError) {
          const err = getRuntimeErrorMessage();
          showToast(`Failed to save profile: ${err}`);
          showInlineStatus("error", `Save profile failed: ${err}`);
          return;
        }
        if (response && response.success) {
          showToast("Profile saved successfully!");
          showInlineStatus("success", "Profile saved successfully.");
        } else {
          const err = response?.error || 'Unknown error';
          showToast(`Failed to save profile: ${err}`);
          showInlineStatus("error", `Save profile failed: ${err}`);
        }
      });
    } catch (err: any) {
      setIsSavingProfile(false);
      showToast(`Profile save failed: ${err?.message || String(err)}`);
      showInlineStatus("error", `Save profile failed: ${err?.message || String(err)}`);
    }
  };

  return (
    <>
      <div id="proposal-preview-root" style={{ position: "fixed", bottom: "20px", right: "20px", width: "420px", padding: "18px", background: "white", border: "1px solid #e5e7eb", borderRadius: "10px", boxShadow: "0 8px 30px rgba(2,6,23,0.2)", zIndex: 99999, fontFamily: "inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto" }}>
        <h3 style={{ margin: 0, marginBottom: 8, fontSize: 16 }}>Proposal Preview</h3>
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 12,
            border: isEffectivelySignedIn ? "1px solid #bbf7d0" : "1px solid #fde68a",
            background: isEffectivelySignedIn ? "#f0fdf4" : "#fffbeb",
            color: isEffectivelySignedIn ? "#166534" : "#92400e"
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{authMessage.title}</div>
          <div>{authMessage.detail}</div>
        </div>

        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            color: "#111827"
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            {activeCvSnapshot ? `Current CV: ${activeCvSnapshot.title}` : "Current CV: none"}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#374151" }}>
            <input
              type="checkbox"
              checked={useCurrentCvContext}
              onChange={(e) => handleCurrentCvContextToggle(e.target.checked)}
              disabled={!activeCvSnapshot}
            />
            <span>Use current CV context</span>
          </label>
          {!activeCvSnapshot && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
              Open the web app and set an active CV to use CV context here.
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 6
          }}
        >
          <label style={{ display: "block", fontSize: 12, color: "#374151" }}>Job Title:</label>
          <button
            type="button"
            onClick={() => {
              void handleCopyJob();
            }}
            style={{
              padding: "4px 8px",
              fontSize: 12,
              background: "#f3f4f6",
              color: "#374151",
              border: "1px solid #e5e7eb",
              borderRadius: 999,
              cursor: "pointer"
            }}
            aria-label="Copy scraped job title and description"
            title="Copy job title and description"
          >
            Copy job
          </button>
        </div>
        <input
          value={jobData.title}
          onChange={(e) => setJobData({ ...jobData, title: e.target.value })}
          style={{ width: "100%", padding: "8px", marginBottom: "10px", borderRadius: 6, border: "1px solid #e5e7eb" }}
          name="jobTitle"
        />

        <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 6 }}>Job Description:</label>
        <textarea
          value={jobData.description || ""}
          onChange={(e) => setJobData({ ...jobData, description: e.target.value })}
          style={{ width: "100%", height: "100px", padding: "8px", marginBottom: "10px", borderRadius: 6, border: "1px solid #e5e7eb" }}
          name="jobDescription"
        />

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={isLoading ? handleStopGenerate : handleGenerate}
            style={{
              padding: "10px 14px",
              background: isLoading ? "#fee2e2" : "#3b82f6",
              color: isLoading ? "#991b1b" : "white",
              border: isLoading ? "1px solid #fecaca" : "none",
              borderRadius: 8,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8
            }}
          >
            {isLoading ? "Stop" : "Generate"}
          </button>

          <button
            onClick={handleOpenInProposalForge}
            disabled={isOpeningInApp}
            style={{
              padding: "10px 14px",
              background: "#e5e7eb",
              color: "#111827",
              border: "none",
              borderRadius: 8,
              cursor: isOpeningInApp ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8
            }}
            title="Open the scraped job in Proposal Forge to choose a CV and generate there"
          >
            {isOpeningInApp ? <Spinner /> : "Open in Proposal Forge"}
          </button>

          <button
            onClick={handleSaveProfile}
            disabled={isSavingProfile}
            style={{
              padding: "8px 12px",
              background: isSavingProfile ? "#9ca3af" : "#9333ea",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: isSavingProfile ? "not-allowed" : "pointer",
              marginLeft: 8
            }}
            title="Save detected profile information from this page to your Neyssan profile"
          >
            {isSavingProfile ? <Spinner small /> : "Save profile"}
          </button>
        </div>

        {inlineStatus && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 12,
              border: inlineStatus.kind === "error" ? "1px solid #fecaca" : inlineStatus.kind === "success" ? "1px solid #bbf7d0" : "1px solid #bfdbfe",
              background: inlineStatus.kind === "error" ? "#fef2f2" : inlineStatus.kind === "success" ? "#f0fdf4" : "#eff6ff",
              color: inlineStatus.kind === "error" ? "#991b1b" : inlineStatus.kind === "success" ? "#166534" : "#1d4ed8"
            }}
          >
            {inlineStatus.message}
          </div>
        )}

        {proposal && (
          <div style={{ marginTop: 14 }}>
            {isLetterLikeProposal ? (
              <div
                style={{
                  maxHeight: "220px",
                  overflowY: "auto",
                  padding: "14px 16px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#fffdfa",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)"
                }}
              >
                {renderLetterLikePreview(proposal)}
              </div>
            ) : (
              <textarea
                value={proposal}
                onChange={(e) => setProposal(e.target.value)}
                style={{ width: "100%", height: "150px", padding: "8px", borderRadius: 6, border: "1px solid #e5e7eb" }}
              />
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <button
                onClick={handleSave}
                disabled={!proposal || isSaving}
                style={{
                  padding: "8px 12px",
                  background: isSaving ? "#f59e0b" : "#f59e0b",
                  color: "black",
                  border: "none",
                  borderRadius: 6,
                  cursor: !proposal || isSaving ? "not-allowed" : "pointer",
                }}
              >
                {isSaving ? <Spinner small /> : "Save"}
              </button>

              <button
                onClick={handleExportText}
                disabled={!proposal}
                style={{ padding: "8px 10px", background: "#10b981", color: "white", border: "none", borderRadius: 6, cursor: proposal ? "pointer" : "not-allowed" }}
              >
                Copy
              </button>

              <button
                onClick={handleExportPDF}
                disabled={!proposal}
                style={{ padding: "8px 10px", background: "#06b6d4", color: "white", border: "none", borderRadius: 6, cursor: proposal ? "pointer" : "not-allowed" }}
              >
                PDF
              </button>

              <button
                onClick={handleClearProposal}
                disabled={!proposal}
                style={{ padding: "8px 10px", background: "#e5e7eb", color: "#111827", border: "none", borderRadius: 6, cursor: proposal ? "pointer" : "not-allowed" }}
              >
                Clear proposal
              </button>

              <div style={{ marginLeft: "auto", color: "#6b7280", fontSize: 12 }}>{isEffectivelySignedIn ? `Signed in${userEmail ? ` as ${userEmail}` : ""}` : "Open popup to sign in"}</div>
            </div>
          </div>
        )}
      </div>

      <Toast message={toast} onClose={() => setToast(null)} />
    </>
  );
}

function Spinner({ small }: { small?: boolean } = { small: false }) {
  const size = small ? 12 : 16;
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" style={{ display: "inline-block" }}>
      <circle cx="25" cy="25" r="20" stroke="#e5e7eb" strokeWidth="6" fill="none" />
      <path d="M45 25a20 20 0 0 1-20 20" stroke="#111827" strokeWidth="6" strokeLinecap="round" fill="none">
        <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 25 25" to="360 25 25" dur="0.9s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

function escapeHtml(unsafe: string) {
  return unsafe.replace(/[&<"'>]/g, function (m) {
    switch (m) {
      case '&': return '&';
      case '<': return '<';
      case '>': return '>';
      case '"': return '"';
      case "'": return '&#039;';
      default: return m;
    }
  });
}

function detectPlatform(url: string): string | null {
  if (url.includes("upwork.com")) return "upwork";
  if (url.includes("indeed.com")) return "indeed";
  if (url.includes("linkedin.com")) return "linkedin";
  if (isZipRecruiterJobUrl(url)) return "ziprecruiter";
  if (url.includes("hellowork.com") && /\/fr-fr\/emplois\/.+/.test(url)) return "hellowork";
  return null;
}

function isZipRecruiterJobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const isZipRecruiterHost =
      host === "ziprecruiter.com" ||
      host.endsWith(".ziprecruiter.com") ||
      host === "ziprecruiter.fr" ||
      host.endsWith(".ziprecruiter.fr");
    if (!isZipRecruiterHost) return false;

    const path = parsed.pathname.toLowerCase();
    return (
      path.startsWith("/jobs/") ||
      path.startsWith("/jobs-search") ||
      path.startsWith("/c/") ||
      parsed.searchParams.has("jid")
    );
  } catch {
    const lowered = url.toLowerCase();
    if (!/ziprecruiter\.(com|fr)/.test(lowered)) return false;
    return (
      lowered.includes("/jobs/") ||
      lowered.includes("/jobs-search") ||
      lowered.includes("/c/") ||
      lowered.includes("jid=")
    );
  }
}

/**
 * Heuristic extraction of profile fields from the page.
 * This is intentionally tolerant and attempts several selectors per platform.
 */
function extractProfileFromPage(): ProfilePayload {
  const url = window.location.href;
  const platform = detectPlatform(url);

  // Helpers
  const textFromSelectors = (selectors: string[]) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) {
        const txt = el.innerText?.trim();
        if (txt) return txt;
      }
    }
    return undefined;
  };

  const listFromSelectors = (selectors: string[]) => {
    for (const sel of selectors) {
      const nodes = Array.from(document.querySelectorAll(sel));
      if (nodes.length) {
        const values = nodes.map((n) => (n.textContent || "").trim()).filter(Boolean);
        if (values.length) return values;
      }
    }
    return undefined;
  };

  const experienceFromLinkedIn = (): ProfilePayload["experience"] | undefined => {
    try {
      const sections = Array.from(document.querySelectorAll('.pv-position-entity, .experience-section .pv-entity'));
      if (!sections.length) return undefined;
      return sections.map((s) => {
        const company = (s.querySelector('.pv-entity__secondary-title, .pv-entity__school-name')?.textContent || "").trim();
        const title = (s.querySelector('.pv-entity__summary-info h3, .pv-entity__summary-info .t-14')?.textContent || "").trim();
        const dateRange = (s.querySelector('.pv-entity__date-range span:nth-child(2)')?.textContent || "").trim();
        // naive parse for start/end year
        let startDate: number | undefined;
        let endDate: number | undefined;
        if (dateRange) {
          const years = dateRange.match(/\d{4}/g);
          if (years && years.length >= 1) startDate = Number(years[0]);
          if (years && years.length >= 2) endDate = Number(years[1]);
        }
        const description = (s.querySelector('.pv-entity__description')?.textContent || "").trim();
        return { company, title, startDate, endDate, description };
      }).filter(Boolean);
    } catch (e) {
      return undefined;
    }
  };

  const educationFromLinkedIn = (): ProfilePayload["education"] | undefined => {
    try {
      const sections = Array.from(document.querySelectorAll('.education__list .education__list-item, .pv-education-entity'));
      if (!sections.length) return undefined;
      return sections.map((s) => {
        const school = (s.querySelector('.pv-entity__school-name')?.textContent || "").trim();
        const degree = (s.querySelector('.pv-entity__degree-name .pv-entity__comma-item')?.textContent || "").trim();
        const fieldOfStudy = (s.querySelector('.pv-entity__fos .pv-entity__comma-item')?.textContent || "").trim();
        return { school, degree, fieldOfStudy };
      }).filter(Boolean);
    } catch (e) {
      return undefined;
    }
  };

  // Default heuristics across platforms
  let summary = textFromSelectors([
    'meta[name="description"]',
    '.summary, .about, .profile-about__summary, .profile-about',
    '.job-description, .description, .job-desc'
  ]);

  // If meta description found, get content
  if (!summary) {
    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (meta && meta.content) summary = meta.content.trim();
  }

  const skills = listFromSelectors([
    '.skills-list .skill, .skill, .pip-skills-section__skill, [data-test="skill"]',
    '.job-criteria__item, .pill, .job-tags__tag'
  ]);

  let experience = undefined;
  let education = undefined;
  if (platform === 'linkedin') {
    summary = summary || textFromSelectors(['.pv-about__summary-text', '.profile-about__summary-text']);
    experience = experienceFromLinkedIn();
    education = educationFromLinkedIn();
  }

  // Fallback: attempt to extract bullet-lists that look like skills
  if (!skills) {
    const list = Array.from(document.querySelectorAll('ul li')).slice(0, 30).map((n) => n.textContent?.trim() || '').filter(Boolean);
    if (list.length) {
      // heuristically pick those with short length as skills
      const shortItems = list.filter((t) => t.split(' ').length <= 4);
      if (shortItems.length >= 3) {
        return { summary, skills: shortItems.slice(0, 12) };
      }
    }
  }

  return {
    summary,
    skills,
    experience,
    education
  };
}

function normalizeScrapedText(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return normalized || undefined;
}

function textFromNode(node: Element | null): string | undefined {
  if (!node) return undefined;
  if (node instanceof HTMLMetaElement) {
    return normalizeScrapedText(node.content);
  }
  if (node instanceof HTMLElement) {
    return normalizeScrapedText(node.innerText || node.textContent);
  }
  return normalizeScrapedText(node.textContent);
}

function descriptionTextFromNode(node: Element | null): string | undefined {
  if (!node) return undefined;

  const blockNodes = Array.from(node.querySelectorAll("p, li, h2, h3, h4, strong"));
  const blockTexts = blockNodes
    .map((child) => textFromNode(child))
    .filter((text): text is string => Boolean(text));

  if (blockTexts.length >= 2) {
    const combined = normalizeScrapedText(blockTexts.join("\n"));
    if (combined && combined.length >= 60) {
      return combined;
    }
  }

  return textFromNode(node);
}

function queryFirstMeaningfulText(
  selectors: string[],
  minLength = 1,
  root: ParentNode = document
): string | undefined {
  for (const selector of selectors) {
    const nodes = Array.from(root.querySelectorAll(selector));
    for (const node of nodes) {
      const text = textFromNode(node);
      if (text && text.length >= minLength) {
        return text;
      }
    }
  }
  return undefined;
}

function queryFirstFilteredText(
  selectors: string[],
  minLength: number,
  isRejected: (text: string) => boolean,
  root: ParentNode = document
): string | undefined {
  for (const selector of selectors) {
    const nodes = Array.from(root.querySelectorAll(selector));
    for (const node of nodes) {
      const text = textFromNode(node);
      if (text && text.length >= minLength && !isRejected(text)) {
        return text;
      }
    }
  }
  return undefined;
}

function queryFirstFilteredDescriptionText(
  selectors: string[],
  minLength: number,
  isRejected: (text: string) => boolean,
  root: ParentNode = document
): string | undefined {
  for (const selector of selectors) {
    const nodes = Array.from(root.querySelectorAll(selector));
    for (const node of nodes) {
      const text = descriptionTextFromNode(node);
      if (text && text.length >= minLength && !isRejected(text)) {
        return text;
      }
    }
  }
  return undefined;
}

function stripHtml(value: string): string {
  const container = document.createElement("div");
  container.innerHTML = value;
  return container.textContent || container.innerText || value;
}

function findJobPostingJsonLdField(field: "title" | "description"): string | undefined {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const queue: unknown[] = [];

  for (const script of scripts) {
    const raw = script.textContent?.trim();
    if (!raw) continue;
    try {
      queue.push(JSON.parse(raw));
    } catch {
      // ignore malformed structured data
    }
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    if (typeof current !== "object") continue;

    const record = current as Record<string, unknown>;
    const typeValue = record["@type"];
    const isJobPosting =
      (typeof typeValue === "string" && typeValue.toLowerCase() === "jobposting") ||
      (Array.isArray(typeValue) &&
        typeValue.some((entry) => typeof entry === "string" && entry.toLowerCase() === "jobposting"));

    if (isJobPosting && typeof record[field] === "string") {
      const text = normalizeScrapedText(stripHtml(record[field] as string));
      if (text) return text;
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return undefined;
}

function findJobPostingJsonLdRecord(): Record<string, unknown> | undefined {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const queue: unknown[] = [];

  for (const script of scripts) {
    const raw = script.textContent?.trim();
    if (!raw) continue;
    try {
      queue.push(JSON.parse(raw));
    } catch {
      // ignore malformed structured data
    }
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    if (typeof current !== "object") continue;

    const record = current as Record<string, unknown>;
    const typeValue = record["@type"];
    const isJobPosting =
      (typeof typeValue === "string" && typeValue.toLowerCase() === "jobposting") ||
      (Array.isArray(typeValue) &&
        typeValue.some((entry) => typeof entry === "string" && entry.toLowerCase() === "jobposting"));

    if (isJobPosting) {
      return record;
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return undefined;
}

function isLikelySerializedAppStateText(text: string): boolean {
  const lowered = text.toLowerCase();
  const trimmed = text.trim();
  const bootstrapMarkers = [
    "\"apollo\"",
    "\"cachedata\"",
    "\"pageprops\"",
    "\"initialstate\"",
    "\"redux\"",
    "\"bootstrap\"",
    "\"experiments\"",
    "\"tracking\"",
    "\"session\"",
    "\"seo\"",
    "\"__next_data__\"",
    "\"__typename\"",
    "\"dehydratedstate\"",
    "\"query\"",
    "\"gigid\"",
    "\"sellername\"",
    "\"pageprops\""
  ];
  const matchedMarkers = bootstrapMarkers.filter((marker) => lowered.includes(marker)).length;
  const braceCount = (text.match(/[{}]/g) || []).length;
  const quoteCount = (text.match(/"/g) || []).length;
  const colonCount = (text.match(/:/g) || []).length;

  return (
    matchedMarkers >= 2 ||
    (braceCount > 12 && quoteCount > 18 && colonCount > 18) ||
    ((trimmed.startsWith("{") || trimmed.startsWith("[")) && quoteCount > 12 && colonCount > 10)
  );
}

function stripHeadingPrefix(text: string, headings: string[]): string {
  let result = text.trim();
  for (const heading of headings) {
    const pattern = new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:\\-]?\\s*`, "i");
    result = result.replace(pattern, "").trim();
  }
  return result;
}

function findContentNearHeading(
  headings: string[],
  minLength: number,
  isRejected: (text: string) => boolean
): string | undefined {
  const root = document.querySelector("main") || document.body;
  const headingNodes = Array.from(root.querySelectorAll("h1, h2, h3, h4, strong, span, p, div"));

  for (const node of headingNodes) {
    const headingText = textFromNode(node)?.toLowerCase();
    if (!headingText) continue;
    if (!headings.some((heading) => headingText === heading || headingText.startsWith(heading) || headingText.includes(heading))) {
      continue;
    }

    const candidates = [
      node.nextElementSibling,
      node.parentElement?.nextElementSibling,
      node.parentElement,
      node.closest("section, article, div"),
      node.closest("section, article, div")?.nextElementSibling
    ].filter((candidate): candidate is Element => Boolean(candidate));

    for (const candidate of candidates) {
      const text = descriptionTextFromNode(candidate);
      if (!text) continue;
      const stripped = stripHeadingPrefix(text, headings);
      if (stripped.length >= minLength && !isRejected(stripped)) {
        return stripped;
      }
    }
  }

  return undefined;
}

function isLikelyUpworkShellText(text: string): boolean {
  const lowered = text.toLowerCase();
  const shellMarkers = [
    "browse talent",
    "project catalog",
    "hire freelancers",
    "talent marketplace",
    "search jobs",
    "log in",
    "sign up"
  ];
  return shellMarkers.filter((marker) => lowered.includes(marker)).length >= 3;
}

function pickBestUpworkDescriptionFallback(): string | undefined {
  const root = document.querySelector("main") || document.body;
  const candidates = Array.from(
    root.querySelectorAll('article, section, [data-test*="job"], [data-test*="description"], .air3-card-section')
  );

  const scored = candidates
    .map((node) => {
      const text = textFromNode(node);
      if (!text || text.length < 120 || text.length > 8000) return null;
      if (isLikelyUpworkShellText(text)) return null;

      const element = node as HTMLElement;
      const selectorHints = `${element.tagName.toLowerCase()} ${element.getAttribute("data-test") || ""} ${element.className || ""}`.toLowerCase();
      let score = text.length;
      if (selectorHints.includes("job-description")) score += 5000;
      if (selectorHints.includes("description")) score += 1500;
      if (selectorHints.includes("job")) score += 500;
      if (element.querySelector("li")) score += 250;
      return { text, score };
    })
    .filter((entry): entry is { text: string; score: number } => Boolean(entry))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.text;
}

function scrapeUpworkJobData(): JobData {
  const title =
    queryFirstMeaningfulText([
      'h1[data-test="job-title"]',
      'h4[data-test="job-title"]',
      '.job-tile-title',
      'a[data-test*="job-tile-title-link"]',
      "main h1",
      "h1"
    ], 4) ||
    findJobPostingJsonLdField("title") ||
    "Untitled";

  const description =
    queryFirstMeaningfulText([
      '*[data-test="job-description-text"]',
      '*[data-test="job-description-line-clamp"]',
      'section[data-test="job-description"]',
      'div[data-test="job-description"]',
      'section[data-test="JobDescription"]',
      'div[data-test="JobDescription"]',
      '*[data-test*="job-description"]'
    ], 120) ||
    findJobPostingJsonLdField("description") ||
    pickBestUpworkDescriptionFallback();

  return {
    platform: "upwork",
    title,
    description,
    url: window.location.href
  };
}

function isLikelyIndeedShellText(text: string): boolean {
  const lowered = text.toLowerCase();
  const shellMarkers = [
    "indeed home",
    "career guide",
    "company reviews",
    "browse jobs",
    "find salaries",
    "privacy center",
    "cookies, privacy and terms",
    "let employers find you",
    "upload your resume"
  ];
  return shellMarkers.filter((marker) => lowered.includes(marker)).length >= 2;
}

const INDEED_TITLE_BADGE_MARKERS = new Set([
  "job post",
  "new",
  "new today",
  "actively hiring",
  "urgently hiring",
  "easily apply",
  "hiring multiple candidates"
]);

function normalizeIndeedTitleBadgeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/^[\s\-:|•.]+/, "")
    .replace(/[\s\-:|•.]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanIndeedTitle(text: string | undefined): string | undefined {
  const normalized = normalizeScrapedText(text);
  if (!normalized) return undefined;

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  while (
    lines.length > 1 &&
    INDEED_TITLE_BADGE_MARKERS.has(normalizeIndeedTitleBadgeText(lines[lines.length - 1]))
  ) {
    lines.pop();
  }

  if (lines.length > 0) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(
      /\s*(?:-|–|—|\||:)\s*(job post|new|new today|actively hiring|urgently hiring|easily apply|hiring multiple candidates)\s*$/i,
      ""
    ).trim();
  }

  const cleaned = lines.join(" ").replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

function pickBestIndeedDescriptionFallback(): string | undefined {
  const root = document.querySelector("main") || document.body;
  const candidates = Array.from(
    root.querySelectorAll(
      '#jobDescriptionText, [data-testid*="JobComponent-description"], [data-testid*="jobDescription"], [id*="jobDescription"], article, section, div[class*="jobsearch-JobComponent-description"], div[class*="jobDescription"]'
    )
  );

  const scored = candidates
    .map((node) => {
      const text = textFromNode(node);
      if (!text || text.length < 120 || text.length > 12000) return null;
      if (isLikelyIndeedShellText(text)) return null;

      const element = node as HTMLElement;
      const selectorHints = `${element.tagName.toLowerCase()} ${element.id || ""} ${element.getAttribute("data-testid") || ""} ${element.className || ""}`.toLowerCase();
      let score = text.length;
      if (selectorHints.includes("jobdescriptiontext")) score += 6000;
      if (selectorHints.includes("jobcomponent-description")) score += 5000;
      if (selectorHints.includes("jobdescription")) score += 2500;
      if (selectorHints.includes("description")) score += 1000;
      if (element.querySelector("li")) score += 200;
      return { text, score };
    })
    .filter((entry): entry is { text: string; score: number } => Boolean(entry))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.text;
}

function scrapeIndeedJobData(): JobData {
  const rawTitle =
    queryFirstMeaningfulText([
      'h1[data-testid="jobsearch-JobInfoHeader-title"]',
      'h1[data-testid="simpler-jobTitle"]',
      ".jobsearch-JobInfoHeader-title",
      "main h1",
      "h1"
    ], 4) ||
    findJobPostingJsonLdField("title") ||
    "Untitled";
  const title = cleanIndeedTitle(rawTitle) || rawTitle;

  const description =
    queryFirstMeaningfulText([
      "#jobDescriptionText",
      '[data-testid="jobsearch-JobComponent-description"]',
      '[data-testid="JobComponent-description"]',
      '[data-testid*="jobDescription"]',
      '.jobsearch-JobComponent-description',
      '[class*="jobsearch-JobComponent-description"]',
      '[id*="jobDescription"]'
    ], 120) ||
    findJobPostingJsonLdField("description") ||
    pickBestIndeedDescriptionFallback();

  return {
    platform: "indeed",
    title,
    description,
    url: window.location.href
  };
}

function isLikelyLinkedInShellText(text: string): boolean {
  const lowered = text.toLowerCase();
  const shellMarkers = [
    "0 notifications total",
    "skip to main content",
    "join now",
    "sign in",
    "people also viewed",
    "jobs you may be interested in",
    "set alert for similar jobs",
    "get job alerts",
    "insights from premium",
    "join linkedin",
    "show all",
    "easy apply",
    "connect with people who can help",
    "meet the hiring team",
    "people you can reach out to",
    "am i a good fit for this job"
  ];
  return shellMarkers.filter((marker) => lowered.includes(marker)).length >= 2;
}

function pickBestLinkedInDescriptionFallback(): string | undefined {
  const root = document.querySelector("main") || document.body;
  const candidates = Array.from(
    root.querySelectorAll(
      '.jobs-description__content, .jobs-box__html-content, .jobs-description-content__text, .jobs-search__job-details--container, .show-more-less-html__markup, .job-details-about-the-job-module__description, article, section, div[class*="jobs-description"], div[class*="jobs-box"], div[class*="show-more-less-html"], div[class*="job-details-about-the-job"], div[class*="job-details-module"]'
    )
  );

  const scored = candidates
    .map((node) => {
      const text = descriptionTextFromNode(node);
      if (!text || text.length < 120 || text.length > 12000) return null;
      if (isLikelyLinkedInShellText(text)) return null;
      if (isLikelySerializedAppStateText(text)) return null;

      const element = node as HTMLElement;
      const selectorHints = `${element.tagName.toLowerCase()} ${element.id || ""} ${element.getAttribute("data-test-id") || ""} ${element.className || ""}`.toLowerCase();
      let score = text.length;
      if (selectorHints.includes("jobs-description")) score += 6000;
      if (selectorHints.includes("jobs-box__html-content")) score += 4500;
      if (selectorHints.includes("jobs-search__job-details")) score += 4000;
      if (selectorHints.includes("show-more-less-html")) score += 3500;
      if (selectorHints.includes("jobs-description-content")) score += 3000;
      if (selectorHints.includes("job-details-about-the-job")) score += 3000;
      if (selectorHints.includes("job-details-module")) score += 2500;
      if (selectorHints.includes("description")) score += 1000;
      if (element.querySelector("li")) score += 200;
      return { text, score };
    })
    .filter((entry): entry is { text: string; score: number } => Boolean(entry))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.text;
}

function scrapeLinkedInJobData(): JobData {
  const isRejected = (text: string) => isLikelyLinkedInShellText(text) || isLikelySerializedAppStateText(text);
  const title =
    queryFirstMeaningfulText([
      ".job-details-jobs-unified-top-card__job-title h1",
      ".jobs-unified-top-card__job-title h1",
      ".job-details-jobs-unified-top-card__job-title",
      ".top-card-layout__title",
      ".topcard__title",
      "main h1",
      "h1"
    ], 4) ||
    findJobPostingJsonLdField("title") ||
    "Untitled";

  const description =
    queryFirstFilteredDescriptionText([
      ".jobs-description__content .jobs-box__html-content",
      ".jobs-description__content .show-more-less-html__markup",
      ".jobs-description__content .jobs-description-content__text--stretch",
      ".jobs-description__content .jobs-description-content__text",
      ".jobs-description__content",
      ".jobs-box__html-content",
      ".jobs-search__job-details--container .show-more-less-html__markup",
      ".jobs-search__job-details--container .jobs-box__html-content",
      ".jobs-search__job-details--container .jobs-description-content__text--stretch",
      ".jobs-search__job-details--container .jobs-description-content__text",
      ".jobs-description-content__text",
      ".show-more-less-html__markup",
      ".job-details-about-the-job-module__description",
      '[aria-label*="Job details"] .show-more-less-html__markup',
      '[aria-label*="Job details"] .jobs-box__html-content',
      '[class*="job-details-module"] [class*="jobs-box__html-content"]',
      '[class*="job-details-module"] [class*="jobs-description-content__text"]',
      '[class*="job-details-module"] [class*="show-more-less-html__markup"]',
      'main [class*="jobs-description"]',
      'main [class*="show-more-less-html"]'
    ], 80, isRejected) ||
    findContentNearHeading(["about the job", "job details"], 80, isRejected) ||
    findJobPostingJsonLdField("description") ||
    pickBestLinkedInDescriptionFallback();

  return {
    platform: "linkedin",
    title,
    description,
    url: window.location.href
  };
}

function isLikelyZipRecruiterShellText(text: string): boolean {
  const lowered = text.toLowerCase();
  const shellMarkers = [
    "skip to main content",
    "create job alert",
    "recommended jobs",
    "similar jobs",
    "job seeker reviews",
    "salary estimate",
    "privacy policy",
    "terms of use",
    "cookie policy",
    "sign in",
    "register",
    "easy apply only",
    "popular searches"
  ];
  return shellMarkers.filter((marker) => lowered.includes(marker)).length >= 3;
}

function cleanZipRecruiterDescriptionText(text: string | null | undefined): string | undefined {
  const normalized = normalizeScrapedText(text);
  if (!normalized) return undefined;

  const lowered = normalized.toLowerCase();
  const cutoffMarkers = [
    "recommended jobs",
    "similar jobs",
    "job seeker reviews",
    "salary estimate",
    "privacy policy",
    "terms of use",
    "cookie policy",
    "popular searches"
  ];

  let cutoffIndex = -1;
  for (const marker of cutoffMarkers) {
    const index = lowered.indexOf(marker);
    if (index >= 120 && (cutoffIndex === -1 || index < cutoffIndex)) {
      cutoffIndex = index;
    }
  }

  const trimmed = cutoffIndex === -1 ? normalized : normalized.slice(0, cutoffIndex).trim();
  if (!trimmed) return undefined;

  const blockedLineMarkers = [
    "create job alert",
    "recommended jobs",
    "similar jobs",
    "job seeker reviews",
    "salary estimate",
    "privacy policy",
    "terms of use",
    "cookie policy",
    "sign in",
    "register"
  ];

  const seen = new Set<string>();
  const filteredLines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isLikelySerializedAppStateText(line))
    .filter((line) => {
      const loweredLine = line.toLowerCase();
      if (blockedLineMarkers.some((marker) => loweredLine.includes(marker))) {
        return false;
      }
      if (seen.has(loweredLine)) {
        return false;
      }
      seen.add(loweredLine);
      return true;
    });

  return normalizeScrapedText(filteredLines.join("\n"));
}

function formatZipRecruiterMoney(value: unknown, currency?: string): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const currencyCode = typeof currency === "string" && /^[A-Z]{3}$/i.test(currency) ? currency.toUpperCase() : "USD";
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: Number.isInteger(value) ? 0 : 2
      }).format(value);
    } catch {
      return `$${value.toLocaleString("en-US")}`;
    }
  }

  if (typeof value === "string") {
    return normalizeScrapedText(value);
  }

  return undefined;
}

function extractZipRecruiterCompanyFromJobPosting(jobPosting: Record<string, unknown> | undefined): string | undefined {
  const hiringOrganization = jobPosting?.hiringOrganization;
  if (!hiringOrganization || typeof hiringOrganization !== "object") return undefined;

  const company = (hiringOrganization as Record<string, unknown>).name;
  return typeof company === "string" ? normalizeScrapedText(company) : undefined;
}

function extractZipRecruiterLocationFromJobPosting(jobPosting: Record<string, unknown> | undefined): string | undefined {
  if (!jobPosting) return undefined;

  const isRemote =
    typeof jobPosting.jobLocationType === "string" &&
    jobPosting.jobLocationType.toLowerCase().includes("telecommute");

  const locations: string[] = [];
  const collectAddressText = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const address = value as Record<string, unknown>;
    const parts = [
      typeof address.addressLocality === "string" ? address.addressLocality : undefined,
      typeof address.addressRegion === "string" ? address.addressRegion : undefined,
      typeof address.postalCode === "string" ? address.postalCode : undefined,
      typeof address.addressCountry === "string" && !["US", "USA"].includes(address.addressCountry.toUpperCase())
        ? address.addressCountry
        : undefined
    ].filter((part): part is string => Boolean(part));
    const formatted = normalizeScrapedText(parts.join(", "));
    if (formatted) {
      locations.push(formatted);
    }
  };

  const jobLocationValues = Array.isArray(jobPosting.jobLocation)
    ? jobPosting.jobLocation
    : jobPosting.jobLocation
      ? [jobPosting.jobLocation]
      : [];
  for (const entry of jobLocationValues) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (record.address) {
      collectAddressText(record.address);
    } else {
      collectAddressText(record);
    }
  }

  const applicantRequirements = Array.isArray(jobPosting.applicantLocationRequirements)
    ? jobPosting.applicantLocationRequirements
    : jobPosting.applicantLocationRequirements
      ? [jobPosting.applicantLocationRequirements]
      : [];
  for (const entry of applicantRequirements) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.name === "string") {
      const formatted = normalizeScrapedText(record.name);
      if (formatted) {
        locations.push(formatted);
      }
    }
    if (record.address) {
      collectAddressText(record.address);
    }
  }

  const primaryLocation = locations.find((value) => Boolean(value));
  if (primaryLocation) {
    return isRemote && !/remote/i.test(primaryLocation)
      ? normalizeScrapedText(`${primaryLocation} (Remote)`)
      : primaryLocation;
  }

  return isRemote ? "Remote" : undefined;
}

function extractZipRecruiterSalaryFromJobPosting(jobPosting: Record<string, unknown> | undefined): string | undefined {
  const baseSalary = jobPosting?.baseSalary;
  if (!baseSalary || typeof baseSalary !== "object") return undefined;

  const baseSalaryRecord = baseSalary as Record<string, unknown>;
  const directCurrency =
    typeof baseSalaryRecord.currency === "string"
      ? baseSalaryRecord.currency
      : typeof jobPosting?.salaryCurrency === "string"
        ? jobPosting.salaryCurrency
        : undefined;
  const directValue = formatZipRecruiterMoney(baseSalaryRecord.value, directCurrency);
  if (directValue && typeof baseSalaryRecord.value !== "object") {
    return normalizeScrapedText(
      `${directValue}${typeof baseSalaryRecord.unitText === "string" ? ` per ${baseSalaryRecord.unitText.replace(/_/g, " ").toLowerCase()}` : ""}`
    );
  }

  const valueRecord = baseSalaryRecord.value;
  if (!valueRecord || typeof valueRecord !== "object") return directValue;

  const salaryValue = valueRecord as Record<string, unknown>;
  const currency =
    typeof salaryValue.currency === "string"
      ? salaryValue.currency
      : directCurrency;
  const exactValue = formatZipRecruiterMoney(salaryValue.value, currency);
  const minValue = formatZipRecruiterMoney(salaryValue.minValue, currency);
  const maxValue = formatZipRecruiterMoney(salaryValue.maxValue, currency);
  const unitText =
    typeof salaryValue.unitText === "string"
      ? salaryValue.unitText
      : typeof baseSalaryRecord.unitText === "string"
        ? baseSalaryRecord.unitText
        : undefined;

  const amount =
    exactValue ||
    (minValue && maxValue ? `${minValue} - ${maxValue}` : undefined) ||
    minValue ||
    maxValue;
  if (!amount) return undefined;

  return normalizeScrapedText(
    `${amount}${unitText ? ` per ${unitText.replace(/_/g, " ").toLowerCase()}` : ""}`
  );
}

function isLikelyZipRecruiterLocationText(text: string): boolean {
  return (
    /\b(remote|hybrid|on-site|onsite)\b/i.test(text) ||
    /,\s*[A-Z]{2}\b/.test(text) ||
    /\b(united states|usa|canada|uk|europe)\b/i.test(text)
  );
}

function extractZipRecruiterHeaderMeta(): {
  company?: string;
  location?: string;
  salary?: string;
} {
  const titleNode = document.querySelector("main h1, h1");
  const titleText = textFromNode(titleNode);
  const headerRoot =
    titleNode?.closest("section, article, header") ||
    titleNode?.parentElement?.parentElement ||
    document.querySelector("main") ||
    document;

  const company = queryFirstFilteredText([
    'a[href*="/c/"]',
    '[data-testid*="company"]',
    '[data-testid*="Company"]',
    '[class*="company"] a',
    '[class*="company"]'
  ], 2, (text) => {
    const lowered = text.toLowerCase();
    return (
      text === titleText ||
      lowered === "ziprecruiter" ||
      /\$\s?\d/.test(text) ||
      isLikelyZipRecruiterLocationText(text) ||
      isLikelyZipRecruiterShellText(text)
    );
  }, headerRoot);

  const location = queryFirstFilteredText([
    '[data-testid*="location"]',
    '[data-testid*="Location"]',
    '[class*="location"]',
    '[class*="job-location"]',
    '[class*="job_location"]',
    'a[href*="/jobs-in-"]'
  ], 2, (text) => !isLikelyZipRecruiterLocationText(text) || isLikelyZipRecruiterShellText(text), headerRoot);

  const salary = queryFirstFilteredText([
    '[data-testid*="salary"]',
    '[data-testid*="Salary"]',
    '[class*="salary"]',
    '[class*="compensation"]',
    '[class*="pay"]'
  ], 2, (text) => !/\$\s?\d/.test(text) || isLikelyZipRecruiterShellText(text), headerRoot);

  return { company, location, salary };
}

function pickBestZipRecruiterDescriptionFallback(): string | undefined {
  const root = document.querySelector("main") || document.body;
  const candidates = Array.from(
    root.querySelectorAll(
      '[data-testid*="job_description"], [data-testid*="job-description"], [data-testid*="jobDescription"], [class*="job_description"], [class*="job-description"], [class*="jobDescription"], [class*="description"], article, section'
    )
  );

  const scored = candidates
    .map((node) => {
      const text = cleanZipRecruiterDescriptionText(descriptionTextFromNode(node));
      if (!text || text.length < 120 || text.length > 14000) return null;
      if (isLikelyZipRecruiterShellText(text) || isLikelySerializedAppStateText(text)) return null;

      const element = node as HTMLElement;
      const selectorHints = `${element.tagName.toLowerCase()} ${element.id || ""} ${element.getAttribute("data-testid") || ""} ${element.className || ""}`.toLowerCase();
      let score = text.length;
      if (selectorHints.includes("job_description")) score += 6000;
      if (selectorHints.includes("job-description")) score += 5500;
      if (selectorHints.includes("jobdescription")) score += 5000;
      if (selectorHints.includes("description")) score += 1800;
      if (/(responsibilities|requirements|qualifications|benefits)/i.test(text)) score += 600;
      if (element.querySelector("li")) score += 250;
      return { text, score };
    })
    .filter((entry): entry is { text: string; score: number } => Boolean(entry))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.text;
}

function scrapeZipRecruiterJobData(): JobData {
  const jobPosting = findJobPostingJsonLdRecord();
  const headerMeta = extractZipRecruiterHeaderMeta();
  const isRejected = (text: string) => isLikelyZipRecruiterShellText(text) || isLikelySerializedAppStateText(text);

  const title =
    queryFirstFilteredText([
      '[data-testid*="job_title"]',
      '[data-testid*="job-title"]',
      '[data-testid*="jobTitle"]',
      '[class*="job_title"]',
      '[class*="job-title"]',
      '[class*="jobTitle"]',
      "main h1",
      "h1"
    ], 4, isRejected) ||
    (typeof jobPosting?.title === "string" ? normalizeScrapedText(jobPosting.title) : undefined) ||
    findJobPostingJsonLdField("title") ||
    "Untitled";

  const company = extractZipRecruiterCompanyFromJobPosting(jobPosting) || headerMeta.company;
  const location = extractZipRecruiterLocationFromJobPosting(jobPosting) || headerMeta.location;
  const salary = extractZipRecruiterSalaryFromJobPosting(jobPosting) || headerMeta.salary;
  const metadataLines = [
    company ? `Company: ${company}` : undefined,
    location ? `Location: ${location}` : undefined,
    salary ? `Salary: ${salary}` : undefined
  ].filter((value): value is string => Boolean(value));

  const body =
    queryFirstFilteredDescriptionText([
      '[data-testid*="job_description"]',
      '[data-testid*="job-description"]',
      '[data-testid*="jobDescription"]',
      '[class*="job_description"]',
      '[class*="job-description"]',
      '[class*="jobDescription"]',
      '[data-testid*="description"]',
      'main article',
      'main section[class*="description"]'
    ], 80, isRejected) ||
    cleanZipRecruiterDescriptionText(findContentNearHeading(["job summary", "job description", "responsibilities", "requirements"], 80, isRejected)) ||
    cleanZipRecruiterDescriptionText(
      typeof jobPosting?.description === "string" ? htmlToStructuredText(jobPosting.description) : undefined
    ) ||
    cleanZipRecruiterDescriptionText(findJobPostingJsonLdField("description")) ||
    pickBestZipRecruiterDescriptionFallback();

  const description = normalizeScrapedText(
    [metadataLines.length ? metadataLines.join("\n") : undefined, cleanZipRecruiterDescriptionText(body)]
      .filter((value): value is string => Boolean(value))
      .join("\n\n")
  ) || undefined;

  return {
    platform: "ziprecruiter",
    title,
    description,
    url: window.location.href
  };
}

function normalizeHelloWorkHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyHelloWorkShellText(text: string): boolean {
  const lowered = text.toLowerCase();
  const shellMarkers = [
    "recherches similaires",
    "trouver mon job",
    "créez votre compte hellowork",
    "créer mon alerte",
    "lire dans l'app",
    "localiser le poste",
    "offres d'emploi par",
    "entreprises",
    "salaire brut net"
  ];

  return shellMarkers.filter((marker) => lowered.includes(marker)).length >= 2;
}

function cleanHelloWorkDescriptionText(text: string | null | undefined): string | undefined {
  const normalized = normalizeScrapedText(text);
  if (!normalized) return undefined;

  const lowered = normalized.toLowerCase();
  const cutoffMarkers = [
    "recherches similaires",
    "la carte",
    "localiser le poste",
    "l'entreprise",
    "offres d'emploi par",
    "créez votre compte hellowork"
  ];

  let cutoffIndex = -1;
  for (const marker of cutoffMarkers) {
    const index = lowered.indexOf(marker);
    if (index >= 120 && (cutoffIndex === -1 || index < cutoffIndex)) {
      cutoffIndex = index;
    }
  }

  const trimmed = cutoffIndex === -1 ? normalized : normalized.slice(0, cutoffIndex).trim();
  return normalizeScrapedText(trimmed);
}

function htmlToStructuredText(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const container = document.createElement("div");
  container.innerHTML = value;
  return normalizeScrapedText(container.innerText || container.textContent);
}

function findHelloWorkJobPosting(): Record<string, unknown> | undefined {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

  for (const script of scripts) {
    const raw = script.textContent?.trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];

      while (queue.length > 0) {
        const current = queue.shift();
        if (!current || typeof current !== "object") continue;

        const record = current as Record<string, unknown>;
        const typeValue = record["@type"];
        const isJobPosting =
          (typeof typeValue === "string" && typeValue.toLowerCase() === "jobposting") ||
          (Array.isArray(typeValue) &&
            typeValue.some((entry) => typeof entry === "string" && entry.toLowerCase() === "jobposting"));

        if (isJobPosting) {
          return record;
        }

        for (const value of Object.values(record)) {
          if (value && typeof value === "object") {
            queue.push(value);
          }
        }
      }
    } catch {
      // ignore malformed structured data
    }
  }

  return undefined;
}

function readHelloWorkAgentOfferData(): Record<string, unknown> | undefined {
  const script = document.querySelector("#AgentIaJsonOffre");
  const raw = script?.textContent?.trim();
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function extractHelloWorkTaggedMeta(): {
  company?: string;
  location?: string;
  contractType?: string;
  salary?: string;
} {
  const titleNode = document.querySelector('[data-cy="jobTitle"]');
  const headerRoot = titleNode?.closest("div")?.parentElement || titleNode?.closest("section") || document;
  const tagValues = Array.from(headerRoot.querySelectorAll("ul.tw-flex li"))
    .map((node) => textFromNode(node))
    .filter((value): value is string => Boolean(value));

  return {
    company:
      queryFirstMeaningfulText([
        'h1 a[href*="/entreprises/"]',
        '#main-content a[href*="/entreprises/"]',
        '[aria-labelledby="offer-tab"] h1 a'
      ], 2) ||
      undefined,
    location:
      tagValues.find((value) => /\b\d{2}\b/.test(value) || /télétravail/i.test(value)) ||
      undefined,
    contractType:
      tagValues.find((value) => /\b(CDI|CDD|Intérim|Alternance|Stage|Freelance|Indépendant|Franchise|Associé|Fonctionnaire)\b/i.test(value)) ||
      undefined,
    salary:
      queryFirstMeaningfulText([
        '[data-cy="salary-tag-button"] span',
        'button[data-cy="salary-tag-button"] span'
      ], 2) || undefined
  };
}

function extractHelloWorkOrderedSections(): string | undefined {
  const root =
    document.querySelector("#offer-panel") ||
    document.querySelector('[role="tabpanel"][aria-labelledby="offer-tab"]') ||
    document.querySelector("main") ||
    document.body;
  const allowedHeadings = new Set([
    "les missions du poste",
    "le profil recherché",
    "infos complémentaires"
  ]);
  const sections: string[] = [];
  const seen = new Set<string>();

  for (const block of Array.from(root.querySelectorAll("section, details"))) {
    const headingNode =
      block.querySelector("summary h2 span:last-child") ||
      block.querySelector("h2 span:last-child") ||
      block.querySelector("summary h2") ||
      block.querySelector("h2");
    const headingText = textFromNode(headingNode);
    if (!headingText) continue;

    const normalizedHeading = normalizeHelloWorkHeading(headingText);
    if (!allowedHeadings.has(normalizedHeading)) continue;

    const contentNode =
      block.querySelector('[data-truncate-text-target="content"]') ||
      block.querySelector(".tw-break-words") ||
      block.querySelector(".tw-leading-relaxed") ||
      block.querySelector(".tw-typo-long-m");
    const rawText = descriptionTextFromNode(contentNode) || descriptionTextFromNode(block);
    const cleaned = cleanHelloWorkDescriptionText(stripHeadingPrefix(rawText || "", [headingText]));
    if (!cleaned || cleaned.length < 20) continue;

    const section = normalizeScrapedText(`${headingText}\n${cleaned}`);
    if (!section) continue;

    const key = section.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    sections.push(section);
  }

  return normalizeScrapedText(sections.join("\n\n"));
}

function scrapeHelloWorkJobData(): JobData {
  const agentOffer = readHelloWorkAgentOfferData();
  const jobPosting = findHelloWorkJobPosting();
  const headerMeta = extractHelloWorkTaggedMeta();
  const domSections = extractHelloWorkOrderedSections();

  const title =
    queryFirstMeaningfulText([
      '[data-cy="jobTitle"]',
      'h1 [data-cy="jobTitle"]',
      "main h1",
      "h1"
    ], 4) ||
    (typeof agentOffer?.JobTitle === "string" ? agentOffer.JobTitle : undefined) ||
    (typeof jobPosting?.title === "string" ? normalizeScrapedText(jobPosting.title) : undefined) ||
    findJobPostingJsonLdField("title") ||
    "Untitled";

  const company =
    headerMeta.company ||
    (typeof agentOffer?.Company === "string" ? normalizeScrapedText(agentOffer.Company) : undefined) ||
    (typeof (jobPosting?.hiringOrganization as Record<string, unknown> | undefined)?.name === "string"
      ? normalizeScrapedText((jobPosting?.hiringOrganization as Record<string, unknown>).name as string)
      : undefined);
  const location =
    headerMeta.location ||
    (typeof agentOffer?.Localisation === "string" ? normalizeScrapedText(agentOffer.Localisation) : undefined) ||
    (typeof ((jobPosting?.jobLocation as Record<string, unknown> | undefined)?.address as Record<string, unknown> | undefined)?.addressLocality === "string"
      ? normalizeScrapedText(
          `${((jobPosting?.jobLocation as Record<string, unknown>).address as Record<string, unknown>).addressLocality as string}${
            typeof (((jobPosting?.jobLocation as Record<string, unknown>).address as Record<string, unknown>).postalCode) === "string"
              ? ` - ${((jobPosting?.jobLocation as Record<string, unknown>).address as Record<string, unknown>).postalCode as string}`
              : ""
          }`
        )
      : undefined);
  const contractType =
    headerMeta.contractType ||
    (typeof agentOffer?.ContractType === "string" ? normalizeScrapedText(agentOffer.ContractType) : undefined);
  const salary =
    headerMeta.salary ||
    (typeof (((jobPosting?.baseSalary as Record<string, unknown> | undefined)?.value as Record<string, unknown> | undefined)?.value) === "string"
      ? normalizeScrapedText(
          `${(((jobPosting?.baseSalary as Record<string, unknown>).value as Record<string, unknown>).value as string)} ${
            typeof (jobPosting?.salaryCurrency) === "string" ? (jobPosting.salaryCurrency as string) : ""
          }`.trim()
        )
      : undefined);

  const metadataLines = [
    company ? `Entreprise: ${company}` : undefined,
    location ? `Lieu: ${location}` : undefined,
    contractType ? `Contrat: ${contractType}` : undefined,
    salary ? `Salaire: ${salary}` : undefined
  ].filter((value): value is string => Boolean(value));

  const scriptSections = [
    typeof agentOffer?.Description === "string"
      ? normalizeScrapedText(`Les missions du poste\n${agentOffer.Description}`)
      : undefined,
    typeof agentOffer?.Profile === "string"
      ? normalizeScrapedText(`Le profil recherché\n${agentOffer.Profile}`)
      : undefined
  ].filter((value): value is string => Boolean(value));

  const description =
    normalizeScrapedText(
      [
        metadataLines.length ? metadataLines.join("\n") : undefined,
        domSections ||
          (scriptSections.length ? scriptSections.join("\n\n") : undefined) ||
          cleanHelloWorkDescriptionText(
            typeof jobPosting?.description === "string" ? htmlToStructuredText(jobPosting.description) : undefined
          )
      ]
        .filter((value): value is string => Boolean(value))
        .join("\n\n")
    ) || undefined;

  return {
    platform: "hellowork",
    title,
    description,
    url: window.location.href
  };
}

function isLikelyFiverrShellText(text: string): boolean {
  const lowered = text.toLowerCase();
  const shellMarkers = [
    "join fiverr",
    "continue with google",
    "continue with facebook",
    "by joining i agree",
    "search for any service",
    "browse categories",
    "popular services",
    "fiverr pro",
    "logo maker",
    "explore",
    "about fiverr",
    "help & support",
    "terms of service",
    "privacy policy",
    "do not sell or share my personal information",
    "seller details",
    "recommended for you",
    "people also viewed",
    "about the seller",
    "contact me",
    "compare packages"
  ];
  return shellMarkers.filter((marker) => lowered.includes(marker)).length >= 2;
}

function normalizeFiverrHeadingText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesFiverrHeading(text: string | null | undefined, headings: string[]): boolean {
  const normalized = normalizeFiverrHeadingText(text || "");
  if (!normalized) return false;

  return headings.some((heading) => {
    const candidate = normalizeFiverrHeadingText(heading);
    return normalized === candidate || normalized.startsWith(`${candidate} `) || normalized.includes(candidate);
  });
}

function extractFiverrSectionTextFromHeading(headingNode: Element): string | undefined {
  const headingText = textFromNode(headingNode);
  if (!headingText) return undefined;

  const sectionContainer = headingNode.closest("section, article, li");
  const candidateTexts = [
    descriptionTextFromNode(headingNode.parentElement),
    normalizeScrapedText(
      [headingText, descriptionTextFromNode(headingNode.nextElementSibling)].filter((value): value is string => Boolean(value)).join("\n")
    ),
    normalizeScrapedText(
      [headingText, descriptionTextFromNode(headingNode.parentElement?.nextElementSibling ?? null)].filter((value): value is string => Boolean(value)).join("\n")
    ),
    descriptionTextFromNode(sectionContainer),
    descriptionTextFromNode(sectionContainer?.nextElementSibling ?? null)
  ];

  for (const candidateText of candidateTexts) {
    const normalized = normalizeScrapedText(candidateText);
    if (!normalized || normalized.length < 20 || normalized.length > 6000) continue;
    if (isLikelySerializedAppStateText(normalized)) continue;

    const cleaned = cleanFiverrDescriptionText(normalized);
    if (!cleaned) continue;

    const stripped = stripHeadingPrefix(cleaned, [headingText]);
    const sectionText = normalizeScrapedText(stripped ? `${headingText}\n${stripped}` : cleaned);
    if (sectionText && sectionText.length >= 20) {
      return sectionText;
    }
  }

  return undefined;
}

function extractFiverrDescriptionBySections(): string | undefined {
  const root = document.querySelector("main") || document.body;
  const startHeadings = [
    "what’s the job?",
    "what's the job?",
    "what is the job?",
    "about this gig",
    "about this service",
    "gig description",
    "project description",
    "about the project"
  ];
  const sectionHeadings = [
    ...startHeadings,
    "what am i going to do?",
    "what will i do?",
    "what will you do?",
    "what are the qualifications?",
    "what are the requirements?",
    "responsibilities",
    "requirements",
    "qualifications"
  ];
  const stopHeadings = [
    "about fiverr",
    "help & support",
    "terms of service",
    "privacy policy",
    "recommended for you",
    "people also viewed",
    "seller details",
    "about the seller",
    "compare packages"
  ];
  const headingNodes = Array.from(root.querySelectorAll("h1, h2, h3, h4, strong, [role='heading'], p, span, div")).filter((node) => {
    const text = textFromNode(node);
    return typeof text === "string" && text.length <= 160;
  });
  const startIndex = headingNodes.findIndex((node) => matchesFiverrHeading(textFromNode(node), startHeadings));

  if (startIndex === -1) {
    return undefined;
  }

  const sections: string[] = [];
  const seen = new Set<string>();

  for (let index = startIndex; index < headingNodes.length && sections.length < 6; index += 1) {
    const headingNode = headingNodes[index];
    const headingText = textFromNode(headingNode);
    if (!headingText) continue;

    if (sections.length > 0 && matchesFiverrHeading(headingText, stopHeadings)) {
      break;
    }

    if (!matchesFiverrHeading(headingText, sectionHeadings)) {
      if (sections.length > 0 && /^H[1-4]$/.test(headingNode.tagName)) {
        break;
      }
      continue;
    }

    const sectionText = extractFiverrSectionTextFromHeading(headingNode);
    const cleaned = cleanFiverrDescriptionText(sectionText);
    if (!cleaned || cleaned.length < 20) continue;

    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    sections.push(cleaned);
  }

  return cleanFiverrDescriptionText(sections.join("\n\n"));
}

function trimFiverrNoiseFromCombinedText(text: string): string {
  const contentStartMarkers = [
    "what’s the job",
    "what's the job",
    "what is the job",
    "what am i going to do",
    "what will i do",
    "what will you do",
    "what are the qualifications",
    "what are the requirements",
    "about this gig",
    "about this service",
    "gig description",
    "project description",
    "about the project"
  ];

  const loweredOriginal = text.toLowerCase().replace(/[\u2018\u2019]/g, "'");
  let startIndex = -1;
  for (const marker of contentStartMarkers) {
    const index = loweredOriginal.indexOf(marker);
    if (index > 0 && index <= 1500 && (startIndex === -1 || index < startIndex)) {
      startIndex = index;
    }
  }

  const candidateText = startIndex > 0 ? text.slice(startIndex).trim() : text;
  const lowered = candidateText.toLowerCase();
  const sectionCutMarkers = [
    "recommended for you",
    "people also viewed",
    "seller details",
    "about the seller",
    "contact seller",
    "contact me",
    "compare packages",
    "about fiverr",
    "help & support",
    "terms of service",
    "privacy policy",
    "do not sell or share my personal information"
  ];

  let cutoffIndex = -1;
  for (const marker of sectionCutMarkers) {
    const index = lowered.indexOf(marker);
    if (index >= 120 && (cutoffIndex === -1 || index < cutoffIndex)) {
      cutoffIndex = index;
    }
  }

  if (cutoffIndex === -1) {
    return candidateText;
  }

  return candidateText.slice(0, cutoffIndex).trim();
}

function cleanFiverrDescriptionText(text: string | null | undefined): string | undefined {
  const normalized = normalizeScrapedText(text);
  if (!normalized) return undefined;

  const blockedExactLines = new Set([
    "graphics & design",
    "programming & tech",
    "digital marketing",
    "video & animation",
    "writing & translation",
    "music & audio",
    "business",
    "consulting",
    "ai services",
    "personal growth & hobbies",
    "finance",
    "photography"
  ]);

  const blockedLineMarkers = [
    "browse categories",
    "popular services",
    "recommended for you",
    "people also viewed",
    "seller details",
    "about fiverr",
    "help & support",
    "terms of service",
    "privacy policy",
    "contact seller",
    "contact me",
    "compare packages",
    "home /",
    "home >",
    "fiverr pro",
    "logo maker",
    "do not sell or share my personal information"
  ];

  const trimmed = normalizeScrapedText(trimFiverrNoiseFromCombinedText(normalized));
  if (!trimmed) return undefined;

  const seen = new Set<string>();
  const filteredLines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isLikelySerializedAppStateText(line))
    .flatMap((line) => {
      const lowered = line.toLowerCase();
      let candidate = line;
      const firstMarkerIndex = blockedLineMarkers.reduce((earliest, marker) => {
        const markerIndex = lowered.indexOf(marker);
        if (markerIndex === -1) return earliest;
        if (earliest === -1 || markerIndex < earliest) return markerIndex;
        return earliest;
      }, -1);

      if (firstMarkerIndex >= 120) {
        candidate = line.slice(0, firstMarkerIndex).trim();
      }

      const candidateLowered = candidate.toLowerCase();
      if (!candidate) return [];
      if (blockedExactLines.has(lowered)) return [];
      if (firstMarkerIndex !== -1 && firstMarkerIndex < 120 && candidate.length < 220) return [];
      if (candidateLowered.startsWith("{") || candidateLowered.startsWith("[")) return [];
      if ((candidate.match(/[{}]/g) || []).length > 6 && (candidate.match(/"/g) || []).length > 8) return [];
      if (seen.has(candidateLowered)) return [];
      seen.add(candidateLowered);
      return [candidate];
    });

  return normalizeScrapedText(filteredLines.join("\n"));
}

function pickBestFiverrDescriptionFallback(): string | undefined {
  const root = document.querySelector("main") || document.body;
  const candidates = Array.from(
    root.querySelectorAll(
      '[itemprop="description"], [data-testid="gig-page-description"], [data-testid="gig-description"], [data-testid*="description"], [class*="gig-page-description"], [class*="gig-description"], [class*="description-content"], [class*="project-description"]'
    )
  );

  const scored = candidates
    .map((node) => {
      const text = cleanFiverrDescriptionText(descriptionTextFromNode(node));
      if (!text || text.length < 80 || text.length > 12000) return null;
      if (isLikelySerializedAppStateText(text)) return null;

      const element = node as HTMLElement;
      const selectorHints = `${element.tagName.toLowerCase()} ${element.id || ""} ${element.getAttribute("itemprop") || ""} ${element.getAttribute("data-testid") || ""} ${element.className || ""}`.toLowerCase();
      let score = text.length;
      if (isLikelyFiverrShellText(text)) score -= 3500;
      if ((element.getAttribute("itemprop") || "").toLowerCase() === "description") score += 4500;
      if (selectorHints.includes("description")) score += 5000;
      if (selectorHints.includes("gig")) score += 2500;
      if (selectorHints.includes("brief")) score += 2000;
      if (selectorHints.includes("project")) score += 1500;
      if (element.querySelector("li")) score += 200;
      if (score < 80) return null;
      return { text, score };
    })
    .filter((entry): entry is { text: string; score: number } => Boolean(entry))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.text;
}

function scrapeFiverrJobData(): JobData {
  const isRejectedTitle = (text: string) => isLikelyFiverrShellText(text) || isLikelySerializedAppStateText(text);
  const isRejectedDescription = (text: string) => isLikelySerializedAppStateText(text);
  const title =
    queryFirstFilteredText([
      'h1[itemprop="name"]',
      '[data-testid="gig-page-title"]',
      '[class*="gig-title"]',
      'main h1',
      'article h1',
      'h1'
    ], 4, isRejectedTitle) ||
    findJobPostingJsonLdField("title") ||
    "Untitled";

  const description =
    extractFiverrDescriptionBySections() ||
    cleanFiverrDescriptionText(queryFirstFilteredDescriptionText([
      '[itemprop="description"]',
      '[data-testid="gig-page-description"]',
      '[data-testid="gig-description"]',
      '[itemprop="description"] [class*="show-more"]',
      '[data-testid="gig-page-description"] [class*="show-more"]',
      '[data-testid="gig-description"] [class*="show-more"]',
      '[data-testid*="description"]',
      '[class*="gig-page-description"]',
      '[class*="gig-description"]',
      '[class*="project-description"]',
      '[class*="description-content"]',
      '[class*="description"] [class*="show-more"]',
      'article [class*="description"]'
    ], 80, isRejectedDescription)) ||
    cleanFiverrDescriptionText(findContentNearHeading(["about this gig", "about this service", "gig description", "project description", "about the project"], 80, isRejectedDescription)) ||
    cleanFiverrDescriptionText(findJobPostingJsonLdField("description")) ||
    pickBestFiverrDescriptionFallback();

  return {
    platform: "fiverr",
    title,
    description: cleanFiverrDescriptionText(description) || description,
    url: window.location.href
  };
}

function scrapeJobData(platform: string): JobData {
  if (platform === "upwork") {
    return scrapeUpworkJobData();
  }
  if (platform === "indeed") {
    return scrapeIndeedJobData();
  }
  if (platform === "linkedin") {
    return scrapeLinkedInJobData();
  }
  if (platform === "ziprecruiter") {
    return scrapeZipRecruiterJobData();
  }
  if (platform === "hellowork") {
    return scrapeHelloWorkJobData();
  }
  if (platform === "fiverr") {
    return scrapeFiverrJobData();
  }
  const title = document.querySelector("h1")?.textContent?.trim() || "Untitled";
  const description = document.querySelector("p, div")?.textContent?.trim();
  return { platform, title, description, url: window.location.href };
}

function isRejectedDescriptionForPlatform(platform: string, text: string): boolean {
  switch (platform) {
    case "linkedin":
      return isLikelyLinkedInShellText(text) || isLikelySerializedAppStateText(text);
    case "ziprecruiter":
      return isLikelyZipRecruiterShellText(text) || isLikelySerializedAppStateText(text);
    case "hellowork":
      return isLikelyHelloWorkShellText(text) || isLikelySerializedAppStateText(text);
    case "fiverr":
      return isLikelySerializedAppStateText(text);
    case "indeed":
      return isLikelyIndeedShellText(text);
    case "upwork":
      return isLikelyUpworkShellText(text);
    default:
      return false;
  }
}

function scoreJobDescription(platform: string, description?: string): number {
  const normalized = normalizeScrapedText(description);
  if (!normalized) return 0;
  if (isRejectedDescriptionForPlatform(platform, normalized)) return 0;

  let score = normalized.length;
  if (normalized.includes("\n")) score += 200;
  if (/[\u2022•]/.test(normalized) || normalized.includes("- ")) score += 150;
  return score;
}

function hasUsefulDescription(platform: string, description?: string): boolean {
  const score = scoreJobDescription(platform, description);
  const minScore = platform === "linkedin" || platform === "fiverr" ? 120 : 80;
  return score >= minScore;
}

function shouldScheduleDeferredScrapes(platform: string, description?: string): boolean {
  if (platform === "linkedin") {
    return true;
  }

  if (platform === "fiverr") {
    return !hasUsefulDescription(platform, description);
  }

  return false;
}

function shouldObserveDeferredScrapes(platform: string): boolean {
  return platform === "linkedin";
}

function mergeJobData(current: JobData, next: JobData): JobData {
  const currentDescriptionScore = scoreJobDescription(current.platform, current.description);
  const nextDescriptionScore = scoreJobDescription(next.platform, next.description);

  return {
    platform: next.platform || current.platform,
    url: next.url || current.url,
    title:
      next.title && next.title !== "Untitled"
        ? next.title
        : current.title,
    description:
      nextDescriptionScore >= currentDescriptionScore
        ? normalizeScrapedText(next.description) || current.description
        : current.description
  };
}
export default ProposalPreview;
