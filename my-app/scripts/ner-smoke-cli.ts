/**
 * my-app/scripts/ner-smoke-cli.ts
 *
 * CLI to call the local spaCy NER service via the nerClient helper
 * using env from my-app/.env.local. Pretty-prints entities and layout blocks.
 *
 * Usage:
 *   pnpm -w my-app exec tsx scripts/ner-smoke-cli.ts --text "...cv text..."
 *   pnpm -w my-app exec tsx scripts/ner-smoke-cli.ts --file my-app/testdata/cv/ResumesJsonAnnotated/cv\ \(1008\)_annotated.json
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { requestNER, isNEREnabled } from "../convex/lib/parsing_shared/nerClient";

dotenv.config({ path: path.resolve(process.cwd(), "my-app/.env.local") });

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--text") {
      out.text = argv[++i] ?? "";
    } else if (a === "--file") {
      out.file = argv[++i] ?? "";
    } else if (a === "--no-layout") {
      out["no-layout"] = true;
    }
  }
  return out;
}

function readFile(p: string): string {
  try {
    const raw = fs.readFileSync(p, "utf8");
    if (p.toLowerCase().endsWith(".json")) {
      try {
        const j = JSON.parse(raw);
        if (typeof j?.text === "string") return j.text as string;
      } catch {
        // fallthrough as plain text
      }
    }
    return raw;
  } catch (e) {
    throw new Error(`Unable to read file: ${p}`);
  }
}

function formatEntity(e: { label: string; text: string; start: number; end: number }): string {
  const text = e.text.replace(/\n/g, "\\n");
  return `${e.label.padEnd(14)} | ${text} (${e.start}-${e.end})`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  let text = String(args.text ?? "");
  const file = args.file ? String(args.file) : null;
  const layout = !args["no-layout"]; // default true

  if (!text && file) text = readFile(path.resolve(process.cwd(), file));
  text = text.trim();
  if (!text) {
    console.error("Provide --text or --file.");
    process.exitCode = 2;
    return;
  }

  if (!isNEREnabled()) {
    console.warn("NER not enabled or NER_SERVICE_URL not set. Check my-app/.env.local");
  }

  const res = await requestNER(text, { layout, timeoutMs: 5000, retry: 1 });
  if (!res) {
    console.error("NER request failed or returned invalid response.");
    process.exitCode = 1;
    return;
  }

  const ents = res.entities ?? [];
  const blocks = res.layout?.blocks ?? [];
  console.log(`Entities: ${ents.length}`);
  for (const e of ents) console.log("  ", formatEntity(e));
  if (layout) {
    console.log(`\nLayout blocks: ${blocks.length}`);
    for (const b of blocks.slice(0, 6)) {
      console.log(`  [${String(b.order).padStart(3, " ")}] (${b.start}-${b.end}) ${b.text.substring(0, 60).replace(/\n/g, " ")}${b.text.length > 60 ? "…" : ""}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

