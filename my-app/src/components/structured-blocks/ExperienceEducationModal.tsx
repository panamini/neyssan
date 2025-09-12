import React, { useMemo, useState, useCallback } from "react";
import type { IExperienceItem, IEducationItem } from "../../types/cvDocument";
import { v4 as uuidv4 } from "uuid";
import { parseIsoToParts, composeIsoFromParts } from "../../lib/date-utils";
import { mapAiExperience, mapAiEducation } from "../../lib/ai-mapping";

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

function ModalShell({
  title,
  open,
  onClose,
  children,
  primaryAction,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      onMouseDownCapture={(e) => e.stopPropagation()}
      onPointerDownCapture={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-3xl bg-[var(--background)] text-[var(--foreground)] rounded-lg shadow-lg overflow-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-700">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="px-2 py-1 rounded hover:bg-[var(--accent)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
          >
            Close
          </button>
        </div>

        <div className="p-4">{children}</div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded bg-neutral-100 dark:bg-slate-800 hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
          >
            Cancel
          </button>
          {primaryAction ? (
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="px-3 py-2 text-sm font-medium rounded bg-[var(--primary)] text-[var(--foreground)] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1 disabled:opacity-50"
            >
              {primaryAction.label}
            </button>
          ) : null}
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

  // derived UI state for date parts by index
  const derived = useMemo(() => {
    return local.map((it) => {
      const sp = parseIsoToParts(it.startDate);
      const ep = parseIsoToParts(it.endDate ?? undefined);
      return {
        startYear: sp.year ?? "",
        startMonth: sp.month ?? "",
        startDay: it.startDatePrecision === "day" ? sp.day ?? "" : "",
        endYear: ep.year ?? "",
        endMonth: ep.month ?? "",
        endDay: it.endDatePrecision === "day" ? ep.day ?? "" : "",
        isCurrent: Boolean(it.isCurrent || it.currentlyWorking),
        startShowDay: it.startDatePrecision === "day",
        endShowDay: it.endDatePrecision === "day",
      };
    });
  }, [local]);

  const setField = useCallback((idx: number, key: keyof IExperienceItem, value: unknown) => {
    setLocal((prev) => prev.map((it, i) => (i === idx ? ({ ...it, [key]: value } as IExperienceItem) : it)));
  }, []);

  const setUiField = useCallback((idx: number, patch: UiPatch) => {
    // apply UI patch by composing back into ISO + precision fields
    setLocal((prev) => {
      const next = [...prev];
      const base = next[idx] ?? {};
      const ui = derived[idx] ?? {};
      const merged = { ...ui, ...patch };

      // start
      const startComposed = composeIsoFromParts({
        year: String(merged.startYear ?? "").trim() || undefined,
        month: String(merged.startMonth ?? "").trim() || undefined,
        day: String(merged.startDay ?? "").trim() || undefined,
        precision: merged.startShowDay ? "day" : merged.startMonth ? "month" : merged.startYear ? "year" : undefined,
      });
      if (startComposed.iso) {
        (base as IExperienceItem).startDate = startComposed.iso;
        (base as IExperienceItem).startDatePrecision = startComposed.precision;
      }

      // end with Present
      const isCurrent = Boolean(merged.isCurrent);
      if (isCurrent) {
        (base as IExperienceItem).isCurrent = true;
        (base as IExperienceItem).currentlyWorking = true;
        (base as IExperienceItem).endDate = null;
        (base as IExperienceItem).endDatePrecision = undefined;
      } else {
        const endComposed = composeIsoFromParts({
          year: String(merged.endYear ?? "").trim() || undefined,
          month: String(merged.endMonth ?? "").trim() || undefined,
          day: String(merged.endDay ?? "").trim() || undefined,
          precision: merged.endShowDay ? "day" : merged.endMonth ? "month" : merged.endYear ? "year" : undefined,
        });
        (base as IExperienceItem).isCurrent = undefined;
        (base as IExperienceItem).currentlyWorking = undefined;
        (base as IExperienceItem).endDate = endComposed.iso ?? null;
        (base as IExperienceItem).endDatePrecision = endComposed.precision;
      }

      next[idx] = base as IExperienceItem;
      return next;
    });
  }, [derived]);

  const addRow = useCallback(() => {
    setLocal((prev) => [
      ...prev,
      {
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
      },
    ]);
  }, []);

  const removeRow = useCallback((idx: number) => {
    setLocal((prev) => prev.filter((_, i) => i !== idx));
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
    } catch {
      // best-effort; ignore parse errors
    }
  }, []);

  return (
    <ModalShell
      title="Edit experience"
      open={open}
      onClose={onClose}
      primaryAction={{ label: "Save", onClick: () => onSave(local) }}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => void importFromClipboardExp()}
            className="px-2 py-1 text-xs rounded bg-[var(--primary)] text-[var(--foreground)] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
            aria-label="Import from AI (experience)"
            title="Import from AI (experience)"
          >
            Import from AI
          </button>
        </div>
        {local.length === 0 && (
          <div className="px-3 py-2 text-sm rounded bg-neutral-50 dark:bg-slate-800 text-neutral-600 dark:text-slate-300">
            No experience yet. Use “Add entry” to create one.
          </div>
        )}

        {local.map((row, idx) => {
          const ui = derived[idx];
          return (
            <div key={String(row.id ?? idx)} className="p-3 border rounded-md dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium opacity-80">Entry {idx + 1}</div>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="px-2 py-1 text-xs rounded hover:bg-[var(--accent)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
                  aria-label="Remove entry"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs opacity-70">Company</label>
                  <input
                    value={row.company}
                    onChange={(e) => setField(idx, "company", e.target.value)}
                    className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70">Position</label>
                  <input
                    value={row.position}
                    onChange={(e) => setField(idx, "position", e.target.value)}
                    className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs opacity-70">Location</label>
                  <input
                    value={row.location ?? ""}
                    onChange={(e) => setField(idx, "location", e.target.value)}
                    className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                  />
                </div>

                <div>
                  <label className="text-xs opacity-70">Start date</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <select
                      className="px-2 py-1 text-sm bg-transparent border rounded"
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
                      className="px-2 py-1 text-sm bg-transparent border rounded"
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
                        className="px-2 py-1 text-sm bg-transparent border rounded"
                        value={ui.startDay}
                        onChange={(e) => setUiField(idx, { startDay: e.target.value })}
                        placeholder="Day"
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-left text-[var(--accent)] hover:underline"
                        onClick={() => setUiField(idx, { startShowDay: true })}
                      >
                        Add day
                      </button>
                    )}
                  </div>
                  {ui.startShowDay && (
                    <div className="mt-1">
                      <button
                        type="button"
                        className="text-xs opacity-70 hover:underline"
                        onClick={() => setUiField(idx, { startShowDay: false, startDay: "" })}
                      >
                        Remove day
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs opacity-70">End date</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <select
                      className="px-2 py-1 text-sm bg-transparent border rounded disabled:opacity-50"
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
                      className="px-2 py-1 text-sm bg-transparent border rounded disabled:opacity-50"
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
                        className="px-2 py-1 text-sm bg-transparent border rounded disabled:opacity-50"
                        value={ui.endDay}
                        disabled={ui.isCurrent}
                        onChange={(e) => setUiField(idx, { endDay: e.target.value })}
                        placeholder="Day"
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-left text-[var(--accent)] hover:underline disabled:opacity-50"
                        disabled={ui.isCurrent}
                        onClick={() => setUiField(idx, { endShowDay: true })}
                      >
                        Add day
                      </button>
                    )}
                  </div>
                  {ui.endShowDay && !ui.isCurrent && (
                    <div className="mt-1">
                      <button
                        type="button"
                        className="text-xs opacity-70 hover:underline"
                        onClick={() => setUiField(idx, { endShowDay: false, endDay: "" })}
                      >
                        Remove day
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      id={`exp-present-${idx}`}
                      type="checkbox"
                      className="w-4 h-4 accent-[var(--primary)]"
                      checked={ui.isCurrent}
                      onChange={(e) => setUiField(idx, { isCurrent: e.target.checked, endYear: "", endMonth: "", endDay: "", endShowDay: false })}
                    />
                    <label htmlFor={`exp-present-${idx}`} className="text-sm">
                      Currently working here (Present)
                    </label>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs opacity-70">Achievements (one per line)</label>
                  <textarea
                    className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                    value={Array.isArray(row.achievements) ? row.achievements.join("\n") : ""}
                    onChange={(e) => {
                      const list = String(e.target.value)
                        .split(/\n/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                      setField(idx, "achievements", list);
                    }}
                    rows={4}
                  />
                </div>
              </div>
            </div>
          );
        })}

        <div>
          <button
            type="button"
            onClick={addRow}
            className="px-3 py-2 text-sm rounded bg-neutral-100 hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
          >
            Add entry
          </button>
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

  const derived = useMemo(() => {
    return local.map((it) => {
      const sp = parseIsoToParts(it.startDate);
      const ep = parseIsoToParts(it.endDate ?? undefined);
      return {
        startYear: sp.year ?? "",
        startMonth: sp.month ?? "",
        startDay: it.startDatePrecision === "day" ? sp.day ?? "" : "",
        endYear: ep.year ?? "",
        endMonth: ep.month ?? "",
        endDay: it.endDatePrecision === "day" ? ep.day ?? "" : "",
        isCurrent: Boolean(it.isCurrent),
        startShowDay: it.startDatePrecision === "day",
        endShowDay: it.endDatePrecision === "day",
      };
    });
  }, [local]);

  const setField = useCallback((idx: number, key: keyof IEducationItem, value: unknown) => {
    setLocal((prev) => prev.map((it, i) => (i === idx ? ({ ...it, [key]: value } as IEducationItem) : it)));
  }, []);
  
  const setUiField = useCallback((idx: number, patch: UiPatch) => {
    setLocal((prev) => {
      const next = [...prev];
      const base = next[idx] ?? {};
      const ui = derived[idx] ?? {};
      const merged = { ...ui, ...patch };

      // start
      const startComposed = composeIsoFromParts({
        year: String(merged.startYear ?? "").trim() || undefined,
        month: String(merged.startMonth ?? "").trim() || undefined,
        day: String(merged.startDay ?? "").trim() || undefined,
        precision: merged.startShowDay ? "day" : merged.startMonth ? "month" : merged.startYear ? "year" : undefined,
      });
      (base as IEducationItem).startDate = startComposed.iso ?? undefined;
      (base as IEducationItem).startDatePrecision = startComposed.precision;

      // end with Present
      const isCurrent = Boolean(merged.isCurrent);
      if (isCurrent) {
        (base as IEducationItem).isCurrent = true;
        (base as IEducationItem).endDate = null;
        (base as IEducationItem).endDatePrecision = undefined;
      } else {
        const endComposed = composeIsoFromParts({
          year: String(merged.endYear ?? "").trim() || undefined,
          month: String(merged.endMonth ?? "").trim() || undefined,
          day: String(merged.endDay ?? "").trim() || undefined,
          precision: merged.endShowDay ? "day" : merged.endMonth ? "month" : merged.endYear ? "year" : undefined,
        });
        (base as IEducationItem).isCurrent = undefined;
        (base as IEducationItem).endDate = endComposed.iso ?? undefined;
        (base as IEducationItem).endDatePrecision = endComposed.precision;
      }

      next[idx] = base as IEducationItem;
      return next;
    });
  }, [derived]);

  const addRow = useCallback(() => {
    setLocal((prev) => [
      ...prev,
      {
        id: uuidv4(),
        institution: "",
        degree: "",
        fieldOfStudy: "",
        startDate: undefined,
        endDate: undefined,
        isCurrent: false,
        grade: "",
        description: undefined,
      },
    ]);
  }, []);

  const removeRow = useCallback((idx: number) => {
    setLocal((prev) => prev.filter((_, i) => i !== idx));
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
    } catch {
      // ignore parse errors
    }
  }, []);

  return (
    <ModalShell
      title="Edit education"
      open={open}
      onClose={onClose}
      primaryAction={{ label: "Save", onClick: () => onSave(local) }}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => void importFromClipboardEdu()}
            className="px-2 py-1 text-xs rounded bg-[var(--primary)] text-[var(--foreground)] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
            aria-label="Import from AI (education)"
            title="Import from AI (education)"
          >
            Import from AI
          </button>
        </div>
        {local.length === 0 && (
          <div className="px-3 py-2 text-sm rounded bg-neutral-50 dark:bg-slate-800 text-neutral-600 dark:text-slate-300">
            No education yet. Use “Add entry” to create one.
          </div>
        )}

        {local.map((row, idx) => {
          const ui = derived[idx];
          return (
            <div key={String(row.id ?? idx)} className="p-3 border rounded-md dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium opacity-80">Entry {idx + 1}</div>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="px-2 py-1 text-xs rounded hover:bg-[var(--accent)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
                  aria-label="Remove entry"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs opacity-70">Institution</label>
                  <input
                    value={row.institution}
                    onChange={(e) => setField(idx, "institution", e.target.value)}
                    className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70">Degree</label>
                  <input
                    value={row.degree ?? ""}
                    onChange={(e) => setField(idx, "degree", e.target.value)}
                    className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70">Field of study</label>
                  <input
                    value={row.fieldOfStudy ?? ""}
                    onChange={(e) => setField(idx, "fieldOfStudy", e.target.value)}
                    className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70">Grade</label>
                  <input
                    value={row.grade ?? ""}
                    onChange={(e) => setField(idx, "grade", e.target.value)}
                    className="w-full px-2 py-1 mt-1 text-sm bg-transparent border rounded"
                  />
                </div>

                <div>
                  <label className="text-xs opacity-70">Start date</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <select
                      className="px-2 py-1 text-sm bg-transparent border rounded"
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
                      className="px-2 py-1 text-sm bg-transparent border rounded"
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
                        className="px-2 py-1 text-sm bg-transparent border rounded"
                        value={ui.startDay}
                        onChange={(e) => setUiField(idx, { startDay: e.target.value })}
                        placeholder="Day"
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-left text-[var(--accent)] hover:underline"
                        onClick={() => setUiField(idx, { startShowDay: true })}
                      >
                        Add day
                      </button>
                    )}
                  </div>
                  {ui.startShowDay && (
                    <div className="mt-1">
                      <button
                        type="button"
                        className="text-xs opacity-70 hover:underline"
                        onClick={() => setUiField(idx, { startShowDay: false, startDay: "" })}
                      >
                        Remove day
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs opacity-70">End date</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <select
                      className="px-2 py-1 text-sm bg-transparent border rounded disabled:opacity-50"
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
                      className="px-2 py-1 text-sm bg-transparent border rounded disabled:opacity-50"
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
                        className="px-2 py-1 text-sm bg-transparent border rounded disabled:opacity-50"
                        value={ui.endDay}
                        disabled={ui.isCurrent}
                        onChange={(e) => setUiField(idx, { endDay: e.target.value })}
                        placeholder="Day"
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-left text-[var(--accent)] hover:underline disabled:opacity-50"
                        disabled={ui.isCurrent}
                        onClick={() => setUiField(idx, { endShowDay: true })}
                      >
                        Add day
                      </button>
                    )}
                  </div>
                  {ui.endShowDay && !ui.isCurrent && (
                    <div className="mt-1">
                      <button
                        type="button"
                        className="text-xs opacity-70 hover:underline"
                        onClick={() => setUiField(idx, { endShowDay: false, endDay: "" })}
                      >
                        Remove day
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      id={`edu-present-${idx}`}
                      type="checkbox"
                      className="w-4 h-4 accent-[var(--primary)]"
                      checked={ui.isCurrent}
                      onChange={(e) => setUiField(idx, { isCurrent: e.target.checked, endYear: "", endMonth: "", endDay: "", endShowDay: false })}
                    />
                    <label htmlFor={`edu-present-${idx}`} className="text-sm">
                      Currently here (Present)
                    </label>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div>
          <button
            type="button"
            onClick={addRow}
            className="px-3 py-2 text-sm rounded bg-neutral-100 hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
          >
            Add entry
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export default ExperienceModal;