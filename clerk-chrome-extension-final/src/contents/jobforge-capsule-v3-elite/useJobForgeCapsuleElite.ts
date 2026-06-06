import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveCvOption, ActiveCvSnapshot, ContextMode, DockStatus, GeneratedProposalState, SaveVisualState, SavedJobState, ToastState } from "./types";
import { checkSession, generateProposal, getActiveCvSnapshot, getJobSaveState, listActiveCvOptions, openProposalForge, saveJob, setActiveCvFromProfile } from "./runtime";
import { persistSavedJobState, readSavedJobState, reconcileSavedJobState } from "./saved-job-state";
import { useScrapedJob } from "./useScrapedJob";

const USE_CURRENT_CV_CONTEXT_STORAGE_KEY = "useCurrentCvContext";

function canSaveJob(jobData: { title?: string; description?: string }) {
  return Boolean(jobData.title?.trim() && jobData.description?.trim());
}

function summarizeGenerationError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Proposal generation failed closed during finalization")) {
    return "generation::finalization-failed";
  }
  if (message.includes("provider_busy") || message.includes("rate limited")) {
    return "generation::provider-busy";
  }
  if (message.includes("transport") || message.includes("unavailable")) {
    return "generation::provider-unavailable";
  }
  return "generation::failed";
}

function normalizeGeneratedText(value: string) {
  return value.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
}

function escapeTitle(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPrintableCoverLetterHtml(text: string, title: string, company?: string) {
  const documentTitle = [title, company].filter(Boolean).join(" - ") || "Cover Letter";
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeTitle(documentTitle)}</title>
    <style>
      @page { margin: 22mm; }
      body {
        color: #16130f;
        background: #ffffff;
        font: 13px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 0;
      }
      main { white-space: pre-wrap; }
    </style>
  </head>
  <body><main></main></body>
</html>`;
}

export function useJobForgeCapsuleElite() {
  const { jobData, setJobData } = useScrapedJob();
  const [savedJobState, setSavedJobState] = useState<SavedJobState | null>(null);
  const [saveState, setSaveState] = useState<SaveVisualState>("idle");
  const [dockVisible, setDockVisible] = useState(false);
  const [dockStatus, setDockStatus] = useState<DockStatus>("ready");
  const [activeCvSnapshot, setActiveCvSnapshot] = useState<ActiveCvSnapshot | null>(null);
  const [activeCvOptions, setActiveCvOptions] = useState<ActiveCvOption[]>([]);
  const [contextMode, setContextMode] = useState<ContextMode>("raw-job");
  const [generatedProposal, setGeneratedProposal] = useState<GeneratedProposalState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastIdRef = useRef(0);
  const generateRunIdRef = useRef(0);

  const showToast = useCallback((message: string) => {
    setToast({ message, id: ++toastIdRef.current });
  }, []);

  useEffect(() => {
    let active = true;

    const refreshActiveCvState = async () => {
      const [snapshotResponse, optionsResponse] = await Promise.all([
        getActiveCvSnapshot(),
        listActiveCvOptions(),
      ]);
      if (!active) return;
      setActiveCvSnapshot(snapshotResponse.success ? snapshotResponse.snapshot ?? null : null);
      setActiveCvOptions(optionsResponse.success ? optionsResponse.options ?? [] : []);
    };

    void checkSession()
      .catch(() => null)
      .then(() => refreshActiveCvState())
      .catch(() => {
        if (active) {
          setActiveCvSnapshot(null);
          setActiveCvOptions([]);
        }
      });

    chrome.storage.local.get([USE_CURRENT_CV_CONTEXT_STORAGE_KEY], (result) => {
      if (!active) return;
      const stored = Boolean(result?.[USE_CURRENT_CV_CONTEXT_STORAGE_KEY]);
      setContextMode(stored ? "active-cv" : "raw-job");
    });

    const updateContext = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== "local") return;
      if (changes[USE_CURRENT_CV_CONTEXT_STORAGE_KEY]) {
        setContextMode(Boolean(changes[USE_CURRENT_CV_CONTEXT_STORAGE_KEY].newValue) ? "active-cv" : "raw-job");
      }
    };

    chrome.storage.onChanged.addListener(updateContext);
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(updateContext);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setSaveState("idle");

    void readSavedJobState(jobData.url).then((state) => {
      if (!active) return;
      setSavedJobState(state);
      if (state?.jobId) {
        setSaveState("saved");
        setJobData((current) => ({ ...current, jobId: state.jobId }));
        void getJobSaveState({ ...jobData, jobId: state.jobId })
          .then((response) => {
            if (!active || !response.success) return;
            const reconciled = reconcileSavedJobState(state, response);
            setSavedJobState(reconciled);
            persistSavedJobState(jobData.url, reconciled);
          })
          .catch(() => null);
      }
    });

    return () => {
      active = false;
    };
  }, [jobData.url, setJobData]);

  useEffect(() => {
    if (!activeCvSnapshot && contextMode === "active-cv") {
      setContextMode("raw-job");
    }
  }, [activeCvSnapshot, contextMode]);

  const setContext = useCallback((mode: ContextMode) => {
    setContextMode(mode);
    chrome.storage.local.set({ [USE_CURRENT_CV_CONTEXT_STORAGE_KEY]: mode === "active-cv" });
  }, []);

  const handleSelectActiveCv = useCallback(async (profileId: string) => {
    if (!profileId) return;
    try {
      const response = await setActiveCvFromProfile(profileId);
      if (!response.success || !response.snapshot) {
        throw new Error(response.error || "cv::selection-failed");
      }
      setActiveCvSnapshot(response.snapshot);
      setContext("active-cv");
      showToast("cv::active-context-selected");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "cv::selection-failed");
    }
  }, [setContext, showToast]);

  const ensureSavedJob = useCallback(async (mode: "visible" | "silent") => {
    if (savedJobState?.jobId || jobData.jobId) {
      return savedJobState ?? {
        jobId: jobData.jobId,
        parseStatus: "parsing" as const,
        savedAt: Date.now(),
        sourceTitle: jobData.title,
      };
    }

    if (!canSaveJob(jobData)) {
      throw new Error("save::missing-job-data");
    }

    const optimisticState: SavedJobState = {
      jobId: jobData.jobId,
      parseStatus: "parsing",
      reviewState: "pending",
      savedAt: Date.now(),
      sourceTitle: jobData.title,
    };

    if (mode === "visible") setSaveState("saving");
    setSavedJobState(optimisticState);
    persistSavedJobState(jobData.url, optimisticState);

    const response = await saveJob(jobData);
    if (!response.success || !response.jobId) {
      const failedState: SavedJobState = { ...optimisticState, parseStatus: "failed" };
      setSavedJobState(failedState);
      persistSavedJobState(jobData.url, failedState);
      throw new Error(response.error || "save::failed");
    }

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
    setSaveState("saved");
    return nextState;
  }, [jobData, savedJobState, setJobData]);

  const handleSave = useCallback(async () => {
    if (saveState === "saving") return;
    try {
      await ensureSavedJob("visible");
      showToast("job::committed-true");
    } catch (error) {
      setSaveState("error");
      showToast(error instanceof Error ? error.message : "save::failed");
    }
  }, [ensureSavedJob, saveState, showToast]);

  const handleDraft = useCallback(async () => {
    if (dockVisible) {
      setDockVisible(false);
      return;
    }
    setDockVisible(true);
    setDockStatus("ready");
    try {
      if (!savedJobState?.jobId && !jobData.jobId) {
        setDockStatus("saving");
        await ensureSavedJob("silent");
      }
      setDockStatus(generatedProposal ? "generated" : "ready");
    } catch {
      setDockStatus("error");
      showToast("save::required-before-draft");
    }
  }, [dockVisible, ensureSavedJob, generatedProposal, jobData.jobId, savedJobState?.jobId, showToast]);

  const handleGenerate = useCallback(async () => {
    const runId = ++generateRunIdRef.current;
    setDockStatus("generating");
    setGeneratedProposal(null);
    try {
      const savedState = await ensureSavedJob("silent");
      const generationJobData = {
        ...jobData,
        jobId: savedState.jobId ?? jobData.jobId,
        proposalType: jobData.proposalType ?? "cover_letter",
      };
      const response = await generateProposal(generationJobData, contextMode === "active-cv");
      if (runId !== generateRunIdRef.current) return;
      if (!response.success) {
        throw new Error(response.error || "generation::failed");
      }
      setGeneratedProposal({
        text: response.proposal || "",
        proposalId: response.proposalId,
        actualModelType: response.actualModelType,
        actualModelName: response.actualModelName,
        routing: response.routing,
      });
      setDockStatus("generated");
      showToast("generation::complete");
    } catch (error) {
      if (runId !== generateRunIdRef.current) return;
      setDockStatus("error");
      showToast(summarizeGenerationError(error));
    }
  }, [contextMode, ensureSavedJob, jobData, showToast]);

  const handleCopyGenerated = useCallback(async () => {
    if (!generatedProposal?.text) return;
    const text = normalizeGeneratedText(generatedProposal.text);
    try {
      await navigator.clipboard.writeText(text);
      showToast("sys::copied-to-clipboard");
    } catch {
      showToast("sys::clipboard-unavailable");
    }
  }, [generatedProposal?.text, showToast]);

  const handleShareGenerated = useCallback(async () => {
    if (!generatedProposal?.text) return;
    const text = normalizeGeneratedText(generatedProposal.text);
    const title = jobData.title ? `Cover letter - ${jobData.title}` : "Cover letter";
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        showToast("sys::share-opened");
        return;
      }
      await navigator.clipboard.writeText(text);
      showToast("sys::share-copied");
    } catch {
      showToast("sys::share-unavailable");
    }
  }, [generatedProposal?.text, jobData.title, showToast]);

  const handleExportPdf = useCallback(() => {
    if (!generatedProposal?.text) return;
    const printWindow = window.open("", "_blank", "width=760,height=920");
    if (!printWindow) {
      showToast("sys::pdf-popup-blocked");
      return;
    }

    const text = normalizeGeneratedText(generatedProposal.text);
    printWindow.document.open();
    printWindow.document.write(buildPrintableCoverLetterHtml(text, jobData.title, jobData.company));
    printWindow.document.close();
    const main = printWindow.document.querySelector("main");
    if (main) {
      main.textContent = text;
    }
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 120);
    showToast("sys::pdf-export-ready");
  }, [generatedProposal?.text, jobData.company, jobData.title, showToast]);

  const handleOpen = useCallback(async () => {
    try {
      const response = await openProposalForge(jobData);
      if (!response.success) {
        throw new Error(response.error || "routing::failed");
      }
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
        setSaveState("saved");
      }
      showToast("route::proposal-forge");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "routing::failed");
    }
  }, [jobData, savedJobState, setJobData, showToast]);

  const handleTw = useCallback(() => {
    setDockVisible((current) => !current);
    showToast(savedJobState?.jobId ? "engine::saved-job-linked" : "engine::ready");
  }, [savedJobState?.jobId, showToast]);

  return {
    activeCvSnapshot,
    activeCvOptions,
    contextMode,
    dockStatus,
    dockVisible,
    generatedProposal,
    jobData,
    saveState,
    savedJobState,
    toast,
    handleDraft,
    handleCopyGenerated,
    handleExportPdf,
    handleGenerate,
    handleOpen,
    handleSave,
    handleSelectActiveCv,
    handleShareGenerated,
    handleTw,
    setContext,
    setDockVisible,
  };
}
