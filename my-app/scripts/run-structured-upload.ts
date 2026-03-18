import fs from "node:fs";
import path from "node:path";
import { canonicalizeParserResult } from "../convex/lib/parsing/canonicalize";

type Mode = "text" | "auto" | "ocr";

function detectMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

async function fetchFromParser(
  endpoint: string,
  mode: Mode,
  rawText: string,
  fileBuffer: Buffer | null,
  fileName: string | null,
  mimeType: string | null,
) {
  const form = new FormData();
  form.set("mode", mode);
  if (mode === "text") {
    form.set("raw_text", rawText);
  } else if (fileBuffer) {
    const blob = new Blob([fileBuffer], { type: mimeType ?? "application/octet-stream" });
    form.set("file", blob, fileName ?? "upload.bin");
  }
  const res = await fetch(endpoint, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Parser responded ${res.status} ${res.statusText}: ${detail}`);
  }
  return res.json();
}

async function main() {
  const [, , modeRaw, inputArg, outputArg] = process.argv;
  const mode = (modeRaw ?? "").trim().toLowerCase() as Mode;
  if (!mode || !outputArg) {
    throw new Error("Usage: tsx scripts/run-structured-upload.ts <mode> <input> <output>");
  }

  const parserUrl = process.env.CONVEX_PARSER_URL;
  if (!parserUrl) {
    throw new Error("CONVEX_PARSER_URL must be set");
  }

  const outputPath = path.resolve(outputArg);
  let rawText = "";
  let fileBuffer: Buffer | null = null;
  let fileName: string | null = null;
  let mimeType: string | null = null;

  if (mode === "text") {
    if (!inputArg) throw new Error("Provide a text input file path for text mode");
    rawText = fs.readFileSync(path.resolve(inputArg), "utf8").trim();
  } else {
    if (!inputArg) throw new Error("Provide a file path for OCR/auto mode");
    const filePath = path.resolve(inputArg);
    fileBuffer = fs.readFileSync(filePath);
    fileName = path.basename(filePath);
    mimeType = detectMimeType(fileName);
  }

  const payload = await fetchFromParser(parserUrl, mode, rawText, fileBuffer, fileName, mimeType);
  const resultPayload = payload?.result ?? payload;
  const canonical = canonicalizeParserResult(resultPayload, {
    rawText,
    mode,
    parserUrl,
  });

  fs.writeFileSync(outputPath, JSON.stringify(canonical, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
