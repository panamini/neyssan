import React from "react";
import {
  Layout,
  Eye,
  FileUser,
  FolderOpen,
  FolderSimple,
  ListNumbers,
  PenLine,
} from "@/lib/icons";
import { Button, Menu, ToneBadge } from "../ui";
import type { CvToneChoice } from "./CvRail";

export type CvStageBarResumeOption = {
  id: string;
  title: string;
  description: string | null;
  selected: boolean;
};

type CvStageBarProps = {
  mode: "edit" | "preview";
  exporting: boolean;
  tone: CvToneChoice;
  resumeOptions: CvStageBarResumeOption[];
  templatesOpen?: boolean;
  sectionsOpen?: boolean;
  designOpen?: boolean;
  onModeChange: (mode: "edit" | "preview") => void;
  onOpenSections?: () => void;
  onOpenDesign?: () => void;
  onOpenTemplates?: () => void;
  onPickResume: (cvId: string) => void;
};

export function CvStageBar({
  mode,
  exporting,
  tone,
  resumeOptions,
  templatesOpen = false,
  sectionsOpen = false,
  designOpen = false,
  onModeChange,
  onOpenSections,
  onOpenDesign,
  onOpenTemplates,
  onPickResume,
}: CvStageBarProps): JSX.Element {
  const stageIconSize = 16;

  const resumeMenuSections = React.useMemo(
    () => [
      {
        label: "Pick resume",
        items:
          resumeOptions.length > 0
            ? resumeOptions.map((option) => ({
                id: option.id,
                role: "menuitemradio" as const,
                selected: option.selected,
                label: option.title,
                description: option.description ?? "Saved resume.",
                onSelect: () => onPickResume(option.id),
              }))
            : [
                {
                  id: "no-resumes",
                  label: "No resumes available",
                  description: "Import or create a resume first.",
                  disabled: true,
                },
              ],
      },
    ],
    [onPickResume, resumeOptions],
  );
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
      <ToneBadge tone={tone}>
        {tone.charAt(0).toUpperCase() + tone.slice(1)}
      </ToneBadge>
      <Menu
        ariaLabel="Pick resume"
        align="end"
        menuClassName="dasti-cv-stage-bar__resume-menu"
        sections={resumeMenuSections}
        trigger={
          <button
            type="button"
            className="dasti-cv-stage-bar__plain-action dasti-cv-stage-bar__pick-resume"
            disabled={exporting}
            aria-label="Pick resume"
            data-toolbar-tooltip="Pick resume"
          >
            <span
              className="dasti-cv-stage-bar__pick-icon dasti-cv-stage-bar__pick-icon--closed"
              aria-hidden="true"
            >
              <FolderSimple size={stageIconSize} strokeWidth={1.8} />
            </span>
            <span
              className="dasti-cv-stage-bar__pick-icon dasti-cv-stage-bar__pick-icon--open"
              aria-hidden="true"
            >
              <FolderOpen size={stageIconSize} strokeWidth={1.8} />
            </span>
          </button>
        }
      />
    </div>
  );
}

export default CvStageBar;
