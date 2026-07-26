import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(repoRoot, "my-app", "src");

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(path)) ? [path] : [];
  });
}

test("every browser PDF.js loader disables dynamic evaluation", () => {
  const loaders = [];
  const getDocumentCall = /\.getDocument\s*\(\s*\{([\s\S]*?)\}\s*\)/gu;

  for (const path of sourceFiles(sourceRoot)) {
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(getDocumentCall)) {
      loaders.push({ path, options: match[1] });
    }
  }

  assert.equal(loaders.length, 2, "Update this contract when adding a PDF.js loader.");
  for (const loader of loaders) {
    assert.match(
      loader.options,
      /\bisEvalSupported:\s*false\b/u,
      `Dynamic PDF.js evaluation must stay disabled in ${loader.path}`,
    );
  }
});
