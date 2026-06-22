/* eslint-disable react-refresh/only-export-components -- Existing mixed component/helper exports are outside this release-gate cleanup; split exports in a focused follow-up. */
import React from "react";
import { PaperPlaneRight } from "@/lib/icons";

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

export function ProposalGenerateButtonGlyph({
  state,
}: {
  state: ProposalGenerateButtonVisualState;
}) {
  return (
    <PaperPlaneRight
      className="dasti-proposal-submit__glyph"
      aria-hidden="true"
      data-state={state}
      weight="regular"
    />
  );
}

export function getProposalGenerateButtonVisualClass(
  _state: ProposalGenerateButtonVisualState,
): string {
  return "is-idle";
}
