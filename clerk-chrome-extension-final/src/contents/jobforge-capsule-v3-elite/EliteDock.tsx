import React from "react";
import { GeneratedText } from "./GeneratedText";
import type { ActiveCvOption, ActiveCvSnapshot, ContextMode, DockStatus, GeneratedProposalState } from "./types";

interface EliteDockProps {
  activeCvSnapshot: ActiveCvSnapshot | null;
  activeCvOptions: ActiveCvOption[];
  contextMode: ContextMode;
  generatedProposal: GeneratedProposalState | null;
  status: DockStatus;
  visible: boolean;
  onCopyGenerated: () => void;
  onExportPdf: () => void;
  onGenerate: () => void;
  onSelectActiveCv: (profileId: string) => void;
  onShareGenerated: () => void;
  onSetContext: (mode: ContextMode) => void;
}

function statusLabel(status: DockStatus) {
  if (status === "saving") return "saving";
  if (status === "generating") return "running";
  if (status === "generated") return "complete";
  if (status === "error") return "fault";
  return "synced";
}

export function EliteDock({
  activeCvSnapshot,
  activeCvOptions,
  contextMode,
  generatedProposal,
  status,
  visible,
  onCopyGenerated,
  onExportPdf,
  onGenerate,
  onSelectActiveCv,
  onShareGenerated,
  onSetContext,
}: EliteDockProps) {
  const activeCvLabel = activeCvSnapshot?.title || "Current active CV";
  const canUseActiveCv = Boolean(activeCvSnapshot);
  const isBusy = status === "saving" || status === "generating";

  return (
    <div className="tw-dock" data-visible={visible ? "true" : "false"} aria-hidden={visible ? "false" : "true"}>
      <div className="tw-dock-header">
        <div className="tw-dock-title">tw // generator-engine</div>
        <div className="tw-status-dot">{statusLabel(status)}</div>
      </div>

      <div className="tw-context-group" role="radiogroup" aria-label="Proposal context">
        <label className="tw-context-item" data-disabled={!canUseActiveCv ? "true" : "false"}>
          <span>{activeCvLabel}</span>
          <input
            type="radio"
            name="tw_jobforge_context"
            checked={contextMode === "active-cv"}
            disabled={!canUseActiveCv}
            onChange={() => onSetContext("active-cv")}
          />
          <span className="tw-radio-marker" />
        </label>
        {activeCvOptions.length > 0 ? (
          <div className="tw-cv-picker-row">
            <select
              className="tw-cv-select"
              aria-label="Choose CV context"
              value={activeCvOptions.find((option) => option.title === activeCvSnapshot?.title)?.profileId ?? ""}
              onChange={(event) => onSelectActiveCv(event.currentTarget.value)}
            >
              <option value="" disabled>
                Choose CV context
              </option>
              {activeCvOptions.map((option) => (
                <option key={option.profileId} value={option.profileId}>
                  {option.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <label className="tw-context-item">
          <span>Raw Job Specification Only</span>
          <input
            type="radio"
            name="tw_jobforge_context"
            checked={contextMode === "raw-job"}
            onChange={() => onSetContext("raw-job")}
          />
          <span className="tw-radio-marker" />
        </label>
      </div>

      <button className="tw-action-btn" type="button" onClick={onGenerate} disabled={isBusy}>
        {status === "generating" ? "executing_generation_routine..." : generatedProposal ? "Regenerate Proposal" : "Create Proposal"}
      </button>

      {generatedProposal ? (
        <GeneratedText
          generatedProposal={generatedProposal}
          onCopy={onCopyGenerated}
          onExportPdf={onExportPdf}
          onShare={onShareGenerated}
        />
      ) : null}
    </div>
  );
}
