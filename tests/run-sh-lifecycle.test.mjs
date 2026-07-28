import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRunScript = join(repoRoot, "run.sh");

function writeExecutable(path, source) {
  writeFileSync(path, source, { mode: 0o755 });
}

function ownerId(root) {
  return createHash("sha256").update(realpathSync(root)).digest("hex");
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function createFixture(t) {
  const root = mkdtempSync(join(tmpdir(), "run-sh-lifecycle-"));
  const binDirectory = join(root, "fake-bin");
  const dockerLog = join(root, "docker.log");
  const dockerContainerFile = join(root, "parser-container");
  const scannerLog = join(root, "scanner.log");
  mkdirSync(binDirectory);
  mkdirSync(join(root, "my-app"));
  copyFileSync(sourceRunScript, join(root, "run.sh"));
  copyFileSync(join(repoRoot, ".infisical.json"), join(root, ".infisical.json"));
  chmodSync(join(root, "run.sh"), 0o755);

  writeExecutable(
    join(binDirectory, "infisical"),
    `#!/bin/sh
if test -n "\${FAKE_INFISICAL_CALL_LOG:-}"; then printf '%s\n' "$*" >> "\${FAKE_INFISICAL_CALL_LOG}"; fi
if test "\${1:-}" = secrets && test "\${2:-}" = get; then
  test "\${FAKE_INFISICAL_MODE:-success}" = success || exit 1
  printf '%s\n' "\${FAKE_INFISICAL_VALUE:-pk_test_lifecycle_reload_fixture}"
  exit 0
fi
exit 1
`,
  );
  writeExecutable(
    join(binDirectory, "docker"),
    `#!/bin/sh
if test -n "\${FAKE_DOCKER_LOG:-}"; then printf '%s\n' "$*" >> "\${FAKE_DOCKER_LOG}"; fi
case "\${1:-}" in
  ps)
    test -n "\${FAKE_DOCKER_RUNNING_NAMES:-}" && printf '%s\n' "\${FAKE_DOCKER_RUNNING_NAMES}"
    ;;
  inspect)
    if test "\${2:-}" = --format; then
      test -n "\${FAKE_DOCKER_OWNER:-}" && printf '%s\n' "\${FAKE_DOCKER_OWNER}"
    elif test -n "\${FAKE_DOCKER_WORKSPACE_ROOT:-}"; then
      printf '%s -> /app\n' "\${FAKE_DOCKER_WORKSPACE_ROOT}"
    fi
    ;;
  container)
    if test "\${2:-}" = inspect; then
      test "\${FAKE_DOCKER_EXISTS:-0}" = 1 || test -f "\${FAKE_DOCKER_CONTAINER_FILE:-}"
      exit
    fi
    ;;
  image)
    if test "\${2:-}" = inspect; then
      test "\${FAKE_DOCKER_IMAGE:-available}" != missing
      exit
    fi
    ;;
  port)
    printf '0.0.0.0:8001\n'
    ;;
  exec)
    test "\${FAKE_DOCKER_WORKSPACE_SURFACE:-available}" = available
    ;;
  rm)
    rm -f "\${FAKE_DOCKER_CONTAINER_FILE:-/nonexistent}"
    ;;
  run)
    case "$*" in
      *"--name cv-parser-service-dev"*)
        : > "\${FAKE_DOCKER_CONTAINER_FILE}"
        printf 'fixture-parser-id\n'
        ;;
      *"curlimages/curl"*)
        printf 'inside_ready=200\n'
        ;;
    esac
    ;;
esac
exit 0
`,
  );
  writeExecutable(
    join(binDirectory, "ps"),
    `#!/bin/sh
if test -n "\${FAKE_PS_COMMAND:-}"; then
  printf '%s\n' "\${FAKE_PS_COMMAND}"
  exit 0
fi
exec /bin/ps "$@"
`,
  );
  writeExecutable(
    join(binDirectory, "node"),
    `#!/bin/sh
if test "\${FAKE_NODE_CONVEX_READY:-0}" = 1 && test "\${1:-}" = -e; then
  case "\${2:-}" in
    *instance_name*) exit 0 ;;
  esac
fi
exec ${JSON.stringify(process.execPath)} "$@"
`,
  );
  writeExecutable(
    join(binDirectory, "lsof"),
    `#!/bin/sh
if test -n "\${FAKE_SCANNER_LOG:-}"; then printf '%s\n' "lsof $*" >> "\${FAKE_SCANNER_LOG}"; fi
if test "\${FAKE_LSOF_BUSY:-0}" = 1; then
  test -n "\${FAKE_SCANNER_PID:-}" && printf '%s\n' "\${FAKE_SCANNER_PID}"
  exit 0
fi
exit 1
`,
  );
  writeExecutable(
    join(binDirectory, "pgrep"),
    `#!/bin/sh
if test -n "\${FAKE_SCANNER_LOG:-}"; then printf '%s\n' "pgrep $*" >> "\${FAKE_SCANNER_LOG}"; fi
test -n "\${FAKE_SCANNER_PID:-}" && printf '%s\n' "\${FAKE_SCANNER_PID}"
exit 0
`,
  );
  writeExecutable(
    join(binDirectory, "curl"),
    `#!/bin/sh
case "$*" in
  *"127.0.0.1:\${FAKE_VITE_PORT:-5173}/"*)
    test "\${FAKE_VITE_READY:-0}" = 1
    ;;
  *"127.0.0.1:8001/ready"*)
    printf '200\\n'
    ;;
  *)
    printf '000\\n'
    ;;
esac
`,
  );

  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, binDirectory, dockerLog, dockerContainerFile, scannerLog };
}

function writeState(root, values = {}) {
  const stateDirectory = join(root, "tmp", "dev-stack");
  mkdirSync(stateDirectory, { recursive: true });
  const defaults = {
    STATE_OWNER_ID: ownerId(root),
    VITE_PID: "",
    PARSER_STARTED: "0",
    CONVEX_PID: "",
    CONVEX_URL: "",
    TUNNEL_STARTED: "0",
    STACK_MODE: "local-fast",
    ACTIVE_ORIGIN: "http://127.0.0.1:8001",
    PARSER_RUNTIME_MODE: "workspace",
    PARSER_RELOAD: "1",
    PARSER_OCR: "auto",
    CONVEX_MODE: "cloud",
    UI_STARTED: "0",
    ENV_HASH: "",
    CONVEX_BINDING_HASH: "",
  };
  const state = { ...defaults, ...values };
  writeFileSync(
    join(stateDirectory, "pids.env"),
    `${Object.entries(state)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
  );
  return join(stateDirectory, "pids.env");
}

function runCommand(fixture, command, env = {}) {
  const args = Array.isArray(command) ? command : [command];
  return spawnSync("/bin/bash", ["./run.sh", ...args], {
    cwd: fixture.root,
    encoding: "utf8",
    timeout: 10_000,
    env: {
      ...process.env,
      HOME: join(fixture.root, "home"),
      PATH: `${fixture.binDirectory}:${process.env.PATH ?? ""}`,
      FAKE_DOCKER_LOG: fixture.dockerLog,
      FAKE_DOCKER_CONTAINER_FILE: fixture.dockerContainerFile,
      FAKE_SCANNER_LOG: fixture.scannerLog,
      ...env,
    },
  });
}

function startSleeper(t) {
  const child = spawn("/bin/sleep", ["60"], {
    stdio: "ignore",
  });
  t.after(() => {
    if (processIsAlive(child.pid)) process.kill(child.pid, "SIGKILL");
  });
  return child;
}

async function waitForExit(child) {
  if (child.exitCode !== null) return;
  await Promise.race([
    once(child, "exit"),
    new Promise((resolve) => setTimeout(resolve, 1_000)),
  ]);
}

test("down refuses an unowned PID recorded in stale state", (t) => {
  const fixture = createFixture(t);
  const sleeper = startSleeper(t);
  const stateFile = writeState(fixture.root, { VITE_PID: String(sleeper.pid) });

  const result = runCommand(fixture, "down", {
    FAKE_PS_COMMAND: "foreign-owner sleep 60",
  });

  assert.notEqual(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.equal(processIsAlive(sleeper.pid), true);
  assert.equal(existsSync(stateFile), true);
  assert.match(`${result.stdout}${result.stderr}`, /refusing to stop unowned Vite process/i);
});

test("down stops a process carrying the current worktree owner marker", async (t) => {
  const fixture = createFixture(t);
  const expectedOwner = ownerId(fixture.root);
  const sleeper = startSleeper(t);
  const stateFile = writeState(fixture.root, { VITE_PID: String(sleeper.pid) });

  const result = runCommand(fixture, "down", {
    FAKE_PS_COMMAND: `twoweeks-run-sh-${expectedOwner.slice(0, 16)}:vite`,
  });
  await waitForExit(sleeper);

  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.equal(processIsAlive(sleeper.pid), false);
  assert.equal(existsSync(stateFile), false);
});

test("reset never scans for unrelated Vite or Convex processes", (t) => {
  const fixture = createFixture(t);
  const sleeper = startSleeper(t);

  const result = runCommand(fixture, "reset", {
    FAKE_SCANNER_PID: String(sleeper.pid),
  });

  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.equal(processIsAlive(sleeper.pid), true);
  assert.equal(existsSync(fixture.scannerLog), false);
});

test("down refuses a parser container owned by another worktree", (t) => {
  const fixture = createFixture(t);
  const stateFile = writeState(fixture.root, { PARSER_STARTED: "1" });

  const result = runCommand(fixture, "down", {
    FAKE_DOCKER_EXISTS: "1",
    FAKE_DOCKER_RUNNING_NAMES: "cv-parser-service-dev",
    FAKE_DOCKER_OWNER: "foreign-owner",
  });

  assert.notEqual(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.equal(existsSync(stateFile), true);
  assert.match(`${result.stdout}${result.stderr}`, /refusing to .*unowned parser container/i);
  assert.doesNotMatch(readFileSync(fixture.dockerLog, "utf8"), /^stop /mu);
});

test("down is convergent when no tracked stack exists", (t) => {
  const fixture = createFixture(t);

  const first = runCommand(fixture, "down");
  const second = runCommand(fixture, "down");

  assert.equal(first.status, 0, `${first.stdout}${first.stderr}`);
  assert.equal(second.status, 0, `${second.stdout}${second.stderr}`);
  assert.match(first.stdout, /down: done/i);
  assert.match(second.stdout, /down: done/i);
  assert.equal(existsSync(fixture.dockerLog), false);
});

test("status reports a tracked reachable Vite server", (t) => {
  const fixture = createFixture(t);
  const sleeper = startSleeper(t);
  const expectedOwner = ownerId(fixture.root);
  writeState(fixture.root, { VITE_PID: String(sleeper.pid) });

  const result = runCommand(fixture, "status", {
    FAKE_PS_COMMAND: `twoweeks-run-sh-${expectedOwner.slice(0, 16)}:vite`,
    FAKE_VITE_READY: "1",
  });

  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /Vite:\s+running \(http:\/\/127\.0\.0\.1:5173\)/i);
});

test("Vite preflight failure preserves parser and Convex services reused by this attempt", async (t) => {
  const fixture = createFixture(t);
  const expectedOwner = ownerId(fixture.root);
  const convex = startSleeper(t);
  writeFileSync(
    join(fixture.root, ".env.local"),
    "CONVEX_TEAM=fixture-team\nCONVEX_PROJECT=fixture-project\n",
  );
  writeFileSync(fixture.dockerContainerFile, "running\n");
  writeState(fixture.root, {
    STACK_MODE: "parser-dev",
    PARSER_STARTED: "1",
    CONVEX_PID: String(convex.pid),
    CONVEX_URL: "http://127.0.0.1:3210",
  });

  const result = runCommand(
    fixture,
    [
      "up",
      "--ui",
      "--local-origin",
      "--local-convex",
      "--workspace-mount",
      "--parser-reload",
    ],
    {
      FAKE_DOCKER_RUNNING_NAMES: "cv-parser-service-dev",
      FAKE_DOCKER_OWNER: expectedOwner,
      FAKE_DOCKER_WORKSPACE_ROOT: realpathSync(fixture.root),
      FAKE_LSOF_BUSY: "1",
      FAKE_NODE_CONVEX_READY: "1",
      FAKE_PS_COMMAND: `twoweeks-run-sh-${expectedOwner.slice(0, 16)}:convex`,
    },
  );

  assert.notEqual(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(`${result.stdout}${result.stderr}`, /Vite port .* is already in use/i);
  assert.equal(
    existsSync(fixture.dockerContainerFile),
    true,
    `${result.stdout}${result.stderr}\n${readFileSync(fixture.dockerLog, "utf8")}`,
  );
  assert.equal(processIsAlive(convex.pid), true);
  const dockerLog = readFileSync(fixture.dockerLog, "utf8");
  assert.doesNotMatch(dockerLog, /^stop cv-parser-service-dev$/mu);
  assert.doesNotMatch(dockerLog, /^rm -f cv-parser-service-dev$/mu);
  assert.doesNotMatch(dockerLog, /^image inspect /mu);
});

test("Vite launcher failure is not masked and cleans a parser started by this attempt", (t) => {
  const fixture = createFixture(t);
  const expectedOwner = ownerId(fixture.root);

  const result = runCommand(
    fixture,
    [
      "up",
      "--ui",
      "--local-origin",
      "--cloud-convex",
      "--workspace-mount",
      "--parser-reload",
    ],
    {
      FAKE_DOCKER_OWNER: expectedOwner,
      FAKE_DOCKER_WORKSPACE_ROOT: realpathSync(fixture.root),
    },
  );

  assert.notEqual(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(`${result.stdout}${result.stderr}`, /missing Vite binary/i);
  assert.match(`${result.stdout}${result.stderr}`, /Vite failed to start/i);
  assert.equal(existsSync(fixture.dockerContainerFile), false);
  const dockerLog = readFileSync(fixture.dockerLog, "utf8");
  assert.match(dockerLog, /^rm -f cv-parser-service-dev$/mu);
});

test("env reload prepares a missing parser image before replacing the tracked parser", (t) => {
  const fixture = createFixture(t);
  const expectedOwner = ownerId(fixture.root);
  writeFileSync(fixture.dockerContainerFile, "running\n");
  writeState(fixture.root, {
    STACK_MODE: "parser-dev",
    PARSER_STARTED: "1",
    ENV_HASH: "stale-env-hash",
  });

  const result = runCommand(fixture, "reload-env", {
    FAKE_DOCKER_RUNNING_NAMES: "cv-parser-service-dev",
    FAKE_DOCKER_OWNER: expectedOwner,
    FAKE_DOCKER_WORKSPACE_ROOT: realpathSync(fixture.root),
    FAKE_DOCKER_IMAGE: "missing",
  });

  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.equal(existsSync(fixture.dockerContainerFile), true);
  const dockerLog = readFileSync(fixture.dockerLog, "utf8");
  const buildIndex = dockerLog.indexOf("buildx build ");
  const replaceIndex = dockerLog.indexOf("rm -f cv-parser-service-dev");
  assert.notEqual(buildIndex, -1, dockerLog);
  assert.notEqual(replaceIndex, -1, dockerLog);
  assert.ok(buildIndex < replaceIndex, dockerLog);
});

test("env reload Vite failure cleans only restarted resources and records convergent state", async (t) => {
  const fixture = createFixture(t);
  const expectedOwner = ownerId(fixture.root);
  const infisicalCallLog = join(fixture.root, "infisical.log");
  const clerkValue = "pk_test_reload_env_clerk_fixture";
  const vite = startSleeper(t);
  writeFileSync(fixture.dockerContainerFile, "running\n");
  const stateFile = writeState(fixture.root, {
    VITE_PID: String(vite.pid),
    PARSER_STARTED: "1",
    STACK_MODE: "local-fast",
    UI_STARTED: "1",
    ENV_HASH: "stale-env-hash",
  });

  const result = runCommand(fixture, "reload-env", {
    FAKE_DOCKER_RUNNING_NAMES: "cv-parser-service-dev",
    FAKE_DOCKER_OWNER: expectedOwner,
    FAKE_DOCKER_WORKSPACE_ROOT: realpathSync(fixture.root),
    FAKE_INFISICAL_CALL_LOG: infisicalCallLog,
    FAKE_INFISICAL_VALUE: clerkValue,
    FAKE_LSOF_BUSY: "1",
    FAKE_PS_COMMAND: `twoweeks-run-sh-${expectedOwner.slice(0, 16)}:vite`,
  });
  await waitForExit(vite);

  assert.notEqual(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(`${result.stdout}${result.stderr}`, /Vite failed to restart during env reload/i);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(clerkValue));
  assert.match(
    readFileSync(infisicalCallLog, "utf8"),
    /^secrets get VITE_CLERK_PUBLISHABLE_KEY /mu,
  );
  assert.equal(processIsAlive(vite.pid), false);
  assert.equal(existsSync(fixture.dockerContainerFile), false);
  const state = readFileSync(stateFile, "utf8");
  assert.match(state, /^VITE_PID=$/mu);
  assert.match(state, /^PARSER_STARTED=0$/mu);
  assert.match(state, /^UI_STARTED=0$/mu);
});

test("local app env reload refreshes Vite for an Infisical-only Clerk change", async (t) => {
  for (const stackMode of ["local-fast", "local-convex"]) {
    const fixture = createFixture(t);
    const expectedOwner = ownerId(fixture.root);
    const infisicalCallLog = join(fixture.root, "infisical.log");
    const clerkValue = `pk_test_reload_env_remote_change_${stackMode.replace("-", "_")}_fixture`;
    const vite = startSleeper(t);
    const stateFile = writeState(fixture.root, {
      STACK_MODE: stackMode,
      UI_STARTED: "0",
      ENV_HASH: "stale-env-hash",
    });

    const converge = runCommand(fixture, "reload-env");
    assert.equal(converge.status, 0, `${stackMode}: ${converge.stdout}${converge.stderr}`);
    const convergedState = readFileSync(stateFile, "utf8")
      .replace(/^VITE_PID=.*$/mu, `VITE_PID=${vite.pid}`)
      .replace(/^UI_STARTED=.*$/mu, "UI_STARTED=1");
    writeFileSync(stateFile, convergedState);

    const result = runCommand(fixture, "reload-env", {
      FAKE_DOCKER_OWNER: expectedOwner,
      FAKE_INFISICAL_CALL_LOG: infisicalCallLog,
      FAKE_INFISICAL_VALUE: clerkValue,
      FAKE_LSOF_BUSY: "1",
      FAKE_PS_COMMAND: `twoweeks-run-sh-${expectedOwner.slice(0, 16)}:vite`,
    });
    await waitForExit(vite);

    assert.notEqual(result.status, 0, `${stackMode}: ${result.stdout}${result.stderr}`);
    assert.match(
      `${result.stdout}${result.stderr}`,
      /Vite failed to restart during env reload/i,
    );
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(clerkValue));
    assert.match(
      readFileSync(infisicalCallLog, "utf8"),
      /^secrets get VITE_CLERK_PUBLISHABLE_KEY /mu,
    );
    assert.equal(processIsAlive(vite.pid), false);
  }
});

test("local-fast env reload keeps Vite running when Clerk configuration cannot be reacquired", (t) => {
  const fixture = createFixture(t);
  const expectedOwner = ownerId(fixture.root);
  const infisicalCallLog = join(fixture.root, "infisical.log");
  const vite = startSleeper(t);
  writeFileSync(fixture.dockerContainerFile, "running\n");
  const stateFile = writeState(fixture.root, {
    VITE_PID: String(vite.pid),
    PARSER_STARTED: "1",
    STACK_MODE: "local-fast",
    UI_STARTED: "1",
    ENV_HASH: "stale-env-hash",
  });

  const result = runCommand(fixture, "reload-env", {
    FAKE_DOCKER_OWNER: expectedOwner,
    FAKE_INFISICAL_CALL_LOG: infisicalCallLog,
    FAKE_INFISICAL_MODE: "failure",
    FAKE_LSOF_BUSY: "1",
    FAKE_PS_COMMAND: `twoweeks-run-sh-${expectedOwner.slice(0, 16)}:vite`,
  });

  assert.notEqual(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(`${result.stdout}${result.stderr}`, /VITE_CLERK_PUBLISHABLE_KEY is unavailable/i);
  assert.equal(processIsAlive(vite.pid), true);
  assert.equal(existsSync(fixture.dockerContainerFile), true);
  assert.equal(readFileSync(fixture.dockerContainerFile, "utf8"), "running\n");
  assert.match(readFileSync(stateFile, "utf8"), new RegExp(`^VITE_PID=${vite.pid}$`, "mu"));
  assert.match(
    readFileSync(infisicalCallLog, "utf8"),
    /^secrets get VITE_CLERK_PUBLISHABLE_KEY /mu,
  );
});

test("local-fast Docker rebuild keeps the running stack when Clerk configuration cannot be reacquired", (t) => {
  const fixture = createFixture(t);
  const expectedOwner = ownerId(fixture.root);
  const vite = startSleeper(t);
  writeFileSync(fixture.dockerContainerFile, "running\n");
  const stateFile = writeState(fixture.root, {
    VITE_PID: String(vite.pid),
    PARSER_STARTED: "1",
    STACK_MODE: "local-fast",
    UI_STARTED: "1",
  });

  const result = runCommand(fixture, "rebuild-docker", {
    FAKE_DOCKER_OWNER: expectedOwner,
    FAKE_INFISICAL_MODE: "failure",
    FAKE_LSOF_BUSY: "1",
    FAKE_PS_COMMAND: `twoweeks-run-sh-${expectedOwner.slice(0, 16)}:vite`,
  });

  assert.notEqual(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(`${result.stdout}${result.stderr}`, /VITE_CLERK_PUBLISHABLE_KEY is unavailable/i);
  assert.equal(processIsAlive(vite.pid), true);
  assert.equal(readFileSync(fixture.dockerContainerFile, "utf8"), "running\n");
  assert.match(readFileSync(stateFile, "utf8"), new RegExp(`^VITE_PID=${vite.pid}$`, "mu"));
});

test("run.sh exposes no global process-kill recovery path", () => {
  const source = readFileSync(sourceRunScript, "utf8");
  assert.doesNotMatch(source, /kill_vite_ports|kill-vite-ports|pgrep\s+-f/u);
  assert.match(source, /require_port_available "\$\{VITE_PORT\}"/u);
  assert.equal(
    source.match(/--label "\$\{RUN_OWNER_LABEL\}=\$\{RUN_OWNER_ID\}"/gu)?.length,
    4,
  );
  assert.equal(
    source.match(/argv0: process\.env\.TWOWEEKS_RUN_OWNER_ARGV0/gu)?.length,
    3,
  );
});
