import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { PlasmoContentScript } from 'plasmo';
import { JobForgeCapsuleRoot } from './jobforge-capsule-v3-elite/JobForgeCapsuleRoot';
import capsuleCssText from 'data-text:./jobforge-capsule-v3-elite/jobforge-capsule-v3-elite.css';
import capsuleTokensCssText from 'data-text:./jobforge-capsule-v3-elite/jobforge-capsule-v3-elite.tokens.css';
import {
  detectPlatform,
  hasUsefulDescription,
  mergeJobData,
  scrapeJobData,
  shouldObserveDeferredScrapes,
  shouldScheduleDeferredScrapes,
  type JobData,
} from './_shared/job-scraper';
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

export const getStyle = () => {
  const style = document.createElement("style");
  style.textContent = `${capsuleTokensCssText}\n${capsuleCssText}`;
  return style;
};

type SavedJobState = {
  jobId?: string;
  dedupeHit?: boolean;
  parseStatus: "parsing" | "parsed" | "failed";
  reviewState?: string;
  savedAt: number;
  sourceTitle?: string;
};

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
const SAVED_JOB_STATE_STORAGE_PREFIX = "neyssanSavedJobState:v1:";

function buildSavedJobStateStorageKey(url: string): string {
  return `${SAVED_JOB_STATE_STORAGE_PREFIX}${url}`;
}

function persistSavedJobState(url: string, state: SavedJobState) {
  chrome.storage.local.set({
    [buildSavedJobStateStorageKey(url)]: state,
  });
}

function readSavedJobState(url: string): Promise<SavedJobState | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([buildSavedJobStateStorageKey(url)], (result) => {
      resolve(result?.[buildSavedJobStateStorageKey(url)] ?? null);
    });
  });
}

function resolveSavedJobMessage(state: SavedJobState): {
  kind: "error" | "success" | "info";
  message: string;
} {
  if (state.parseStatus === "failed") {
    return {
      kind: "error",
      message: "Job saved, but parsing failed. Open saved Job to review it.",
    };
  }

  if (state.dedupeHit) {
    return {
      kind: "info",
      message: "Already saved. Open saved Job to continue from the existing brief.",
    };
  }

  if (state.reviewState === "ready") {
    return {
      kind: "success",
      message: "Job saved. Ready for document generation.",
    };
  }

  if (state.reviewState === "needs_review") {
    return {
      kind: "info",
      message: "Job saved. Needs review before it becomes trusted.",
    };
  }

  return {
    kind: "info",
    message: "Job saved. Parsing is still in progress.",
  };
}

function reconcileSavedJobState(
  currentState: SavedJobState,
  response: {
    jobId?: string;
    parseStatus?: string;
    reviewState?: string;
  },
): SavedJobState {
  return {
    ...currentState,
    jobId: response.jobId ?? currentState.jobId,
    parseStatus:
      response.parseStatus === "failed"
        ? "failed"
        : response.parseStatus === "parsed"
          ? "parsed"
          : "parsing",
    reviewState: response.reviewState ?? currentState.reviewState,
  };
}

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
  const [isSavingJob, setIsSavingJob] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isOpeningInApp, setIsOpeningInApp] = useState(false);
  const [activeCvSnapshot, setActiveCvSnapshot] = useState<ActiveCvSnapshot | null>(null);
  const [useCurrentCvContext, setUseCurrentCvContext] = useState(false);
  const [savedJobState, setSavedJobState] = useState<SavedJobState | null>(null);
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
    let isActive = true;
    void readSavedJobState(jobData.url).then((state) => {
      if (!isActive) {
        return;
      }

      setSavedJobState(state);
      if (state?.jobId) {
        setJobData((current) =>
          current.url === jobData.url && current.jobId !== state.jobId
            ? { ...current, jobId: state.jobId }
            : current,
        );
        chrome.runtime.sendMessage(
          {
            action: "getJobSaveState",
            jobData: {
              ...jobData,
              jobId: state.jobId,
            },
          },
          (response) => {
            if (!isActive || chrome.runtime.lastError || !response?.success) {
              return;
            }

            const reconciledState = reconcileSavedJobState(state, response);
            setSavedJobState(reconciledState);
            persistSavedJobState(jobData.url, reconciledState);
          },
        );
      }
    });

    return () => {
      isActive = false;
    };
  }, [jobData.url]);

  useEffect(() => {
    if (!savedJobState?.jobId || savedJobState.parseStatus !== "parsing") {
      return;
    }

    let isActive = true;
    const intervalId = window.setInterval(() => {
      chrome.runtime.sendMessage(
        {
          action: "getJobSaveState",
          jobData: {
            ...jobData,
            jobId: savedJobState.jobId,
          },
        },
        (response) => {
          if (!isActive || chrome.runtime.lastError || !response?.success) {
            return;
          }

          const reconciledState = reconcileSavedJobState(savedJobState, response);
          setSavedJobState(reconciledState);
          persistSavedJobState(jobData.url, reconciledState);
        },
      );
    }, 2500);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [jobData, savedJobState]);

  useEffect(() => {
    const platform = detectPlatform(window.location.href);
    let urlPollId: number | null = null;
    let scrapeRetryIds: number[] = [];
    let authRetryIds: number[] = [];
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
    authRetryIds = [300, 1000, 2500].map((delay) =>
      window.setTimeout(() => {
        void applyStoredAuthSnapshot().then(() => {
          refreshActiveCvSnapshot();
          syncAuthFromBackgroundSilently(`content-auth-retry-${delay}`);
        });
      }, delay),
    );

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
      authRetryIds.forEach((id) => window.clearTimeout(id));
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

  const handleSaveJob = () => {
    if (!jobData.title.trim() || !(jobData.description || "").trim()) {
      showToast("Add a job title and description first.");
      showInlineStatus("error", "Save job failed: add a title and description first.");
      return;
    }

    const optimisticState: SavedJobState = {
      jobId: jobData.jobId,
      parseStatus: "parsing",
      reviewState: "pending",
      savedAt: Date.now(),
      sourceTitle: jobData.title,
    };

    setIsSavingJob(true);
    setSavedJobState(optimisticState);
    persistSavedJobState(jobData.url, optimisticState);
    showInlineStatus("info", "Job saved · Parsing…");

    chrome.runtime.sendMessage({ action: "saveJob", jobData }, (response) => {
      setIsSavingJob(false);
      if (chrome.runtime.lastError) {
        const err = getRuntimeErrorMessage();
        const failedState: SavedJobState = {
          ...optimisticState,
          parseStatus: "failed",
        };
        setSavedJobState(failedState);
        persistSavedJobState(jobData.url, failedState);
        showToast(`Failed to save job: ${err}`);
        showInlineStatus("error", `Save job failed: ${err}`);
        return;
      }

      if (response && response.success && response.jobId) {
        const nextState: SavedJobState = {
          jobId: response.jobId,
          dedupeHit: Boolean(response.dedupeHit),
          parseStatus: response.parseStatus === "failed" ? "failed" : response.parseStatus === "parsed" ? "parsed" : "parsing",
          reviewState: response.reviewState,
          savedAt: Date.now(),
          sourceTitle: jobData.title,
        };
        setJobData((current) => ({ ...current, jobId: response.jobId }));
        setSavedJobState(nextState);
        persistSavedJobState(jobData.url, nextState);
        const status = resolveSavedJobMessage(nextState);
        showToast(nextState.dedupeHit ? "Job already saved" : "Job saved");
        showInlineStatus(status.kind, status.message);
        return;
      }

      const err = response?.error || "Unknown error";
      const failedState: SavedJobState = {
        ...optimisticState,
        parseStatus: "failed",
      };
      setSavedJobState(failedState);
      persistSavedJobState(jobData.url, failedState);
      showToast(`Failed to save job: ${err}`);
      showInlineStatus("error", `Save job failed: ${err}`);
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
        if (response.jobId) {
          const nextState: SavedJobState = {
            jobId: response.jobId,
            dedupeHit: Boolean(response.dedupeHit),
            parseStatus: savedJobState?.parseStatus ?? "parsing",
            reviewState: savedJobState?.reviewState ?? "needs_review",
            savedAt: Date.now(),
            sourceTitle: jobData.title,
          };
          setJobData((current) => ({ ...current, jobId: response.jobId }));
          setSavedJobState(nextState);
          persistSavedJobState(jobData.url, nextState);
        }
        showToast(response?.dedupeHit ? "Opened saved Job" : "Opened Proposal Forge");
        showInlineStatus(
          "success",
          response?.dedupeHit
            ? "Opened saved Job in Proposal Forge."
            : "Opened Job Brief in Proposal Forge.",
        );
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

  const primaryOpenLabel =
    savedJobState?.jobId || jobData.jobId ? "Open saved Job" : "Open in Proposal Forge";
  const savedJobPill = savedJobState
    ? resolveSavedJobMessage(savedJobState)
    : null;

  return (
    <>
      <div id="proposal-preview-root" style={{ position: "fixed", bottom: "20px", right: "20px", width: "420px", padding: "18px", background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98))", border: "1px solid rgba(148,163,184,0.26)", borderRadius: "14px", boxShadow: "0 18px 44px rgba(15,23,42,0.18)", zIndex: 99999, fontFamily: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif", backdropFilter: "blur(16px)" }}>
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

        {savedJobPill ? (
          <div
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 10,
              border:
                savedJobPill.kind === "error"
                  ? "1px solid #fecaca"
                  : savedJobPill.kind === "success"
                    ? "1px solid #bbf7d0"
                    : "1px solid #bfdbfe",
              background:
                savedJobPill.kind === "error"
                  ? "#fff7f7"
                  : savedJobPill.kind === "success"
                    ? "#f4fff7"
                    : "#f5f9ff",
              color:
                savedJobPill.kind === "error"
                  ? "#991b1b"
                  : savedJobPill.kind === "success"
                    ? "#166534"
                    : "#1d4ed8",
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.72 }}>
              Saved Job
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{savedJobPill.message}</div>
          </div>
        ) : null}

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
            onClick={handleSaveJob}
            disabled={isSavingJob}
            style={{
              padding: "10px 14px",
              background: savedJobState?.jobId ? "#ecfccb" : "#111827",
              color: savedJobState?.jobId ? "#365314" : "white",
              border: savedJobState?.jobId ? "1px solid #bef264" : "none",
              borderRadius: 8,
              cursor: isSavingJob ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8
            }}
            title="Save this job into the canonical Job object before generating documents"
          >
            {isSavingJob ? <Spinner /> : savedJobState?.jobId ? "Saved job" : "Save Job"}
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
            title="Open this job in Proposal Forge to review the brief and generate documents"
          >
            {isOpeningInApp ? <Spinner /> : primaryOpenLabel}
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

function shouldRenderLegacyProposalPreview() {
  return (
    process.env.PLASMO_PUBLIC_ENABLE_LEGACY_PROPOSAL_PREVIEW === "1" ||
    window.localStorage.getItem("tw:jobforge:legacy-preview") === "1"
  );
}

function ContentRoot() {
  return shouldRenderLegacyProposalPreview() ? <ProposalPreview /> : <JobForgeCapsuleRoot />;
}

export default ContentRoot;
