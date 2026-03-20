import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import type { CvBlock, CvSection } from "../../types/cvDocument";
import type { RemirrorJSON } from "remirror";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import { RichSummary } from "../cv-display/RichSummary";
import { AchievementsDisplay } from "../cv-display/AchievementsDisplay";
import RemirrorEditor from "../remirror-editor/RemirrorEditor";
import { ensureRemirrorDoc } from "../remirror-editor/utils/conversion";
import { useBlockFlushSubscription } from "../../hooks/use-flush-subscription";
// Debug logging toggle (enable with window.__CV_EDITOR_DEBUG__ = true)
const DEBUG_CV_EDITOR = typeof window !== "undefined" && (window as any).__CV_EDITOR_DEBUG__ === true;
function dbg(...args: any[]) {
  if (DEBUG_CV_EDITOR) {
    // eslint-disable-next-line no-console
    console.debug(...args);
  }
}

/**
 * BlockRenderer
 *
 * Editable renderer for a single CvBlock.
 * Wraps the existing RemirrorEditor but wires section changes back to the
 * CvLibraryContext.updateBlockContent so edits persist.
 */
export interface BlockRendererProps {
  sectionId: string;
  block: CvBlock;
  onDelete?: () => void;
  disableChevron?: boolean;
}

export default React.memo(BlockRenderer);

export function BlockRenderer({ sectionId, block, onDelete, disableChevron = false }: BlockRendererProps) {
  const {
    updateBlockContent,
    updateBlockTitle,
    currentCv,
    isV1Active,
    openInspector,
    activeEditorBlockId,
    setActiveEditorBlockId,
    selectedInspector,
  } = useCvLibrary();
 
  function handleSectionChange(_index: number, updatedSection: any) {
    try {
      if (!sectionId || !block?.id || !(updatedSection as any)?.content) return;
 
      const newContent = ensureRemirrorDoc((updatedSection as any).content as any);
      void updateBlockContent(sectionId, String(block.id), newContent);
 
      if ((updatedSection as any).title && (updatedSection as any).title !== block.title) {
        void updateBlockTitle(sectionId, String(block.id), (updatedSection as any).title);
      }
    } catch (err) {
      console.error("[BlockRenderer] handleSectionChange failed", err);
    }
  }
 
  const sectionForEditor: any = useMemo(
    () => ({
      id: block.id ?? sectionId,
      title: block.title ?? "",
      type: "text",
      blocks: [],
      content: ensureRemirrorDoc((block as any).content),
      structuredContent: null,
    }),
    [block, sectionId]
  );

  const storageKey = useMemo(
    () => `cv:collapsed:${currentCv?.id ?? "global"}`,
    [currentCv?.id]
  );

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const pendingUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) setCollapsedSections(JSON.parse(raw));
        else setCollapsedSections({});
      }
    } catch {
      setCollapsedSections({});
    }
  }, [storageKey]);

  function persistCollapsedSections(next: Record<string, boolean>) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      }
    } catch {
      // ignore
    }
  }

  function handleCollapseToggle(id: string) {
    setCollapsedSections((prev) => {
      const next = { ...prev, [id]: !Boolean(prev[id]) };
      persistCollapsedSections(next);
      return next;
    });
  }

  const linkedStructuredId =
    (block as any)?.attributes?.linkedStructuredId ??
    (block as any)?.attributes?.linkedstructuredid;
  
  const section = useMemo(() => {
    return currentCv?.sections?.find(
      (s) => String(s.id) === String(sectionId)
    );
  }, [currentCv?.sections, sectionId]);
  const sectionType = String(section?.type ?? "");
  const showDeleteAction =
    typeof onDelete === "function" &&
    !["experience", "education"].includes(sectionType);

  const isStructuredSection = section?.type === "experience" || section?.type === "education";
  
  const linkedItem = useMemo(() => {
    try {
      if (!linkedStructuredId) {
        // For structured sections (experience/education) a linkedStructuredId is expected.
        // For non-structured blocks it's normal to not have one — avoid noisy warnings there.
        if (isStructuredSection) {
          if (DEBUG_CV_EDITOR) {
            // eslint-disable-next-line no-console
            console.warn("[BlockRenderer] Missing linkedStructuredId for structured block", {
              blockId: block?.id,
              sectionId,
            });
          } else {
            dbg("[BlockRenderer] Missing linkedStructuredId for structured block", {
              blockId: block?.id,
              sectionId,
            });
          }
        } else {
          dbg("[BlockRenderer] no linkedStructuredId for non-structured block", {
            blockId: block?.id,
            sectionId,
          });
        }
        return null;
      }
      // First try the current section's structuredContent
      if (section && Array.isArray(section.structuredContent)) {
        const found = (section.structuredContent as any[]).find(
          (it) => String(it?.id) === String(linkedStructuredId)
        );
        if (found) return found;
      }
      // Fallback: search all sections in currentCv
      if (currentCv && Array.isArray(currentCv.sections)) {
        for (const s of currentCv.sections) {
          if (!Array.isArray(s?.structuredContent)) continue;
          const found = (s.structuredContent as any[]).find(
            (it) => String(it?.id) === String(linkedStructuredId)
          );
          if (found) return found;
        }
      }
      // eslint-disable-next-line no-console
      console.warn("[BlockRenderer] No linkedItem found for linkedStructuredId", {
        linkedStructuredId,
        blockId: block?.id,
        sectionId,
      });
      return null;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[BlockRenderer] Error computing linkedItem", err);
      return null;
    }
  }, [linkedStructuredId, section, currentCv]);

  useEffect(() => {
    try {
      // Only log when debug mode is enabled to reduce console spam
      if (DEBUG_CV_EDITOR) {
        // eslint-disable-next-line no-console
        console.debug("[BlockRenderer] linkedItem (stable log)", {
          linkedStructuredId,
          linkedItem,
          sectionStructuredContent: section?.structuredContent,
          sectionsCount: currentCv?.sections?.length ?? 0,
        });
      }
    } catch (e) {
      // noop
    }
  }, [linkedStructuredId, linkedItem, section?.structuredContent, currentCv?.sections?.length]);

  // Small helper: extract visible plain text from a Remirror JSON doc.
  function extractPlainTextFromRemirror(json: RemirrorJSON | undefined) {
    if (!json || typeof json !== "object") return "";
    const parts: string[] = [];
    function walk(node: any) {
      if (!node) return;
      if (typeof node.text === "string") parts.push(node.text);
      if (Array.isArray(node.content)) node.content.forEach(walk);
      if (Array.isArray(node.items)) node.items.forEach(walk);
    }
    walk(json as any);
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  // Derived plain-text for blocks that don't include plainText.
  const extractedPlainText = useMemo(() => {
    try {
      const pt = (block as any)?.plainText;
      if (pt) return String(pt);
      const json = (block as any)?.content as RemirrorJSON | undefined;
      return extractPlainTextFromRemirror(json);
    } catch {
      return "";
    }
  }, [block]);



  // Mount/unmount diagnostics with stable mount id
  const mountIdRef = useRef<string>(
    (typeof globalThis !== "undefined" &&
      (globalThis as any).crypto &&
      typeof (globalThis as any).crypto.randomUUID === "function")
      ? (globalThis as any).crypto.randomUUID()
      : String(Math.random())
  );
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.debug("[BlockRenderer] mount", { mountId: mountIdRef.current, sectionId, blockId: block?.id, linkedStructuredId });
    return () => {
      // eslint-disable-next-line no-console
      console.debug("[BlockRenderer] unmount", { mountId: mountIdRef.current, sectionId, blockId: block?.id });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dev-only diagnostic: surface whether this renderer is running in v1 mode and link resolution state.
  useEffect(() => {
    try {
      // eslint-disable-next-line no-console
      console.debug("[BlockRenderer] v1-render-debug", {
        mountId: mountIdRef.current,
        sectionId,
        blockId: String(block?.id ?? null),
        sectionType: section?.type ?? null,
        isV1Active,
        linkedStructuredId,
        hasLinkedItem: Boolean(linkedItem),
        selectedInspectorBlockId: selectedInspector?.block?.id ?? null,
      });
    } catch {
      /* noop */
    }
  }, [isV1Active, section?.type, linkedItem, block?.id, linkedStructuredId, selectedInspector?.block?.id]);

  useEffect(() => {
    try {
      // Render-time snapshot for debugging
      dbg("BlockRenderer render", { block, section, linkedItem });
      if (DEBUG_CV_EDITOR) {
        dbg("[BlockRenderer] linkedItem change", {
          blockId: String(block?.id),
          linkedStructuredId,
          linkedItem,
          sectionStructured: section?.structuredContent,
          selectedInspectorBlockId: selectedInspector?.block?.id ?? null,
        });
        // eslint-disable-next-line no-console
        console.debug("[BlockRenderer] linkedItem debug", { blockId: String(block?.id), linkedStructuredId, linkedItem });
      }
    } catch (e) {
      /* noop */
    }
  }, [block, section, linkedItem, linkedStructuredId, section?.structuredContent, selectedInspector?.block?.id, block?.id]);

  // Register a no-op block flush subscription to participate in global flush without churn.
  // Inline renderer itself doesn't need to flush anything eagerly; editors/inspectors handle content persistence.
  useBlockFlushSubscription({
    blockId: block?.id ? String(block.id) : undefined,
    onFlush: () => {
      // intentionally noop
    },
    enabled: Boolean(block?.id),
  });

  const inspectorEditingSame =
    selectedInspector && String(selectedInspector.block?.id) === String(block?.id);

  const isCollapsed = Boolean(collapsedSections[String(block?.id)]);
  const shouldRenderInlineEditor =
    activeEditorBlockId === String(block.id) && !inspectorEditingSame && !isCollapsed && !disableChevron && !isStructuredSection;

  const onPointerDownSetActive = () => {
    try {
      // Do not toggle active editor for structured sections; it can interfere with the Edit button click
      if (!isStructuredSection) {
        setActiveEditorBlockId(String(block.id));
      }
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    try {
      // When inspector closes (inspectorEditingSame becomes false) clear active editor to avoid inline editor/chevron lingering.
      if (!inspectorEditingSame && activeEditorBlockId === String(block?.id)) {
        setActiveEditorBlockId(null);
      }
    } catch {
      /* noop */
    }
  // only depend on these to avoid excessive resets
  }, [inspectorEditingSame, activeEditorBlockId, block?.id, setActiveEditorBlockId]);

  function handleEditClick(e?: React.MouseEvent<HTMLButtonElement>) {
    try {
      if (e) {
        // Prevent DnD and parent handlers from swallowing the click
        e.stopPropagation();
        e.preventDefault();
      }
      const linkedId =
        (block as any)?.attributes?.linkedStructuredId ??
        (block as any)?.attributes?.linkedstructuredid ??
        null;
      const shouldRouteToTypedModal = Boolean(isStructuredSection && linkedItem && linkedId);

      const basePayload = { sectionId, block, linkedStructured: linkedItem };
      const payload = shouldRouteToTypedModal
        ? ({ ...basePayload, openTypedModal: true } as const)
        : basePayload;

      // eslint-disable-next-line no-console
      console.debug("[BlockRenderer] handleEditClick", {
        sectionId,
        blockId: String(block?.id),
        linkedId: linkedId ? String(linkedId) : null,
        hasLinkedItem: Boolean(linkedItem),
        isStructuredSection,
        shouldRouteToTypedModal,
      });

      if (typeof openInspector !== "function") {
        // eslint-disable-next-line no-console
        console.error("[BlockRenderer] openInspector is not a function", { openInspector });
        return;
      }
      // Route to typed modal via context signal when applicable; otherwise open inspector
      // (SelectedBlockInspector will ignore when `openTypedModal` was requested).
      openInspector(payload as any);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[BlockRenderer] handleEditClick error", err);
    }
  }

  return (
    <div className={isStructuredSection ? "" : "mb-2"}>
      <div
        onPointerDown={onPointerDownSetActive}
        // Make sure the container doesn't swallow the click for the Edit button
        onClick={(e) => {
          // If the click originated on the Edit button, let it through
          const target = e.target as HTMLElement | null;
          if (target && target.closest('[data-testid^="edit-btn-"]')) {
            return;
          }
        }}
      >
        {shouldRenderInlineEditor ? (
          <RemirrorEditor
            sections={[sectionForEditor]} embedded={true}
            onSectionChange={handleSectionChange}
            onSectionContentChange={(secId: string, json: RemirrorJSON) => {
              try {
                if (pendingUpdateRef.current) {
                  clearTimeout(pendingUpdateRef.current as ReturnType<typeof setTimeout>);
                  pendingUpdateRef.current = null;
                }
                // Replace zero-timeout with a short debounce to reduce remount/update churn
                pendingUpdateRef.current = setTimeout(() => {
                  try {
                    const newContent = json ?? ensureRemirrorDoc(undefined);
                    void updateBlockContent(sectionId, String(block.id), newContent);
                  } catch {
                    /* noop */
                  } finally {
                    pendingUpdateRef.current = null;
                  }
                }, 300);
              } catch {
                /* noop */
              }
            }}
            onSectionTitleChange={(secId: string, newTitle: string) => {
              try {
                if (typeof updateBlockTitle === "function") {
                  updateBlockTitle(sectionId, String(block.id), newTitle ?? "");
                }
              } catch {
                /* noop */
              }
            }}
            collapsedSections={collapsedSections}
            onCollapseToggle={handleCollapseToggle}
          />
        ) : (
          <div
            className={
              isStructuredSection
                ? "py-3 [color:var(--ti)]"
                : "p-3 [background:var(--sfr)] border border-bo rounded [color:var(--ti)]"
            }
          >
            <div className="flex items-center justify-between">
                {linkedItem && section ? (
                    <RichSummary item={linkedItem} sectionType={section.type} />
                ) : (
                    <p className="text-sm [color:var(--tm2)]">
                        {block.title || extractedPlainText.slice(0, 100) || 'Block Content'}
                    </p>
                )}

                {/* v1: Edit button removed — editing is handled via the typed modal/inspector */}
            </div>
            {section?.type === "experience" ? (() => {
              // Prefer achievements from the resolved structured item when available.
              const linkedAchievements = Array.isArray((linkedItem as any)?.achievements)
                ? (linkedItem as any).achievements as unknown[]
                : null;

              // Defensive: if linkedItem failed to resolve, try a manual lookup using linkedStructuredId across all sections.
              const effectiveLinkedItem = linkedItem ?? (() => {
                try {
                  if (currentCv && linkedStructuredId) {
                    for (const s of currentCv.sections ?? []) {
                      const arr = (s as any)?.structuredContent;
                      if (!Array.isArray(arr)) continue;
                      const found = arr.find((it: any) => String(it?.id) === String(linkedStructuredId));
                      if (found) return found;
                    }
                  }
                } catch {
                  /* noop */
                }
                return null;
              })();

              // If achievements are empty, try responsibilities from the structured item (typed modal field).
              // This can be a Remirror JSON object, JSON string, plain string, or an array of those.
              const responsibilities = (effectiveLinkedItem as any)?.responsibilities as unknown;
              const responsibilitiesItems = responsibilities
                ? (Array.isArray(responsibilities) ? responsibilities : [responsibilities])
                : null;

              // Fallback: if still nothing, present the block's own plainText or extracted Remirror text.
              const seedPlaceholder = "Start typing here…";
              const rawFallbackText = (block as any)?.plainText ?? extractPlainTextFromRemirror((block as any)?.content as any);
              const fallbackText = typeof rawFallbackText === "string" ? rawFallbackText : "";
              const isSeed = fallbackText.replace(/\s+/g, " ").trim() === seedPlaceholder;
              const fallbackAchievements = fallbackText && !isSeed ? [fallbackText] as unknown[] : null;

              const itemsToShow =
                (Array.isArray(linkedAchievements) && linkedAchievements.length > 0 ? linkedAchievements : null)
                ?? responsibilitiesItems
                ?? fallbackAchievements;

              // Debug snapshot
              console.debug("[BlockRenderer] AchievementsMount", {
                itemId: String((((effectiveLinkedItem as any)?.id ?? (linkedItem as any)?.id) ?? block?.id) ?? ""),
                linkedAchievements,
                hasResponsibilities: Boolean(responsibilities),
                responsibilitiesType: responsibilities === null ? "null" : typeof responsibilities,
                fallbackText,
                usedFallback: Boolean(!linkedAchievements && !responsibilitiesItems && fallbackAchievements),
                isSeed,
                itemsToShow,
                linkedItem,
                effectiveLinkedItem,
                linkedStructuredId,
              });

              if (Array.isArray(itemsToShow) && itemsToShow.length > 0) {
                return (
                  <div className="mt-2">
                    <AchievementsDisplay
                      itemId={String((((effectiveLinkedItem as any)?.id ?? (linkedItem as any)?.id) ?? block?.id) ?? "")}
                      items={itemsToShow}
                    />
                  </div>
                );
              }
              return null;
            })() : null}
        </div>
        )}
      </div>
  
      {showDeleteAction && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => {
              try {
                onDelete();
              } catch {
                /* noop */
              }
            }}
            className="px-2 py-1 text-sm [color:var(--ert)] [background:var(--erb)] border border-[color:var(--er)] rounded [box-shadow:var(--sha)] hover:[background:var(--er)] hover:[color:var(--op)] focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
          >
            Delete Block
          </button>
        </div>
      )}
    </div>
  );
}
