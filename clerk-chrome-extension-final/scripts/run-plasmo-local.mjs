import { readFile, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const command = process.argv[2];

if (command !== "build" && command !== "dev") {
  console.error("[run-plasmo-local] Usage: node ./scripts/run-plasmo-local.mjs <build|dev>");
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const envFile = path.join(repoRoot, ".env.chrome");
const plasmoBin = path.join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "plasmo.cmd" : "plasmo"
);
const plasmoCacheDir = path.join(repoRoot, ".plasmo", "cache");
const buildRoot = path.join(repoRoot, "build");
const canonicalLocalTargetName = "chrome-mv3-dev";

function parseEnvFile(source) {
  const env = {};

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const envFileContents = await readFile(envFile, "utf8");
const localEnv = parseEnvFile(envFileContents);

// Plasmo can reuse stale cached env substitutions. Clear only the Plasmo cache,
// not the current build output, before local dev/build.
await rm(plasmoCacheDir, { recursive: true, force: true });

if (command === "build") {
  const existingBuildEntries = await readdir(buildRoot, { withFileTypes: true }).catch(() => []);
  await Promise.all(
    existingBuildEntries.map(async (entry) => {
      if (!entry.isDirectory()) return;
      if (!entry.name.startsWith("chrome-mv3-dev")) return;
      await rm(path.join(buildRoot, entry.name), { recursive: true, force: true });
    })
  );
}

const childEnv = {
  ...process.env,
  ...localEnv
};

const child = spawn(
  plasmoBin,
  [command, "--target=chrome-mv3-dev", "--env=.env.chrome"],
  {
    cwd: repoRoot,
    env: childEnv,
    stdio: "inherit"
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  if ((code ?? 1) === 0 && command === "build") {
    void (async () => {
      try {
        const buildEntries = await readdir(buildRoot, { withFileTypes: true });
        const localTargets = await Promise.all(
          buildEntries
            .filter((entry) => entry.isDirectory() && entry.name.startsWith("chrome-mv3-dev"))
            .map(async (entry) => {
              const targetPath = path.join(buildRoot, entry.name);
              const metadata = await stat(targetPath);
              return {
                name: entry.name,
                targetPath,
                mtimeMs: metadata.mtimeMs
              };
            })
        );

        localTargets.sort((a, b) => b.mtimeMs - a.mtimeMs);
        const latestTarget = localTargets[0];
        if (latestTarget) {
          const canonicalTargetPath = path.join(buildRoot, canonicalLocalTargetName);

          if (latestTarget.name !== canonicalLocalTargetName) {
            await rm(canonicalTargetPath, { recursive: true, force: true });
            await rename(latestTarget.targetPath, canonicalTargetPath);
          }

          const normalizedEntries = await readdir(buildRoot, { withFileTypes: true });
          await Promise.all(
            normalizedEntries.map(async (entry) => {
              if (!entry.isDirectory()) return;
              if (!entry.name.startsWith("chrome-mv3-dev")) return;
              if (entry.name === canonicalLocalTargetName) return;
              await rm(path.join(buildRoot, entry.name), { recursive: true, force: true });
            })
          );

          console.log(`[run-plasmo-local] Load unpacked extension from: ${canonicalTargetPath}`);
        }
      } catch (error) {
        console.warn("[run-plasmo-local] Failed to determine latest local build output:", error);
      } finally {
        process.exit(code ?? 1);
      }
    })();
    return;
  }

  process.exit(code ?? 1);
});
