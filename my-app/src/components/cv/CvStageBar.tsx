import React from "react";
import {
  Layout,
  Eye,
  FileUser,
  ListNumbers,
  PenLine,
} from "@/lib/icons";
import { Button, ToneBadge } from "../ui";
import type { CvToneChoice } from "./CvRail";

type CvStageBarProps = {
  mode: "edit" | "preview";
  exporting: boolean;
  tone: CvToneChoice;
  templatesOpen?: boolean;
  sectionsOpen?: boolean;
  designOpen?: boolean;
  onModeChange: (mode: "edit" | "preview") => void;
  onOpenSections?: () => void;
  onOpenDesign?: () => void;
  onOpenTemplates?: () => void;
  askOpen?: boolean;
  onOpenAsk?: () => void;
};

export function CvStageBar({
  mode,
  tone,
  templatesOpen = false,
  sectionsOpen = false,
  designOpen = false,
  onModeChange,
  onOpenSections,
  onOpenDesign,
  onOpenTemplates,
  askOpen = false,
  onOpenAsk,
}: CvStageBarProps): JSX.Element {
  const stageIconSize = 18;
  return (
    <div className="dasti-cv-stage-bar dasti-toolbar--surface-tooltips">
      <div
        className="style-segmented dasti-cv-stage-bar__mode"
        role="group"
        aria-label="CV view mode"
      >
        <button
          type="button"
          className="dasti-cv-mode-toggle"
          data-selected={mode === "edit" ? "true" : undefined}
          onClick={() => onModeChange("edit")}
          aria-label="Edit"
          data-toolbar-tooltip="Edit"
        >
          <PenLine size={stageIconSize} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="dasti-cv-mode-toggle"
          data-selected={mode === "preview" ? "true" : undefined}
          onClick={() => onModeChange("preview")}
          aria-label="Page preview"
          data-toolbar-tooltip="Preview"
        >
          <Eye size={stageIconSize} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="dasti-cv-stage-bar__version-history"
        disabled
      >
        Version history
      </Button>
      {onOpenSections ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="dasti-cv-stage-bar__primary-action"
          iconLeft={<ListNumbers size={stageIconSize} strokeWidth={1.8} />}
          aria-expanded={sectionsOpen}
          aria-label="Sections"
          data-toolbar-tooltip="Sections"
          data-stage-tooltip-mode="compact"
          onClick={onOpenSections}
        >
          <span className="dasti-cv-stage-bar__action-label">Sections</span>
        </Button>
      ) : null}
      {onOpenDesign ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="dasti-cv-stage-bar__primary-action"
          iconLeft={<FileUser size={stageIconSize} strokeWidth={1.8} />}
          aria-expanded={designOpen}
          aria-label="Design"
          data-toolbar-tooltip="Design"
          data-stage-tooltip-mode="compact"
          onClick={onOpenDesign}
        >
          <span className="dasti-cv-stage-bar__action-label">Design</span>
        </Button>
      ) : null}
      {onOpenTemplates ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="dasti-cv-stage-bar__primary-action"
          iconLeft={<Layout size={stageIconSize} strokeWidth={1.8} />}
          aria-expanded={templatesOpen}
          aria-label="Templates"
          data-toolbar-tooltip="Templates"
          data-stage-tooltip-mode="compact"
          onClick={onOpenTemplates}
        >
          <span className="dasti-cv-stage-bar__action-label">Templates</span>
        </Button>
      ) : null}
      {onOpenAsk ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          className="dasti-cv-stage-bar__primary-action"
          aria-expanded={askOpen}
          aria-label="Ask"
          data-toolbar-tooltip="Ask"
          data-stage-tooltip-mode="compact"
          onClick={onOpenAsk}
        >
          <span className="dasti-cv-stage-bar__action-label">Ask</span>
        </Button>
      ) : null}
      <span className="dasti-cv-stage-bar__spacer" aria-hidden="true" />
      <ToneBadge tone={tone}>
        {tone.charAt(0).toUpperCase() + tone.slice(1)}
      </ToneBadge>
    </div>
  );
}

export default CvStageBar;
