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
  const scannerLog = join(root, "scanner.log");
  mkdirSync(binDirectory);
  mkdirSync(join(root, "my-app"));
  copyFileSync(sourceRunScript, join(root, "run.sh"));
  chmodSync(join(root, "run.sh"), 0o755);

  writeExecutable(
    join(binDirectory, "docker"),
    `#!/bin/sh
if test -n "\${FAKE_DOCKER_LOG:-}"; then printf '%s\n' "$*" >> "\${FAKE_DOCKER_LOG}"; fi
case "\${1:-}" in
  ps)
    test -n "\${FAKE_DOCKER_RUNNING_NAMES:-}" && printf '%s\n' "\${FAKE_DOCKER_RUNNING_NAMES}"
    ;;
  inspect)
    test -n "\${FAKE_DOCKER_OWNER:-}" && printf '%s\n' "\${FAKE_DOCKER_OWNER}"
    ;;
  container)
    if test "\${2:-}" = inspect; then
      test "\${FAKE_DOCKER_EXISTS:-0}" = 1
      exit
    fi
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
  for (const name of ["lsof", "pgrep"]) {
    writeExecutable(
      join(binDirectory, name),
      `#!/bin/sh
if test -n "\${FAKE_SCANNER_LOG:-}"; then printf '%s\n' "${name} $*" >> "\${FAKE_SCANNER_LOG}"; fi
test -n "\${FAKE_SCANNER_PID:-}" && printf '%s\n' "\${FAKE_SCANNER_PID}"
exit 0
`,
    );
  }

  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, binDirectory, dockerLog, scannerLog };
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
  return spawnSync("/bin/bash", ["./run.sh", command], {
    cwd: fixture.root,
    encoding: "utf8",
    timeout: 10_000,
    env: {
      ...process.env,
      HOME: join(fixture.root, "home"),
      PATH: `${fixture.binDirectory}:${process.env.PATH ?? ""}`,
      FAKE_DOCKER_LOG: fixture.dockerLog,
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
