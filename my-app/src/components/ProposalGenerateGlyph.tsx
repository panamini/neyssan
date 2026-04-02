import React from "react";

export type ProposalGenerateButtonVisualState =
  | "idle"
  | "loading-hiding"
  | "loading-spinning"
  | "loading-revealing-stop"
  | "loading-stop"
  | "stop-undrawing"
  | "stop-revealing"
  | "finishing-hiding"
  | "finishing-spinning"
  | "finishing-revealing";

const PROPOSAL_GENERATE_FLOW_PATH =
  "M 37 92 C 57 67, 82 52, 111 52 C 134 52, 152 59, 166 73 C 178 86, 185 104, 185 124 C 186 145, 179 165, 166 181 C 153 197, 134 208, 109 208 C 87 208, 71 200, 64 185 C 57 170, 60 151, 73 137 C 87 122, 107 113, 133 112 C 173 111, 211 127, 241 159";
const PROPOSAL_GENERATE_SQUARE_PATH =
  "M 84 74 H 172 Q 184 74, 184 86 V 170 Q 184 182, 172 182 H 96 Q 84 182, 84 170 V 86 Q 84 74, 96 74";

export function ProposalGenerateButtonGlyph({
  state,
}: {
  state: ProposalGenerateButtonVisualState;
}) {
  return (
    <svg
      className="dasti-proposal-submit__glyph"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="none"
      aria-hidden="true"
      data-state={state}
    >
      <path
        className="dasti-proposal-submit__scribble"
        pathLength={100}
        d={PROPOSAL_GENERATE_FLOW_PATH}
      />
      <path
        className="dasti-proposal-submit__spinner"
        pathLength={100}
        d={PROPOSAL_GENERATE_FLOW_PATH}
      />
      <path
        className="dasti-proposal-submit__square"
        pathLength={100}
        d={PROPOSAL_GENERATE_SQUARE_PATH}
      />
    </svg>
  );
}

export function getProposalGenerateButtonVisualClass(
  state: ProposalGenerateButtonVisualState,
): string {
  switch (state) {
    case "idle":
      return "is-idle";
    case "loading-hiding":
    case "loading-spinning":
      return "is-spinning";
    case "loading-revealing-stop":
      return "is-revealing";
    case "loading-stop":
      return "is-done";
    case "stop-undrawing":
      return "is-back-undrawing";
    case "stop-revealing":
      return "is-back-revealing";
    case "finishing-hiding":
    case "finishing-spinning":
      return "is-finishing-spinning";
    case "finishing-revealing":
      return "is-finishing-revealing";
    default:
      return "is-idle";
  }
}
