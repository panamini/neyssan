import React from "react";
import type { SaveVisualState } from "./types";

interface SegmentedPillProps {
  expanded: boolean;
  saveState: SaveVisualState;
  onDraft: () => void;
  onOpen: () => void;
  onSave: () => void;
  onTw: () => void;
}

function saveLabel(saveState: SaveVisualState) {
  if (saveState === "saving") return "Saving";
  if (saveState === "saved") return "Saved";
  return "Save";
}

export function SegmentedPill({ expanded, saveState, onDraft, onOpen, onSave, onTw }: SegmentedPillProps) {
  return (
    <div className="tw-segmented" data-expanded={expanded ? "true" : "false"}>
      <button className="tw-btn tw-btn-2w" type="button" onClick={onTw} aria-label="TwoWeeks status">
        tw
      </button>
      <button
        className="tw-btn tw-save-btn"
        type="button"
        data-state={saveState}
        onClick={onSave}
        disabled={saveState === "saving"}
      >
        <span className="tw-progress-line" />
        <span>{saveLabel(saveState)}</span>
      </button>
      <button className="tw-btn tw-draft" type="button" onClick={onDraft}>
        Draft
      </button>
      <button className="tw-btn tw-open" type="button" onClick={onOpen}>
        Open
      </button>
    </div>
  );
}
