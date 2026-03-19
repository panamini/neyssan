import React, { useMemo, useState } from "react";
import type { CvSection } from "../../schemas/cvDocument.schema";
import AchievementsDisplay from "../cv-display/AchievementsDisplay";
import AchievementsModal from "./AchievementsModal";
import { Trash2, Plus } from "lucide-react";
import { docToPlainText } from "../remirror-editor/utils/text";

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
}

export function AchievementsBlock({ section, onChange }: AchievementsBlockProps) {
  const items = useMemo(() => {
    const normalizedItems: Array<{ id: string; text: string }> = [];
    const seenTexts = new Set<string>();

    const pushItem = (rawText: unknown, rawId?: unknown) => {
      const text = String(rawText ?? "").trim();
      if (!text) return;
      const dedupeKey = text.toLowerCase();
      if (seenTexts.has(dedupeKey)) return;
      seenTexts.add(dedupeKey);
      normalizedItems.push({
        id: typeof rawId === "string" && rawId.trim().length > 0
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
          pushItem(o.text ?? o.achievement ?? "", o.id);
        });
      }

      if (Array.isArray(section.blocks)) {
        section.blocks.forEach((block) => {
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

          if (!blockText && typeof (block as any)?.title === "string" && !/^Achievement\s+\d+$/i.test(String((block as any).title))) {
            blockText = String((block as any).title);
          }

          pushItem(
            blockText,
            (block as any)?.attributes?.linkedStructuredId ?? (block as any)?.id,
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
  // When true and list is empty, seed the modal with a blank row and focus it.
  const [seedOnOpen, setSeedOnOpen] = useState(false);
  const [isClearConfirming, setIsClearConfirming] = useState(false);
  const contentId = useMemo(() => `ach-content-${String(section.id)}`, [section.id]);

  function handleSave(next: Array<{ id?: string; text: string }>) {
    try {
      const sanitized = next.map((r, idx) => ({ id: String(r.id ?? `ach-${Math.random().toString(36).slice(2, 8)}-${idx}`), text: String(r.text ?? "").trim() }))
        .filter((r) => r.text.length > 0);
      const updatedSection = { ...section, structuredContent: sanitized as any, blocks: [] as any };
      onChange(updatedSection as CvSection);
    } finally {
      setIsModalOpen(false);
      setSeedOnOpen(false);
    }
  }

  function handleClear() {
    try {
      const updated = { ...section, structuredContent: [] as any, blocks: [] as any };
      onChange(updated as CvSection);
    } catch {
      /* noop */
    }
  }

  // Collapsed preview handled by AchievementsDisplay via maxItems prop

  return (
    <div className="mb-4 border border-bo rounded-rm section-container">
      <div className="flex items-center justify-between p-3 [background:var(--sf1)]">
        <h3 className="text-lg font-semibold">{section.title}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSeedOnOpen(true);
              setIsModalOpen(true);
            }}
            className="dasti-icon-button"
            aria-label="Add achievement"
            title="Add achievement"
          >
            <Plus className="w-4 h-4" aria-hidden />
          </button>
          {isClearConfirming ? (
            <span className="sb-doc-confirm" style={{ gap: "var(--s2)" }}>
              <span className="sb-doc-confirm__label" style={{ fontSize: "var(--tx)" }}>Clear all?</span>
              <button type="button" className="sb-doc-confirm__yes" onClick={(e) => { e.stopPropagation(); setIsClearConfirming(false); handleClear(); }}>Clear</button>
              <button type="button" className="sb-doc-confirm__no" onClick={(e) => { e.stopPropagation(); setIsClearConfirming(false); }}>Cancel</button>
            </span>
          ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsClearConfirming(true); }}
            className="dasti-icon-button dasti-icon-button--danger"
            aria-label="Clear achievements"
            title="Clear achievements"
          >
            <Trash2 className="w-4 h-4" aria-hidden />
          </button>
          )}
        </div>
      </div>

      <div className="p-4">
        <div
          id={contentId}
          role="region"
          aria-expanded={isExpanded}
          className="text-sm [color:var(--ti)]"
          onClick={() => {
            if (items.length === 0) return;
            setSeedOnOpen(false);
            setIsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (items.length === 0) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSeedOnOpen(false);
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
              className="[color:var(--tg2)] cursor-text"
              role="button"
              tabIndex={0}
              onClick={() => {
                setSeedOnOpen(true);
                setIsModalOpen(true);
                setTimeout(() => {
                  try {
                    const el = document.getElementById("achievement-text-0") as HTMLInputElement | null;
                    el?.focus();
                  } catch { /* noop */ }
                }, 60);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSeedOnOpen(true);
                  setIsModalOpen(true);
                  setTimeout(() => {
                    try {
                      const el = document.getElementById("achievement-text-0") as HTMLInputElement | null;
                      el?.focus();
                    } catch { /* noop */ }
                  }, 60);
                }
              }}
              aria-label="Add your first achievement"
              title="Click to add your first achievement"
            >
              No achievements yet — click to start typing
            </div>
          ) : isExpanded ? (
            <AchievementsDisplay itemId={String(section.id)} items={items} />
          ) : (
            <AchievementsDisplay itemId={String(section.id)} items={items} maxItems={2} />
          )}
        </div>

        {items.length > 2 ? (
          <div className="flex items-center justify-between mt-3">
            <button
              type="button"
              aria-controls={contentId}
              aria-expanded={isExpanded}
              onClick={() => setIsExpanded((v) => !v)}
              className="px-2 py-1 text-xs rounded [background:transparent] [color:var(--tm2)] hover:[background:var(--sf2)] hover:[color:var(--ti)] focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
            >
              {isExpanded ? "Read less" : "Read more"}
            </button>
          </div>
        ) : null}
      </div>

      <AchievementsModal
        open={isModalOpen}
        items={items}
        appendBlankOnOpen={seedOnOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSeedOnOpen(false);
        }}
        onSave={handleSave}
      />
    </div>
  );
}

export default AchievementsBlock;
