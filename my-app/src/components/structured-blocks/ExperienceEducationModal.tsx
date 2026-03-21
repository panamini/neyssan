import React, { useState, useCallback, useEffect, useMemo } from "react";
import type { IExperienceItem, IEducationItem } from "../../types/cvDocument";
import { v4 as uuidv4 } from "uuid";
import { parseIsoToParts, composeIsoFromParts } from "../../lib/date-utils";
import { mapAiExperience, mapAiEducation } from "../../lib/ai-mapping";
import { Remirror, useRemirror, EditorComponent } from "@remirror/react";
import {
  BoldExtension,
  ItalicExtension,
  UnderlineExtension,
  BulletListExtension,
  OrderedListExtension,
  ListItemExtension,
  ParagraphExtension,
  HistoryExtension,
  HardBreakExtension,
} from "remirror/extensions";
import type { RemirrorJSON } from "remirror";
import { ensureRemirrorDoc } from "../remirror-editor/utils/conversion";
import { EditorToolbar } from "../remirror-editor/components/EditorToolbar";
import { Trash, X } from "lucide-react";
import { Button } from "../ui/button";

type UiPatch = Partial<{
  startYear: string;
  startMonth: string;
  startDay: string;
  endYear: string;
  endMonth: string;
  endDay: string;
  startShowDay: boolean;
  endShowDay: boolean;
  isCurrent: boolean;
}>;

type UiState = {
  startYear: string;
  startMonth: string;
  startDay: string;
  endYear: string;
  endMonth: string;
  endDay: string;
  startShowDay: boolean;
  endShowDay: boolean;
  isCurrent: boolean;
};

interface BaseModalProps {
  open: boolean;
  onClose: () => void;
}

interface ExperienceModalProps extends BaseModalProps {
  items: IExperienceItem[];
  onSave: (next: IExperienceItem[]) => void;
}

interface EducationModalProps extends BaseModalProps {
  items: IEducationItem[];
  onSave: (next: IEducationItem[]) => void;
}

/**
 * Shared UI helpers
 */
function getYearOptions(): number[] {
  const now = new Date().getUTCFullYear();
  const start = 1950;
  const end = now + 5;
  const years: number[] = [];
  for (let y = end; y >= start; y--) years.push(y);
  return years;
}

// Build a bullet list Remirror doc from an achievements[] array (legacy migration)
function achievementsToBulletDoc(list: string[] | undefined | null): RemirrorJSON {
  const items = Array.isArray(list) ? list.map((s) => String(s ?? "").trim()).filter(Boolean) : [];
  if (items.length === 0) return ensureRemirrorDoc(undefined as any);
  return {
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: items.map((txt) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: txt }],
            },
          ],
        })),
      },
    ],
  } as RemirrorJSON;
}

// Lightweight embedded Remirror editor used inside the Experience modal per entry
function RichEditor({
  initialContent,
  onChangeDoc,
}: {
  initialContent: RemirrorJSON;
  onChangeDoc: (doc: RemirrorJSON) => void;
}) {
  const extensions = useMemo(
    () => [
      // Core text + history
      new ParagraphExtension(),
      new HistoryExtension({}),
      new HardBreakExtension({}),
      // Inline marks
      new BoldExtension({}),
      new ItalicExtension({}),
      new UnderlineExtension({}),
      // Lists
      new BulletListExtension({}),
      new OrderedListExtension({}),
      new ListItemExtension({}),
    ],
    []
  );

  // Initialize with provided content; keep internal state stable
  const { manager, state, onChange } = useRemirror({
    extensions: () => extensions as any,
    content: initialContent as any,
  });

  const handleChange = useCallback(
    (param: any) => {
      try {
        onChange(param);
        const view = (manager as any)?.view;
        const doc: RemirrorJSON =
          (view?.state?.doc?.toJSON?.() as RemirrorJSON | undefined) ?? ensureRemirrorDoc(undefined as any);
        onChangeDoc(ensureRemirrorDoc(doc as any));
      } catch {
        /* noop */
      }
    },
    [manager, onChange, onChangeDoc]
  );

  return (
    <div className="dasti-rich">
      <Remirror manager={manager} initialContent={state} onChange={handleChange}>
        <div className="rich-content">
          <EditorToolbar position="top" />
          <EditorComponent />
        </div>
      </Remirror>
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  open,
  onClose,
  children,
  primaryAction,
  footerNote,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  footerNote?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      onMouseDownCapture={(e) => e.stopPropagation()}
      onPointerDownCapture={(e) => e.stopPropagation()}
    >
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
        style={{ background: "hsla(30,12%,11%,.32)", backdropFilter: "blur(8px) saturate(1.2)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="dasti-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dasti-modal-header">
          <div className="dasti-modal-heading">
            <h2 className="dasti-modal-title">{title}</h2>
            {subtitle ? <p className="dasti-modal-subtitle">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="dasti-modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="dasti-modal-body">{children}</div>

        <div className="dasti-modal-footer">
          <div className="dasti-modal-footer-note">{footerNote ?? "Applied to the active resume."}</div>
          <div className="dasti-modal-actions">
            {primaryAction ? (
              <Button type="button" variant="primary" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
                {primaryAction.label}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ExperienceModal
 * - Edits a list of Experience entries with precision-aware dates and Present toggle
 * - Minimal v1: company, position, location, dates, achievements (simple textarea)
 */
export function ExperienceModal({ open, onClose, items, onSave }: ExperienceModalProps) {
  const [local, setLocal] = useState<IExperienceItem[]>(() => {
    if (Array.isArray(items)) return items.map((it) => ({ ...it }));
    return [];
  });

  // Local UI state decoupled from ISO composition to avoid select resets
  const deriveUi = useCallback((it: IExperienceItem): UiState => {
    const sp = parseIsoToParts(it.startDate);
    const ep = parseIsoToParts(it.endDate ?? undefined);
    return {
      startYear: sp.year ?? "",
      startMonth: sp.month ?? "",
      startDay: it.startDatePrecision === "day" ? (sp.day ?? "") : "",
      endYear: ep.year ?? "",
      endMonth: ep.month ?? "",
      endDay: it.endDatePrecision === "day" ? (ep.day ?? "") : "",
      isCurrent: Boolean(it.isCurrent || it.currentlyWorking),
      startShowDay: it.startDatePrecision === "day",
      endShowDay: it.endDatePrecision === "day",
    };
  }, []);

  const [uiState, setUiState] = useState<UiState[]>(() => {
    if (Array.isArray(items)) return items.map((it) => deriveUi(it));
    return [];
  });

  // Sync local + UI state when the modal opens or items change to avoid stale/empty selects
  useEffect(() => {
    if (open) {
      const copied = Array.isArray(items) ? (items.map((it) => ({ ...it })) as IExperienceItem[]) : [];
      setLocal(copied);
      setUiState(copied.map((it) => deriveUi(it)));
    }
  }, [open, items, deriveUi]);

  const setField = useCallback((idx: number, key: keyof IExperienceItem, value: unknown) => {
    setLocal((prev) => prev.map((it, i) => (i === idx ? ({ ...it, [key]: value } as IExperienceItem) : it)));
  }, []);

  const setUiField = useCallback((idx: number, patch: UiPatch) => {
    // Update UI state first to keep dropdowns stable even if ISO can't be composed yet
    const currentUi: UiState = uiState[idx] ?? {
      startYear: "", startMonth: "", startDay: "",
      endYear: "", endMonth: "", endDay: "",
      startShowDay: false, endShowDay: false, isCurrent: false,
    };
    const merged: UiState = { ...currentUi, ...patch };

    setUiState((prev) => {
      const nu = [...prev];
      nu[idx] = merged;
      return nu;
    });

    // Apply to model by composing back into ISO + precision fields
    setLocal((prev) => {
      const next = [...prev];
      const base = next[idx] ?? {};

      // start: persist intended precision even if iso can't be composed yet
      const intendedStartPrecision: "year" | "month" | "day" | undefined =
        merged.startShowDay ? "day" : merged.startMonth ? "month" : merged.startYear ? "year" : undefined;

      (base as IExperienceItem).startDatePrecision = intendedStartPrecision;

      const startComposed = composeIsoFromParts({
        year: String(merged.startYear ?? "").trim() || undefined,
        month: String(merged.startMonth ?? "").trim() || undefined,
        day: String(merged.startDay ?? "").trim() || undefined,
        precision: intendedStartPrecision,
      });

      // Only update startDate when we have the parts needed for the chosen precision.
      const wantsDayButMissing = intendedStartPrecision === "day" && !(String(merged.startDay ?? "").trim());
      if (!wantsDayButMissing) {
        if (startComposed.iso) {
          (base as IExperienceItem).startDate = startComposed.iso;
        }
      }

      // end with Present
      const isCurrent = Boolean(merged.isCurrent);
      if (isCurrent) {
        (base as IExperienceItem).isCurrent = true;
        (base as IExperienceItem).currentlyWorking = true;
        (base as IExperienceItem).endDate = null;
        (base as IExperienceItem).endDatePrecision = undefined;
      } else {
        const intendedEndPrecision: "year" | "month" | "day" | undefined =
          merged.endShowDay ? "day" : merged.endMonth ? "month" : merged.endYear ? "year" : undefined;

        (base as IExperienceItem).isCurrent = undefined;
        (base as IExperienceItem).currentlyWorking = undefined;
        (base as IExperienceItem).endDatePrecision = intendedEndPrecision;

        const endComposed = composeIsoFromParts({
          year: String(merged.endYear ?? "").trim() || undefined,
          month: String(merged.endMonth ?? "").trim() || undefined,
          day: String(merged.endDay ?? "").trim() || undefined,
          precision: intendedEndPrecision,
        });

        const endWantsDayButMissing = intendedEndPrecision === "day" && !(String(merged.endDay ?? "").trim());
        if (!endWantsDayButMissing) {
          (base as IExperienceItem).endDate = endComposed.iso ?? null;
        }
      }

      next[idx] = base as IExperienceItem;
      return next;
    });
  }, [uiState]);

  const addRow = useCallback(() => {
    const newItem: IExperienceItem = {
      id: uuidv4(),
      company: "",
      position: "",
      startDate: new Date(Date.UTC(1970, 0, 1, 0, 0, 0)).toISOString(),
      endDate: null,
      isCurrent: false,
      currentlyWorking: false,
      location: "",
      responsibilities: undefined,
      achievements: [],
    };
    setLocal((prev) => [...prev, newItem]);
    setUiState((prev) => [...prev, deriveUi(newItem)]);
  }, [deriveUi]);

  const removeRow = useCallback((idx: number) => {
    setLocal((prev) => prev.filter((_, i) => i !== idx));
    setUiState((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // Import from AI (clipboard/prompt) and map to typed Experience
  const importFromClipboardExp = useCallback(async () => {
    try {
      let text = "";
      try {
        // Try clipboard first (user can copy JSON payload from AI output)
        if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.readText) {
          text = await navigator.clipboard.readText();
        }
      } catch {
        /* clipboard not available */
      }
      if (!text) {
        const promptText = typeof window !== "undefined"
          ? window.prompt("Paste AI JSON for experience (array or { experience: [...] }):", "")
          : null;
        if (!promptText) return;
        text = promptText;
      }
      const j = JSON.parse(text) as unknown;
      const arr = Array.isArray(j) ? j : (Array.isArray((j as any)?.experience) ? (j as any).experience : []);
      if (!Array.isArray(arr) || arr.length === 0) return;
      const mapped = mapAiExperience(arr);
      setLocal(mapped);
      setUiState(mapped.map((it) => deriveUi(it)));
    } catch {
      // best-effort; ignore parse errors
    }
  }, []);

  return (
    <ModalShell
      title="Edit experience"
      subtitle="Roles and responsibilities"
      open={open}
      onClose={onClose}
      primaryAction={{ label: "Save all", onClick: () => onSave(local) }}
      footerNote="Order follows your resume."
    >
      <div className="space-y-5">
        {local.length === 0 && (
          <div className="dasti-hint">
            No experience yet. Use “Add entry” to create one.
          </div>
        )}

        {local.map((row, idx) => {
          const ui = uiState[idx] ?? {
            startYear: "", startMonth: "", startDay: "",
            endYear: "", endMonth: "", endDay: "",
            startShowDay: false, endShowDay: false, isCurrent: false,
          };
          return (
            <section key={String(row.id ?? idx)} className="dasti-zone">
              <div className="dasti-zone-header">
                <h3 className="dasti-zone-title">Entry {idx + 1}</h3>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="dasti-icon-button"
                  aria-label="Remove entry"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>

              <div className="dasti-grid-2">
                <label className="dasti-field-group">
                  <span className="dasti-label">Company</span>
                  <input
                    value={row.company}
                    onChange={(e) => setField(idx, "company", e.target.value)}
                    className="dasti-field"
                  />
                </label>

                <label className="dasti-field-group">
                  <span className="dasti-label">Position</span>
                  <input
                    value={row.position}
                    onChange={(e) => setField(idx, "position", e.target.value)}
                    className="dasti-field"
                  />
                </label>

                <label className="dasti-field-group" style={{ gridColumn: "1 / -1" }}>
                  <span className="dasti-label">Location</span>
                  <input
                    value={row.location ?? ""}
                    onChange={(e) => setField(idx, "location", e.target.value)}
                    className="dasti-field"
                    placeholder="City, Country"
                  />
                </label>

                <div className="dasti-field-group">
                  <span className="dasti-label">Start date</span>
                  <div style={{ display: "grid", gridTemplateColumns: ui.startShowDay ? "1fr 1fr 1fr" : "1fr 1fr auto", gap: "var(--s2)" }}>
                    <select
                      className="dasti-select"
                      value={ui.startMonth}
                      onChange={(e) => setUiField(idx, { startMonth: e.target.value })}
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
                      className="dasti-select"
                      value={ui.startYear}
                      onChange={(e) => setUiField(idx, { startYear: e.target.value })}
                    >
                      <option value="">Year</option>
                      {getYearOptions().map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                    {ui.startShowDay ? (
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="dasti-field"
                        value={ui.startDay}
                        onChange={(e) => setUiField(idx, { startDay: e.target.value })}
                        placeholder="Day"
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-left text-xs [color:var(--tm2)] hover:[color:var(--ti)]"
                        onClick={() => setUiField(idx, { startShowDay: true })}
                      >
                        Add day
                      </button>
                    )}
                  </div>
                  {ui.startShowDay && (
                    <div>
                      <button
                        type="button"
                        className="text-xs [color:var(--tg2)] hover:[color:var(--ti)]"
                        onClick={() => setUiField(idx, { startShowDay: false, startDay: "" })}
                      >
                        Remove day
                      </button>
                    </div>
                  )}
                </div>

                <div className="dasti-field-group">
                  <span className="dasti-label">End date</span>
                  <div style={{ display: "grid", gridTemplateColumns: ui.endShowDay ? "1fr 1fr 1fr" : "1fr 1fr auto", gap: "var(--s2)" }}>
                    <select
                      className="dasti-select"
                      value={ui.endMonth}
                      disabled={ui.isCurrent}
                      onChange={(e) => setUiField(idx, { endMonth: e.target.value })}
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
                      className="dasti-select"
                      value={ui.endYear}
                      disabled={ui.isCurrent}
                      onChange={(e) => setUiField(idx, { endYear: e.target.value })}
                    >
                      <option value="">Year</option>
                      {getYearOptions().map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                    {ui.endShowDay ? (
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="dasti-field"
                        value={ui.endDay}
                        disabled={ui.isCurrent}
                        onChange={(e) => setUiField(idx, { endDay: e.target.value })}
                        placeholder="Day"
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-left text-xs [color:var(--tm2)] hover:[color:var(--ti)] disabled:opacity-50"
                        disabled={ui.isCurrent}
                        onClick={() => setUiField(idx, { endShowDay: true })}
                      >
                        Add day
                      </button>
                    )}
                  </div>
                  {ui.endShowDay && !ui.isCurrent && (
                    <div>
                      <button
                        type="button"
                        className="text-xs [color:var(--tg2)] hover:[color:var(--ti)]"
                        onClick={() => setUiField(idx, { endShowDay: false, endDay: "" })}
                      >
                        Remove day
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2" style={{ marginTop: "var(--s2)" }}>
                    <input
                      id={`exp-present-${idx}`}
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={ui.isCurrent}
                      onChange={(e) => setUiField(idx, { isCurrent: e.target.checked, endYear: "", endMonth: "", endDay: "", endShowDay: false })}
                    />
                    <label htmlFor={`exp-present-${idx}`} className="dasti-hint">
                      Current role
                    </label>
                  </div>
                </div>

                <div className="dasti-field-group" style={{ gridColumn: "1 / -1" }}>
                  <span className="dasti-label">Responsibilities</span>
                  <RichEditor
                    initialContent={
                      (() => {
                        const existing = (row as IExperienceItem).responsibilities as RemirrorJSON | string | undefined;
                        if (existing) return ensureRemirrorDoc(existing as any);
                        const legacy = Array.isArray(row.achievements) ? row.achievements : [];
                        return achievementsToBulletDoc(legacy);
                      })()
                    }
                    onChangeDoc={(doc) => {
                      setField(idx, "responsibilities", doc);
                      setField(idx, "achievements", []);
                    }}
                  />
                  <div className="dasti-hint">Describe scope, output, and notable outcomes.</div>
                </div>
              </div>
            </section>
          );
        })}

        <div>
          <Button type="button" variant="secondary" onClick={addRow}>
            Add entry
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

/**
 * EducationModal
 * - Edits a list of Education entries with precision-aware dates and Present toggle
 * - Minimal v1: institution, degree, fieldOfStudy, grade, dates
 */
export function EducationModal({ open, onClose, items, onSave }: EducationModalProps) {
  const [local, setLocal] = useState<IEducationItem[]>(() => {
    if (Array.isArray(items)) return items.map((it) => ({ ...it }));
    return [];
  });

  const deriveUiEdu = useCallback((it: IEducationItem): UiState => {
    const sp = parseIsoToParts(it.startDate);
    const ep = parseIsoToParts(it.endDate ?? undefined);
    return {
      startYear: sp.year ?? "",
      startMonth: sp.month ?? "",
      startDay: it.startDatePrecision === "day" ? (sp.day ?? "") : "",
      endYear: ep.year ?? "",
      endMonth: ep.month ?? "",
      endDay: it.endDatePrecision === "day" ? (ep.day ?? "") : "",
      isCurrent: Boolean(it.isCurrent),
      startShowDay: it.startDatePrecision === "day",
      endShowDay: it.endDatePrecision === "day",
    };
  }, []);

  const [uiState, setUiState] = useState<UiState[]>(() => {
    if (Array.isArray(items)) return items.map((it) => deriveUiEdu(it));
    return [];
  });

  // Sync local + UI state for Education on open/items change
  useEffect(() => {
    if (open) {
      const copied = Array.isArray(items) ? (items.map((it) => ({ ...it })) as IEducationItem[]) : [];
      setLocal(copied);
      setUiState(copied.map((it) => deriveUiEdu(it)));
    }
  }, [open, items, deriveUiEdu]);

  const setField = useCallback((idx: number, key: keyof IEducationItem, value: unknown) => {
    setLocal((prev) => prev.map((it, i) => (i === idx ? ({ ...it, [key]: value } as IEducationItem) : it)));
  }, []);
  
  const setUiField = useCallback((idx: number, patch: UiPatch) => {
    // Keep UI responsive and stable first
    const currentUi: UiState = uiState[idx] ?? {
      startYear: "", startMonth: "", startDay: "",
      endYear: "", endMonth: "", endDay: "",
      startShowDay: false, endShowDay: false, isCurrent: false,
    };
    const merged: UiState = { ...currentUi, ...patch };

    setUiState((prev) => {
      const nu = [...prev];
      nu[idx] = merged;
      return nu;
    });

    // Then apply to the underlying model (local)
    setLocal((prev) => {
      const next = [...prev];
      const base = next[idx] ?? {};

      // start: persist intended precision even if a full ISO isn't available yet
      const intendedStartPrecision: "year" | "month" | "day" | undefined =
        merged.startShowDay ? "day" : merged.startMonth ? "month" : merged.startYear ? "year" : undefined;

      (base as IEducationItem).startDatePrecision = intendedStartPrecision;

      const startComposed = composeIsoFromParts({
        year: String(merged.startYear ?? "").trim() || undefined,
        month: String(merged.startMonth ?? "").trim() || undefined,
        day: String(merged.startDay ?? "").trim() || undefined,
        precision: intendedStartPrecision,
      });

      const wantsDayButMissing = intendedStartPrecision === "day" && !(String(merged.startDay ?? "").trim());
      if (!wantsDayButMissing) {
        (base as IEducationItem).startDate = startComposed.iso ?? undefined;
      }

      // end with Present
      const isCurrent = Boolean(merged.isCurrent);
      if (isCurrent) {
        (base as IEducationItem).isCurrent = true;
        (base as IEducationItem).endDate = null;
        (base as IEducationItem).endDatePrecision = undefined;
      } else {
        const intendedEndPrecision: "year" | "month" | "day" | undefined =
          merged.endShowDay ? "day" : merged.endMonth ? "month" : merged.endYear ? "year" : undefined;

        (base as IEducationItem).isCurrent = undefined;
        (base as IEducationItem).endDatePrecision = intendedEndPrecision;

        const endComposed = composeIsoFromParts({
          year: String(merged.endYear ?? "").trim() || undefined,
          month: String(merged.endMonth ?? "").trim() || undefined,
          day: String(merged.endDay ?? "").trim() || undefined,
          precision: intendedEndPrecision,
        });

        const endWantsDayButMissing = intendedEndPrecision === "day" && !(String(merged.endDay ?? "").trim());
        if (!endWantsDayButMissing) {
          (base as IEducationItem).endDate = endComposed.iso ?? undefined;
        }
      }

      next[idx] = base as IEducationItem;
      return next;
    });
  }, [uiState]);

  const addRow = useCallback(() => {
    const newItem: IEducationItem = {
      id: uuidv4(),
      institution: "",
      degree: "",
      fieldOfStudy: "",
      startDate: undefined,
      endDate: undefined,
      isCurrent: false,
      grade: "",
      description: undefined,
    };
    setLocal((prev) => [...prev, newItem]);
    setUiState((prev) => [...prev, deriveUiEdu(newItem)]);
  }, [deriveUiEdu]);

  const removeRow = useCallback((idx: number) => {
    setLocal((prev) => prev.filter((_, i) => i !== idx));
    setUiState((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // Import from AI (clipboard/prompt) and map to typed Education
  const importFromClipboardEdu = useCallback(async () => {
    try {
      let text = "";
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.readText) {
          text = await navigator.clipboard.readText();
        }
      } catch {
        /* clipboard not available */
      }
      if (!text) {
        const promptText = typeof window !== "undefined"
          ? window.prompt("Paste AI JSON for education (array or { education: [...] }):", "")
          : null;
        if (!promptText) return;
        text = promptText;
      }
      const j = JSON.parse(text) as unknown;
      const arr = Array.isArray(j) ? j : (Array.isArray((j as any)?.education) ? (j as any).education : []);
      if (!Array.isArray(arr) || arr.length === 0) return;
      const mapped = mapAiEducation(arr);
      setLocal(mapped);
      setUiState(mapped.map((it) => deriveUiEdu(it)));
    } catch {
      // ignore parse errors
    }
  }, []);

  return (
    <ModalShell
      title="Edit education"
      subtitle="Study and qualifications"
      open={open}
      onClose={onClose}
      primaryAction={{ label: "Save all", onClick: () => onSave(local) }}
      footerNote="Order follows your resume."
    >
      <div className="space-y-5">
        {local.length === 0 && (
          <div className="dasti-hint">
            No education yet. Use “Add entry” to create one.
          </div>
        )}

        {local.map((row, idx) => {
          const ui = uiState[idx] ?? {
            startYear: "", startMonth: "", startDay: "",
            endYear: "", endMonth: "", endDay: "",
            startShowDay: false, endShowDay: false, isCurrent: false,
          };
          return (
            <section key={String(row.id ?? idx)} className="dasti-zone">
              <div className="dasti-zone-header">
                <h3 className="dasti-zone-title">Entry {idx + 1}</h3>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="dasti-icon-button"
                  aria-label="Remove entry"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>

              <div className="dasti-grid-2">
                <label className="dasti-field-group">
                  <span className="dasti-label">Institution</span>
                  <input
                    value={row.institution}
                    onChange={(e) => setField(idx, "institution", e.target.value)}
                    className="dasti-field"
                  />
                </label>

                <label className="dasti-field-group">
                  <span className="dasti-label">Degree</span>
                  <input
                    value={row.degree ?? ""}
                    onChange={(e) => setField(idx, "degree", e.target.value)}
                    className="dasti-field"
                  />
                </label>

                <label className="dasti-field-group">
                  <span className="dasti-label">Field of study</span>
                  <input
                    value={row.fieldOfStudy ?? ""}
                    onChange={(e) => setField(idx, "fieldOfStudy", e.target.value)}
                    className="dasti-field"
                  />
                </label>

                <label className="dasti-field-group">
                  <span className="dasti-label">Grade</span>
                  <input
                    value={row.grade ?? ""}
                    onChange={(e) => setField(idx, "grade", e.target.value)}
                    className="dasti-field"
                  />
                </label>

                <div className="dasti-field-group">
                  <span className="dasti-label">Start date</span>
                  <div style={{ display: "grid", gridTemplateColumns: ui.startShowDay ? "1fr 1fr 1fr" : "1fr 1fr auto", gap: "var(--s2)" }}>
                    <select
                      className="dasti-select"
                      value={ui.startMonth}
                      onChange={(e) => setUiField(idx, { startMonth: e.target.value })}
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
                      className="dasti-select"
                      value={ui.startYear}
                      onChange={(e) => setUiField(idx, { startYear: e.target.value })}
                    >
                      <option value="">Year</option>
                      {getYearOptions().map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                    {ui.startShowDay ? (
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="dasti-field"
                        value={ui.startDay}
                        onChange={(e) => setUiField(idx, { startDay: e.target.value })}
                        placeholder="Day"
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-left text-xs [color:var(--tm2)] hover:[color:var(--ti)]"
                        onClick={() => setUiField(idx, { startShowDay: true })}
                      >
                        Add day
                      </button>
                    )}
                  </div>
                  {ui.startShowDay ? (
                    <button
                      type="button"
                      className="w-fit text-xs [color:var(--tg2)] hover:[color:var(--ti)]"
                      onClick={() => setUiField(idx, { startShowDay: false, startDay: "" })}
                    >
                      Remove day
                    </button>
                  ) : null}
                </div>

                <div className="dasti-field-group">
                  <span className="dasti-label">End date</span>
                  <div style={{ display: "grid", gridTemplateColumns: ui.endShowDay ? "1fr 1fr 1fr" : "1fr 1fr auto", gap: "var(--s2)" }}>
                    <select
                      className="dasti-select"
                      value={ui.endMonth}
                      disabled={ui.isCurrent}
                      onChange={(e) => setUiField(idx, { endMonth: e.target.value })}
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
                      className="dasti-select"
                      value={ui.endYear}
                      disabled={ui.isCurrent}
                      onChange={(e) => setUiField(idx, { endYear: e.target.value })}
                    >
                      <option value="">Year</option>
                      {getYearOptions().map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                    {ui.endShowDay ? (
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="dasti-field"
                        value={ui.endDay}
                        disabled={ui.isCurrent}
                        onChange={(e) => setUiField(idx, { endDay: e.target.value })}
                        placeholder="Day"
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-left text-xs [color:var(--tm2)] hover:[color:var(--ti)] disabled:opacity-50"
                        disabled={ui.isCurrent}
                        onClick={() => setUiField(idx, { endShowDay: true })}
                      >
                        Add day
                      </button>
                    )}
                  </div>
                  {ui.endShowDay && !ui.isCurrent ? (
                    <button
                      type="button"
                      className="w-fit text-xs [color:var(--tg2)] hover:[color:var(--ti)]"
                      onClick={() => setUiField(idx, { endShowDay: false, endDay: "" })}
                    >
                      Remove day
                    </button>
                  ) : null}
                  <div className="flex items-center gap-2" style={{ marginTop: "var(--s2)" }}>
                    <input
                      id={`edu-present-${idx}`}
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={ui.isCurrent}
                      onChange={(e) => setUiField(idx, { isCurrent: e.target.checked, endYear: "", endMonth: "", endDay: "", endShowDay: false })}
                    />
                    <label htmlFor={`edu-present-${idx}`} className="dasti-hint">
                      Current study
                    </label>
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        <div>
          <Button type="button" variant="secondary" onClick={addRow}>
            Add entry
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

export default ExperienceModal;
