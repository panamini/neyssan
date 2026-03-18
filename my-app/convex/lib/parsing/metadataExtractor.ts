/**
 * metadataExtractor.ts — simplified: delegate contact extraction to contactExtractor.
 * Returns only name/email/phone/linkedin (name left null — name heuristics handled elsewhere).
 */
import { extractContactFromText } from "./contactExtractor";

export interface ExtractedMetadata {
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
}

/**
 * Simple metadata extractor that delegates to the robust contact extractor.
 */
export function extractMetadataHeuristically(text: string): ExtractedMetadata {
  const contact = extractContactFromText(text);
  const email = Array.isArray(contact.emails) && contact.emails.length ? String(contact.emails[0]) : null;
  const phone = Array.isArray(contact.phones) && contact.phones.length ? String(contact.phones[0]) : null;
  const linkedinUrl = Array.isArray(contact.linkedinUrls) && contact.linkedinUrls.length ? String(contact.linkedinUrls[0]) : null;
  return { name: null, email, phone, linkedinUrl };
}