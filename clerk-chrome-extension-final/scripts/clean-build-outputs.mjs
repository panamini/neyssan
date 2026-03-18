import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const buildRoot = path.join(repoRoot, "build");

const knownTargets = [
  "chrome-mv3-dev",
  "chrome-mv3-prod",
  "chrome-mv3-dev-dev",
  "chrome-mv3-dev-prod"
];

await Promise.all(
  knownTargets.map(async (target) => {
    const targetPath = path.join(buildRoot, target);
    await rm(targetPath, { recursive: true, force: true });
  })
);

await mkdir(buildRoot, { recursive: true });

const remainingEntries = (await readdir(buildRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (remainingEntries.length > 0) {
  console.log(`[clean:build] Remaining build directories: ${remainingEntries.join(", ")}`);
} else {
  console.log("[clean:build] Removed canonical and legacy extension build outputs.");
}
