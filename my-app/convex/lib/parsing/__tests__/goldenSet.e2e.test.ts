/* my-app/convex/lib/parsing/__tests__/goldenSet.e2e.test.ts
   Golden-set harness to evaluate NER-assisted fusion end-to-end without requiring Convex runtime.

   How it works:
   - Scans my-app/testdata/cv/golden/*.txt for raw CV text files (UTF-8).
   - If ENABLE_NER=1 and NER_SERVICE_URL is set, calls requestNER(text) to obtain entities.
   - Attaches the NER payload to mappedCv._ner and calls mapParsedToStrict() directly.
   - Aggregates simple metrics (name/location coverage; experience presence).
   - Prints a summary at the end. This is a lightweight QA harness, not a pass/fail analytics suite.

   Usage:
   - Place ~30 CV .txt files under my-app/testdata/cv/golden/
   - Ensure spaCy service is running and Convex env vars are set (see docs/spacy-layout-service.md):
       ENABLE_NER=1
       NER_SERVICE_URL=...
       NER_SERVICE_KEY=...
   - Run:  npm run test -- -t "Golden set NER fusion"
*/

import { describe, it, expect } from "vitest";
import { mapParsedToStrict } from "../../parsing/strictProfileAdapter";
import { requestNER, isNEREnabled } from "../../parsing_shared/nerClient";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load NER-related environment for the harness. Try both repo root and my-app cwd layouts.
(function loadEnv(): void {
  try {
    dotenv.config({ path: path.resolve(process.cwd(), "my-app/.env.production") });
  } catch {
    /* ignore */
  }
  // Fallback when running with cwd = my-app
  if (!process.env.NER_SERVICE_URL && !process.env.ENABLE_NER) {
    try {
      dotenv.config({ path: path.resolve(process.cwd(), ".env.production") });
    } catch {
      /* ignore */
    }
  }
})();

interface ParsedSection {
  title: string;
  content: string;
  fieldKey: string;
  confidence: number;
}
interface Metadata {
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
}

function readGoldenFiles(dir: string): string[] {
  try {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".txt"))
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

function safeReadFile(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

describe("Golden set NER fusion", () => {
  it("runs over golden *.txt files, applying NER-assisted fusion when enabled", async () => {
    // Support both cwd patterns:
    // - When running inside my-app: ./testdata/cv/golden
    // - When running from repo root: ./my-app/testdata/cv/golden
    const candidateDirs = [
      path.resolve(process.cwd(), "testdata/cv/golden"),
      path.resolve(process.cwd(), "my-app/testdata/cv/golden"),
    ];
    let chosenDir = "";
    let files: string[] = [];
    for (const d of candidateDirs) {
      const f = readGoldenFiles(d);
      if (f.length > 0) {
        chosenDir = d;
        files = f;
        break;
      }
    }

    if (files.length === 0) {
      // Soft assert: no files found, this is an opt-in harness.
      // eslint-disable-next-line no-console
      console.warn(
        `[golden-set] No files found. Tried: ${candidateDirs.join(
          ", "
        )} (place *.txt under testdata/cv/golden to enable this harness).`
      );
      expect(true).toBe(true);
      return;
    }

    let total = 0;
    let namePresent = 0;
    let locationPresent = 0;
    let expPresent = 0;

    const nerEnabled = isNEREnabled();

    // Narrow, consistent sections (we don't rely on LLM sections for this harness)
    const baseSections: ParsedSection[] = [
      { title: "Intro", content: "", fieldKey: "summary", confidence: 0.6 },
    ];
    const baseMeta: Metadata | null = null;

    for (const file of files) {
      const text = safeReadFile(file);
      if (!text.trim()) continue;

      total += 1;
      let mappedCv: unknown = null;

      // Optionally call spaCy service for this raw text and attach as _ner
      if (nerEnabled) {
        try {
          const ner = await requestNER(text, { timeoutMs: 2500, layout: false });
          if (ner) mappedCv = { _ner: ner };
        } catch {
          // ignore NER failure; continue with heuristics-only
        }
      }

      const out = mapParsedToStrict({
        rawText: text,
        parsedSections: baseSections,
        metadata: baseMeta,
        mappedCv,
      });

      if (out.name) namePresent += 1;
      if (out.location) locationPresent += 1;
      if (Array.isArray(out.experience) && out.experience.length > 0) expPresent += 1;
    }

    // Print summary for QA
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          filesProcessed: total,
          nerEnabled,
          metrics: {
            nameCoverage: total ? Number((namePresent / total).toFixed(3)) : 0,
            locationCoverage: total ? Number((locationPresent / total).toFixed(3)) : 0,
            experiencePresence: total ? Number((expPresent / total).toFixed(3)) : 0,
          },
        },
        null,
        2
      )
    );

    // Soft assertions: we at least processed something if files existed.
    expect(total).toBeGreaterThan(0);
  }, 60_000);
});