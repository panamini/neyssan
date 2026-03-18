/**
 * my-app/scripts/run-extract-profile-strict.ts
 * CLI helper to run the strict extractor locally (Node) without Convex server.
 *
 * Usage:
 *   pnpm --filter my-app run extract:strict -- ./path/to/cv.txt
 *   or
 *   npm run -w my-app extract:strict -- ./path/to/cv.txt
 *
 * Behavior:
 * - Loads NER env from my-app/.env.production (ENABLE_NER, NER_SERVICE_URL, NER_SERVICE_KEY) for convenience.
 * - Calls parseCV(rawText, { returnMappedCV: true, mapperStrip: true }) if available.
 * - Optionally calls NER service and attaches the payload under mappedCv._ner.
 * - Runs mapParsedToStrict and prints the validated StrictProfile JSON.
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { mapParsedToStrict } from "../convex/lib/parsing/strictProfileAdapter";
import { requestNER, isNEREnabled } from "../convex/lib/parsing_shared/nerClient";
import type { StrictProfile } from "../convex/lib/schemas/profileStrict.schema";

// Prefer to use parseCV if available (typed signature kept minimal to avoid coupling)
type ParseCVFn = (rawText: string, opts: { returnMappedCV: boolean; mapperStrip: boolean }) => Promise<unknown>;

// Load env (NER) from app .env for local runs (harmless if file missing)
dotenv.config({ path: path.resolve(process.cwd(), "my-app/.env.production") });

interface ParsedSection {
  title: string;
  content: string;
  fieldKey: string;
  confidence: number;
}

interface ParsedMetadata {
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
}

interface ParsedCVOut {
  sections: ParsedSection[];
  metadata: ParsedMetadata | null;
  cv: unknown | null;
}

function isFileReadable(p: string): boolean {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    const st = fs.statSync(p);
    return st.isFile();
  } catch {
    return false;
  }
}

function readTextFile(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.resume();
  });
}

async function dynamicImportParseCV(): Promise<ParseCVFn | undefined> {
  try {
    // Dynamic import to avoid bundling issues in environments missing deps
    const mod = (await import("../convex/lib/parsing/hybridParser")) as { parseCV: ParseCVFn };
    if (typeof mod?.parseCV === "function") return mod.parseCV;
    return undefined;
  } catch {
    return undefined;
  }
}

function coerceSections(x: unknown): ParsedSection[] {
  if (!Array.isArray(x)) return [];
  const out: ParsedSection[] = [];
  for (const s of x) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title : "";
    const content = typeof o.content === "string" ? o.content : "";
    const fieldKey = typeof o.fieldKey === "string" ? o.fieldKey : "";
    const confidence = Number.isFinite(o.confidence) ? Number(o.confidence) : 0;
    if (!title && !content && !fieldKey) continue;
    out.push({ title, content, fieldKey, confidence });
  }
  return out;
}

function coerceMetadata(x: unknown): ParsedMetadata | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  return {
    name: o.name == null ? null : String(o.name),
    email: o.email == null ? null : String(o.email),
    phone: o.phone == null ? null : String(o.phone),
    linkedinUrl: o.linkedinUrl == null ? null : String(o.linkedinUrl),
  };
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  let rawText = "";

  if (arg && arg !== "-") {
    const abs = path.resolve(process.cwd(), arg);
    if (!isFileReadable(abs)) {
      process.stderr.write(`Input file not found or unreadable: ${abs}\n`);
      process.exitCode = 2;
      return;
    }
    rawText = readTextFile(abs);
  } else {
    rawText = await readStdin();
  }

  rawText = String(rawText ?? "").trim();
  if (!rawText) {
    process.stderr.write("No input text provided. Pass a file path or pipe text via stdin.\n");
    process.exitCode = 2;
    return;
  }

  let parsed: ParsedCVOut = { sections: [], metadata: null, cv: null };

  // Try parseCV; if missing, fall back to minimal defaults.
  try {
    const parseCV = await dynamicImportParseCV();
    if (parseCV) {
      const r = (await parseCV(rawText, { returnMappedCV: true, mapperStrip: true })) as unknown as Record<string, unknown>;
      parsed = {
        sections: coerceSections(r.sections),
        metadata: coerceMetadata(r.metadata),
        cv: Object.prototype.hasOwnProperty.call(r, "cv") ? (r.cv as unknown) : null,
      };
    }
  } catch {
    // ignore parser failure; we'll proceed heuristics-only
  }

  // Optional NER
  let mappedCvCombined: unknown | null = parsed.cv;
  try {
    if (isNEREnabled()) {
      const ner = await requestNER(rawText, { timeoutMs: 2500, layout: false });
      if (ner) {
        mappedCvCombined =
          parsed.cv && typeof parsed.cv === "object"
            ? { ...(parsed.cv as Record<string, unknown>), _ner: ner }
            : { _ner: ner };
      }
    }
  } catch {
    // ignore NER failure
  }

  const strict: StrictProfile = mapParsedToStrict({
    rawText,
    parsedSections: parsed.sections,
    metadata: parsed.metadata,
    mappedCv: mappedCvCombined,
  }) as StrictProfile;

  // Print JSON to stdout
  process.stdout.write(`${JSON.stringify(strict, null, 2)}\n`);
}

main().catch((_e) => {
  // final safety
  process.exitCode = 1;
});