#!/usr/bin/env node
/**
 * check-convex-functions.mjs
 *
 * Quick diagnostic to verify generated Convex API surface and whether
 * `api.mutations.upsertProfile` exists. Run from the project root:
 *
 *   node ./scripts/check-convex-functions.mjs
 *
 * The script will:
 * - Look for common generated API file names under `convex/_generated/`
 * - If a JS module is present, dynamically import it and print available keys
 * - If only TS is present, print a quick textual scan for "mutations" / "upsertProfile"
 *
 * This helps determine whether `mutations.upsertProfile` is present client-side
 * (codegen step) or missing (requires running `npx convex dev` with codegen).
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const projectConvexGenDir = path.resolve("./convex/_generated");
const candidates = [
  "api.js",
  "api.mjs",
  "api.cjs",
  "api.ts",
  "api.d.ts",
  "index.js",
  "index.mjs",
  "index.cjs",
];

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

async function tryImport(filePath) {
  const ext = path.extname(filePath);
  try {
    if (ext === ".cjs") {
      const req = createRequire(import.meta.url);
      return { ok: true, module: req(filePath) };
    }
    const fileUrl = `file://${filePath}`;
    const mod = await import(fileUrl);
    return { ok: true, module: mod };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function scanTextFor(filePath, patterns) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const results = {};
    for (const p of patterns) {
      results[p] = content.includes(p);
    }
    return results;
  } catch (err) {
    return { error: String(err) };
  }
}

(async function main() {
  console.log("Checking for generated Convex API in:", projectConvexGenDir);
  if (!exists(projectConvexGenDir)) {
    console.error("No convex/_generated directory found. Run `npx convex dev` to generate code.");
    process.exitCode = 2;
    return;
  }

  const found = [];
  for (const name of candidates) {
    const p = path.join(projectConvexGenDir, name);
    if (exists(p)) found.push(p);
  }

  if (found.length === 0) {
    console.error("No candidate generated API files found under convex/_generated.");
    console.error("Files checked:", candidates.join(", "));
    process.exitCode = 3;
    return;
  }

  console.log("Found candidate generated files:");
  found.forEach((f) => console.log(" -", path.relative(process.cwd(), f)));

  // Prefer JS-like files that we can import
  const importable = found.find((f) => [".js", ".mjs", ".cjs"].includes(path.extname(f)));
  if (importable) {
    console.log("\nAttempting dynamic import of:", path.relative(process.cwd(), importable));
    const res = await tryImport(importable);
    if (!res.ok) {
      console.error("Import failed:", res.error);
      process.exitCode = 4;
      return;
    }
    const api = res.module?.api ?? res.module?.default ?? res.module;
    console.log("Top-level exports (keys):", Object.keys(api || {}));
    const hasMutations = api && typeof api.mutations !== "undefined";
    console.log("Has `api.mutations`?:", hasMutations);
    if (hasMutations) {
      console.log("mutation keys:", Object.keys(api.mutations));
      const hasUpsert = typeof (api.mutations?.upsertProfile ?? api.mutations?.["upsertProfile"]) !== "undefined";
      console.log("Has `mutations.upsertProfile`?:", Boolean(hasUpsert));
      if (!hasUpsert) {
        console.log("Note: mutation exists but `upsertProfile` not found. List the mutation keys above to inspect naming.");
      }
    } else {
      console.log("`api.mutations` not found. Inspect available keys above.");
    }
    return;
  }

  // If no importable JS file, scan text of the found files for clues.
  console.log("\nNo importable JS file found; scanning textual files for occurrences...");
  for (const f of found) {
    console.log("\n-- Scanning", path.relative(process.cwd(), f));
    const scan = scanTextFor(f, ["mutations", "upsertProfile", "upsert_profile", "mutations/upsertProfile", "mutations:upsertProfile"]);
    console.log(JSON.stringify(scan, null, 2));
  }

  console.log("\nIf the mutation is not present in generated API, run `npx convex dev --codegen=enable` in the my-app directory and re-run this script.");
  process.exitCode = 0;
})();