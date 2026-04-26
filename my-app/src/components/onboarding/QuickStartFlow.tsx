import React from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { Rewind, Stop } from "@/lib/icons";
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
import { QuickStartChoiceCard } from "./QuickStartChoiceCard";

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
  const hasPreviousStep = step === 2 && resumeMode !== "upload-only";

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
      state: createProposalWorkspaceResetState({
        entryIntent: "cover-letter-start",
      }),
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
      data-testid="quick-start-pane"
      className="dasti-quick-start-pane"
    >
      <section
        aria-labelledby="quick-start-heading"
        aria-describedby="quick-start-description"
        className="dasti-quick-start-pane__frame"
      >
        <header className="dasti-quick-start-pane__controls">
          <div
            data-testid="quick-start-header-back-slot"
            data-has-action={hasPreviousStep ? "true" : "false"}
            className="dasti-quick-start-pane__control-slot"
          >
            {hasPreviousStep ? (
              <button
                type="button"
                aria-label="Back"
                className="dasti-modal-close"
                onClick={() => {
                  invalidateActiveQuickStartSession();
                  setParseError(null);
                  setStep(1);
                }}
                disabled={isBusy}
              >
                <Rewind className="w-5 h-5" aria-hidden="true" />
              </button>
            ) : (
              <div aria-hidden="true" style={{ width: "100%", height: "var(--hs)" }} />
            )}
          </div>

          <div className="dasti-quick-start-pane__progress">
            <StepIndicator current={step} />
          </div>

          <div className="dasti-quick-start-pane__control-slot dasti-quick-start-pane__control-slot--end">
            <button
              type="button"
              onClick={closeQuickStart}
              aria-label="Close"
              className="dasti-modal-close"
              disabled={isBusy}
            >
              <Stop className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="dasti-quick-start-sheet">
          {step === 1 ? (
            <StepOne
              onResume={() => {
                setStep(2);
              }}
              onCoverLetter={handleStartCoverLetter}
            />
          ) : null}

          {step === 2 ? (
            <StepTwo
              parsing={parsing}
              parseError={parseError}
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
            />
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept={TRUSTED_MISTRAL_FILE_INPUT_ACCEPT}
            onChange={handleFileChange}
            style={{ display: "none" }}
            aria-hidden="true"
          />
        </div>
      </section>
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
            width: 32,
            borderRadius: 2,
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
    <section className="dasti-quick-start-sheet__section">
      <header className="dasti-quick-start-sheet__header">
        <h1 id="quick-start-heading" className="dasti-quick-start-sheet__title">
          What are you starting?
        </h1>
        <p
          id="quick-start-description"
          className="dasti-quick-start-sheet__subtitle"
        >
          Pick one path and keep moving.
        </p>
      </header>
      <div className="dasti-quick-start-sheet__choice-grid">
        <QuickStartChoiceCard
          label="Resume"
          hint="A sharp, printable CV."
          onClick={onResume}
          primaryAction
          className="dasti-quick-start-sheet__choice-card"
        />
        <QuickStartChoiceCard
          label="Cover letter"
          hint="Targeted to one role."
          onClick={onCoverLetter}
          className="dasti-quick-start-sheet__choice-card"
        />
      </div>
    </section>
  );
}

function StepTwo({
  parsing,
  parseError,
  resumeMode,
  creatingFresh,
  importPhase,
  importFileName,
  onPickFile,
  onStartFresh,
}: {
  parsing: boolean;
  parseError: string | null;
  resumeMode: QuickStartResumeMode;
  creatingFresh: boolean;
  importPhase: ImportPhase;
  importFileName: string | null;
  onPickFile: () => void;
  onStartFresh: () => void;
}): JSX.Element {
  const isBusy = parsing || creatingFresh;
  const importStatusCopy =
    importPhase === "preparing"
      ? {
          title: "Preparing file...",
          detail: "Checking the file before upload.",
        }
      : importPhase === "retrying"
        ? {
            title: "Retrying import...",
            detail: "The connection dropped. The same import is retrying now.",
          }
        : importPhase === "finalizing"
        ? {
            title: "Opening resume...",
            detail: "Loading the imported resume into the editor.",
          }
          : {
              title: creatingFresh
                ? "Opening blank resume..."
                : "Importing resume...",
              detail: creatingFresh
                ? "Creating a blank resume and opening the editor."
                : "Running the trusted Mistral import. This can take a few seconds.",
            };
  const uploadCardTitle = parsing
    ? importStatusCopy.title
    : "Upload PDF or image";
  const uploadCardHint = parsing
    ? importStatusCopy.detail
    : "We’ll fill the editor for you.";
  const freshCardTitle = creatingFresh
    ? importStatusCopy.title
    : "Start fresh";
  const freshCardHint = creatingFresh
    ? importStatusCopy.detail
    : "A clean template, nothing to unlearn.";

  return (
    <section
      aria-busy={isBusy || undefined}
      className="dasti-quick-start-sheet__section"
    >
      <header className="dasti-quick-start-sheet__header">
        <h1 id="quick-start-heading" className="dasti-quick-start-sheet__title">
          Bring in your resume.
        </h1>
        <p
          id="quick-start-description"
          className="dasti-quick-start-sheet__subtitle"
        >
          {resumeMode === "upload-only"
            ? "Upload a trusted PDF or image to use it in the cover letter flow."
            : "Upload a PDF or image. Or start blank."}
        </p>
      </header>

      <div className="dasti-quick-start-sheet__choice-grid">
        <QuickStartChoiceCard
          label={uploadCardTitle}
          hint={uploadCardHint}
          onClick={onPickFile}
          disabled={isBusy}
          loading={parsing}
          meta={parsing ? importFileName : null}
          testId={parsing ? "quick-start-import-status" : undefined}
          primaryAction
          className="dasti-quick-start-sheet__choice-card"
        />
        {resumeMode !== "upload-only" ? (
          <QuickStartChoiceCard
            label={freshCardTitle}
            hint={freshCardHint}
            onClick={onStartFresh}
            disabled={isBusy}
            loading={creatingFresh}
            className="dasti-quick-start-sheet__choice-card"
          />
        ) : null}
      </div>

      {parseError ? (
        <p
          role="alert"
          style={{
            margin: 0,
            color: "var(--color-danger)",
            fontSize: "var(--ts)",
          }}
        >
          {parseError}
        </p>
      ) : null}
    </section>
  );
}
