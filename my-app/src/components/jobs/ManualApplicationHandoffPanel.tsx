import React from "react";

export type ManualApplicationHandoffPanelState = {
  status:
    | "disabled"
    | "not_started"
    | "handoff_prepared"
    | "handoff_confirmed"
    | "destination_open_requested"
    | "user_reported_submitted"
    | "user_reported_not_submitted"
    | "abandoned";
  enabled: boolean;
  canPrepare: boolean;
  canConfirm: boolean;
  canUseConfirmedPackage: boolean;
  handoffId?: string | null;
  applicationPackageId?: string | null;
  applicationContextId?: string | null;
  manifestDigest?: string | null;
  requiredConfirmationCopy?: string | null;
  destinationHostname?: string | null;
  destinationOrigin?: string | null;
  providerVerified: false;
  approvedAnswers: ManualApplicationHandoffAnswer[];
  downloadableArtifacts: ManualApplicationHandoffArtifact[];
  answerCopyBlockedReason?: string | null;
  downloadBlockedReason?: string | null;
};

export type ManualApplicationHandoffAnswer = {
  answerRef: string;
  label: string;
  text: string;
  answerDigest: string;
};

export type ManualApplicationHandoffArtifact = {
  artifactRef: string;
  label: string;
  filename: string;
  mimeType: string;
  text: string;
  artifactDigest: string;
};

type ManualApplicationHandoffPanelProps = {
  jobId: string;
  applicationUrl?: string | null;
  handoff: ManualApplicationHandoffPanelState | null | undefined;
  onPrepare: (args: { jobId: string }) => Promise<unknown>;
  onConfirm: (args: {
    handoffId: string;
    manifestDigest: string;
    confirmationCopy: string;
  }) => Promise<unknown>;
  onRecordCopySucceeded: (args: {
    handoffId: string;
    manifestDigest: string;
    answerRef: string;
    answerDigest: string;
  }) => Promise<unknown>;
  onRecordFileDownloadRequested: (args: {
    handoffId: string;
    manifestDigest: string;
    artifactRef: string;
    artifactDigest: string;
  }) => Promise<unknown>;
  onRecordDestinationOpenRequested: (args: {
    handoffId: string;
    manifestDigest: string;
  }) => Promise<unknown>;
  onReportOutcome: (args: {
    handoffId: string;
    manifestDigest: string;
    outcome:
      | "user_reported_submitted"
      | "user_reported_not_submitted"
      | "abandoned";
  }) => Promise<unknown>;
};

type ActionState = "idle" | "working" | "done" | "failed";

export function ManualApplicationHandoffPanel({
  jobId,
  applicationUrl,
  handoff,
  onPrepare,
  onConfirm,
  onRecordDestinationOpenRequested,
  onReportOutcome,
}: ManualApplicationHandoffPanelProps): JSX.Element {
  const [confirmationCopy, setConfirmationCopy] = React.useState("");
  const [actionState, setActionState] = React.useState<ActionState>("idle");
  const handoffId = handoff?.handoffId ?? "";
  const manifestDigest = handoff?.manifestDigest ?? "";
  const requiredConfirmationCopy = handoff?.requiredConfirmationCopy ?? "";
  const answerCopyBlockedReason =
    handoff?.answerCopyBlockedReason ??
    "Approved answer copy is blocked until approved answers are server-derived.";
  const downloadBlockedReason =
    handoff?.downloadBlockedReason ??
    "Approved artifact downloads are blocked until an approved export representation is available.";
  const canUsePackage = Boolean(
    handoffId &&
      manifestDigest &&
      handoff?.enabled &&
      handoff.canUseConfirmedPackage,
  );
  const canConfirm =
    Boolean(handoffId && manifestDigest && handoff?.canConfirm) &&
    confirmationCopy === requiredConfirmationCopy;

  React.useEffect(() => {
    setConfirmationCopy("");
    setActionState("idle");
  }, [jobId, handoffId, manifestDigest]);

  const runAction = async (action: () => Promise<unknown>) => {
    setActionState("working");
    try {
      await action();
      setActionState("done");
    } catch {
      setActionState("failed");
    }
  };

  const handlePrepare = () => {
    void runAction(() => onPrepare({ jobId }));
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    void runAction(() =>
      onConfirm({
        handoffId,
        manifestDigest,
        confirmationCopy,
      }),
    );
  };

  const handleOpenDestination = () => {
    if (!canUsePackage || !applicationUrl) return;
    void runAction(async () => {
      await onRecordDestinationOpenRequested({ handoffId, manifestDigest });
      window.open(applicationUrl, "_blank", "noopener");
    });
  };

  const handleReportOutcome = (
    outcome:
      | "user_reported_submitted"
      | "user_reported_not_submitted"
      | "abandoned",
  ) => {
    if (!handoffId || !manifestDigest) return;
    void runAction(() =>
      onReportOutcome({
        handoffId,
        manifestDigest,
        outcome,
      }),
    );
  };

  return (
    <section
      className="dasti-proposal-sheet"
      aria-label="Manual application handoff"
      data-testid="manual-application-handoff-panel"
    >
      <div className="dasti-proposal-sheet__header">
        <div className="dasti-stack">
          <div className="dasti-brief-card__summary-label">
            Application handoff
          </div>
          <div className="dasti-empty-state__title">
            Manual application handoff
          </div>
          <p className="dasti-empty-state__subtitle">
            Twoweeks will not submit, fill forms, or contact the provider.
          </p>
          <p className="dasti-empty-state__subtitle">
            Reported by you, not verified by the provider.
          </p>
        </div>
      </div>

      {handoff?.enabled ? (
        <div className="dasti-brief-card__summary">
          <div className="dasti-brief-card__summary-block">
            <div className="dasti-brief-card__summary-label">Destination</div>
            <div>{handoff.destinationHostname ?? "Application URL required"}</div>
            <div className="dasti-empty-state__subtitle">
              {handoff.destinationOrigin ?? "No safe destination yet."}
            </div>
          </div>
          <div className="dasti-brief-card__summary-block">
            <div className="dasti-brief-card__summary-label">
              Package digest
            </div>
            <code>{manifestDigest || "No package prepared yet."}</code>
          </div>
        </div>
      ) : (
        <div className="dasti-empty-state__subtitle">
          Manual handoff is disabled.
        </div>
      )}

      {handoff?.enabled && handoff.status === "not_started" ? (
        <button
          type="button"
          className="dasti-button dasti-button--pill dasti-button--sm"
          disabled={!handoff.canPrepare || actionState === "working"}
          onClick={handlePrepare}
        >
          Prepare package
        </button>
      ) : null}

      {handoff?.canConfirm ? (
        <div className="dasti-stack">
          <label className="dasti-jobs-toolbar__search">
            <span className="dasti-brief-card__summary-label">
              Confirmation copy
            </span>
            <textarea
              className="dasti-select"
              aria-label="Confirmation copy"
              value={confirmationCopy}
              rows={3}
              onChange={(event) => setConfirmationCopy(event.target.value)}
            />
          </label>
          <div className="dasti-empty-state__subtitle">
            Required copy: {requiredConfirmationCopy}
          </div>
          <button
            type="button"
            className="dasti-button dasti-button--pill dasti-button--sm"
            disabled={!canConfirm || actionState === "working"}
            onClick={handleConfirm}
          >
            Confirm package
          </button>
        </div>
      ) : null}

      {canUsePackage ? (
        <div className="dasti-stack">
          <div className="dasti-brief-card__summary-label">
            Approved answers
          </div>
          <div className="dasti-empty-state__subtitle">
            {answerCopyBlockedReason}
          </div>

          <div className="dasti-brief-card__summary-label">Approved files</div>
          <div className="dasti-empty-state__subtitle">
            {downloadBlockedReason}
          </div>

          <button
            type="button"
            className="dasti-button dasti-button--pill dasti-button--sm"
            disabled={!applicationUrl}
            onClick={handleOpenDestination}
          >
            Open application form
          </button>

          <div className="dasti-jobs-filter-chips">
            <button
              type="button"
              className="dasti-button dasti-button--pill dasti-button--sm"
              onClick={() => handleReportOutcome("user_reported_submitted")}
            >
              I submitted it
            </button>
            <button
              type="button"
              className="dasti-button dasti-button--pill dasti-button--sm"
              onClick={() => handleReportOutcome("user_reported_not_submitted")}
            >
              I did not submit it
            </button>
            <button
              type="button"
              className="dasti-button dasti-button--pill dasti-button--sm"
              onClick={() => handleReportOutcome("abandoned")}
            >
              Mark abandoned
            </button>
          </div>
        </div>
      ) : null}

      {actionState === "failed" ? (
        <div className="dasti-empty-state__subtitle" role="status">
          Handoff action failed.
        </div>
      ) : null}
    </section>
  );
}
