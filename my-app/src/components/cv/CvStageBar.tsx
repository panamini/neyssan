import React from "react";
import {
  ChatCircleText,
  Layout,
  Eye,
  Palette,
  ListNumbers,
  PenLine,
} from "@/lib/icons";
import { Button } from "../ui";
import type { CommandLayerModeControlMode } from "@/lib/document-command-layer-layout";

type CvStageBarProps = {
  mode: "edit" | "preview";
  toolbarStyle?: React.CSSProperties;
  modeControlMode?: CommandLayerModeControlMode;
  commandLayerSticky?: boolean;
  commandLayerMeasured?: boolean;
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
  toolbarStyle,
  modeControlMode = "split",
  commandLayerSticky = false,
  commandLayerMeasured = true,
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
  const isUltraCompactToolbar = modeControlMode === "toggle";
  const nextMode = mode === "edit" ? "preview" : "edit";
  const modeToggleLabel =
    mode === "edit" ? "Switch to Preview" : "Switch to Edit";

  return (
    <>
      <div
        className="forge__stage-bar dasti-proposal-skeleton-stage__bar dasti-toolbar--surface-tooltips"
        data-sticky={commandLayerSticky ? "true" : undefined}
        data-command-layer-measured={commandLayerMeasured ? "true" : "false"}
        data-testid="cv-toolbar"
        style={toolbarStyle}
      >
        <div
          className="dasti-proposal-skeleton-stage__toolbar-main dasti-cv-stage-bar"
          role="group"
          aria-label="CV toolbar"
        >
          <div
            className="dasti-icon-cluster dasti-icon-cluster--tight dasti-proposal-skeleton-stage__actions dasti-proposal-skeleton-stage__actions--document dasti-cv-stage-bar__actions"
            role="group"
            aria-label="Document controls"
          >
            {isUltraCompactToolbar ? (
              <button
                type="button"
                className="dasti-icon-button dasti-proposal-mode-toggle dasti-proposal-mode-toggle--single dasti-cv-mode-toggle dasti-cv-mode-toggle--single"
                onClick={() => onModeChange(nextMode)}
                aria-label={modeToggleLabel}
                data-toolbar-tooltip={modeToggleLabel}
              >
                {mode === "edit" ? (
                  <PenLine
                    size={stageIconSize}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                ) : (
                  <Eye
                    size={stageIconSize}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                )}
              </button>
            ) : (
              <div
                className="style-segmented dasti-proposal-skeleton-stage__mode dasti-cv-stage-bar__mode"
                role="group"
                aria-label="CV view mode"
              >
                <button
                  type="button"
                  className="dasti-proposal-mode-toggle dasti-cv-mode-toggle"
                  data-selected={mode === "edit" ? "true" : undefined}
                  onClick={() => onModeChange("edit")}
                  aria-label="Edit"
                  data-toolbar-tooltip="Edit"
                >
                  <PenLine
                    size={stageIconSize}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  className="dasti-proposal-mode-toggle dasti-cv-mode-toggle"
                  data-selected={mode === "preview" ? "true" : undefined}
                  onClick={() => onModeChange("preview")}
                  aria-label="Page preview"
                  data-toolbar-tooltip="Preview"
                >
                  <Eye
                    size={stageIconSize}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </button>
              </div>
            )}
            {onOpenSections ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="dasti-proposal-skeleton-stage__primary-action dasti-cv-stage-bar__primary-action"
                iconLeft={
                  <ListNumbers size={stageIconSize} strokeWidth={1.8} />
                }
                aria-expanded={sectionsOpen}
                aria-label="Sections"
                data-toolbar-tooltip="Sections"
                data-stage-tooltip-mode="compact"
                onClick={onOpenSections}
              >
                <span className="dasti-proposal-skeleton-stage__action-label dasti-cv-stage-bar__action-label">
                  Sections
                </span>
              </Button>
            ) : null}
            {onOpenDesign ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="dasti-proposal-skeleton-stage__primary-action dasti-cv-stage-bar__primary-action"
                iconLeft={<Palette size={stageIconSize} strokeWidth={1.8} />}
                aria-expanded={designOpen}
                aria-label="Design"
                data-toolbar-tooltip="Design"
                data-stage-tooltip-mode="compact"
                onClick={onOpenDesign}
              >
                <span className="dasti-proposal-skeleton-stage__action-label dasti-cv-stage-bar__action-label">
                  Design
                </span>
              </Button>
            ) : null}
            {onOpenTemplates ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="dasti-proposal-skeleton-stage__primary-action dasti-cv-stage-bar__primary-action"
                iconLeft={<Layout size={stageIconSize} strokeWidth={1.8} />}
                aria-expanded={templatesOpen}
                aria-label="Templates"
                data-toolbar-tooltip="Templates"
                data-stage-tooltip-mode="compact"
                onClick={onOpenTemplates}
              >
                <span className="dasti-proposal-skeleton-stage__action-label dasti-cv-stage-bar__action-label">
                  Templates
                </span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {onOpenAsk ? (
        <div
          className="dasti-proposal-skeleton-stage__ask-handle-layer dasti-toolbar--surface-tooltips"
          data-sticky={commandLayerSticky ? "true" : undefined}
          style={toolbarStyle}
        >
          <button
            type="button"
            className="dasti-icon-button dasti-proposal-skeleton-stage__ask-handle"
            aria-expanded={askOpen}
            aria-label="Ask"
            title="Ask"
            data-testid="cv-ask-handle"
            data-toolbar-tooltip="Ask"
            data-stage-tooltip-mode="compact"
            onClick={onOpenAsk}
          >
            <ChatCircleText size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </>
  );
}

export default CvStageBar;
