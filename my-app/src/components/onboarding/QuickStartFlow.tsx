import React from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { Loader2 } from "@/lib/icons";
import { Button } from "../ui/button";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import { deriveCvTitleFromSections } from "../../lib/normalize-cv";
import { markQuickStartCompleted } from "../../lib/onboarding-state";
import {
  clearActiveLocalCvId,
  setProposalAttachedCvId,
} from "../../lib/proposal-personalization";
import {
  createProposalWorkspaceResetState,
  startFreshProposalWorkspace,
} from "../../lib/proposal-workspace-state";
import type {
  QuickStartCreateType,
  QuickStartResumeMode,
  QuickStartReturnTarget,
} from "../../lib/quick-start-routing";
import {
  beginStructuredImportTimingTrace,
  logStructuredImportTiming,
  TRUSTED_MISTRAL_FILE_INPUT_ACCEPT,
  type StructuredImportTimingTrace,
  useStructuredMistralImport,
} from "../useStructuredMistralImport";

type Step = 1 | 2;
type ImportPhase =
  | "idle"
  | "preparing"
  | "importing"
  | "retrying"
  | "finalizing";

interface Props {
  onExit: () => void;
  initialCreateType?: QuickStartCreateType;
  resumeMode?: QuickStartResumeMode;
  returnTarget?: QuickStartReturnTarget;
}

export function QuickStartFlow({
  onExit,
  initialCreateType = "resume",
  resumeMode = "choice",
  returnTarget = null,
}: Props): JSX.Element {
  const navigate = useNavigate();
  const { importCv, createNewCv, currentCvId } = useCvLibrary();
  const { importFile } = useStructuredMistralImport({ probeOnMount: false });
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const mountedRef = React.useRef(true);
  const requestIdRef = React.useRef(0);
  const pendingImportedCvIdRef = React.useRef<string | null>(null);
  const pendingImportRequestIdRef = React.useRef<number | null>(null);
  const pendingImportTraceRef =
    React.useRef<StructuredImportTimingTrace | null>(null);
  const pendingImportReturnTargetRef =
    React.useRef<QuickStartReturnTarget>(null);
  const [step, setStep] = React.useState<Step>(() =>
    initialCreateType === "resume" && resumeMode === "upload-only" ? 2 : 1,
  );
  const [createType, setCreateType] =
    React.useState<QuickStartCreateType>(initialCreateType);
  const [parsing, setParsing] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [creatingFresh, setCreatingFresh] = React.useState(false);
  const [importPhase, setImportPhase] = React.useState<ImportPhase>("idle");
  const [importFileName, setImportFileName] = React.useState<string | null>(
    null,
  );
  const [pendingImportedCvId, setPendingImportedCvId] = React.useState<
    string | null
  >(null);
  const isBusy = parsing || creatingFresh;

  const clearPendingImportedHandoffRefs = React.useCallback(() => {
    pendingImportedCvIdRef.current = null;
    pendingImportRequestIdRef.current = null;
    pendingImportTraceRef.current = null;
    pendingImportReturnTargetRef.current = null;
  }, []);

  const clearPendingImportedHandoff = React.useCallback(() => {
    clearPendingImportedHandoffRefs();
    setPendingImportedCvId(null);
  }, [clearPendingImportedHandoffRefs]);

  const resetImportUi = React.useCallback(() => {
    setParsing(false);
    setImportPhase("idle");
    setImportFileName(null);
  }, []);

  const invalidateActiveQuickStartSession = React.useCallback(() => {
    requestIdRef.current += 1;
    clearPendingImportedHandoff();
  }, [clearPendingImportedHandoff]);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      clearPendingImportedHandoffRefs();
    };
  }, [clearPendingImportedHandoffRefs]);

  const closeQuickStart = React.useCallback(() => {
    if (isBusy) {
      return;
    }
    invalidateActiveQuickStartSession();
    markQuickStartCompleted();
    onExit();
  }, [invalidateActiveQuickStartSession, isBusy, onExit]);

  const handleResumeCompletion = React.useCallback(
    (
      cvId?: string | null,
      trace?: StructuredImportTimingTrace | null,
      completionReturnTarget: QuickStartReturnTarget = returnTarget,
    ) => {
      logStructuredImportTiming(trace, "final_navigation.start", {
        returnTarget: completionReturnTarget,
        cvId: cvId ?? null,
      });
      markQuickStartCompleted();
      if (completionReturnTarget === "proposal" && cvId) {
        setProposalAttachedCvId(cvId);
        void navigate("/proposal", { replace: true });
        logStructuredImportTiming(trace, "final_navigation.finish", {
          pathname: "/proposal",
        });
        return;
      }
      void navigate("/cv", { replace: true });
      logStructuredImportTiming(trace, "final_navigation.finish", {
        pathname: "/cv",
      });
    },
    [navigate, returnTarget],
  );

  React.useEffect(() => {
    if (!pendingImportedCvId) {
      return;
    }
    if (!mountedRef.current) {
      return;
    }
    if (currentCvId !== pendingImportedCvId) {
      return;
    }
    if (pendingImportRequestIdRef.current === null) {
      return;
    }
    if (requestIdRef.current !== pendingImportRequestIdRef.current) {
      return;
    }

    const completedCvId = pendingImportedCvId;
    const trace = pendingImportTraceRef.current;
    const completionReturnTarget = pendingImportReturnTargetRef.current ?? null;
    clearPendingImportedHandoff();
    resetImportUi();
    handleResumeCompletion(completedCvId, trace, completionReturnTarget);
  }, [
    clearPendingImportedHandoff,
    currentCvId,
    handleResumeCompletion,
    pendingImportedCvId,
    resetImportUi,
  ]);

  const handleStartCoverLetter = React.useCallback(() => {
    invalidateActiveQuickStartSession();
    clearActiveLocalCvId();
    startFreshProposalWorkspace();
    markQuickStartCompleted();
    void navigate("/proposal", {
      replace: true,
      state: createProposalWorkspaceResetState(),
    });
  }, [invalidateActiveQuickStartSession, navigate]);

  const handleFileChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || isBusy) return;

      const trace = beginStructuredImportTimingTrace("quick_start", file.name);
      const requestId = ++requestIdRef.current;
      let awaitingLiveCvHandoff = false;
      const isCurrentRequest = () =>
        mountedRef.current && requestIdRef.current === requestId;

      logStructuredImportTiming(trace, "file.selected", {
        fileSizeBytes: file.size,
        fileType: file.type || null,
      });
      logStructuredImportTiming(trace, "quick_start.handler.entered");
      setParseError(null);
      setImportFileName(file.name);
      setImportPhase("preparing");
      setParsing(true);

      try {
        if (!isCurrentRequest()) {
          return;
        }

        setImportPhase("importing");
        const outcome = await importFile(file, {
          trace,
          onRetrying: () => {
            if (isCurrentRequest()) {
              setImportPhase("retrying");
            }
          },
          onRetrySucceeded: () => {
            if (isCurrentRequest()) {
              setImportPhase("importing");
            }
          },
        });
        if (!isCurrentRequest()) {
          return;
        }

        if (outcome.status === "rejected") {
          setParseError(outcome.message);
          return;
        }
        if (!Array.isArray(outcome.sections) || outcome.sections.length === 0) {
          setParseError(
            outcome.emptyReason
              ? `Parser returned empty result: ${outcome.emptyReason}`
              : "No importable sections were found.",
          );
          return;
        }

        const nextCvId = uuidv4();
        const now = new Date().toISOString();
        setImportPhase("finalizing");
        logStructuredImportTiming(trace, "importCv.start", {
          nextCvId,
        });
        pendingImportedCvIdRef.current = nextCvId;
        pendingImportRequestIdRef.current = requestId;
        pendingImportTraceRef.current = trace;
        pendingImportReturnTargetRef.current = returnTarget;
        setPendingImportedCvId(nextCvId);
        awaitingLiveCvHandoff = true;

        void importCv({
          id: nextCvId,
          title: deriveCvTitleFromSections(
            outcome.sections as any,
            "Imported CV",
          ),
          metadata: {
            createdAt: now,
            updatedAt: now,
            version: 1,
            ...(outcome.authoritativeResume
              ? { authoritativeResume: outcome.authoritativeResume }
              : {}),
          },
          sections: outcome.sections as any,
        })
          .then(() => {
            logStructuredImportTiming(trace, "importCv.finish", {
              nextCvId,
            });
          })
          .catch((error) => {
            const message =
              error instanceof Error ? error.message : "Couldn't read that file.";
            logStructuredImportTiming(trace, "importCv.error", {
              nextCvId,
              message,
            });
            if (!isCurrentRequest()) {
              return;
            }
            if (pendingImportedCvIdRef.current !== nextCvId) {
              return;
            }
            clearPendingImportedHandoff();
            setParseError(message);
            resetImportUi();
          });
        return;
      } catch (error) {
        if (isCurrentRequest()) {
          logStructuredImportTiming(trace, "quick_start.error", {
            message:
              error instanceof Error ? error.message : "Couldn't read that file.",
          });
          setParseError(
            error instanceof Error ? error.message : "Couldn't read that file.",
          );
        }
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        if (isCurrentRequest() && !awaitingLiveCvHandoff) {
          resetImportUi();
        }
      }
    },
    [
      clearPendingImportedHandoff,
      importCv,
      importFile,
      isBusy,
      resetImportUi,
      returnTarget,
    ],
  );

  const handleStartFresh = React.useCallback(async () => {
    if (isBusy) {
      return;
    }

    const requestId = ++requestIdRef.current;
    const isCurrentRequest = () =>
      mountedRef.current && requestIdRef.current === requestId;

    setParseError(null);
    setCreatingFresh(true);
    try {
      await createNewCv();
      if (!isCurrentRequest()) {
        return;
      }
      handleResumeCompletion(null);
    } finally {
      if (isCurrentRequest()) {
        setCreatingFresh(false);
      }
    }
  }, [createNewCv, handleResumeCompletion, isBusy]);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="quick-start-heading"
      style={{
        height: "100%",
        overflowY: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(var(--space-4), 4vw, var(--space-7))",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
        }}
      >
        <StepIndicator current={step} />

        {step === 1 ? (
          <StepOne
            onResume={() => {
              setCreateType("resume");
              setStep(2);
            }}
            onCoverLetter={handleStartCoverLetter}
          />
        ) : null}

        {step === 2 ? (
          <StepTwo
            parsing={parsing}
            parseError={parseError}
            createType={createType}
            resumeMode={resumeMode}
            creatingFresh={creatingFresh}
            importPhase={importPhase}
            importFileName={importFileName}
            onPickFile={() => {
              if (!isBusy) {
                fileInputRef.current?.click();
              }
            }}
            onStartFresh={handleStartFresh}
            onBack={() => {
              invalidateActiveQuickStartSession();
              setParseError(null);
              if (resumeMode === "upload-only") {
                closeQuickStart();
                return;
              }
              setStep(1);
            }}
          />
        ) : null}

        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            onClick={closeQuickStart}
            className="dasti-button dasti-button--ghost dasti-button--sm"
            style={{ color: "var(--color-text-muted)" }}
            disabled={isBusy}
          >
            Not now
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={TRUSTED_MISTRAL_FILE_INPUT_ACCEPT}
          onChange={handleFileChange}
          style={{ display: "none" }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: Step }): JSX.Element {
  return (
    <div
      aria-label={`Step ${current} of 2`}
      style={{
        display: "flex",
        gap: "var(--space-2)",
        justifyContent: "center",
      }}
    >
      {[1, 2].map((n) => (
        <span
          key={n}
          style={{
            height: 4,
            width: 40,
            borderRadius: 999,
            background:
              n <= current
                ? "var(--color-accent, var(--ti))"
                : "var(--color-border)",
          }}
        />
      ))}
    </div>
  );
}

function StepOne({
  onResume,
  onCoverLetter,
}: {
  onResume: () => void;
  onCoverLetter: () => void;
}): JSX.Element {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <header>
        <h1
          id="quick-start-heading"
          style={{
            fontFamily: "var(--font-heading-family)",
            fontSize: "var(--tl)",
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          What are you starting?
        </h1>
        <p
          style={{
            marginTop: "var(--space-2)",
            color: "var(--color-text-muted)",
            fontSize: "var(--tm)",
          }}
        >
          Pick one path and keep moving.
        </p>
      </header>

      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        <ChoiceCard
          label="Resume"
          hint="Upload a PDF or image, or begin from a blank resume."
          onClick={onResume}
        />
        <ChoiceCard
          label="Cover letter"
          hint="Open the cover letter workspace with a lightweight start surface."
          onClick={onCoverLetter}
        />
      </div>
    </section>
  );
}

function StepTwo({
  parsing,
  parseError,
  createType,
  resumeMode,
  creatingFresh,
  importPhase,
  importFileName,
  onPickFile,
  onStartFresh,
  onBack,
}: {
  parsing: boolean;
  parseError: string | null;
  createType: QuickStartCreateType;
  resumeMode: QuickStartResumeMode;
  creatingFresh: boolean;
  importPhase: ImportPhase;
  importFileName: string | null;
  onPickFile: () => void;
  onStartFresh: () => void;
  onBack: () => void;
}): JSX.Element {
  const isBusy = parsing || creatingFresh;
  const importStatusCopy =
    importPhase === "preparing"
      ? {
          title: "Preparing file…",
          detail: "Checking the file before upload.",
        }
      : importPhase === "retrying"
        ? {
            title: "Retrying import…",
            detail: "The connection dropped. The same import is retrying now.",
          }
        : importPhase === "finalizing"
        ? {
            title: "Opening resume…",
            detail: "Loading the imported resume into the editor.",
          }
          : {
              title: creatingFresh
                ? "Opening blank resume…"
                : "Importing resume…",
              detail: creatingFresh
                ? "Creating a blank resume and opening the editor."
                : "Running the trusted Mistral import. This can take a few seconds.",
            };

  return (
    <section
      aria-busy={isBusy || undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <header>
        <h1
          id="quick-start-heading"
          style={{
            fontFamily: "var(--font-heading-family)",
            fontSize: "var(--tl)",
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          {createType === "cover-letter"
            ? "Open the workspace."
            : resumeMode === "upload-only"
              ? "Import a resume."
              : "Bring in your resume."}
        </h1>
        <p
          style={{
            marginTop: "var(--space-2)",
            color: "var(--color-text-muted)",
            fontSize: "var(--tm)",
          }}
        >
          {resumeMode === "upload-only"
            ? "Upload a trusted PDF or image to use it in the cover letter flow."
            : "Use a trusted PDF or image, or start from a blank resume."}
        </p>
      </header>

      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        <ChoiceCard
          label={parsing ? "Reading your file…" : "Upload PDF or image"}
          hint="Quick Start only accepts trusted parser-supported files."
          onClick={onPickFile}
          disabled={isBusy}
        />
        {resumeMode !== "upload-only" ? (
          <ChoiceCard
            label={creatingFresh ? "Opening blank resume…" : "Start fresh"}
            hint="Open a blank resume immediately."
            onClick={onStartFresh}
            disabled={isBusy}
          />
        ) : null}
      </div>

      {isBusy ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="quick-start-import-status"
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "var(--space-3)",
            alignItems: "start",
            padding: "var(--space-3)",
            borderRadius: "var(--radius-surface, 12px)",
            border: "1px solid var(--color-border)",
            background:
              "color-mix(in srgb, var(--color-canvas) 95%, white 5%)",
          }}
        >
          <Loader2
            size={16}
            className="animate-spin"
            aria-hidden="true"
            style={{ marginTop: 2, color: "var(--color-accent, var(--ti))" }}
          />
          <div style={{ display: "grid", gap: 4 }}>
            <div
              style={{
                fontSize: "var(--tm)",
                fontWeight: 600,
                color: "var(--color-text)",
              }}
            >
              {importStatusCopy.title}
            </div>
            <div
              style={{
                fontSize: "var(--ts)",
                color: "var(--color-text-muted)",
                lineHeight: 1.45,
              }}
            >
              {importStatusCopy.detail}
            </div>
            {importFileName ? (
              <div
                style={{
                  fontSize: "var(--txs, 11px)",
                  color: "var(--color-text-subtle)",
                  wordBreak: "break-word",
                }}
              >
                {importFileName}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {parseError ? (
        <p
          role="alert"
          style={{
            margin: 0,
            color: "var(--color-danger, #b42318)",
            fontSize: "var(--ts)",
          }}
        >
          {parseError}
        </p>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button variant="ghost" onClick={onBack} disabled={isBusy}>
          {resumeMode === "upload-only" ? "Close" : "Back"}
        </Button>
      </div>
    </section>
  );
}

function ChoiceCard({
  label,
  hint,
  onClick,
  disabled,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        textAlign: "left",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-surface, 12px)",
        border: "1px solid var(--color-border)",
        background: "var(--sfr, #fff)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition:
          "transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-heading-family)",
          fontSize: "var(--tm)",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          color: "var(--color-text-muted)",
          fontSize: "var(--ts)",
          lineHeight: 1.4,
        }}
      >
        {hint}
      </div>
    </button>
  );
}
