/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CvSection } from "../../schemas/cvDocument.schema";
import AchievementsDisplay from "../cv-display/AchievementsDisplay";
import AchievementsModal from "./AchievementsModal";
import { ChevronDown, ChevronUp, Pencil, X } from "@/lib/icons";
import { docToPlainText } from "../remirror-editor/utils/text";
import type {
  ResumeActiveTarget,
  SectionOpenRequest,
} from "../../features/verbati/resumeLinking";

/**
 * AchievementsBlock
 *
 * - Preview renderer and edit entry point for top-level "achievements" sections.
 * - Collapsed: show a short preview (first 1-2 items / truncated text).
 * - Expanded: render AchievementsDisplay for full fidelity.
 * - Edit: opens AchievementsModal which returns IAchievementItem[] via onSave.
 *
 * Accessibility:
 * - region with aria-expanded
 * - keyboard-accessible Edit/Clear controls
 */

interface AchievementsBlockProps {
  section: CvSection;
  onChange: (updatedSection: CvSection) => void;
  onContentChange?: (sectionId: string, json: unknown) => void;
  onDeleteSection?: () => void;
  openRequest?: SectionOpenRequest | null;
  activeTarget?: ResumeActiveTarget | null;
  onActiveTargetChange?: (target: ResumeActiveTarget | null) => void;
}

export function AchievementsBlock({
  section,
  onChange,
  onDeleteSection,
  openRequest = null,
  activeTarget = null,
  onActiveTargetChange,
}: AchievementsBlockProps) {
  const items = useMemo(() => {
    const normalizedItems: Array<{ id: string; text: string }> = [];
    const seenTexts = new Set<string>();
    const structuredIds = new Set<string>();

    const normalizeText = (value: unknown) =>
      String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();

    const pushItem = (rawText: unknown, rawId?: unknown) => {
      const text = normalizeText(rawText);
      if (!text) return;
      const dedupeKey = text.toLowerCase();
      if (seenTexts.has(dedupeKey)) return;
      seenTexts.add(dedupeKey);
      normalizedItems.push({
        id:
          typeof rawId === "string" && rawId.trim().length > 0
            ? rawId
            : `ach-${Math.random().toString(36).slice(2, 8)}`,
        text,
      });
    };

    try {
      if (Array.isArray(section.structuredContent)) {
        (section.structuredContent as any[]).forEach((it) => {
          if (typeof it === "string") {
            pushItem(it);
            return;
          }
          const o = it as { id?: string; text?: string; achievement?: string };
          if (typeof o.id === "string" && o.id.trim().length > 0) {
            structuredIds.add(o.id.trim());
          }
          pushItem(o.text ?? o.achievement ?? "", o.id);
        });
      }

      if (normalizedItems.length === 0 && Array.isArray(section.blocks)) {
        section.blocks.forEach((block) => {
          const linkedStructuredId = String(
            (block as any)?.attributes?.linkedStructuredId ??
              (block as any)?.attributes?.linkedstructuredid ??
              "",
          ).trim();
          if (linkedStructuredId && structuredIds.has(linkedStructuredId)) {
            return;
          }
          let blockText = "";
          if (typeof (block as any)?.plainText === "string") {
            blockText = (block as any).plainText;
          } else {
            try {
              blockText = docToPlainText((block as any)?.content);
            } catch {
              blockText = "";
            }
          }

          if (
            !blockText &&
            typeof (block as any)?.title === "string" &&
            !/^Achievement\s+\d+$/i.test(String((block as any).title))
          ) {
            blockText = String((block as any).title);
          }

          pushItem(
            blockText,
            linkedStructuredId || (block as any)?.id,
          );
        });
      }

      return normalizedItems;
    } catch {
      return normalizedItems;
    }
  }, [section.blocks, section.structuredContent]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialItemId, setInitialItemId] = useState<string | undefined>();
  // When true and list is empty, seed the modal with a blank row and focus it.
  const [seedOnOpen, setSeedOnOpen] = useState(false);
  const lastHandledRequestIdRef = useRef<string | null>(null);
  const contentId = useMemo(
    () => `ach-content-${String(section.id)}`,
    [section.id],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps -- Pre-existing dependency contract is preserved for this release-gate cleanup.
  function publishActiveTarget(
    source: ResumeActiveTarget["source"],
    itemId?: string,
  ) {
    onActiveTargetChange?.({
      sectionType: "achievements",
      sectionId: String(section.id ?? ""),
      itemId,
      source,
    });
  }

  function clearActiveTarget() {
    onActiveTargetChange?.(null);
  }

  function clearHoverTarget(itemId?: string) {
    if (
      activeTarget?.source === "editor-hover" &&
      activeTarget.sectionType === "achievements" &&
      (itemId ? activeTarget.itemId === itemId : true)
    ) {
      onActiveTargetChange?.(null);
    }
  }

  useEffect(() => {
    if (
      !openRequest ||
      openRequest.sectionType !== "achievements" ||
      openRequest.sectionId !== String(section.id ?? "") ||
      lastHandledRequestIdRef.current === openRequest.requestId
    ) {
      return;
    }

    lastHandledRequestIdRef.current = openRequest.requestId;
    setSeedOnOpen(false);
    setInitialItemId(openRequest.itemId);
    setIsModalOpen(true);
    publishActiveTarget("modal", openRequest.itemId);
  }, [openRequest, publishActiveTarget, section.id]);

  function handleSave(next: Array<{ id?: string; text: string }>) {
    try {
      const sanitized = next
        .map((r, idx) => ({
          id: String(
            r.id ?? `ach-${Math.random().toString(36).slice(2, 8)}-${idx}`,
          ),
          text: String(r.text ?? "").trim(),
        }))
        .filter((r) => r.text.length > 0);
      const updatedSection = {
        ...section,
        structuredContent: sanitized as any,
        blocks: [] as any,
      };
      onChange(updatedSection as CvSection);
    } finally {
      setIsModalOpen(false);
      setSeedOnOpen(false);
    }
  }

  // Collapsed preview handled by AchievementsDisplay via maxItems prop

  return (
    <div
      className="mb-4 ds-card border [border-color:var(--color-border)] [border-radius:var(--radius-card)] section-container section-container--dismissable section-container--achievements"
      data-interactive="true"
      data-state="open"
    >
      {onDeleteSection ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteSection();
          }}
          className="dasti-section-dismiss-pill"
          aria-label="Delete achievements section"
          title="Delete achievements section"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.1} aria-hidden />
        </button>
      ) : null}
      <div className="section-container-header flex items-center justify-between">
        <h3 className="ds-card__title cv-section-heading">{section.title}</h3>
        <div className="flex items-center" style={{ gap: 2 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSeedOnOpen(false);
              setInitialItemId(undefined);
              publishActiveTarget("modal");
              setIsModalOpen(true);
            }}
            className="dasti-icon-button cv-section-edit-trigger"
            aria-label="Edit achievements"
            title="Edit achievements"
          >
            <Pencil className="w-4 h-4" strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </div>

      <div className="ds-card__content cv-section-body">
        <div
          className={[
            "cv-achievements-surface",
            "cv-achievements-surface--editable",
            items.length === 0 ? "cv-achievements-surface--empty" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div
            id={contentId}
            role="region"
            aria-expanded={isExpanded}
            className="text-sm [color:var(--ti)]"
            onClick={() => {
              if (items.length === 0) return;
              setSeedOnOpen(false);
              setInitialItemId(undefined);
              publishActiveTarget("modal");
              setIsModalOpen(true);
            }}
            onPointerEnter={() => publishActiveTarget("editor-hover")}
            onPointerLeave={() => clearHoverTarget()}
            onKeyDown={(e) => {
              if (items.length === 0) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSeedOnOpen(false);
                setInitialItemId(undefined);
                publishActiveTarget("modal");
                setIsModalOpen(true);
              }
            }}
            tabIndex={items.length > 0 ? 0 : -1}
            aria-label={items.length > 0 ? "Edit achievements" : undefined}
            title={items.length > 0 ? "Click to edit achievements" : undefined}
            style={{ cursor: items.length > 0 ? "pointer" : "default" }}
          >
          {items.length === 0 ? (
            <div
              className="cv-preview-empty cv-preview-text cv-preview-text--muted cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={() => {
                setSeedOnOpen(true);
                setInitialItemId(undefined);
                publishActiveTarget("modal");
                setIsModalOpen(true);
                setTimeout(() => {
                  try {
                    const el = document.getElementById(
                      "achievement-text-0",
                    ) as HTMLInputElement | null;
                    el?.focus();
                  } catch {
                    /* noop */
                  }
                }, 60);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSeedOnOpen(true);
                  setInitialItemId(undefined);
                  publishActiveTarget("modal");
                  setIsModalOpen(true);
                  setTimeout(() => {
                    try {
                      const el = document.getElementById(
                        "achievement-text-0",
                      ) as HTMLInputElement | null;
                      el?.focus();
                    } catch {
                      /* noop */
                    }
                  }, 60);
                }
              }}
              aria-label="Add your first achievement"
              title="Click to add your first achievement"
            >
              Add key wins, awards, or standout results
            </div>
          ) : isExpanded ? (
            <AchievementsDisplay
              itemId={String(section.id)}
              items={items}
              separatedItems={true}
              className="achievements-display--editorial"
            />
          ) : (
            <AchievementsDisplay
              itemId={String(section.id)}
              items={items}
              maxItems={2}
              separatedItems={true}
              className="achievements-display--editorial"
            />
          )}
        </div>
        </div>

        {items.length > 2 ? (
          <div className="cv-disclosure-row">
            <button
              type="button"
              aria-controls={contentId}
              aria-expanded={isExpanded}
              onClick={() => setIsExpanded((v) => !v)}
              className="dasti-icon-button dasti-icon-button--compact"
              title={isExpanded ? "Show less" : "Show more"}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" aria-hidden />
              )}
            </button>
          </div>
        ) : null}
      </div>

      <AchievementsModal
        open={isModalOpen}
        items={items}
        initialItemId={initialItemId}
        appendBlankOnOpen={seedOnOpen}
        onClose={() => {
          setIsModalOpen(false);
          setInitialItemId(undefined);
          setSeedOnOpen(false);
          clearActiveTarget();
        }}
        onSave={handleSave}
      />
    </div>
  );
}

export default AchievementsBlock;
