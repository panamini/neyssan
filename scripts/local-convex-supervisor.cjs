#!/usr/bin/env node

const fs = require("node:fs");
const { spawn } = require("node:child_process");
const http = require("node:http");

const [
  pidFile,
  logFile,
  backendBin,
  deploymentUrl,
  cloudPort,
  sitePort,
  deploymentName,
  localStorage,
  sqlitePath,
  convexBin,
  configPath,
  startupTimeoutSecs,
] = process.argv.slice(2);

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const adminKey = config.adminKey;
const instanceSecret = config.instanceSecret;
const logFd = fs.openSync(logFile, "a");
const children = new Set();
let shuttingDown = false;

function logLine(message) {
  fs.writeSync(logFd, `${message}\n`);
}

function spawnLogged(command, args, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  for (const [key, value] of Object.entries(env)) {
    if (value === null) {
      delete env[key];
    }
  }
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", logFd, logFd],
  });
  children.add(child);
  child.on("exit", () => children.delete(child));
  return child;
}

function requestInstanceName() {
  return new Promise((resolve) => {
    const req = http.get(`${deploymentUrl}/instance_name`, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve(res.statusCode === 200 ? body : "");
      });
    });
    req.on("error", () => resolve(""));
    req.setTimeout(500, () => {
      req.destroy();
      resolve("");
    });
  });
}

async function waitForBackend(child) {
  const deadline = Date.now() + Number(startupTimeoutSecs) * 1000;
  while (Date.now() <= deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      return false;
    }
    const instanceName = await requestInstanceName();
    if (instanceName === deploymentName) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    child.kill("SIGTERM");
  }
  setTimeout(() => {
    for (const child of children) {
      child.kill("SIGKILL");
    }
    process.exit(exitCode);
  }, 3000).unref();
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));
process.on("SIGHUP", () => {});
fs.writeFileSync(pidFile, String(process.pid));

(async () => {
  logLine(`[run] starting Convex local backend directly at ${deploymentUrl}`);
  const backend = spawnLogged(backendBin, [
    "--port",
    String(cloudPort),
    "--site-proxy-port",
    String(sitePort),
    "--instance-name",
    deploymentName,
    "--instance-secret",
    instanceSecret,
    "--local-storage",
    localStorage,
    sqlitePath,
  ]);

  const ready = await waitForBackend(backend);
  if (!ready) {
    logLine(`[run] ERROR: direct Convex backend did not become ready within ${startupTimeoutSecs}s`);
    shutdown(1);
    return;
  }

  logLine("[run] Convex local backend is ready; starting convex dev against existing local URL");
  const convex = spawnLogged(convexBin, ["dev", "--verbose", "--tail-logs", "always", "--url", deploymentUrl, "--admin-key", adminKey], {
    CONVEX_DEPLOYMENT: null,
    CONVEX_DEPLOY_KEY: null,
    CONVEX_SELF_HOSTED_URL: null,
    CONVEX_SELF_HOSTED_ADMIN_KEY: null,
    VITE_CONVEX_URL: null,
    NEXT_PUBLIC_CONVEX_URL: null,
  });
  convex.on("exit", (code, signal) => {
    logLine(`[run] convex dev exited ${signal ? `with signal ${signal}` : `with code ${code}`}`);
    if (code !== 0) {
      shutdown(code ?? 1);
    }
  });
  backend.on("exit", (code, signal) => {
    if (!shuttingDown) {
      logLine(`[run] Convex local backend exited ${signal ? `with signal ${signal}` : `with code ${code}`}`);
      shutdown(code ?? 1);
    }
  });
})().catch((error) => {
  logLine(`[run] ERROR: Convex supervisor failed: ${error?.stack || error}`);
  shutdown(1);
});
