import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import type { CvBlock, CvSection } from "../../types/cvDocument";
import type { RemirrorJSON } from "remirror";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import { RichSummary } from "../cv-display/RichSummary";
import { ReadOnlyRichDoc } from "../cv-display/ReadOnlyRichDoc";
import { AchievementsDisplay } from "../cv-display/AchievementsDisplay";
import RemirrorEditor from "../remirror-editor/RemirrorEditor";
import { ensureRemirrorDoc } from "../remirror-editor/utils/conversion";
import { docToPlainText } from "../remirror-editor/utils/text";
import { useBlockFlushSubscription } from "../../hooks/use-flush-subscription";
// Debug logging toggle (enable with window.__CV_EDITOR_DEBUG__ = true)
const DEBUG_CV_EDITOR = typeof window !== "undefined" && (window as any).__CV_EDITOR_DEBUG__ === true;
function dbg(...args: any[]) {
  if (DEBUG_CV_EDITOR) {

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
      const next = { ...prev, [id]: !prev[id] };
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

      console.warn("[BlockRenderer] No linkedItem found for linkedStructuredId", {
        linkedStructuredId,
        blockId: block?.id,
        sectionId,
      });
      return null;
    } catch (err) {

      console.error("[BlockRenderer] Error computing linkedItem", err);
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Pre-existing dependency contract is preserved for this release-gate cleanup.
  }, [linkedStructuredId, section, currentCv]);

  useEffect(() => {
    try {
      // Only log when debug mode is enabled to reduce console spam
      if (DEBUG_CV_EDITOR) {

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
  const genericPreviewDoc = useMemo(() => {
    try {
      return ensureRemirrorDoc((block as any)?.content as any);
    } catch {
      return null;
    }
  }, [block]);
  const trimmedTitle = String(block.title ?? "").trim();
  const showGenericBody =
    extractedPlainText.length > 0 &&
    (!trimmedTitle || extractedPlainText.trim().toLowerCase() !== trimmedTitle.toLowerCase());



  // Mount/unmount diagnostics with stable mount id
  const mountIdRef = useRef<string>(
    (typeof globalThis !== "undefined" &&
      (globalThis as any).crypto &&
      typeof (globalThis as any).crypto.randomUUID === "function")
      ? (globalThis as any).crypto.randomUUID()
      : String(Math.random())
  );
  useEffect(() => {

    console.debug("[BlockRenderer] mount", { mountId: mountIdRef.current, sectionId, blockId: block?.id, linkedStructuredId });
    return () => {

      // eslint-disable-next-line react-hooks/exhaustive-deps -- Pre-existing dependency contract is preserved for this release-gate cleanup.
      console.debug("[BlockRenderer] unmount", { mountId: mountIdRef.current, sectionId, blockId: block?.id });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dev-only diagnostic: surface whether this renderer is running in v1 mode and link resolution state.
  useEffect(() => {
    try {

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Pre-existing dependency contract is preserved for this release-gate cleanup.
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
      const basePayload = { sectionId, block, linkedStructured: linkedItem };


      console.debug("[BlockRenderer] handleEditClick", {
        sectionId,
        blockId: String(block?.id),
        linkedId: linkedId ? String(linkedId) : null,
        hasLinkedItem: Boolean(linkedItem),
        isStructuredSection,
      });

      if (typeof openInspector !== "function") {

        console.error("[BlockRenderer] openInspector is not a function", { openInspector });
        return;
      }
      openInspector(basePayload as any);
    } catch (err) {

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
                : "p-3 [background:var(--sfr)] border [border-color:var(--color-border)] rounded [color:var(--ti)]"
            }
          >
            {linkedItem && section ? (
              <RichSummary item={linkedItem} sectionType={section.type} />
            ) : (
              <>
                {trimmedTitle ? (
                  <p className="cv-entry-title cv-entry-title--truncate">{trimmedTitle}</p>
                ) : null}
                {showGenericBody && genericPreviewDoc ? (
                  <div className={trimmedTitle ? "mt-2" : undefined}>
                    <ReadOnlyRichDoc doc={genericPreviewDoc} />
                  </div>
                ) : (
                  <p className="cv-entry-body cv-entry-body--muted">
                    {trimmedTitle || extractedPlainText.slice(0, 100) || "Block Content"}
                  </p>
                )}
              </>
            )}
            {section?.type === "experience" ? (() => {
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
              const linkedAchievements = Array.isArray((effectiveLinkedItem as any)?.achievements)
                ? ((effectiveLinkedItem as any).achievements as unknown[]).filter(Boolean)
                : [];

              const responsibilities = (effectiveLinkedItem as any)?.responsibilities as unknown;
              let responsibilitiesDoc: RemirrorJSON | null = null;
              try {
                if (typeof responsibilities !== "undefined" && responsibilities !== null) {
                  responsibilitiesDoc = ensureRemirrorDoc(responsibilities as any);
                }
              } catch {
                responsibilitiesDoc = null;
              }
              const responsibilitiesText = responsibilitiesDoc ? docToPlainText(responsibilitiesDoc) : "";
              const hasResponsibilitiesPreview = responsibilitiesText.trim().length > 0;

              const seedPlaceholder = "Start typing here…";
              const rawFallbackText = (block as any)?.plainText ?? extractPlainTextFromRemirror((block as any)?.content as any);
              const fallbackText = typeof rawFallbackText === "string" ? rawFallbackText : "";
              const isSeed = fallbackText.replace(/\s+/g, " ").trim() === seedPlaceholder;
              const fallbackDoc = fallbackText && !isSeed ? ensureRemirrorDoc(fallbackText) : null;

              console.debug("[BlockRenderer] ExperiencePreviewMount", {
                itemId: String((((effectiveLinkedItem as any)?.id ?? (linkedItem as any)?.id) ?? block?.id) ?? ""),
                linkedAchievements,
                hasResponsibilitiesPreview,
                responsibilitiesType: responsibilities === null ? "null" : typeof responsibilities,
                fallbackText,
                isSeed,
                linkedItem,
                effectiveLinkedItem,
                linkedStructuredId,
              });

              if (hasResponsibilitiesPreview) {
                return (
                  <div className="mt-2">
                    <ReadOnlyRichDoc doc={responsibilitiesDoc ?? undefined} />
                  </div>
                );
              }
              if (Array.isArray(linkedAchievements) && linkedAchievements.length > 0) {
                return (
                  <div className="mt-2">
                    <AchievementsDisplay
                      itemId={String((((effectiveLinkedItem as any)?.id ?? (linkedItem as any)?.id) ?? block?.id) ?? "")}
                      items={linkedAchievements}
                    />
                  </div>
                );
              }
              if (fallbackDoc) {
                return (
                  <div className="mt-2">
                    <ReadOnlyRichDoc doc={fallbackDoc} />
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
            className="px-2 py-1 text-sm [color:var(--ert)] [background:var(--erb)] border border-[color:var(--er)] rounded [box-shadow:var(--sha)] hover:[background:var(--er)] hover:[color:var(--color-on-accent)] focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
          >
            Delete Block
          </button>
        </div>
      )}
    </div>
  );
}
