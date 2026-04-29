import React from "react";
import AiStageList from "../ai/AiStageList";

type ProposalAIStreamProps = {
  loading: boolean;
  error: string | null;
  statusMessage?: string | null;
};

const PROPOSAL_AI_STAGES = [
  { id: "reading-role", label: "Reading role" },
  { id: "matching-profile", label: "Matching profile" },
  { id: "writing-draft", label: "Writing draft" },
  { id: "polishing", label: "Polishing" },
] as const;

export function ProposalAIStream({
  loading,
  error,
  statusMessage,
}: ProposalAIStreamProps): JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const currentIndex = loading ? 2 : PROPOSAL_AI_STAGES.length;
  const summary = error
    ? "Generation needs attention"
    : loading
      ? statusMessage?.trim() || "Writing draft"
      : "Ready for edits";

  return (
    <div className="dasti-proposal-ai-stream">
      <button
        type="button"
        className="dasti-proposal-ai-stream__summary"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="dasti-proposal-ai-stream__dot" aria-hidden="true" />
        <span className="dasti-proposal-ai-stream__label">{summary}</span>
        <span className="dasti-proposal-ai-stream__count">
          {Math.min(currentIndex + 1, PROPOSAL_AI_STAGES.length)} of{" "}
          {PROPOSAL_AI_STAGES.length}
        </span>
        <span className="dasti-proposal-ai-stream__caret" aria-hidden="true">
          v
        </span>
      </button>
      {expanded ? (
        <AiStageList
          title="Proposal AI stream"
          stages={[...PROPOSAL_AI_STAGES]}
          currentIndex={currentIndex}
          errorIndex={error ? Math.min(currentIndex, 2) : null}
        />
      ) : null}
    </div>
  );
}

export default ProposalAIStream;
