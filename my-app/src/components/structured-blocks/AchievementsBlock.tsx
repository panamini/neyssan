import React, { useMemo, useState } from "react";
import type { CvSection } from "../../schemas/cvDocument.schema";
import AchievementsDisplay from "../cv-display/AchievementsDisplay";
import AchievementsModal from "./AchievementsModal";
import { Pencil, Trash2 } from "lucide-react";

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
    try {
      if (!Array.isArray(section.structuredContent)) return [];
      return (section.structuredContent as any[]).map((it) => {
        // support legacy string items as well as object { id, text }
        if (typeof it === "string") {
          return { id: `ach-${Math.random().toString(36).slice(2, 8)}`, text: String(it) };
        }
        const o = it as { id?: string; text?: string; achievement?: string };
        const id = String(o.id ?? `ach-${Math.random().toString(36).slice(2, 8)}`);
        const text = String(o.text ?? o.achievement ?? "");
        return { id, text };
      });
    } catch {
      return [];
    }
  }, [section.structuredContent]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // When true and list is empty, seed the modal with a blank row and focus it.
  const [seedOnOpen, setSeedOnOpen] = useState(false);
  const contentId = useMemo(() => `ach-content-${String(section.id)}`, [section.id]);

  function handleSave(next: Array<{ id?: string; text: string }>) {
    try {
      // sanitize
      const sanitized = next.map((r, idx) => ({ id: String(r.id ?? `ach-${Math.random().toString(36).slice(2, 8)}-${idx}`), text: String(r.text ?? "").trim() }))
        .filter((r) => r.text.length > 0);
      const updatedSection = { ...section, structuredContent: sanitized as any };
      onChange(updatedSection as CvSection);
    } finally {
      setIsModalOpen(false);
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
              setIsModalOpen(true);
            }}
            className="p-1 rounded [background:transparent] [color:var(--tm2)] hover:[color:var(--ti)] hover:[background:var(--sf2)] focus:outline-none [transition:all_.12s_var(--ez)]"
            aria-label="Edit achievements"
            title="Edit achievements"
          >
            <Pencil className="w-4 h-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              try {
                if (typeof window !== "undefined") {
                  const confirmClear = window.confirm("Clear achievements? This will remove all achievement items.");
                  if (!confirmClear) return;
                }
              } catch {}
              handleClear();
            }}
            className="p-1 rounded [background:transparent] [color:var(--tm2)] hover:[color:var(--ti)] hover:[background:var(--sf2)] focus:outline-none [transition:all_.12s_var(--ez)]"
            aria-label="Clear achievements"
            title="Clear achievements"
          >
            <Trash2 className="w-4 h-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="p-4">
        <div id={contentId} role="region" aria-expanded={isExpanded} className="text-sm [color:var(--ti)]">
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
        // Seed a blank row when opening from the empty-state click
        items={isModalOpen && seedOnOpen && items.length === 0 ? [{ id: "ach-temp-0", text: "" }] : items}
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