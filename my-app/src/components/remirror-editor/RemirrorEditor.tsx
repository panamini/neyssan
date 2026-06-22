import React, { useEffect } from "react";
import type { CvSection } from "../../schemas/cvDocument.schema";
import SectionEditor from "../SectionEditor";

/**
 * Controlled RemirrorEditor
 * - Receives sections from parent and emits changes through callbacks.
 * - Parent is responsible for collapsed state and section-level handlers.
 */
export interface RemirrorEditorProps {
  sections: CvSection[];
  onSectionChange: (index: number, updatedSection: CvSection) => void;
  /**
   * Optional callback for high-frequency content-only updates (editor keystrokes).
   * Receives (sectionId, remirrorJson). Parent may debounce/persist as needed.
   */
  onSectionContentChange?: (sectionId: string, json: import("remirror").RemirrorJSON) => void;
  /**
   * Optional callback for title updates originating from SectionEditor.
   * Receives (sectionId, newTitle).
   */
  onSectionTitleChange?: (sectionId: string, newTitle: string) => void;
  collapsedSections: Record<string, boolean>;
  onCollapseToggle: (sectionId: string) => void;
  onSectionFocus?: (sectionId: string) => void;
  onSectionBlur?: (sectionId: string) => void;
  /**
   * When true, render SectionEditor instances in embedded mode (used inside
   * inline editors/inspectors). This disables legacy migration side-effects that
   * can cause remount loops in nested contexts.
   */
  embedded?: boolean;
}

export function RemirrorEditor({
  sections,
  onSectionChange,
  onSectionContentChange,
  onSectionTitleChange,
  collapsedSections,
  onCollapseToggle,
  onSectionFocus,
  onSectionBlur,
  embedded = false,
}: RemirrorEditorProps) {
  if ((window as any).__CV_EDITOR_DEBUG__) console.debug("[RemirrorEditor] sections", sections.map(s => s.id));
  // Debug: log section ids on render when enabled
  useEffect(() => {
    try {
      const isDebug = typeof window !== "undefined" && (window as any).__CV_EDITOR_DEBUG__ === true;
      if (isDebug) {

        console.debug("[RemirrorEditor] sections", Array.isArray(sections) ? sections.map((s) => s.id) : sections);
      }
    } catch {
      /* noop */
    }
  }, [sections]);

  return (
    <div>
      {Array.isArray(sections) &&
        sections.map((section, index) => {
          if (!section.id) return null;
          return (
            <SectionEditor
              key={section.id}
              section={section}
              index={index}
              onChange={(idx: number, updated: CvSection) => onSectionChange(idx, updated)}
              // Forward content-only updates (from SectionEditor) to the optional handler.
              onContentChange={(secId: string, json) => {
                if (typeof onSectionContentChange === "function") onSectionContentChange(secId, json as any);
              }}
              // Forward title updates from SectionEditor to optional handler.
              onTitleChange={(secId: string, newTitle: string) => {
                if (typeof onSectionTitleChange === "function") onSectionTitleChange(secId, newTitle);
              }}
              // collapsed state comes from parent controller (fallback false)
              collapsed={collapsedSections[section.id] ?? false}
              onCollapseChange={() => onCollapseToggle(section.id!)}
              onFocus={onSectionFocus}
              onBlur={onSectionBlur}
              embedded={embedded}
            />
          );
        })}
    </div>
  );
}

export default RemirrorEditor;
