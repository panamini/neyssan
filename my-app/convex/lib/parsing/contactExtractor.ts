// my-app/convex/lib/parsing/contactExtractor.ts
import { z } from "zod";
import { findPhoneNumbersInText, CountryCode } from "libphonenumber-js";
import { extractName as extractNameHeuristic } from "../parsing_shared/contactHeuristics";

// pipeline-note: lowest-level contact extraction lives here. strictProfileAdapter
// and cvMapper delegate to these helpers for email/phone/linkedin (and now name)
// so keep heuristics centralized.

/**
 * Zod schema for structured contact info extracted from freeform text.
 * Uses arrays to capture multiple values for maximum detection.
 * Keeps fields optional to avoid throwing on partial results.
 */
export const ContactSchema = z.object({
  emails: z.array(z.string().email()).optional(),
  phones: z.array(z.string()).optional(), // E.164 formatted strings
  linkedinUrls: z.array(z.string().url()).optional(),
  names: z.array(z.string()).optional(),
  raw: z.string().nullable().optional(),
});

export type IContact = z.infer<typeof ContactSchema>;

/**
 * Simple helper: validate string array, deduplicate, but don't throw.
 * Returns validated unique values in original order of first appearance.
 */
function safeValidateAndDeduplicate(items: string[] = [], schema: z.ZodString) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const candidate = it.trim();
    if (seen.has(candidate)) continue;
    const res = schema.safeParse(candidate);
    if (res.success) {
      seen.add(candidate);
      out.push(res.data);
    }
  }
  return out;
}

/**
 * Extract contact pieces from arbitrary text, using libphonenumber-js for robust
 * phone detection and normalization to E.164.
 *
 * - emails: all valid email-like tokens (validated via Zod email)
 * - phones: all globally-detected phones via findPhoneNumbersInText (normalized .number)
 * - linkedinUrls: links containing linkedin.com (validated as URLs via Zod)
 *
 * defaultCountry (optional) can be provided to help parse national-format numbers.
 *
 * Returns an object validated by Zod (fields may be undefined if none found).
 */
export function extractContactFromText(text: string | null | undefined, defaultCountry?: CountryCode): IContact {
  const raw = (text ?? "").trim();
  if (!raw) return ContactSchema.parse({ raw: "" });

  // 1) Emails - find all potential matches, dedupe & validate
  const emailMatches = raw.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) || [];
  const emails = safeValidateAndDeduplicate(emailMatches.map((e) => e.trim()), z.string().email());

  // 2) Phones - use libphonenumber-js findPhoneNumbersInText to get E.164 normalized numbers
  let phones: string[] = [];
  try {
    const found = findPhoneNumbersInText(raw, defaultCountry);
    const formattedNumbers: string[] = [];
    for (const f of found) {
      // f.number.number is the E.164 normalized form
      if (f?.number?.number) formattedNumbers.push(f.number.number);
    }
    // Deduplicate preserving order
    phones = Array.from(new Set(formattedNumbers));
  } catch {
    // If lib phonenumber errors, fall back to empty list (do not throw)
    phones = [];
  }

  // Fallback (best-effort): if libphonenumber didn't find anything, run a permissive regex
  // and normalize by stripping separators. This helps in CI where the lib parser may not
  // detect certain formats in constrained environments.
  if (phones.length === 0) {
    const phoneCandidates = raw.match(/\+?\d[\d\s().-]{6,}\d/g) || [];
    const normalizedSet = new Set<string>();
    for (const cand of phoneCandidates) {
      // Normalize: remove spaces, dots, parentheses and hyphens
      const normalized = cand.replace(/[\s().-]/g, "").trim();
      if (!normalized) continue;
      // Ensure leading + is preserved if present; otherwise keep as-is
      normalizedSet.add(normalized);
    }
    if (normalizedSet.size > 0) phones = Array.from(normalizedSet);
  }

  // 3) LinkedIn URLs - capture explicit linkedin links, normalize and dedupe
  const linkedInRegex = /(https?:\/\/)?((?:www\.)?linkedin\.com\/(?:in|pub|company)\/[\w-]+)/gi;
  const linkedinMatches: string[] = [];
  for (const m of raw.matchAll(linkedInRegex)) {
    if (!m[0]) continue;
    const candidate = m[0].startsWith("http") ? m[0].trim() : `https://${m[0].trim()}`;
    linkedinMatches.push(candidate);
  }
  const linkedinUrls = safeValidateAndDeduplicate(linkedinMatches, z.string().url());

  const candidate: any = {
    raw,
  };
  if (emails.length > 0) candidate.emails = emails;
  if (phones.length > 0) candidate.phones = phones;
  if (linkedinUrls.length > 0) candidate.linkedinUrls = linkedinUrls;

  // Names: reuse contact heuristics to surface a sanitized primary candidate.
  try {
    const primaryName = extractNameHeuristic(raw, emails[0] ?? null);
    if (primaryName?.value) {
      candidate.names = [primaryName.value];
    }
  } catch {
    /* ignore name extraction failures */
  }

  // Return Zod-parsed/sanitized object (will remove invalid values)
  return ContactSchema.parse(candidate);
}
