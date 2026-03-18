import { v4 as uuidv4 } from "uuid";
import { ensureRemirrorDoc } from "../components/remirror-editor/utils/conversion";
import { composeIsoFromParts } from "./date-utils";
import type { RemirrorJSON } from "remirror";
import type { IExperienceItem, IEducationItem } from "../types/cvDocument";

/**
 * Detect "Present" semantics on a rhs token.
 * Matches common variants (present/current/now) case-insensitively, trimming punctuation.
 */
export function detectPresent(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const s = raw.trim().replace(/[.,;:()\[\]{}]+$/g, "");
  if (!s) return false;
  return /(present|current|now)/i.test(s);
}

interface ParsedDateToken {
  year?: string;
  month?: string;
  day?: string;
  precision?: "year" | "month" | "day";
}

const MONTHS: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

/**
 * Parse human-friendly date tokens into parts and precision without guessing missing units.
 * Supported formats:
 * - YYYY
 * - YYYY-MM or YYYY/MM
 * - MM/YYYY
 * - Mon YYYY (Jan 2023) or Month YYYY (January 2023)
 * - Mon D YYYY or Month D, YYYY (comma optional)
 * - YYYY-MM-DD or YYYY/MM/DD
 */
export function parseHumanDateToken(raw: unknown): ParsedDateToken {
  if (typeof raw !== "string") return {};
  const s = raw.trim();
  if (!s) return {};

  // Year-only: 2021
  let m = /^(\d{4})$/.exec(s);
  if (m) {
    const year = m[1];
    return { year, precision: "year" };
  }

  // YYYY-MM or YYYY/MM
  m = /^(\d{4})[-/](\d{1,2})$/.exec(s);
  if (m) {
    const year = m[1];
    const month = String(m[2]).padStart(2, "0");
    return { year, month, precision: "month" };
  }

  // MM/YYYY
  m = /^(\d{1,2})[-/](\d{4})$/.exec(s);
  if (m) {
    const month = String(m[1]).padStart(2, "0");
    const year = m[2];
    return { year, month, precision: "month" };
  }

  // Mon YYYY | Month YYYY
  m = /^([A-Za-z]+)\s+(\d{4})$/.exec(s);
  if (m) {
    const monthKey = m[1].toLowerCase();
    const year = m[2];
    const month = MONTHS[monthKey];
    if (month) return { year, month, precision: "month" };
  }

  // Mon D YYYY | Month D YYYY | Month D, YYYY (comma optional)
  m = /^([A-Za-z]+)\s+(\d{1,2})(?:,)?\s+(\d{4})$/.exec(s);
  if (m) {
    const monthKey = m[1].toLowerCase();
    const day = String(m[2]).padStart(2, "0");
    const year = m[3];
    const month = MONTHS[monthKey];
    if (month) return { year, month, day, precision: "day" };
  }

  // YYYY-MM-DD or YYYY/MM/DD
  m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (m) {
    const year = m[1];
    const month = String(m[2]).padStart(2, "0");
    const day = String(m[3]).padStart(2, "0");
    return { year, month, day, precision: "day" };
  }

  // As a last resort, only attempt Date.parse when the raw string clearly contains a day component.
  // This avoids accidentally treating "2020-01" or "2018" as day-precision dates because Date.parse
  // will default missing parts to 1 and produce a valid Date object.
  const looksLikeFullDate = /([A-Za-z]+\s+\d{1,2},?\s+\d{4})|(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;
  if (looksLikeFullDate.test(s)) {
    const parsed = Date.parse(s);
    if (!Number.isNaN(parsed)) {
      const d = new Date(parsed);
      // Only accept if all parts exist (we still consider this "day" precision)
      const y = d.getUTCFullYear();
      const mon = d.getUTCMonth() + 1;
      const dd = d.getUTCDate();
      if (y && mon && dd) {
        return {
          year: String(y),
          month: String(mon).padStart(2, "0"),
          day: String(dd).padStart(2, "0"),
          precision: "day",
        };
      }
    }
  }

  return {};
}

export interface MappedDateRange {
  startIso?: string;
  startPrecision?: "year" | "month" | "day";
  endIso?: string | null;
  endPrecision?: "year" | "month" | "day";
  isCurrent?: boolean;
}

/**
 * Compose ISO + precision range from two tokens.
 * When rhs indicates Present/current/now: sets isCurrent=true, endIso=null, endPrecision=undefined.
 */
export function mapDateRangeToIsoPrecision(lhs: unknown, rhs: unknown): MappedDateRange {
  const left = parseHumanDateToken(lhs);
  const rightIsPresent = detectPresent(rhs);
  const right = rightIsPresent ? {} : parseHumanDateToken(rhs);

  const start = composeIsoFromParts({
    year: left.year,
    month: left.month,
    day: left.day,
    precision: left.precision,
  });

  if (rightIsPresent) {
    return {
      startIso: start.iso,
      startPrecision: start.precision,
      endIso: null,
      endPrecision: undefined,
      isCurrent: true,
    };
  }

  const end = composeIsoFromParts({
    year: right.year,
    month: right.month,
    day: right.day,
    precision: right.precision,
  });

  return {
    startIso: start.iso,
    startPrecision: start.precision,
    endIso: end.iso,
    endPrecision: end.precision,
    isCurrent: undefined,
  };
}

/** Normalize description/responsibilities to Remirror JSON document */
export function toRemirrorDoc(raw: unknown): RemirrorJSON {
  return ensureRemirrorDoc(raw as any);
}

interface AiExperienceInput {
  id?: string;
  company?: string;
  position?: string;
  role?: string;
  location?: string;
  start?: string;
  end?: string;
  startDate?: string;
  endDate?: string | null;
  isCurrent?: boolean;
  currentlyWorking?: boolean;
  description?: string | RemirrorJSON;
  responsibilities?: string | RemirrorJSON;
  achievements?: Array<string>;
  [key: string]: unknown;
}

interface AiEducationInput {
  id?: string;
  institution?: string;
  degree?: string;
  fieldOfStudy?: string;
  start?: string;
  end?: string;
  startDate?: string;
  endDate?: string | null;
  isCurrent?: boolean;
  grade?: string;
  description?: string | RemirrorJSON;
  [key: string]: unknown;
}

/**
 * Map AI parsed experience items (loose shape) to IExperienceItem[]
 * - Dates: parsed from (start|startDate) and (end|endDate) with explicit Present semantics
 * - Description mapped to responsibilities (Remirror JSON)
 * - Leaves unmapped optional fields blank
 */
export function mapAiExperience(input: unknown): IExperienceItem[] {
  const arr: AiExperienceInput[] = Array.isArray(input) ? (input as AiExperienceInput[]) : [];
  const out: IExperienceItem[] = [];

  for (const [idx, it] of arr.entries()) {
    const id = typeof it.id === "string" && it.id.trim() ? it.id : uuidv4();
    const company = typeof it.company === "string" ? it.company : "";
    const position = typeof it.position === "string" ? it.position : (typeof it.role === "string" ? it.role : "");
    const location = typeof it.location === "string" ? it.location : "";

    const startToken = typeof it.startDate === "string" ? it.startDate : it.start;
    const endToken = typeof it.endDate === "string" || it.endDate === null ? it.endDate : it.end;

    const { startIso, startPrecision, endIso, endPrecision, isCurrent } = mapDateRangeToIsoPrecision(startToken, endToken as any);

    // Respect explicit boolean flags if provided (prefer explicit true over inferred)
    const currentFinal = it.isCurrent === true || it.currentlyWorking === true ? true : isCurrent ? true : undefined;

    // Prefer 'responsibilities' for experience body (our schema)
    const bodyRaw = typeof it.responsibilities !== "undefined" ? it.responsibilities : it.description;
    const responsibilities = bodyRaw !== undefined ? toRemirrorDoc(bodyRaw) : undefined;

    const achievements = Array.isArray(it.achievements) ? it.achievements.map(String) : [];

    // If startIso missing, use epoch sentinel to satisfy strict schema (UI will render it blank)
    const startDate = startIso ?? new Date(Date.UTC(1970, 0, 1, 0, 0, 0)).toISOString();
    const item: IExperienceItem = {
      id,
      company,
      position,
      startDate,
      startDatePrecision: startPrecision,
      endDate: currentFinal ? null : endIso ?? null,
      endDatePrecision: currentFinal ? undefined : endPrecision,
      isCurrent: currentFinal,
      currentlyWorking: currentFinal,
      location,
      responsibilities,
      achievements,
    };
    out.push(item);
  }

  return out;
}

/**
 * Map AI parsed education items (loose shape) to IEducationItem[]
 * - Dates: parsed from (start|startDate) and (end|endDate) with explicit Present semantics
 * - Description mapped to Remirror JSON
 */
export function mapAiEducation(input: unknown): IEducationItem[] {
  const arr: AiEducationInput[] = Array.isArray(input) ? (input as AiEducationInput[]) : [];
  const out: IEducationItem[] = [];

  for (const [idx, it] of arr.entries()) {
    const id = typeof it.id === "string" && it.id.trim() ? it.id : uuidv4();
    const institution = typeof it.institution === "string" ? it.institution : "";
    const degree = typeof it.degree === "string" ? it.degree : "";
    const fieldOfStudy = typeof it.fieldOfStudy === "string" ? it.fieldOfStudy : "";

    const startToken = typeof it.startDate === "string" ? it.startDate : it.start;
    const endToken = typeof it.endDate === "string" || it.endDate === null ? it.endDate : it.end;

    const { startIso, startPrecision, endIso, endPrecision, isCurrent } = mapDateRangeToIsoPrecision(startToken, endToken as any);

    const currentFinal = it.isCurrent === true ? true : isCurrent ? true : undefined;
    const description = typeof it.description !== "undefined" ? toRemirrorDoc(it.description) : undefined;
    const grade = typeof it.grade === "string" ? it.grade : "";

    const item: IEducationItem = {
      id,
      institution,
      degree,
      fieldOfStudy,
      startDate: startIso ?? undefined,
      startDatePrecision: startPrecision,
      endDate: currentFinal ? null : (endIso ?? undefined),
      endDatePrecision: currentFinal ? undefined : endPrecision,
      isCurrent: currentFinal,
      grade,
      description,
    };
    out.push(item);
  }

  return out;
}