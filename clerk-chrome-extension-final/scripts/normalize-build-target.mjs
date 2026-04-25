import { readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const canonicalTargetName = process.argv[2];

if (!canonicalTargetName) {
  console.error("[normalize-build-target] Missing canonical target name argument.");
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const buildRoot = path.join(repoRoot, "build");

const buildEntries = await readdir(buildRoot, { withFileTypes: true });
const matchingTargets = await Promise.all(
  buildEntries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        (entry.name === canonicalTargetName ||
          entry.name.startsWith(`${canonicalTargetName}-`)),
    )
    .map(async (entry) => {
      const targetPath = path.join(buildRoot, entry.name);
      const metadata = await stat(targetPath);
      return {
        name: entry.name,
        targetPath,
        mtimeMs: metadata.mtimeMs,
      };
    }),
);

matchingTargets.sort((a, b) => b.mtimeMs - a.mtimeMs);
const latestTarget = matchingTargets[0];

if (!latestTarget) {
  console.error(
    `[normalize-build-target] No build directory found for ${canonicalTargetName}.`,
  );
  process.exit(1);
}

const canonicalTargetPath = path.join(buildRoot, canonicalTargetName);

if (latestTarget.name !== canonicalTargetName) {
  await rm(canonicalTargetPath, { recursive: true, force: true });
  await rename(latestTarget.targetPath, canonicalTargetPath);
}

const normalizedEntries = await readdir(buildRoot, { withFileTypes: true });
await Promise.all(
  normalizedEntries.map(async (entry) => {
    if (!entry.isDirectory()) return;
    if (entry.name === canonicalTargetName) return;
    if (!entry.name.startsWith(canonicalTargetName)) return;
    await rm(path.join(buildRoot, entry.name), { recursive: true, force: true });
  }),
);

console.log(
  `[normalize-build-target] Canonical build directory ready at: ${canonicalTargetPath}`,
);
