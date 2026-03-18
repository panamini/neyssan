#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_DIR = path.resolve(__dirname, "..");
const URL_FILE = path.join(APP_DIR, ".parser-tunnel-url");

const PORT = Number(process.env.PARSER_PORT ?? 8000);
const HEALTH_PATH = "/healthz";
const PATH_SUFFIX = "/parse-cv";
const MAX_HEALTH_ATTEMPTS = Number(process.env.TUNNEL_HEALTH_ATTEMPTS ?? 60);
const HEALTH_DELAY_MS = Number(process.env.TUNNEL_HEALTH_DELAY_MS ?? 2000);
const URL_TIMEOUT_MS = Number(process.env.TUNNEL_URL_TIMEOUT_MS ?? 60000);
const INITIAL_HEALTH_DELAY_MS = Number(process.env.TUNNEL_HEALTH_INITIAL_DELAY_MS ?? 5000);
const KEEP_ALIVE_MS = Number.isFinite(Number(process.env.KEEP_ALIVE_MS))
  ? Number(process.env.KEEP_ALIVE_MS)
  : 900000;

const isWin = process.platform === "win32";
const NPX_COMMAND = isWin ? "npx.cmd" : "npx";

const LOG_PREFIX = "[parser-tunnel]";

function normalizeOrigin(value) {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    if (typeof value === "string") {
      return value.replace(/\/+$/, "");
    }
    return "";
  }
}

const configuredOrigin = normalizeOrigin(
  process.env.PARSER_ORIGIN ?? process.env.CONVEX_PARSER_URL ?? "",
);
const usingExternalOrigin =
  Boolean(configuredOrigin) && !/trycloudflare\.com/i.test(configuredOrigin);

function log(message) {
  console.log(`${LOG_PREFIX} ${message}`);
}

function logStreamLine(stream, line) {
  const trimmed = line.trim();
  if (!trimmed) return;
  console.log(`${LOG_PREFIX} ${stream}: ${trimmed}`);
}

function describeError(error) {
  if (!error) return "unknown error";
  if (error.message && error.cause?.code) {
    return `${error.message} (cause: ${error.cause.code})`;
  }
  if (error.message) return error.message;
  return JSON.stringify(error);
}

async function ensureHealth(baseUrl) {
  if (INITIAL_HEALTH_DELAY_MS > 0) {
    await new Promise((resolve) => setTimeout(resolve, INITIAL_HEALTH_DELAY_MS));
  }

  const healthUrl = new URL(baseUrl);
  healthUrl.pathname = HEALTH_PATH;
  healthUrl.search = "";

  for (let attempt = 1; attempt <= MAX_HEALTH_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_DELAY_MS);
      const response = await fetch(healthUrl, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);
      log(`health attempt ${attempt}: ${response.status} ${response.statusText}`);
      if (response.ok) {
        return;
      }
    } catch (error) {
      log(`health attempt failed (${attempt}): ${describeError(error)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_DELAY_MS));
  }
  throw new Error("parser tunnel health check failed");
}

async function writeTunnelUrl(url) {
  await fs.writeFile(URL_FILE, url, "utf8");
  log(`URL written to ${URL_FILE}`);
}

function startCloudflared() {
  const args = [
    "--yes",
    "cloudflared",
    "tunnel",
    "--url",
    `http://127.0.0.1:${PORT}`,
    "--no-autoupdate",
    "--metrics",
    "127.0.0.1:0",
    "--protocol",
    "http2",
    "--loglevel",
    "info",
  ];

  const child = spawn(NPX_COMMAND, args, {
    cwd: APP_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      TUNNEL_TRANSPORT_PROTOCOL: "http2",
    },
  });

  return child;
}

async function obtainTunnelUrl(child) {
  let resolved = false;

  const urlPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (resolved) return;
      child.kill("SIGTERM");
      reject(new Error("timed out waiting for tunnel URL"));
    }, URL_TIMEOUT_MS);

    child.on("exit", (code, signal) => {
      if (!resolved) {
        reject(new Error(`cloudflared exited (code=${code ?? "null"}, signal=${signal ?? "null"}) before tunnel URL was available`));
      }
    });

    const extractUrl = (text) => {
      const match = text.match(/https:\/\/[\w.-]+\.trycloudflare\.com/);
      if (match) {
        resolved = true;
        clearTimeout(timeout);
        resolve(match[0]);
      }
    };

    const handleChunk = (stream) => (chunk) => {
      const text = chunk.toString();
      text.split(/\r?\n/).forEach((line) => logStreamLine(stream, line));
      extractUrl(text);
    };

    child.stdout.on("data", handleChunk("stdout"));
    child.stderr.on("data", handleChunk("stderr"));
  });

  return urlPromise;
}

(async () => {
  if (usingExternalOrigin) {
    log(`Skipping tunnel, using external origin: ${configuredOrigin}`);
    try {
      await writeTunnelUrl(configuredOrigin);
    } catch (error) {
      log(`warning: unable to record origin (${describeError(error)})`);
    }
    process.exit(0);
  }

  log("Starting Cloudflare Tunnel (quick tunnel mode)...");
  const tunnelProcess = startCloudflared();

  const cleanup = async () => {
    log("Shutting down tunnel...");
    try {
      await fs.unlink(URL_FILE);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        log(`cleanup warning: ${error.message ?? error}`);
      }
    }
    tunnelProcess.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 500));
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("uncaughtException", (error) => {
    console.error(`${LOG_PREFIX} uncaught exception`, error);
    cleanup().finally(() => process.exit(1));
  });

  let baseUrl;
  try {
    baseUrl = await obtainTunnelUrl(tunnelProcess);
  } catch (error) {
    console.error(`${LOG_PREFIX} failed to obtain tunnel URL:`, error?.message ?? error);
    tunnelProcess.kill("SIGTERM");
    process.exit(1);
  }

  log(`tunnel established at ${baseUrl}`);

  const SKIP_SMOKE = String(process.env.SKIP_SMOKE ?? "0").toLowerCase();
  const skipSmoke = SKIP_SMOKE === "1" || SKIP_SMOKE === "true" || SKIP_SMOKE === "yes" || SKIP_SMOKE === "on";
  if (skipSmoke) {
    try {
      await ensureHealth(baseUrl);
    } catch (error) {
      console.warn(`${LOG_PREFIX} smoke/health check failed but SKIP_SMOKE=1; keeping tunnel alive:`, error?.message ?? error);
    }
  } else {
    try {
      await ensureHealth(baseUrl);
    } catch (error) {
      console.error(`${LOG_PREFIX} tunnel health check failed:`, error?.message ?? error);
      tunnelProcess.kill("SIGTERM");
      process.exit(1);
    }
  }

  const normalizedBase = baseUrl.replace(/\/$/, "");
  const publicUrl = `${normalizedBase}${PATH_SUFFIX}`;
  log(`Parser endpoint: ${publicUrl}`);
  // Write origin only; Convex action composes the path safely.
  await writeTunnelUrl(normalizedBase);

  if (Number.isFinite(KEEP_ALIVE_MS) && KEEP_ALIVE_MS > 0) {
    log(`KEEP_ALIVE_MS=${KEEP_ALIVE_MS}; tunnel will stay up for manual tests.`);
    setTimeout(() => {
      log("KEEP_ALIVE elapsed; shutting down tunnel.");
      cleanup();
    }, KEEP_ALIVE_MS);
  } else {
    log("KEEP_ALIVE disabled; tunnel will remain until terminated.");
  }

  await new Promise(() => {});
})();
