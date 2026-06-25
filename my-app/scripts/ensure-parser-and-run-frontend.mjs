#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "..");
const tunnelFile = path.join(appRoot, ".parser-tunnel-url");
const startParserScript = path.join(repoRoot, "scripts", "start-parser-service.sh");

const isProduction = process.env.NODE_ENV === "production";

const CONTEXT = "[structuredUpload:dev]";
const LOCAL_PARSER_CANDIDATES = [
  "http://127.0.0.1:8001",
  "http://localhost:8001",
];

function isLoopbackHost(hostname) {
  if (!hostname) return false;
  const lower = hostname.toLowerCase();
  return lower === "localhost" || lower === "127.0.0.1" || lower === "::1";
}

function persistTunnelUrl(url) {
  if (!url) return;
  try {
    const parsed = new URL(url);
    if (isLoopbackHost(parsed.hostname)) {
      return;
    }
    writeFileSync(tunnelFile, `${url.trim()}\n`, "utf8");
  } catch (err) {
    console.warn(`${CONTEXT} Failed to persist tunnel URL to ${tunnelFile}`, err);
  }
}

function readTunnelUrlFromFile() {
  if (!existsSync(tunnelFile)) {
    return null;
  }
  try {
    const raw = readFileSync(tunnelFile, "utf8").trim();
    if (!raw) return null;
    const url = new URL(raw);
    if (!/^https?:/.test(url.protocol)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

async function checkHealthz(parserUrl) {
  try {
    const healthUrl = new URL(parserUrl);
    healthUrl.pathname = "/healthz";
    healthUrl.search = "";
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 3000);
    try {
      const res = await fetch(healthUrl, {
        method: "GET",
        signal: abort.signal,
      });
      return res.ok;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}

async function ensureParserUrl() {
  if (isProduction) {
    const existing = process.env.CONVEX_PARSER_URL || process.env.VITE_PARSER_URL;
    if (!existing) {
      throw new Error(`${CONTEXT} CONVEX_PARSER_URL must be provided explicitly in production.`);
    }
    return existing;
  }

  for (const candidate of LOCAL_PARSER_CANDIDATES) {
    if (await checkHealthz(candidate)) {
      console.info(`${CONTEXT} Using local parser URL: ${candidate}`);
      return candidate;
    }
  }

  const envParserUrl = (process.env.CONVEX_PARSER_URL || "").trim();
  if (envParserUrl) {
    try {
      const parsed = new URL(envParserUrl);
      if (!isLoopbackHost(parsed.hostname)) {
        const healthy = await checkHealthz(envParserUrl);
        if (!healthy) {
          console.warn(
            `${CONTEXT} Provided CONVEX_PARSER_URL appears unhealthy but will be used anyway: ${envParserUrl}`,
          );
        } else {
          console.info(`${CONTEXT} Using provided CONVEX_PARSER_URL (tunnel detected).`);
        }
        persistTunnelUrl(envParserUrl);
        return envParserUrl;
      }
    } catch (err) {
      console.warn(`${CONTEXT} Invalid CONVEX_PARSER_URL provided; falling back to auto tunnel.`, err);
    }
  }

  let parserUrl = envParserUrl || readTunnelUrlFromFile();
  if (parserUrl && (await checkHealthz(parserUrl))) {
    persistTunnelUrl(parserUrl);
    return parserUrl;
  }

  console.info(`${CONTEXT} Parser tunnel unavailable. Booting via start-parser-service.sh ...`);
  if (!existsSync(startParserScript)) {
    throw new Error(`${CONTEXT} Cannot locate ${startParserScript}.`);
  }

  const spawnEnv = { ...process.env };
  delete spawnEnv.STRUCTURED_UPLOAD_SKIP_HEALTHCHECK;

  const spawnResult = spawnSync("bash", ["-lc", `TAIL_LOGS=0 \"${startParserScript}\"`], {
    cwd: repoRoot,
    stdio: "inherit",
    env: spawnEnv,
  });

  if (spawnResult.status !== 0) {
    throw new Error(`${CONTEXT} start-parser-service.sh exited with code ${spawnResult.status}.`);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    parserUrl = readTunnelUrlFromFile();
    if (parserUrl && (await checkHealthz(parserUrl))) {
      persistTunnelUrl(parserUrl);
      return parserUrl;
    }
    await delay(1000 * (attempt + 1));
  }

  throw new Error(
    `${CONTEXT} Parser service still unreachable after start-parser-service.sh. ` +
      `Check tunnel logs or run the script manually.`,
  );
}

async function main() {
  try {
    const parserUrl = await ensureParserUrl();

    if (parserUrl) {
      let shouldSync = false;
      try {
        const parsed = new URL(parserUrl);
        shouldSync = !isLoopbackHost(parsed.hostname);
      } catch (err) {
        console.warn(`${CONTEXT} Invalid parser URL detected (${parserUrl}); skipping Convex env sync.`, err);
      }

      if (shouldSync) {
        console.info(`${CONTEXT} Syncing CONVEX_PARSER_URL=${parserUrl}`);
        const syncResult = spawnSync(
          "npx",
          ["convex", "env", "set", "CONVEX_PARSER_URL", parserUrl],
          {
            cwd: appRoot,
            stdio: "inherit",
          },
        );
        if (syncResult.status !== 0) {
          console.warn(`${CONTEXT} Failed to sync CONVEX_PARSER_URL to Convex env (exit ${syncResult.status}).`);
        } else {
          const readBack = spawnSync(
            "npx",
            ["convex", "env", "get", "CONVEX_PARSER_URL"],
            {
              cwd: appRoot,
              stdio: "pipe",
              encoding: "utf8",
            },
          );
          if (readBack.status === 0) {
            const persisted = (readBack.stdout || "").trim();
            if (persisted === parserUrl) {
              console.info(`${CONTEXT} Convex env confirmed: CONVEX_PARSER_URL=${persisted}`);
            } else {
              console.warn(
                `${CONTEXT} Convex env mismatch. expected=${parserUrl} got=${persisted || '<empty>'}`,
              );
            }
          } else {
            console.warn(
              `${CONTEXT} Unable to verify Convex env (exit ${readBack.status}). Check authentication and try again.`,
            );
          }
        }
      } else {
        console.info(`${CONTEXT} Loopback parser URL detected (${parserUrl}); leaving Convex env untouched.`);
      }
    }

    delete process.env.STRUCTURED_UPLOAD_SKIP_HEALTHCHECK;
    process.env.CONVEX_PARSER_URL = parserUrl;
    process.env.VITE_PARSER_URL = parserUrl;
    process.env.VITE_CONVEX_PARSER_URL = parserUrl;

    console.info(`${CONTEXT} Using parser URL: ${parserUrl}`);

    const cmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const childEnv = { ...process.env };
    childEnv.CONVEX_PARSER_URL = parserUrl;
    childEnv.VITE_PARSER_URL = parserUrl;
    childEnv.VITE_CONVEX_PARSER_URL = parserUrl;
    childEnv.STRUCTURED_UPLOAD_PREFER_LOOPBACK = "1";
    delete childEnv.STRUCTURED_UPLOAD_SKIP_HEALTHCHECK;

    const child = spawn(cmd, ["run", "dev:frontend:raw"], {
      cwd: appRoot,
      stdio: "inherit",
      env: childEnv,
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exit(code ?? 0);
    });

    const forwardSignal = (signal) => {
      child.kill(signal);
    };

    process.on("SIGINT", forwardSignal);
    process.on("SIGTERM", forwardSignal);
  } catch (err) {
    console.error(`${CONTEXT} ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

await main();
