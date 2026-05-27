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
import { translateUi } from "../../lib/i18n";
import { useUiLanguagePreference } from "../../lib/ui-preferences";

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
  const { resolvedLanguage } = useUiLanguagePreference();
  const stageIconSize = 18;
  const isUltraCompactToolbar = modeControlMode === "toggle";
  const nextMode = mode === "edit" ? "preview" : "edit";
  const modeToggleLabel =
    mode === "edit"
      ? translateUi(resolvedLanguage, "workspace.switchToPreview")
      : translateUi(resolvedLanguage, "workspace.switchToEdit");
  const cvToolbarLabel = translateUi(resolvedLanguage, "workspace.cvToolbar");
  const documentControlsLabel = translateUi(
    resolvedLanguage,
    "workspace.documentControls",
  );
  const editLabel = translateUi(resolvedLanguage, "workspace.edit");
  const pagePreviewLabel = translateUi(
    resolvedLanguage,
    "workspace.pagePreview",
  );
  const sectionsLabel = translateUi(resolvedLanguage, "workspace.sections");
  const designLabel = translateUi(resolvedLanguage, "workspace.design");
  const templatesLabel = translateUi(resolvedLanguage, "workspace.templates");
  const askLabel = translateUi(resolvedLanguage, "workspace.ask");
  const showAskHandle = mode === "preview" && Boolean(onOpenAsk);

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
          aria-label={cvToolbarLabel}
        >
          <div
            className="dasti-icon-cluster dasti-icon-cluster--tight dasti-proposal-skeleton-stage__actions dasti-proposal-skeleton-stage__actions--document dasti-cv-stage-bar__actions"
            role="group"
            aria-label={documentControlsLabel}
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
                  aria-label={editLabel}
                  data-toolbar-tooltip={editLabel}
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
                  aria-label={pagePreviewLabel}
                  data-toolbar-tooltip={translateUi(
                    resolvedLanguage,
                    "workspace.preview",
                  )}
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
                aria-label={sectionsLabel}
                data-toolbar-tooltip={sectionsLabel}
                data-stage-tooltip-mode="compact"
                onClick={onOpenSections}
              >
                <span className="dasti-proposal-skeleton-stage__action-label dasti-cv-stage-bar__action-label">
                  {sectionsLabel}
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
                aria-label={designLabel}
                data-toolbar-tooltip={designLabel}
                data-stage-tooltip-mode="compact"
                onClick={onOpenDesign}
              >
                <span className="dasti-proposal-skeleton-stage__action-label dasti-cv-stage-bar__action-label">
                  {designLabel}
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
                aria-label={templatesLabel}
                data-toolbar-tooltip={templatesLabel}
                data-stage-tooltip-mode="compact"
                onClick={onOpenTemplates}
              >
                <span className="dasti-proposal-skeleton-stage__action-label dasti-cv-stage-bar__action-label">
                  {templatesLabel}
                </span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {showAskHandle ? (
        <div
          className="dasti-proposal-skeleton-stage__ask-handle-layer dasti-toolbar--surface-tooltips"
          data-sticky={commandLayerSticky ? "true" : undefined}
          style={toolbarStyle}
        >
          <button
            type="button"
            className="dasti-icon-button dasti-proposal-skeleton-stage__ask-handle"
            aria-expanded={askOpen}
            aria-label={askLabel}
            title={askLabel}
            data-testid="cv-ask-handle"
            data-toolbar-tooltip={askLabel}
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
