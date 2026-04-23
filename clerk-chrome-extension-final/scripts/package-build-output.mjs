import { access, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const canonicalTargetName = process.argv[2];

if (!canonicalTargetName) {
  console.error("[package-build-output] Missing canonical target name argument.");
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const buildRoot = path.join(repoRoot, "build");
const sourceDir = path.join(buildRoot, canonicalTargetName);
const zipPath = path.join(buildRoot, `${canonicalTargetName}.zip`);

await access(sourceDir).catch(() => {
  console.error(`[package-build-output] Build directory not found: ${sourceDir}`);
  process.exit(1);
});

await rm(zipPath, { force: true });

await new Promise((resolve, reject) => {
  const child = spawn(
    "/usr/bin/zip",
    ["-r", "-X", zipPath, canonicalTargetName],
    {
      cwd: buildRoot,
      stdio: "inherit",
    },
  );

  child.on("error", reject);
  child.on("exit", (code, signal) => {
    if (signal) {
      reject(new Error(`[package-build-output] zip exited with signal ${signal}`));
      return;
    }
    if ((code ?? 1) !== 0) {
      reject(new Error(`[package-build-output] zip exited with code ${code ?? 1}`));
      return;
    }
    resolve(undefined);
  });
});

const zipStats = await stat(zipPath);

if (zipStats.size === 0) {
  console.error(`[package-build-output] Created empty archive: ${zipPath}`);
  process.exit(1);
}

console.log(`[package-build-output] Packaged ${sourceDir} -> ${zipPath}`);
