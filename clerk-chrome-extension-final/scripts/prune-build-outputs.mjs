import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const keepTarget = process.argv[2];

if (!keepTarget) {
  console.error("[prune:build] Missing keep target argument.");
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const buildRoot = path.join(repoRoot, "build");

const entries = await readdir(buildRoot, { withFileTypes: true });
const removedTargets = [];

await Promise.all(
  entries.map(async (entry) => {
    if (!entry.isDirectory() || entry.name === keepTarget) {
      return;
    }

    const targetPath = path.join(buildRoot, entry.name);
    await rm(targetPath, { recursive: true, force: true });
    removedTargets.push(entry.name);
  })
);

if (removedTargets.length > 0) {
  removedTargets.sort();
  console.log(`[prune:build] Removed non-canonical build directories: ${removedTargets.join(", ")}`);
} else {
  console.log(`[prune:build] ${keepTarget} is the only build directory present.`);
}
