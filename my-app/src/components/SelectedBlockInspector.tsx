import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CvBlock } from "../types/cvDocument";
import type { RemirrorJSON } from "remirror";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import RemirrorEditor from "./remirror-editor/RemirrorEditor";
import { ensureRemirrorDoc, remirrorJsonToStructuredFields } from "./remirror-editor/utils/conversion";
import { useBlockFlushSubscription } from "../hooks/use-flush-subscription";
import dbg from "../lib/cv-debug";
import { parseIsoToParts, composeIsoFromParts } from "../lib/date-utils";

interface SelectedBlockInspectorProps {
  // sectionId, block, and linkedStructured are now read from the context.
  // The component is rendered at a higher level (e.g., ProfileReviewCard)
  // and its visibility is controlled by `selectedInspector` from CvLibraryContext.
  onClose: () => void; // still needed for the close button
}

/**
 * SelectedBlockInspector
 *
 * Modal inspector that allows editing of a structured item (experience/education)
 * and the underlying block content. Keeps updates atomic by calling
 * updateStructuredItem and updateBlockContent from the CvLibraryContext.
 */
export function SelectedBlockInspector({ onClose }: SelectedBlockInspectorProps) {
  const {
    updateStructuredItem,
    updateBlockContent,
    updateBlockTitle,
    selectedInspector,
    setActiveEditorBlockId,
    currentCv,
  } = useCvLibrary();
 
  const sectionId = selectedInspector?.sectionId;
  const block = selectedInspector?.block;
  const linkedStructured = selectedInspector?.linkedStructured;
  // Trace current selection snapshot
  dbg("[SelectedBlockInspector] selection snapshot", {
    hasSelected: Boolean(selectedInspector),
    sectionId,
    blockId: block?.id ?? null,
    hasLinkedStructured: Boolean(linkedStructured),
  });

  // Fallback: if linkedStructured was not provided (or got lost), try to resolve it
  // from the current document using the block's attributes.linkedStructuredId.
  const linkedIdAttr = useMemo(() => {
    try {
      return (block as any)?.attributes?.linkedStructuredId ?? (block as any)?.attributes?.linkedstructuredid ?? null;
    } catch {
      return null;
    }
  }, [block]);

  const fallbackLinked = useMemo(() => {
    try {
      if (linkedStructured || !linkedIdAttr || !currentCv) return null;
      // 1) Prefer the currently selected section (source-of-truth for this inspector)
      const preferSectionId = selectedInspector?.sectionId ? String(selectedInspector.sectionId) : null;
      if (preferSectionId) {
        const sec = currentCv.sections?.find((s: any) => String(s.id) === preferSectionId);
        if (sec && Array.isArray((sec as any).structuredContent)) {
          const found = ((sec as any).structuredContent as any[]).find(
            (it: any) => String((it?.id ?? it?._id)) === String(linkedIdAttr)
          );
          if (found) return found;
        }
      }
      // 2) Fallback: search across all sections
      for (const s of currentCv.sections ?? []) {
        if (Array.isArray((s as any).structuredContent)) {
          const found = ((s as any).structuredContent as any[]).find(
            (it: any) => String((it?.id ?? it?._id)) === String(linkedIdAttr)
          );
          if (found) return found;
        }
      }
      return null;
    } catch {
      return null;
    }
  }, [linkedStructured, linkedIdAttr, currentCv?.sections, selectedInspector?.sectionId]);

  const effectiveLinked = linkedStructured ?? fallbackLinked;

  const sectionForEditor = useMemo(() => {
    return {
      id: block?.id ?? sectionId,
      title: block?.title ?? "",
      type: "text",
      blocks: [],
      content: ensureRemirrorDoc(block?.content as string | RemirrorJSON | null | undefined),
      structuredContent: null,
    } as any;
  }, [block, sectionId]);
  
  // Local, staged state — parent remains the source of truth until we flush.
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [pendingBlockContent, setPendingBlockContent] = useState<RemirrorJSON | null>(null);
  // Debounce handle for live-syncing editor -> structured fields/block content
  const pendingSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevent closing while commit is running to avoid losing the commit race
  const [isCommitting, setIsCommitting] = useState(false);
  // Track whether the user edited the embedded Title during this inspector session.
  const titleEditedRef = useRef<boolean>(false);
  // Reset the flag when switching to a different block
  useEffect(() => {
    titleEditedRef.current = false;
  }, [block?.id]);

  // Derive section type for heuristics (experience/education/etc.)
  const sectionType = useMemo(() => {
    try {
      const sid = selectedInspector?.sectionId;
      if (!sid || !currentCv) return undefined;
      const sec = currentCv.sections?.find((s: any) => String(s.id) === String(sid));
      return sec?.type;
    } catch {
      return undefined;
    }
  }, [selectedInspector?.sectionId, currentCv?.sections]);

  // Resolve sectionId from the live document when the selected one is missing or stale.
  const resolvedSectionId = useMemo(() => {
    try {
      if (sectionId) return String(sectionId);
      const bid = String((block as any)?.id ?? "");
      if (!bid || !currentCv) return undefined;
      for (const s of currentCv.sections ?? []) {
        const has = Array.isArray((s as any)?.blocks)
          ? (s as any).blocks.some((b: any) => String(b?.id) === bid)
          : false;
        if (has) return String(s.id);
      }
      return sectionId ?? undefined;
    } catch {
      return sectionId ?? undefined;
    }
  }, [sectionId, block?.id, currentCv?.sections]);

  useEffect(() => {
    if (effectiveLinked) {
      try {
        const raw = effectiveLinked as Record<string, any>;
        const normalized: Record<string, any> = { ...raw };

        // Normalize common string fields to non-null strings
        const strKeys = [
          "company",
          "position",
          "location",
          "institution",
          "degree",
          "fieldOfStudy",
          "grade",
          "title",
          "name",
          "email",
          "linkedin",
          "address",
        ];
        for (const k of strKeys) {
          if (normalized[k] === undefined || normalized[k] === null) normalized[k] = "";
          else if (typeof normalized[k] !== "string") normalized[k] = String(normalized[k] ?? "");
        }

        // Normalize achievements to an array of strings (experience)
        if (Array.isArray(normalized.achievements)) {
          normalized.achievements = normalized.achievements.map((s: any) => String(s ?? "").trim()).filter(Boolean);
        } else if (typeof normalized.achievements === "string") {
          normalized.achievements = String(normalized.achievements)
            .split(/\n/)
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          normalized.achievements = Array.isArray(normalized.achievements) ? normalized.achievements : [];
        }

        // Dates are kept as stored (ISO or null/undefined). Inputs format them via asDateInput().
        // Deep-clone to detach from any proxies and keep local formState stable
        const deep = JSON.parse(JSON.stringify(normalized));

        // Initialize Present toggle (prefer explicit flags)
        const isCurrentInit = Boolean(deep.isCurrent ?? deep.currentlyWorking ?? false);

        // Derive UI date parts from stored ISO + precision
        const sp = parseIsoToParts(deep.startDate);
        const ep = parseIsoToParts(deep.endDate);
        const startPrec = (deep as any).startDatePrecision as "year" | "month" | "day" | undefined;
        const endPrec = (deep as any).endDatePrecision as "year" | "month" | "day" | undefined;
        const startShowDay = startPrec === "day";
        const endShowDay = endPrec === "day";

        setFormState({
          ...deep,
          isCurrent: isCurrentInit,
          // start
          startYear: sp.year ?? "",
          startMonth: sp.month ?? "",
          startDay: startShowDay ? (sp.day ?? "") : "",
          startShowDay,
          startDatePrecision: startPrec,
          // end
          endYear: ep.year ?? "",
          endMonth: ep.month ?? "",
          endDay: endShowDay ? (ep.day ?? "") : "",
          endShowDay,
          endDatePrecision: endPrec,
        });
        try {
          dbg("[DBG][Inspector] formState initialized", {
            keys: Object.keys(deep),
            preview: JSON.stringify({
              company: deep.company,
              position: deep.position,
              location: deep.location,
              achievementsLen: Array.isArray(deep.achievements) ? deep.achievements.length : undefined,
              institution: deep.institution,
              degree: deep.degree,
              fieldOfStudy: deep.fieldOfStudy,
              grade: deep.grade,
              startDate: deep.startDate,
              endDate: deep.endDate,
            }),
          });
        } catch { /* noop */ }
      } catch {
        setFormState({ ...effectiveLinked });
      }
    }
    if (block) {
      setPendingBlockContent(ensureRemirrorDoc(block.content as string | RemirrorJSON | null | undefined));
    }
  }, [effectiveLinked, block]);
  
  // Preserve hook order by deferring guard to render phase.
  // Allow render when the block is present; section id will be resolved lazily.
  const canRenderInspector = Boolean(block);

  function handleFieldChange(key: string, value: any) {
    // Only update local staged state here — avoid per-keystroke writes to context.
    setFormState((prev) => ({ ...prev, [key]: value }));
  }
  
const flushAllChanges = async (mode: 'auto' | 'commit' = 'auto') => {
  const linkedIdRaw = String((effectiveLinked as any)?.id ?? (effectiveLinked as any)?._id ?? "");
  // eslint-disable-next-line no-console
  dbg("[DBG][Inspector] flushAllChanges start", {
    sectionId,
    resolvedSectionId,
    blockId: block?.id,
    linkedIdRaw,
    mode,
  });
  const isCommit = mode === 'commit';

  // Helpers to resolve the correct owning section for a structured item or block
  function resolveSectionIdForStructured(itemId: string | null | undefined): string | undefined {
    if (!currentCv || !itemId) return sectionId ?? resolvedSectionId ?? undefined;
    // 1) Prefer the currently selected sectionId (source-of-truth for the open inspector)
    if (sectionId) {
      const s = currentCv.sections?.find((sec: any) => String(sec.id) === String(sectionId));
      const has = Array.isArray((s as any)?.structuredContent)
        ? (s as any).structuredContent.some((it: any) => String((it?.id ?? it?._id)) === String(itemId))
        : false;
      if (has) return String(sectionId);
    }
    // 2) Next prefer resolvedSectionId (derived by scanning by block id)
    if (resolvedSectionId) {
      const s = currentCv.sections?.find((sec: any) => String(sec.id) === String(resolvedSectionId));
      const has = Array.isArray((s as any)?.structuredContent)
        ? (s as any).structuredContent.some((it: any) => String((it?.id ?? it?._id)) === String(itemId))
        : false;
      if (has) return String(resolvedSectionId);
    }
    // 3) Else search across sections
    for (const sec of currentCv.sections ?? []) {
      const list = (sec as any)?.structuredContent;
      if (Array.isArray(list) && list.some((it: any) => String((it?.id ?? it?._id)) === String(itemId))) {
        return String(sec.id);
      }
    }
    // 4) Fallback (unknown): keep current selection if any, otherwise resolved
    return sectionId ?? resolvedSectionId ?? undefined;
  }

  function resolveSectionIdForBlock(blockId: string | null | undefined): string | undefined {
    if (!currentCv || !blockId) return resolvedSectionId ?? sectionId ?? undefined;
    if (resolvedSectionId) {
      const s = currentCv.sections?.find((sec: any) => String(sec.id) === String(resolvedSectionId));
      const has = Array.isArray((s as any)?.blocks)
        ? (s as any).blocks.some((b: any) => String(b?.id) === String(blockId))
        : false;
      if (has) return String(resolvedSectionId);
    }
    for (const sec of currentCv.sections ?? []) {
      const list = (sec as any)?.blocks;
      if (Array.isArray(list) && list.some((b: any) => String(b?.id) === String(blockId))) {
        return String(sec.id);
      }
    }
    return resolvedSectionId ?? sectionId ?? undefined;
  }

  try {
    // 1) Persist structured form fields only during an explicit commit (Save)
    if (isCommit) {
      try {
        const linkedId = linkedIdRaw || (() => {
          try {
            return String(
              (block as any)?.attributes?.linkedStructuredId ??
              (block as any)?.attributes?.linkedstructuredid ??
              ""
            );
          } catch {
            return "";
          }
        })();

        // Sanitize/trim patch for schema-compat and stable diffs
        function sanitizePatch(raw: Record<string, any>, sType?: string): Record<string, any> {
          const out: Record<string, any> = {};
          const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

          // Text fields
          if (sType === "experience") {
            if (typeof raw.company === "string" && raw.company.trim() !== "") out.company = String(trim(raw.company));
            if (typeof raw.position === "string" && raw.position.trim() !== "") out.position = String(trim(raw.position));
            if (typeof raw.location === "string" && raw.location.trim() !== "") out.location = String(trim(raw.location));
            if (Array.isArray(raw.achievements)) {
              out.achievements = raw.achievements.map((s: any) => String(s ?? "").trim()).filter(Boolean);
            }
          } else if (sType === "education") {
            if (typeof raw.institution === "string" && raw.institution.trim() !== "") out.institution = String(trim(raw.institution));
            if (typeof raw.degree === "string" && raw.degree.trim() !== "") out.degree = String(trim(raw.degree));
            if (typeof raw.fieldOfStudy === "string" && raw.fieldOfStudy.trim() !== "") out.fieldOfStudy = String(trim(raw.fieldOfStudy));
            if (typeof raw.grade === "string" && raw.grade.trim() !== "") out.grade = String(trim(raw.grade));
          }

          // Compose dates from UI parts and preserve precision
          const isCurrent = Boolean(raw.isCurrent);

          const startParts = {
            year: String(raw.startYear ?? "").trim() || undefined,
            month: String(raw.startMonth ?? "").trim() || undefined,
            day: String(raw.startDay ?? "").trim() || undefined,
            precision: raw.startShowDay ? "day" : (raw.startMonth ? "month" : (raw.startYear ? "year" : undefined)),
          } as { year?: string; month?: string; day?: string; precision?: "year" | "month" | "day" };

          const endParts = {
            year: String(raw.endYear ?? "").trim() || undefined,
            month: String(raw.endMonth ?? "").trim() || undefined,
            day: String(raw.endDay ?? "").trim() || undefined,
            precision: raw.endShowDay ? "day" : (raw.endMonth ? "month" : (raw.endYear ? "year" : undefined)),
          } as { year?: string; month?: string; day?: string; precision?: "year" | "month" | "day" };

          const startComposed = composeIsoFromParts(startParts);
          if (startComposed.iso) {
            out.startDate = startComposed.iso;
            out.startDatePrecision = startComposed.precision;
          }

          if (isCurrent) {
            out.isCurrent = true;
            if (sType === "experience") out.currentlyWorking = true;
            out.endDate = null;
            // When Present, precision is not applicable
          } else {
            const endComposed = composeIsoFromParts(endParts);
            if (endComposed.iso) {
              out.endDate = endComposed.iso;
              out.endDatePrecision = endComposed.precision;
            }
          }

          // Map editor content back to structured description fields on commit:
          // - Experience: responsibilities
          // - Education: description
          try {
            const editorDoc = pendingBlockContent ?? ensureRemirrorDoc(block?.content as any);
            const isEmptyDoc = (doc: any): boolean => {
              try {
                const c = doc?.content;
                if (!Array.isArray(c) || c.length === 0) return true;
                if (c.length === 1 && c[0]?.type === "paragraph") {
                  const p = c[0];
                  const t = p?.content;
                  if (!Array.isArray(t) || t.length === 0) return true;
                  if (t.length === 1 && t[0]?.type === "text" && String(t[0]?.text ?? "").trim() === "") return true;
                }
                return false;
              } catch {
                return false;
              }
            };
            if (!isEmptyDoc(editorDoc)) {
              if (sType === "experience") {
                out.responsibilities = editorDoc;
              } else if (sType === "education") {
                out.description = editorDoc;
              }
            }
          } catch {
            // non-fatal
          }

          // Common trims
          if (typeof raw.title === "string" && raw.title.trim() !== "") out.title = String(trim(raw.title));
          if (typeof raw.name === "string" && raw.name.trim() !== "") out.name = String(trim(raw.name));
          if (typeof raw.email === "string" && raw.email.trim() !== "") out.email = String(trim(raw.email));
          if (typeof raw.linkedin === "string" && raw.linkedin.trim() !== "") out.linkedin = String(trim(raw.linkedin));
          if (typeof raw.address === "string" && raw.address.trim() !== "") out.address = String(trim(raw.address));

          return out;
        }

        if (linkedId) {
          const targetSecId = resolveSectionIdForStructured(linkedId);
          const patchRaw = { ...formState };
          const patch = sanitizePatch(patchRaw, sectionType as any);
          dbg("[DBG][Inspector] commit structured patch", {
            targetSecId,
            linkedId,
            patchKeys: Object.keys(patch),
            preview: JSON.stringify({
              company: (patch as any)?.company,
              position: (patch as any)?.position,
              location: (patch as any)?.location,
              achievementsLen: Array.isArray((patch as any)?.achievements) ? (patch as any).achievements.length : undefined,
              institution: (patch as any)?.institution,
              degree: (patch as any)?.degree,
              fieldOfStudy: (patch as any)?.fieldOfStudy,
              grade: (patch as any)?.grade,
              startDate: (patch as any)?.startDate,
              endDate: (patch as any)?.endDate,
            }),
          });
          if (targetSecId) {
            updateStructuredItem(targetSecId, linkedId, patch);
            // Also update block title from structured fields for collapsed view,
            // but NEVER override a non-empty live title. Only backfill when live title is empty.
            try {
              if (block) {
                const titleFromFields = computeTitleFromStructured(patch, sectionType);
                const liveTitle = getLiveBlockTitle(String(block.id)).trim();
                if (liveTitle.length === 0 && titleFromFields && titleFromFields.trim()) {
                  const blockSecId = resolveSectionIdForBlock(String(block.id));
                  if (blockSecId) {
                    updateBlockTitle(blockSecId, String(block.id), titleFromFields.trim());
                    dbg("[SelectedBlockInspector] structured-derived title applied (live empty)", {
                      newTitle: titleFromFields.trim(),
                      previousLiveTitle: liveTitle,
                    });
                  }
                } else {
                  dbg("[SelectedBlockInspector] structured-derived title skipped (live non-empty or candidate empty)", {
                    candidate: titleFromFields?.trim(),
                    liveTitle,
                  });
                }
              }
            } catch { /* noop */ }
          } else {
            dbg("[DBG][Inspector] could not resolve section for structured item", { linkedId });
          }
        } else {
          dbg("[DBG][Inspector] no linked structured id; skipping structured update");
        }
      } catch (err) {
        dbg("[DBG][Inspector] flushAllChanges structured patch failed", err);
      }
    }

    // 2) Persist block content (pendingBlockContent if present) for both auto and commit
    try {
      if (block && (pendingBlockContent || block.content)) {
        const doc = pendingBlockContent ?? ensureRemirrorDoc(block.content as any);
        const blockSecId = resolveSectionIdForBlock(String(block.id));
        if (blockSecId) {
          updateBlockContent(blockSecId, String(block.id), doc);
        } else {
          dbg("[DBG][Inspector] could not resolve section for block content", { blockId: block?.id });
        }
      }
    } catch (err) {
      dbg("[DBG][Inspector] flushAllChanges block content flush failed", err);
    }

    // 3) Clear any pending debounced sync
    try {
      if (pendingSyncRef.current) {
        clearTimeout(pendingSyncRef.current);
        pendingSyncRef.current = null;
      }
    } catch {
      /* noop */
    }

    // 4) Only during explicit commit, derive fields from editor and backfill
    if (isCommit) {
      dbg("[DBG][Inspector] flushAllChanges running runSyncNow");
      try {
        runSyncNow(
          pendingBlockContent ?? ensureRemirrorDoc(undefined as any),
          { allowDeriveTitle: !titleEditedRef.current }
        );
        dbg("[DBG][Inspector] flushAllChanges runSyncNow completed");
      } catch (err) {
        dbg("[DBG][Inspector] flushAllChanges runSyncNow error", err);
      }
    }
  } catch (err) {
    dbg("[DBG][Inspector] flushAllChanges top-level error", err);
  }
}


  // Claim active editor while mounted
  useEffect(() => {
    if (!block?.id) return;
    // log mount claim
    // eslint-disable-next-line no-console
    dbg("[SelectedBlockInspector] mount claim", { blockId: String(block.id) });
    try {
      setActiveEditorBlockId(String(block.id));
    } catch {
      /* noop */
    }
    return () => {
      // Use functional setter to avoid adding activeEditorBlockId to deps
      try {
        // eslint-disable-next-line no-console
        dbg("[SelectedBlockInspector] cleanup attempting to clear activeEditor if still owner", { blockId: String(block.id) });
        setActiveEditorBlockId((prev) => (String(prev) === String(block.id) ? null : prev));
      } catch {
        /* noop */
      }
    };
  }, [block?.id, setActiveEditorBlockId]);

  // Stable block-scoped flush subscription using shared hook to avoid register/unregister churn.
  useBlockFlushSubscription({
    blockId: block?.id ? String(block.id) : undefined,
    onFlush: () => {
      try {
        void flushAllChanges('auto');
      } catch {
        /* noop */
      }
    },
    enabled: Boolean(block?.id),
  });
  
  async function handleSave() {
    if (isCommitting) return;
    setIsCommitting(true);
    dbg("[DBG][Inspector] handleSave: starting commit");
    try {
      await flushAllChanges('commit');
      dbg("[DBG][Inspector] handleSave: commit finished");
    } catch (err) {
      dbg("[DBG][Inspector] handleSave: commit error", err);
    } finally {
      setIsCommitting(false);
      onClose();
    }
  }
  
  function handleCancel() {
    dbg("[SelectedBlockInspector] cancel without save");
    // Discard staged changes by simply closing the inspector
    onClose();
  }
  
  function computeTitleFromStructured(fields: Record<string, any>, sType?: string) {
    if (!fields) return '';
    if (sType === 'experience') return String(fields.position ?? fields.company ?? '').trim();
    if (sType === 'education') return String(fields.institution ?? fields.degree ?? '').trim();
    if (sType === 'summary') return String(fields.name ?? fields.title ?? '').trim();
    return String(fields.title ?? fields.name ?? fields.position ?? fields.company ?? '').trim();
  }
 
  // Normalize input value for <input type="date">
  function asDateInput(v: unknown): string {
    if (v === null || v === undefined) return "";
    const s = String(v).trim();
    if (!s) return "";
    // Hide the epoch sentinel (used to satisfy strict schema) so the input renders blank by default.
    if (s.startsWith("1970-01-01")) return "";
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    return "";
  }

  // Date UI helpers: month-year selects with optional day; preserve precision
  function getYearOptions(): number[] {
    const now = new Date().getUTCFullYear();
    const start = 1950;
    const end = now + 5;
    const years: number[] = [];
    for (let y = end; y >= start; y--) years.push(y);
    return years;
  }

  // moved to ../lib/date-utils: parseIsoToParts, composeIsoFromParts
 
 // Small helper to preview plain text for debug
 function extractPlainText(node: RemirrorJSON | undefined | null): string {
   if (!node || typeof node !== "object") return "";
   const parts: string[] = [];
   function walk(n: any) {
     if (!n) return;
     if (typeof n.text === "string") parts.push(n.text);
     if (Array.isArray(n.content)) n.content.forEach(walk);
     if (Array.isArray(n.items)) n.items.forEach(walk);
   }
   walk(node as any);
   return parts.join(" ").replace(/\s+/g, " ").trim();
 }
 
  function onEditorContentChange(_secId: string, json: RemirrorJSON) {
    // Stage block content changes locally; persist on save/flush and live-sync (debounced).
    const doc = json ?? ensureRemirrorDoc(undefined as any);
    setPendingBlockContent(doc);
 
    if (!block) return;
 
    // Resolve the correct section for this block before live-sync
    function resolveSectionIdForBlock(blockId: string | null | undefined): string | undefined {
      if (!currentCv || !blockId) return sectionId ?? undefined;
      if (resolvedSectionId) {
        const s = currentCv.sections?.find((sec: any) => String(sec.id) === String(resolvedSectionId));
        const has = Array.isArray((s as any)?.blocks)
          ? (s as any).blocks.some((b: any) => String(b?.id) === String(blockId))
          : false;
        if (has) return String(resolvedSectionId);
      }
      for (const sec of currentCv.sections ?? []) {
        const list = (sec as any)?.blocks;
        if (Array.isArray(list) && list.some((b: any) => String(b?.id) === String(block?.id))) {
          return String(sec.id);
        }
      }
      return resolvedSectionId ?? sectionId ?? undefined;
    }
 
    try {
      if (pendingSyncRef.current) clearTimeout(pendingSyncRef.current);
      const preview = extractPlainText(doc).slice(0, 80);
      dbg("[SelectedBlockInspector] onSectionContentChange scheduled", {
        blockId: String(block.id),
        preview,
      });
      pendingSyncRef.current = setTimeout(() => {
        try {
          const blockSecId = resolveSectionIdForBlock(String(block.id));
          if (blockSecId) {
            updateBlockContent(blockSecId, String(block.id), doc);
            dbg("[SelectedBlockInspector] onSectionContentChange applied", {
              sectionId: blockSecId,
              blockId: String(block.id),
              preview: extractPlainText(doc).slice(0, 80),
            });
          } else {
            dbg("[SelectedBlockInspector] onSectionContentChange: could not resolve section id", {
              blockId: String(block.id),
            });
          }
        } catch {
          /* noop */
        } finally {
          pendingSyncRef.current = null;
        }
      }, 120);
    } catch {
      /* noop */
    }
  }
  
  /**
   * runSyncNow
   *
   * Core sync logic extracted from the debounced handler so it can be
   * invoked from both the debounced path and synchronously on flush.
   */
  function runSyncNow(doc: RemirrorJSON, opts?: { allowDeriveTitle?: boolean }) {
    if (!block) {
      return { updatedFields: null as any, appliedStructured: false, titleUpdated: false, linkedId: "" };
    }
  
    function resolveSectionIdForStructured(itemId: string | null | undefined): string | undefined {
      if (!currentCv || !itemId) return sectionId ?? undefined;
      if (sectionId) {
        const s = currentCv.sections?.find((sec: any) => String(sec.id) === String(sectionId));
        const has = Array.isArray((s as any)?.structuredContent)
          ? (s as any).structuredContent.some((it: any) => String(it?.id ?? it?._id) === String(itemId))
          : false;
        if (has) return String(sectionId);
      }
      for (const sec of currentCv.sections ?? []) {
        const list = (sec as any)?.structuredContent;
        if (Array.isArray(list) && list.some((it: any) => String(it?.id ?? it?._id) === String(itemId))) {
          return String(sec.id);
        }
      }
      return sectionId ?? undefined;
    }
  
    function resolveSectionIdForBlock(blockId: string | null | undefined): string | undefined {
      if (!currentCv || !blockId) return sectionId ?? undefined;
      if (sectionId) {
        const s = currentCv.sections?.find((sec: any) => String(sec.id) === String(sectionId));
        const has = Array.isArray((s as any)?.blocks)
          ? (s as any).blocks.some((b: any) => String(b?.id) === String(blockId))
          : false;
        if (has) return String(sectionId);
      }
      for (const sec of currentCv.sections ?? []) {
        const list = (sec as any)?.blocks;
        if (Array.isArray(list) && list.some((b: any) => String(b?.id) === String(block?.id))) {
          return String(sec.id);
        }
      }
      return sectionId ?? undefined;
    }
  
    const bid = String(block.id);
    const linkedId = String((effectiveLinked as any)?.id ?? (effectiveLinked as any)?._id ?? "");
    const blockSecId = resolveSectionIdForBlock(bid);
    const structuredSecId = resolveSectionIdForStructured(linkedId);
  
    // Avoid duplicate content writes here; block content already persisted earlier in flushAllChanges.
    // Keep this section to potentially derive title only (below).
  
    let updatedFields: Record<string, any> | null = null;
    let appliedStructured = false;
    let titleUpdated = false;
    let newTitle = "";
  
    try {
      updatedFields = remirrorJsonToStructuredFields(doc, sectionType as any);
      dbg("[DBG][Inspector] converted fields", updatedFields);
  
      const hasKeys = updatedFields && Object.keys(updatedFields).length > 0;
      const hasRichField = !!(updatedFields && (updatedFields.responsibilities || updatedFields.description));
      const hasFallbackTitle = !!(updatedFields && (updatedFields.position || updatedFields.title || updatedFields.degree));
  
      if (updatedFields && (hasKeys || hasRichField || hasFallbackTitle)) {
        // Do NOT write structured fields here. Commit-only path already persisted structured data.
        // Optionally derive a title only when allowed and current live title is empty.
        const allow = opts?.allowDeriveTitle === true;
        const liveTitle = getLiveBlockTitle(bid).trim();
        if (allow && liveTitle.length === 0) {
          newTitle = computeTitleFromStructured(updatedFields, sectionType);
          if (newTitle && newTitle !== liveTitle) {
            try {
              if (blockSecId) {
                void updateBlockTitle(blockSecId, bid, newTitle);
                titleUpdated = true;
                dbg("[SelectedBlockInspector] updated block title (derived)", { newTitle, previousLiveTitle: liveTitle });
              }
            } catch { /* noop */ }
          } else {
            dbg("[SelectedBlockInspector] skip derived title (same as live or empty)", { candidate: newTitle, liveTitle });
          }
        } else {
          dbg("[SelectedBlockInspector] skip derived title (user edited or non-empty current title)", {
            allow,
            currentTitleLen: liveTitle.length,
          });
        }
      }
    } catch {
      /* noop */
    }
  
    return { updatedFields, appliedStructured, titleUpdated, linkedId };
  }
  
  /**
   * flushPendingSync
   *
   * Wrapper that forwards to flushAllChanges() to provide a single flush path.
   */
  function flushPendingSync() {
    const linkedId = String((effectiveLinked as any)?.id ?? (effectiveLinked as any)?._id ?? "");
    dbg("[DBG][Inspector] flushPendingSync wrapper start", { linkedId });
    try {
      flushAllChanges('auto');
    } catch (err) {
      // eslint-disable-next-line no-console
      dbg("[DBG][Inspector] flushPendingSync wrapper error", err);
    }
    dbg("[DBG][Inspector] flushPendingSync wrapper exit", { linkedId });
  }
  
  // Cleanup pending debounce timer on unmount
  useEffect(() => {
    return () => {
      try {
        if (pendingSyncRef.current) {
          clearTimeout(pendingSyncRef.current);
          pendingSyncRef.current = null;
        }
      } catch {
        /* noop */
      }
    };
  }, []);

  // Resolve the correct owning section id for a block (shared by handlers)
  function resolveSectionIdForBlockLocal(blockId: string | null | undefined): string | undefined {
    try {
      if (!currentCv || !blockId) return resolvedSectionId ?? sectionId ?? undefined;
      if (resolvedSectionId) {
        const s = currentCv.sections?.find((sec: any) => String(sec.id) === String(resolvedSectionId));
        const has = Array.isArray((s as any)?.blocks)
          ? (s as any).blocks.some((b: any) => String(b?.id) === String(blockId))
          : false;
        if (has) return String(resolvedSectionId);
      }
      for (const sec of currentCv.sections ?? []) {
        const list = (sec as any)?.blocks;
        if (Array.isArray(list) && list.some((b: any) => String(b?.id) === String(blockId))) {
          return String(sec.id);
        }
      }
      return resolvedSectionId ?? sectionId ?? undefined;
    } catch {
      return resolvedSectionId ?? sectionId ?? undefined;
    }
  }

  // Live lookup: get the current title for a block from the up-to-date document
  function getLiveBlockTitle(bid: string | null | undefined): string {
    try {
      if (!currentCv || !bid) return String(block?.title ?? "");
      for (const s of currentCv.sections ?? []) {
        const arr = (s as any)?.blocks;
        if (!Array.isArray(arr)) continue;
        const found = (arr as any[]).find((b: any) => String(b?.id) === String(bid));
        if (found) return String((found as any)?.title ?? "");
      }
      return String(block?.title ?? "");
    } catch {
      return String(block?.title ?? "");
    }
  }

  // Determine which form to render: prefer the resolved sectionType, fall back to heuristics.
  const heuristicExperience = Boolean(
    formState && (formState.company || formState.position || Array.isArray(formState.achievements))
  );
  const heuristicEducation = Boolean(
    formState &&
    (["institution", "degree", "fieldOfStudy", "description", "startDate", "endDate", "grade"].some((k) =>
      Object.prototype.hasOwnProperty.call(formState, k)
    ))
  );
  const isExperience = (sectionType === "experience") || (sectionType === undefined && heuristicExperience && !heuristicEducation);
  const isEducation = (sectionType === "education") || (sectionType === undefined && heuristicEducation && !heuristicExperience);
  const isAchievement = Boolean(formState && (typeof formState.achievement === "string" || formState.achievement !== undefined));

  // If this inspector is opened for an achievement structured item, render a
  // simplified editor focused on the single `achievement` field.
  if (isAchievement) {
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={handleCancel} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit achievement"
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-lg shadow-lg overflow-auto max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-700">
            <h2 className="text-lg font-semibold">Edit achievement</h2>
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Close inspector"
              className="px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-slate-800"
            >
              Close
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="text-xs text-neutral-500">Achievement</label>
              <textarea
                className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                value={String(formState.achievement ?? "")}
                onChange={(e) => handleFieldChange("achievement", e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex items-center justify-end gap-2 mt-4">
              <button type="button" onClick={handleCancel} className="px-3 py-2 rounded bg-neutral-100">
                Cancel
              </button>
              <button type="button" onClick={handleSave} className="px-3 py-2 text-white rounded bg-[var(--primary)]">
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Late guard to preserve hook order and still log once when data is incomplete.
  if (!canRenderInspector) {
    dbg("[SelectedBlockInspector] guard prevented render", {
      hasBlock: Boolean(block),
      hasSection: Boolean(sectionId),
      hasLinked: Boolean(effectiveLinked),
      hadLinkedStructured: Boolean(linkedStructured),
      linkedIdAttr,
    });
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      onMouseDownCapture={(e) => e.stopPropagation()}
      onPointerDownCapture={(e) => e.stopPropagation()}
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={(e) => {
          if (isCommitting) {
            dbg("[DBG][Inspector] backdrop click ignored during commit");
            e.stopPropagation();
            return;
          }
          handleCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit block details"
        className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-lg shadow-lg overflow-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-700">
          <h2 className="text-lg font-semibold">Edit details</h2>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (isCommitting) {
                dbg("[DBG][Inspector] close button ignored during commit");
                return;
              }
              handleCancel();
            }}
            aria-label="Close inspector"
            className="px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-slate-800 disabled:opacity-50"
            disabled={isCommitting}
          >
            Close
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {isExperience ? (
              <>
                <div>
                  <label className="text-xs text-neutral-500">Company</label>
                  <input
                    className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                    value={formState.company ?? ""}
                    onChange={(e) => handleFieldChange("company", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-500">Position</label>
                  <input
                    className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                    value={formState.position ?? ""}
                    onChange={(e) => handleFieldChange("position", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-500">Start date</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <select
                      className="px-2 py-1 text-sm bg-transparent border rounded"
                      value={formState.startMonth ?? ""}
                      onChange={(e) => handleFieldChange("startMonth", e.target.value)}
                    >
                      <option value="">Month</option>
                      <option value="01">Jan</option>
                      <option value="02">Feb</option>
                      <option value="03">Mar</option>
                      <option value="04">Apr</option>
                      <option value="05">May</option>
                      <option value="06">Jun</option>
                      <option value="07">Jul</option>
                      <option value="08">Aug</option>
                      <option value="09">Sep</option>
                      <option value="10">Oct</option>
                      <option value="11">Nov</option>
                      <option value="12">Dec</option>
                    </select>
                    <select
                      className="px-2 py-1 text-sm bg-transparent border rounded"
                      value={formState.startYear ?? ""}
                      onChange={(e) => handleFieldChange("startYear", e.target.value)}
                    >
                      <option value="">Year</option>
                      {getYearOptions().map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    {formState.startShowDay ? (
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="px-2 py-1 text-sm bg-transparent border rounded"
                        value={formState.startDay ?? ""}
                        onChange={(e) => handleFieldChange("startDay", e.target.value)}
                        placeholder="Day"
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-left text-[var(--accent)] hover:underline"
                        onClick={() => setFormState((prev) => ({ ...prev, startShowDay: true }))}
                      >
                        Add day
                      </button>
                    )}
                  </div>
                  {formState.startShowDay && (
                    <div className="mt-1">
                      <button
                        type="button"
                        className="text-xs text-neutral-500 hover:underline"
                        onClick={() => setFormState((prev) => ({ ...prev, startShowDay: false, startDay: "" }))}
                      >
                        Remove day
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-neutral-500">End date</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <select
                      className="px-2 py-1 text-sm bg-transparent border rounded disabled:opacity-50"
                      value={formState.endMonth ?? ""}
                      disabled={Boolean(formState.isCurrent)}
                      onChange={(e) => handleFieldChange("endMonth", e.target.value)}
                    >
                      <option value="">Month</option>
                      <option value="01">Jan</option>
                      <option value="02">Feb</option>
                      <option value="03">Mar</option>
                      <option value="04">Apr</option>
                      <option value="05">May</option>
                      <option value="06">Jun</option>
                      <option value="07">Jul</option>
                      <option value="08">Aug</option>
                      <option value="09">Sep</option>
                      <option value="10">Oct</option>
                      <option value="11">Nov</option>
                      <option value="12">Dec</option>
                    </select>
                    <select
                      className="px-2 py-1 text-sm bg-transparent border rounded disabled:opacity-50"
                      value={formState.endYear ?? ""}
                      disabled={Boolean(formState.isCurrent)}
                      onChange={(e) => handleFieldChange("endYear", e.target.value)}
                    >
                      <option value="">Year</option>
                      {getYearOptions().map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    {formState.endShowDay ? (
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="px-2 py-1 text-sm bg-transparent border rounded disabled:opacity-50"
                        value={formState.endDay ?? ""}
                        disabled={Boolean(formState.isCurrent)}
                        onChange={(e) => handleFieldChange("endDay", e.target.value)}
                        placeholder="Day"
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-left text-[var(--accent)] hover:underline disabled:opacity-50"
                        disabled={Boolean(formState.isCurrent)}
                        onClick={() => setFormState((prev) => ({ ...prev, endShowDay: true }))}
                      >
                        Add day
                      </button>
                    )}
                  </div>
                  {formState.endShowDay && !formState.isCurrent && (
                    <div className="mt-1">
                      <button
                        type="button"
                        className="text-xs text-neutral-500 hover:underline"
                        onClick={() => setFormState((prev) => ({ ...prev, endShowDay: false, endDay: "" }))}
                      >
                        Remove day
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      id="exp-present"
                      type="checkbox"
                      className="w-4 h-4 accent-[var(--primary)]"
                      checked={Boolean(formState.isCurrent)}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          isCurrent: e.target.checked,
                          ...(e.target.checked ? { endYear: "", endMonth: "", endDay: "", endShowDay: false } : {}),
                        }))
                      }
                    />
                    <label htmlFor="exp-present" className="text-sm">Currently working here (Present)</label>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-neutral-500">Location</label>
                  <input
                    className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                    value={formState.location ?? ""}
                    onChange={(e) => handleFieldChange("location", e.target.value)}
                  />
                </div>

                {/* Achievements editing (simple textarea: one per line) */}
                <div className="md:col-span-2">
                  <label className="text-xs text-neutral-500">Achievements (one per line)</label>
                  <textarea
                    className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                    value={Array.isArray(formState.achievements) ? (formState.achievements as any[]).join("\n") : String(formState.achievements ?? "")}
                    onChange={(e) => {
                      const lines = String(e.target.value).split(/\n/).map((l) => l.trim()).filter(Boolean);
                      handleFieldChange("achievements", lines);
                    }}
                    rows={4}
                  />
                </div>
              </>
            ) : isEducation ? (
              <>
                <div>
                  <label className="text-xs text-neutral-500">Institution</label>
                  <input
                    className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                    value={formState.institution ?? ""}
                    onChange={(e) => handleFieldChange("institution", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-500">Degree</label>
                  <input
                    className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                    value={formState.degree ?? ""}
                    onChange={(e) => handleFieldChange("degree", e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs text-neutral-500">Start date</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <select
                      className="px-2 py-1 text-sm bg-transparent border rounded"
                      value={formState.startMonth ?? ""}
                      onChange={(e) => handleFieldChange("startMonth", e.target.value)}
                    >
                      <option value="">Month</option>
                      <option value="01">Jan</option>
                      <option value="02">Feb</option>
                      <option value="03">Mar</option>
                      <option value="04">Apr</option>
                      <option value="05">May</option>
                      <option value="06">Jun</option>
                      <option value="07">Jul</option>
                      <option value="08">Aug</option>
                      <option value="09">Sep</option>
                      <option value="10">Oct</option>
                      <option value="11">Nov</option>
                      <option value="12">Dec</option>
                    </select>
                    <select
                      className="px-2 py-1 text-sm bg-transparent border rounded"
                      value={formState.startYear ?? ""}
                      onChange={(e) => handleFieldChange("startYear", e.target.value)}
                    >
                      <option value="">Year</option>
                      {getYearOptions().map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    {formState.startShowDay ? (
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="px-2 py-1 text-sm bg-transparent border rounded"
                        value={formState.startDay ?? ""}
                        onChange={(e) => handleFieldChange("startDay", e.target.value)}
                        placeholder="Day"
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-left text-[var(--accent)] hover:underline"
                        onClick={() => setFormState((prev) => ({ ...prev, startShowDay: true }))}
                      >
                        Add day
                      </button>
                    )}
                  </div>
                  {formState.startShowDay && (
                    <div className="mt-1">
                      <button
                        type="button"
                        className="text-xs text-neutral-500 hover:underline"
                        onClick={() => setFormState((prev) => ({ ...prev, startShowDay: false, startDay: "" }))}
                      >
                        Remove day
                      </button>
                    </div>
                  )}
                </div>
 
                <div>
                  <label className="text-xs text-neutral-500">End date</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <select
                      className="px-2 py-1 text-sm bg-transparent border rounded disabled:opacity-50"
                      value={formState.endMonth ?? ""}
                      disabled={Boolean(formState.isCurrent)}
                      onChange={(e) => handleFieldChange("endMonth", e.target.value)}
                    >
                      <option value="">Month</option>
                      <option value="01">Jan</option>
                      <option value="02">Feb</option>
                      <option value="03">Mar</option>
                      <option value="04">Apr</option>
                      <option value="05">May</option>
                      <option value="06">Jun</option>
                      <option value="07">Jul</option>
                      <option value="08">Aug</option>
                      <option value="09">Sep</option>
                      <option value="10">Oct</option>
                      <option value="11">Nov</option>
                      <option value="12">Dec</option>
                    </select>
                    <select
                      className="px-2 py-1 text-sm bg-transparent border rounded disabled:opacity-50"
                      value={formState.endYear ?? ""}
                      disabled={Boolean(formState.isCurrent)}
                      onChange={(e) => handleFieldChange("endYear", e.target.value)}
                    >
                      <option value="">Year</option>
                      {getYearOptions().map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    {formState.endShowDay ? (
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="px-2 py-1 text-sm bg-transparent border rounded disabled:opacity-50"
                        value={formState.endDay ?? ""}
                        disabled={Boolean(formState.isCurrent)}
                        onChange={(e) => handleFieldChange("endDay", e.target.value)}
                        placeholder="Day"
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-left text-[var(--accent)] hover:underline disabled:opacity-50"
                        disabled={Boolean(formState.isCurrent)}
                        onClick={() => setFormState((prev) => ({ ...prev, endShowDay: true }))}
                      >
                        Add day
                      </button>
                    )}
                  </div>
                  {formState.endShowDay && !formState.isCurrent && (
                    <div className="mt-1">
                      <button
                        type="button"
                        className="text-xs text-neutral-500 hover:underline"
                        onClick={() => setFormState((prev) => ({ ...prev, endShowDay: false, endDay: "" }))}
                      >
                        Remove day
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      id="edu-present"
                      type="checkbox"
                      className="w-4 h-4 accent-[var(--primary)]"
                      checked={Boolean(formState.isCurrent)}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          isCurrent: e.target.checked,
                          ...(e.target.checked ? { endYear: "", endMonth: "", endDay: "", endShowDay: false } : {}),
                        }))
                      }
                    />
                    <label htmlFor="edu-present" className="text-sm">Currently here (Present)</label>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-neutral-500">Field of study</label>
                  <input
                    className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                    value={formState.fieldOfStudy ?? ""}
                    onChange={(e) => handleFieldChange("fieldOfStudy", e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-neutral-500">Grade</label>
                  <input
                    className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                    value={formState.grade ?? ""}
                    onChange={(e) => handleFieldChange("grade", e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="md:col-span-2">
                <label className="text-xs text-neutral-500">Title</label>
                <input
                  className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                  value={formState.title ?? ""}
                  onChange={(e) => handleFieldChange("title", e.target.value)}
                />
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-xs text-neutral-500">Block content</div>
            {sectionForEditor &&
              <RemirrorEditor
                sections={[sectionForEditor as any]} embedded={true}
                onSectionChange={(_index: number, updatedSection: any) => {
                  try {
                    if (!block?.id) return;
                    const doc = ensureRemirrorDoc((updatedSection as any)?.content as any);
                    setPendingBlockContent(doc);
                    const blockSecId = resolveSectionIdForBlockLocal(String(block.id));
                    if (blockSecId) {
                      updateBlockContent(blockSecId, String(block.id), doc);
                      dbg("[DBG][Inspector] onSectionChange applied content", { blockId: String(block.id), sectionId: blockSecId });
                    }
                    const newTitle = String((updatedSection as any)?.title ?? "");
                    if (newTitle && newTitle !== String(block.title ?? "")) {
                      const secIdForTitle = blockSecId ?? (resolvedSectionId ?? sectionId);
                      if (secIdForTitle) {
                        titleEditedRef.current = true;
                        updateBlockTitle(secIdForTitle, String(block.id), newTitle);
                        dbg("[DBG][Inspector] onSectionChange applied title", { blockId: String(block.id), sectionId: secIdForTitle, newTitle });
                      }
                    }
                  } catch { /* noop */ }
                }}
                onSectionContentChange={onEditorContentChange}
                onSectionTitleChange={(_secId: string, newTitle: string) => {
                  try {
                    if (!block?.id) return;
                    const secIdForTitle = resolveSectionIdForBlockLocal(String(block.id)) ?? (resolvedSectionId ?? sectionId);
                    if (secIdForTitle) {
                      titleEditedRef.current = true;
                      updateBlockTitle(secIdForTitle, String(block.id), String(newTitle ?? ""));
                      dbg("[DBG][Inspector] onSectionTitleChange applied", { blockId: String(block.id), sectionId: secIdForTitle, newTitle });
                    }
                  } catch { /* noop */ }
                }}
                collapsedSections={{}}
                onCollapseToggle={() => {}}
              />
            }
          </div>

          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (isCommitting) {
                  dbg("[DBG][Inspector] cancel ignored during commit");
                  return;
                }
                handleCancel();
              }}
              className="px-3 py-2 rounded bg-neutral-100 disabled:opacity-50"
              disabled={isCommitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                void handleSave();
              }}
              className="px-3 py-2 text-white rounded bg-[var(--primary)] disabled:opacity-50"
              disabled={isCommitting}
              aria-busy={isCommitting}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SelectedBlockInspector;