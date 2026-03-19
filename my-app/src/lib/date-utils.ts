/* Central date utilities shared by UI and model layers.
 * - Precision-aware formatting (year | month | day)
 * - Range formatting with Present semantics
 * - ISO parts helpers for Month–Year (+ optional Day) UI
 *
 * Usage:
 *   import { formatByPrecision, formatDateRange, parseIsoToParts, composeIsoFromParts } from '../lib/date-utils';
 */

import type { DatePrecision } from '../types/cvDocument';

export const PRESENT_LABEL = 'Present';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;

function isEpochSentinel(iso?: string | null): boolean {
  return typeof iso === 'string' && iso.startsWith('1970-01-01');
}

export function formatByPrecision(iso?: string | null, precision?: DatePrecision): string {
  if (!iso || isEpochSentinel(iso)) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth(); // 0-11
    const day = d.getUTCDate();
    const p: DatePrecision | undefined =
      precision ?? (iso.match(/^\d{4}-\d{2}-\d{2}/) ? 'day' : iso.match(/^\d{4}-\d{2}/) ? 'month' : 'year');

    if (p === 'year') return `${y}`;
    if (p === 'month') return `${MONTHS[m]} ${y}`;
    if (p === 'day') return `${MONTHS[m]} ${day}, ${y}`;
    return `${y}`;
  } catch {
    return '';
  }
}

export function formatDateRange(
  startDate?: string,
  endDate?: string | null,
  opts?: { startPrecision?: DatePrecision; endPrecision?: DatePrecision; isCurrent?: boolean }
): string {
  if (!startDate) return '';
  const start = formatByPrecision(startDate, opts?.startPrecision);
  if (opts?.isCurrent) return `${start} — ${PRESENT_LABEL}`;
  if (endDate) {
    const end = formatByPrecision(endDate, opts?.endPrecision);
    if (!end) return start;
    return `${start} — ${end}`;
  }
  // Unknown end date and not current: show only start (no "Present")
  return `${start}`;
}

/** Narrow helper interface for items that carry date range fields. */
export interface DateRangedItem {
  startDate?: string;
  endDate?: string | null;
  startDatePrecision?: DatePrecision;
  endDatePrecision?: DatePrecision;
  isCurrent?: boolean;
  /** Back-compat alias sometimes present on experience entries */
  currentlyWorking?: boolean;
}

/** Convenience: format a date range directly from a CV item. */
export function formatRangeFromItem(item?: DateRangedItem | null): string {
  if (!item?.startDate || isEpochSentinel(item.startDate)) return '';
  return formatDateRange(item.startDate, item.endDate, {
    startPrecision: item.startDatePrecision,
    endPrecision: item.endDatePrecision,
    isCurrent: Boolean(item.isCurrent || item.currentlyWorking),
  });
}

export function parseIsoToParts(iso: unknown): { year?: string; month?: string; day?: string } {
  try {
    if (typeof iso !== 'string' || !iso) return {};
    if (iso.startsWith('1970-01-01')) return {}; // hide epoch sentinel
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { year: m[1], month: m[2], day: m[3] };
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      const yyyy = String(d.getUTCFullYear());
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      return { year: yyyy, month: mm, day: dd };
    }
    return {};
  } catch {
    return {};
  }
}

function clampDay(year: number, month: number, day: number): number {
  const max = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1) return 1;
  if (day > max) return max;
  return day;
}

export function composeIsoFromParts(parts: {
  year?: string;
  month?: string;
  day?: string;
  precision?: DatePrecision;
}): { iso?: string; precision?: DatePrecision } {
  const year = parts.year ? Number(parts.year) : undefined;
  const month = parts.month ? Number(parts.month) : undefined;
  const wantDay = parts.precision === 'day';
  const dayNum = parts.day ? Number(parts.day) : undefined;

  if (year && month && wantDay && dayNum) {
    const d = clampDay(year, month, dayNum);
    return {
      iso: new Date(Date.UTC(year, month - 1, d, 0, 0, 0)).toISOString(),
      precision: 'day',
    };
  }
  if (year && month) {
    return {
      iso: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString(),
      precision: 'month',
    };
  }
  if (year) {
    return {
      iso: new Date(Date.UTC(year, 0, 1, 0, 0, 0)).toISOString(),
      precision: 'year',
    };
  }
  return { iso: undefined, precision: undefined };
}
