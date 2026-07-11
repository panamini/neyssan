import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRunScript = join(repoRoot, "run.sh");
const bash = "/bin/bash";
const generatedDirectories = ["tmp", ".docker", ".buildx-cache"];

function writeExecutable(path, source) {
  writeFileSync(path, source, { mode: 0o755 });
}

function findHostTool(name) {
  for (const directory of (process.env.PATH ?? "").split(":")) {
    const candidate = join(directory, name);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Required test host tool is unavailable: ${name}`);
}

function linkHostTools(binDirectory) {
  for (const name of [
    "cut",
    "dirname",
    "grep",
    "head",
    "stat",
    "tail",
    "tr",
    "xargs",
  ]) {
    symlinkSync(findHostTool(name), join(binDirectory, name));
  }
}

function createFixture(t, { dependencies = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "run-sh-doctor-"));
  const binDirectory = join(root, "fake-bin");
  const homeDirectory = join(root, "home");
  const appDirectory = join(root, "my-app");
  const appBinDirectory = join(appDirectory, "node_modules", ".bin");

  mkdirSync(binDirectory);
  mkdirSync(homeDirectory);
  mkdirSync(appBinDirectory, { recursive: true });
  mkdirSync(join(root, "cv_parser_service"));
  mkdirSync(join(root, "scripts"));
  copyFileSync(sourceRunScript, join(root, "run.sh"));
  chmodSync(join(root, "run.sh"), 0o755);
  linkHostTools(binDirectory);

  writeExecutable(
    join(binDirectory, "uname"),
    `#!/bin/sh
case "\${1:-}" in
  -m) printf '%s\\n' "\${FAKE_UNAME_M:-x86_64}" ;;
  -r) printf '%s\\n' "\${FAKE_UNAME_R:-6.8.0-doctor-fixture}" ;;
  *) printf '%s\\n' "\${FAKE_UNAME_S:-Linux}" ;;
esac
`,
  );
  writeExecutable(
    join(binDirectory, "docker"),
    `#!/bin/sh
case "\${1:-}" in
  --version) printf '%s\\n' 'Docker version doctor-fixture' ;;
  info) test "\${FAKE_DOCKER_DAEMON:-available}" = available ;;
  image)
    if test "\${2:-}" = inspect && test "\${FAKE_DOCKER_IMAGE:-available}" = missing; then exit 1; fi
    if test "\${2:-}" = inspect && test -n "\${FAKE_DOCKER_EXPECT_IMAGE:-}"; then test "\${3:-}" = "\${FAKE_DOCKER_EXPECT_IMAGE}"; fi
    ;;
  buildx)
    if test "\${FAKE_DOCKER_BUILDX:-available}" != available; then exit 1; fi
    if test "\${2:-}" = inspect && test "\${FAKE_DOCKER_BUILDER:-available}" != available; then exit 1; fi
    exit 0
    ;;
  *) exit 0 ;;
esac
`,
  );
  writeExecutable(
    join(binDirectory, "node"),
    `#!/bin/sh
case "\${1:-}" in
  --version|-v) printf '%s\\n' "\${FAKE_NODE_VERSION:-v20.0.0}"; exit 0 ;;
  -e|-)
    if test "\${FAKE_NODE_EXEC_BROKEN:-0}" = 1; then exit 1; fi
    if test "\${FAKE_NODE_NOOP:-0}" = 1; then exit 0; fi
    if test "\${FAKE_NODE_STDIN_BROKEN:-0}" = 1 && test "\${1:-}" = - && test "\$#" -eq 1; then exit 1; fi
    if test "\${FAKE_NODE_PARSER_BROKEN:-0}" = 1 && test "\${1:-}" = - && test "\$#" -gt 1; then exit 1; fi
    ;;
esac
exec ${JSON.stringify(process.execPath)} "\$@"
`,
  );
  for (const name of ["npm", "npx"]) {
    writeExecutable(join(binDirectory, name), "#!/bin/sh\nexit 0\n");
  }
  writeExecutable(join(binDirectory, "curl"), "#!/bin/sh\nexit 0\n");
  writeExecutable(
    join(binDirectory, "lsof"),
    '#!/bin/sh\nif test -n "${FAKE_LSOF_LOG:-}"; then printf "%s\\n" "$*" >> "${FAKE_LSOF_LOG}"; fi\nexit 1\n',
  );

  writeFileSync(join(root, "cv_parser_service", "Dockerfile"), "FROM scratch\n");
  writeFileSync(
    join(root, "scripts", "local-convex-supervisor.cjs"),
    "// Doctor fixture marker.\n",
  );
  writeFileSync(
    join(appDirectory, "package.json"),
    `${JSON.stringify(
      {
        private: true,
        dependencies: { convex: "0.0.0-doctor-fixture" },
        devDependencies: { vite: "0.0.0-doctor-fixture" },
      },
      null,
      2,
    )}\n`,
  );
  if (dependencies) {
    installDependencyFixture(root, "vite");
    installDependencyFixture(root, "convex");
  }

  const envFile = join(root, ".env.local");
  writeFileSync(
    envFile,
    "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\n",
    { mode: 0o600 },
  );

  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, binDirectory, envFile };
}

function installDependencyFixture(root, name) {
  const moduleDirectory = join(root, "my-app", "node_modules", name);
  mkdirSync(moduleDirectory, { recursive: true });
  writeFileSync(
    join(moduleDirectory, "package.json"),
    `${JSON.stringify({ name, version: "0.0.0-doctor-fixture" })}\n`,
  );
  writeExecutable(
    join(root, "my-app", "node_modules", ".bin", name),
    "#!/bin/sh\nexit 0\n",
  );
  if (name === "vite") {
    mkdirSync(join(moduleDirectory, "bin"));
    writeFileSync(join(moduleDirectory, "bin", "vite.js"), "// Doctor fixture.\n");
  }
}

function removeDependencyFixture(root, name) {
  rmSync(join(root, "my-app", "node_modules", name), {
    recursive: true,
    force: true,
  });
  rmSync(join(root, "my-app", "node_modules", ".bin", name), {
    force: true,
  });
}

function runDoctor(fixture, args = [], env = {}) {
  const result = spawnSync(bash, ["./run.sh", "doctor", ...args], {
    cwd: fixture.root,
    encoding: "utf8",
    timeout: 5_000,
    env: {
      HOME: join(fixture.root, "home"),
      LANG: "C",
      LC_ALL: "C",
      PATH: fixture.binDirectory,
      ...env,
    },
  });
  assert.equal(result.error, undefined);
  return {
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    status: result.status,
  };
}

function assertFailure(result) {
  assert.notEqual(result.status, 0, result.output);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function configureValidMcpFixture(
  fixture,
  { rootEnvExtra = "", baseEnv = "", appEnv = "" } = {},
) {
  rmSync(join(fixture.binDirectory, "node"));
  symlinkSync(process.execPath, join(fixture.binDirectory, "node"));

  const credentialsDirectory = join(fixture.root, "home", ".cloudflared");
  const credentialsFile = join(
    credentialsDirectory,
    "935a2064-9473-41bc-bd73-174660892847.json",
  );
  mkdirSync(credentialsDirectory, { recursive: true });
  writeFileSync(credentialsFile, "{}\n", { mode: 0o600 });

  const hiddenValues = {
    digest: "a".repeat(64),
    convexToken: "doctor-valid#convex-token-do-not-print",
  };
  writeFileSync(
    fixture.envFile,
    `CONVEX_TEAM=doctor-fixture-team
CONVEX_PROJECT=doctor-fixture-project
MCP_OAUTH_PRODUCTION_RUNTIME="1" # enabled
MCP_OAUTH_PRODUCTION_APPROVED='1' # enabled
MCP_OAUTH_PRODUCTION_ROUTE_WIRING="1" # enabled
MCP_OAUTH_PRODUCTION_CLIENT_IDS="local-chatgpt-client" # exact client
MCP_OAUTH_PRODUCTION_PRIVATE_BETA_ENABLED="1" # enabled
MCP_OAUTH_PRODUCTION_PRIVATE_BETA_CLIENT_IDS="local-chatgpt-client" # exact client
MCP_OAUTH_PRODUCTION_PRIVATE_BETA_RESOURCES="https://mcp.twoweeks.ai/mcp" # exact resource
MCP_OAUTH_PRODUCTION_RESOURCE="https://mcp.twoweeks.ai/mcp" # exact resource
MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN="https://mcp.twoweeks.ai" # exact origin
MCP_OAUTH_PRODUCTION_REDIRECT_URIS="https://chatgpt.com/connector/oauth/b7v_6OncLEsg" # exact redirect
MCP_OAUTH_PRODUCTION_ISSUER="https://mcp.twoweeks.ai" # issuer
MCP_OAUTH_PRODUCTION_PROVIDER_ENVIRONMENT="production" # environment
MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256="${hiddenValues.digest}" # digest
CLERK_JWT_ISSUER_DOMAIN="https://doctor.clerk.accounts.dev" # issuer
CONVEX_URL="https://doctor-convex.invalid" # URL
CONVEX_AUTH_TOKEN="${hiddenValues.convexToken}" # token
${rootEnvExtra}`,
    { mode: 0o600 },
  );
  if (baseEnv) writeFileSync(join(fixture.root, ".env"), baseEnv);
  if (appEnv) writeFileSync(join(fixture.root, "my-app", ".env"), appEnv);
  return { credentialsFile, hiddenValues };
}

test("doctor defaults to a successful, read-only local-fast check", (t) => {
  const fixture = createFixture(t);
  const bindingBefore = readFileSync(fixture.envFile, "utf8");

  const result = runDoctor(fixture);

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /local-fast/i);
  assert.equal(readFileSync(fixture.envFile, "utf8"), bindingBefore);
  for (const directory of generatedDirectories) {
    assert.equal(
      existsSync(join(fixture.root, directory)),
      false,
      `doctor created ${directory}`,
    );
  }
});

test("doctor parses dotenv files as data without executing shell content", (t) => {
  const fixture = createFixture(t);
  const marker = join(fixture.root, "dotenv-command-ran");
  writeFileSync(
    join(fixture.root, ".env"),
    `DOCTOR_EXECUTION_PROBE=\$(touch "${marker}")\n`,
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assert.equal(result.status, 0, result.output);
  assert.equal(existsSync(marker), false, "doctor executed dotenv shell content");
});

test("doctor applies literal local-fast dotenv overrides with startup precedence", (t) => {
  const fixture = createFixture(t);
  rmSync(join(fixture.binDirectory, "node"));
  symlinkSync(process.execPath, join(fixture.binDirectory, "node"));
  writeFileSync(
    join(fixture.root, ".env"),
    'VITE_PORT="6101" # base port\nIMAGE_NAME="base-image:fixture" # base image\n',
  );
  writeFileSync(
    fixture.envFile,
    `CONVEX_TEAM=doctor-fixture-team
CONVEX_PROJECT=doctor-fixture-project
VITE_PORT="6201" # local override
LOCAL_CONVEX_CLOUD_PORT='6202' # local cloud
LOCAL_CONVEX_SITE_PORT="6203" # local site
IMAGE_NAME="doctor-image:fixture" # selected image
CONVEX_TMPDIR="fixture-convex-tmp" # relative to repository root
`,
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_DOCKER_EXPECT_IMAGE: "doctor-image:fixture",
    FAKE_LSOF_LOG: join(fixture.root, "lsof.log"),
  });

  assert.equal(result.status, 0, result.output);
  const lsofLog = readFileSync(join(fixture.root, "lsof.log"), "utf8");
  for (const port of ["6201", "6202", "6203"]) {
    assert.match(lsofLog, new RegExp(`iTCP:${port}`));
    assert.doesNotMatch(result.output, new RegExp(port));
  }
  assert.doesNotMatch(lsofLog, /iTCP:6101/u);
});

test("doctor restores the startup default after a higher-precedence empty override", (t) => {
  const fixture = createFixture(t);
  rmSync(join(fixture.binDirectory, "node"));
  symlinkSync(process.execPath, join(fixture.binDirectory, "node"));
  writeFileSync(
    fixture.envFile,
    "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nVITE_PORT=\n",
    { mode: 0o600 },
  );

  const lsofLogPath = join(fixture.root, "lsof.log");
  const result = runDoctor(fixture, ["local-fast"], {
    VITE_PORT: "7000",
    FAKE_LSOF_LOG: lsofLogPath,
  });

  assert.equal(result.status, 0, result.output);
  const lsofLog = readFileSync(lsofLogPath, "utf8");
  assert.match(lsofLog, /iTCP:5173/u);
  assert.doesNotMatch(lsofLog, /iTCP:7000/u);
  assert.doesNotMatch(result.output, /5173|7000/u);
});

test("doctor local-fast ignores an invalid MCP-only Vite port", (t) => {
  const fixture = createFixture(t);
  writeFileSync(
    fixture.envFile,
    "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nMCP_PRIVATE_BETA_VITE_PORT=not-a-port\n",
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /MCP_PRIVATE_BETA_VITE_PORT/u);
});

test("doctor local-fast rejects an invalid local-fast Vite port", (t) => {
  const fixture = createFixture(t);
  writeFileSync(
    fixture.envFile,
    "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nVITE_PORT=not-a-port\n",
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /VITE_PORT is not a supported literal/i);
});

test("doctor fails closed for a non-literal runtime override", (t) => {
  const fixture = createFixture(t);
  rmSync(join(fixture.binDirectory, "node"));
  symlinkSync(process.execPath, join(fixture.binDirectory, "node"));
  writeFileSync(
    fixture.envFile,
    'CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nCONVEX_TMPDIR="$HOME/convex"\n',
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /CONVEX_TMPDIR is not a supported literal/i);
  assert.doesNotMatch(result.output, /\/convex/u);
});

for (const [label, assignment] of [
  ["process substitution", "CONVEX_TMPDIR=<(touch dotenv-command-ran)"],
  ["tilde expansion", "CONVEX_TMPDIR=~/convex"],
  ["backslash escape", "CONVEX_TMPDIR=fixture\\ convex"],
  ["unmatched quote", 'CONVEX_TMPDIR="fixture-convex'],
  ["whitespace before equals", "CONVEX_TMPDIR =fixture-convex"],
  ["whitespace after equals", "CONVEX_TMPDIR= fixture-convex"],
]) {
  test(`doctor rejects ${label} in a runtime override`, (t) => {
    const fixture = createFixture(t);
    rmSync(join(fixture.binDirectory, "node"));
    symlinkSync(process.execPath, join(fixture.binDirectory, "node"));
    const marker = join(fixture.root, "dotenv-command-ran");
    const safeAssignment = assignment.replace("dotenv-command-ran", marker);
    writeFileSync(
      fixture.envFile,
      `CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\n${safeAssignment}\n`,
      { mode: 0o600 },
    );

    const result = runDoctor(fixture, ["local-fast"]);

    assertFailure(result);
    assert.match(result.output, /CONVEX_TMPDIR is not a supported literal/i);
    assert.equal(existsSync(marker), false, `${label} was executed`);
  });
}

test("doctor local-fast succeeds with fake tools and a minimal Convex binding", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"]);

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /doctor/i);
  assert.match(result.output, /(pass|ready|ok)/i);
});

test("doctor accepts exported Convex bindings without relying on xargs echo", (t) => {
  const fixture = createFixture(t);
  writeFileSync(
    fixture.envFile,
    "export CONVEX_TEAM=doctor-export-team\nexport CONVEX_PROJECT=doctor-export-project\n",
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Convex team\/project binding is available/i);
  assert.doesNotMatch(result.output, /doctor-export-(team|project)/u);
});

test("doctor rejects disabled local Convex deployments", (t) => {
  const fixture = createFixture(t);
  const convexDirectory = join(fixture.root, "home", ".convex");
  mkdirSync(convexDirectory, { recursive: true });
  writeFileSync(
    join(convexDirectory, "config.json"),
    '{"optOutOfLocalDevDeploymentsUntilBetaOver": true}\n',
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /local Convex deployments are disabled/i);
});

test("doctor checks ports resolved from named local Convex state", (t) => {
  const fixture = createFixture(t);
  const deploymentName = "doctor-named-deployment";
  const stateDirectory = join(
    fixture.root,
    "home",
    ".convex",
    "convex-backend-state",
    deploymentName,
  );
  mkdirSync(stateDirectory, { recursive: true });
  writeFileSync(
    join(stateDirectory, "config.json"),
    '{\n  "ports": {\n    "cloud": 7302,\n    "site": 7303\n  }\n}\n',
  );
  writeFileSync(
    fixture.envFile,
    `CONVEX_TEAM=doctor-fixture-team
CONVEX_PROJECT=doctor-fixture-project
CONVEX_DEPLOYMENT=local:${deploymentName}
`,
    { mode: 0o600 },
  );
  const lsofLogPath = join(fixture.root, "lsof.log");

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_LSOF_LOG: lsofLogPath,
  });

  assert.equal(result.status, 0, result.output);
  const lsofLog = readFileSync(lsofLogPath, "utf8");
  assert.match(lsofLog, /iTCP:7302/u);
  assert.match(lsofLog, /iTCP:7303/u);
  assert.doesNotMatch(lsofLog, /iTCP:3210|iTCP:3211/u);
  assert.doesNotMatch(result.output, /7302|7303/u);
});

test("doctor rejects an out-of-range port resolved from local Convex state", (t) => {
  const fixture = createFixture(t);
  const deploymentName = "doctor-invalid-port-deployment";
  const stateDirectory = join(
    fixture.root,
    "home",
    ".convex",
    "convex-backend-state",
    deploymentName,
  );
  mkdirSync(stateDirectory, { recursive: true });
  writeFileSync(
    join(stateDirectory, "config.json"),
    '{\n  "ports": {\n    "cloud": 7302,\n    "site": 65536\n  }\n}\n',
  );
  writeFileSync(
    fixture.envFile,
    `CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nCONVEX_DEPLOYMENT=local:${deploymentName}\n`,
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /resolved Convex site port must be between 1 and 65535/i);
  assert.doesNotMatch(result.output, /65536/u);
});

test("doctor checks a configured LOCAL_CONVEX_URL port", (t) => {
  const fixture = createFixture(t);
  writeFileSync(
    fixture.envFile,
    "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nLOCAL_CONVEX_URL=http://127.0.0.1:7402\n",
    { mode: 0o600 },
  );
  const lsofLogPath = join(fixture.root, "lsof.log");

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_LSOF_LOG: lsofLogPath,
  });

  assert.equal(result.status, 0, result.output);
  assert.match(readFileSync(lsofLogPath, "utf8"), /iTCP:7402/u);
  assert.doesNotMatch(result.output, /7402/u);
});

for (const invalidPort of ["0", "65536"]) {
  test(`doctor rejects an out-of-range LOCAL_CONVEX_URL port (${invalidPort})`, (t) => {
    const fixture = createFixture(t);
    writeFileSync(
      fixture.envFile,
      `CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nLOCAL_CONVEX_URL=http://127.0.0.1:${invalidPort}\n`,
      { mode: 0o600 },
    );

    const result = runDoctor(fixture, ["local-fast"]);

    assertFailure(result);
    assert.match(result.output, /LOCAL_CONVEX_URL port must be between 1 and 65535/i);
    assert.doesNotMatch(result.output, /127\.0\.0\.1/u);
  });
}

for (const architecture of ["x86_64", "amd64", "arm64", "aarch64"]) {
  test(`doctor accepts the supported ${architecture} architecture`, (t) => {
    const fixture = createFixture(t);

    const result = runDoctor(fixture, ["local-fast"], {
      FAKE_UNAME_M: architecture,
    });

    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /CPU architecture is supported/i);
  });
}

test("doctor rejects an unsupported architecture without printing its value", (t) => {
  const fixture = createFixture(t);
  const unsupportedArchitecture = "doctor-unsupported-architecture";

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_UNAME_M: unsupportedArchitecture,
  });

  assertFailure(result);
  assert.match(result.output, /CPU architecture is unsupported/i);
  assert.doesNotMatch(result.output, new RegExp(unsupportedArchitecture));
});

test("doctor disables xtrace before configured runtime values are loaded", (t) => {
  const fixture = createFixture(t);
  rmSync(join(fixture.binDirectory, "node"));
  symlinkSync(process.execPath, join(fixture.binDirectory, "node"));
  const hiddenValues = ["6391", "doctor-hidden-image:fixture", "doctor-hidden-tmp"];
  writeFileSync(
    fixture.envFile,
    `CONVEX_TEAM=doctor-fixture-team
CONVEX_PROJECT=doctor-fixture-project
VITE_PORT=${hiddenValues[0]}
IMAGE_NAME=${hiddenValues[1]}
CONVEX_TMPDIR=${hiddenValues[2]}
`,
    { mode: 0o600 },
  );

  const result = spawnSync(bash, ["-x", "./run.sh", "doctor", "local-fast"], {
    cwd: fixture.root,
    encoding: "utf8",
    timeout: 5_000,
    env: {
      HOME: join(fixture.root, "home"),
      LANG: "C",
      LC_ALL: "C",
      PATH: fixture.binDirectory,
      FAKE_DOCKER_EXPECT_IMAGE: hiddenValues[1],
    },
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  assert.equal(result.status, 0, output);
  for (const value of hiddenValues) {
    assert.doesNotMatch(output, new RegExp(escapeRegExp(value)));
  }
});

test("doctor recognizes a Linux shell running through WSL2", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_UNAME_S: "Linux",
    FAKE_UNAME_R: "5.15.153.1-microsoft-standard-WSL2",
    WSL_DISTRO_NAME: "Ubuntu",
  });

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Windows through WSL2/i);
});

test("doctor rejects WSL1 instead of reporting it as WSL2", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_UNAME_S: "Linux",
    FAKE_UNAME_R: "4.4.0-19041-Microsoft",
    WSL_DISTRO_NAME: "Ubuntu",
  });

  assertFailure(result);
  assert.match(result.output, /WSL1 is unsupported/i);
  assert.match(result.output, /WSL2/i);
});

test("doctor installs a non-mutating signal trap", () => {
  const source = readFileSync(sourceRunScript, "utf8");

  assert.match(
    source,
    /if \[\[ "\$\{CMD\}" == "doctor" \]\]; then\s+trap 'exit 130' INT TERM/u,
  );
});

test("doctor rejects an unknown target without running checks", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["unknown-target"]);

  assert.equal(result.status, 2, result.output);
  assert.match(result.output, /usage:/i);
  assert.doesNotMatch(result.output, /Docker daemon/i);
});

test("doctor reports a missing Docker CLI by actionable name only", (t) => {
  const fixture = createFixture(t);
  rmSync(join(fixture.binDirectory, "docker"));

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /docker (CLI|command)/i);
  assert.match(result.output, /(install|missing|required)/i);
  assert.doesNotMatch(result.output, new RegExp(escapeRegExp(fixture.root)));
  assert.doesNotMatch(result.output, /PATH=/);
});

test("doctor warns but does not fail when lsof is unavailable", (t) => {
  const fixture = createFixture(t);
  rmSync(join(fixture.binDirectory, "lsof"));

  const result = runDoctor(fixture, ["local-fast"]);

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /WARN - lsof command is missing; port conflict checks will be skipped/i);
});

test("doctor rejects Node versions older than the CI runtime", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_NODE_VERSION: "v18.20.0",
  });

  assertFailure(result);
  assert.match(result.output, /Node 20 or newer is required/i);
  assert.doesNotMatch(result.output, /18\.20/u);
});

test("doctor rejects a Node binary that cannot execute node -e", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_NODE_EXEC_BROKEN: "1",
  });

  assertFailure(result);
  assert.match(result.output, /cannot execute startup scripts with node -e/i);
});

test("doctor rejects a Node wrapper that returns success without executing scripts", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_NODE_NOOP: "1",
  });

  assertFailure(result);
  assert.match(result.output, /cannot execute startup scripts with node -e/i);
});

test("doctor rejects a Node binary that cannot execute scripts from stdin", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_NODE_STDIN_BROKEN: "1",
  });

  assertFailure(result);
  assert.match(result.output, /cannot execute doctor scripts from standard input/i);
});

test("doctor fails when the runtime dotenv parser process fails", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_NODE_PARSER_BROKEN: "1",
  });

  assertFailure(result);
  assert.match(result.output, /runtime dotenv parser failed/i);
});

test("doctor fails when the Docker daemon is unavailable", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_DOCKER_DAEMON: "unavailable",
  });

  assertFailure(result);
  assert.match(result.output, /Docker daemon/i);
  assert.match(result.output, /(start|unavailable|not running|required)/i);
});

test("doctor local-fast rejects a missing parser image", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_DOCKER_IMAGE: "missing",
  });

  assertFailure(result);
  assert.match(result.output, /parser runtime image is missing/i);
  assert.doesNotMatch(result.output, /startup will build it/i);
});

for (const dependency of ["vite", "convex"]) {
  test(`doctor fails when the ${dependency} dependency is missing`, (t) => {
    const fixture = createFixture(t);
    removeDependencyFixture(fixture.root, dependency);

    const result = runDoctor(fixture, ["local-fast"]);

    assertFailure(result);
    assert.match(result.output, new RegExp(dependency, "i"));
    assert.match(result.output, /(install|missing|required)/i);
  });
}

for (const platform of [
  "MINGW64_NT-10.0-22631",
  "MSYS_NT-10.0-22631",
  "CYGWIN_NT-10.0-22631",
]) {
  test(`doctor rejects native ${platform.split("_")[0]} and recommends WSL2`, (t) => {
    const fixture = createFixture(t);

    const result = runDoctor(fixture, ["local-fast"], {
      FAKE_UNAME_S: platform,
    });

    assertFailure(result);
    assert.match(result.output, /unsupported/i);
    assert.match(result.output, /WSL2/i);
  });
}

test("doctor mcp-private-beta fails closed without printing configured values", (t) => {
  const fixture = createFixture(t);
  const configuredValues = [
    "configured-runtime-do-not-print",
    "configured-client-do-not-print",
    "configured-issuer-do-not-print.invalid",
    "configured-secret-digest-do-not-print",
    "configured-convex-token-do-not-print",
  ];
  writeFileSync(
    fixture.envFile,
    `CONVEX_TEAM=doctor-fixture-team
CONVEX_PROJECT=doctor-fixture-project
MCP_OAUTH_PRODUCTION_RUNTIME=${configuredValues[0]}
MCP_OAUTH_PRODUCTION_APPROVED=1
MCP_OAUTH_PRODUCTION_ROUTE_WIRING=1
MCP_OAUTH_PRODUCTION_CLIENT_IDS=${configuredValues[1]}
MCP_OAUTH_PRODUCTION_PRIVATE_BETA_ENABLED=1
MCP_OAUTH_PRODUCTION_PRIVATE_BETA_CLIENT_IDS=${configuredValues[1]}
MCP_OAUTH_PRODUCTION_PRIVATE_BETA_RESOURCES=https://configured-resource-do-not-print.invalid/mcp
MCP_OAUTH_PRODUCTION_RESOURCE=https://configured-resource-do-not-print.invalid/mcp
MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN=https://configured-origin-do-not-print.invalid
MCP_OAUTH_PRODUCTION_REDIRECT_URIS=https://configured-redirect-do-not-print.invalid/oauth
MCP_OAUTH_PRODUCTION_ISSUER=https://${configuredValues[2]}
MCP_OAUTH_PRODUCTION_PROVIDER_ENVIRONMENT=configured-provider-do-not-print
MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256=${configuredValues[3]}
CLERK_JWT_ISSUER_DOMAIN=https://configured-clerk-do-not-print.invalid
CONVEX_URL=https://configured-convex-do-not-print.invalid
CONVEX_AUTH_TOKEN=${configuredValues[4]}
`,
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assertFailure(result);
  assert.match(result.output, /(mcp-check|MCP.*config)/i);
  assert.match(result.output, /(fail|invalid|missing|does not match)/i);
  for (const value of configuredValues) {
    assert.doesNotMatch(result.output, new RegExp(escapeRegExp(value)));
  }
  assert.doesNotMatch(result.output, /configured-(resource|origin|redirect|provider|clerk|convex)-do-not-print/i);
});

test("doctor rejects a quoted tilde in the MCP credentials path", (t) => {
  const fixture = createFixture(t);
  rmSync(join(fixture.binDirectory, "node"));
  symlinkSync(process.execPath, join(fixture.binDirectory, "node"));
  writeFileSync(
    fixture.envFile,
    'CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nMCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE="~/.cloudflared/fixture.json"\n',
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assertFailure(result);
  assert.match(result.output, /MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE must not use tilde expansion/i);
  assert.doesNotMatch(result.output, /fixture\.json/u);
});

test("doctor mcp-private-beta validates a complete fixture without exposing values", (t) => {
  const fixture = createFixture(t);
  const { hiddenValues } = configureValidMcpFixture(fixture);

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /private-beta MCP configuration is valid/i);
  for (const value of Object.values(hiddenValues)) {
    assert.doesNotMatch(result.output, new RegExp(escapeRegExp(value)));
  }
});

test("doctor mcp-private-beta warns when startup can build a missing parser image", (t) => {
  const fixture = createFixture(t);
  const { hiddenValues } = configureValidMcpFixture(fixture);

  const result = runDoctor(fixture, ["mcp-private-beta"], {
    FAKE_DOCKER_IMAGE: "missing",
  });

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /WARN - parser runtime image is missing; mcp-private-beta startup will build it with the available builder/i);
  for (const value of Object.values(hiddenValues)) {
    assert.doesNotMatch(result.output, new RegExp(escapeRegExp(value)));
  }
});

test("doctor mcp-private-beta rejects a missing image when buildx is unavailable", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture);

  const result = runDoctor(fixture, ["mcp-private-beta"], {
    FAKE_DOCKER_BUILDX: "unavailable",
    FAKE_DOCKER_IMAGE: "missing",
  });

  assertFailure(result);
  assert.match(result.output, /parser runtime image is missing and cannot be prepared/i);
});

test("doctor mcp-private-beta reports when startup must configure the buildx builder", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture);

  const result = runDoctor(fixture, ["mcp-private-beta"], {
    FAKE_DOCKER_BUILDER: "unavailable",
    FAKE_DOCKER_IMAGE: "missing",
  });

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /WARN - parser runtime image and buildx builder are missing; mcp-private-beta startup will configure the builder and build the image/i);
});

test("doctor preserves an empty higher-precedence Clerk publishable key", (t) => {
  const fixture = createFixture(t);
  const lowerPrecedenceValue = "bad-lower-clerk-key-do-not-print";
  const { hiddenValues } = configureValidMcpFixture(fixture, {
    baseEnv: `VITE_CLERK_PUBLISHABLE_KEY=${lowerPrecedenceValue}\n`,
    rootEnvExtra: "VITE_CLERK_PUBLISHABLE_KEY=\n",
  });

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, new RegExp(lowerPrecedenceValue, "u"));
  for (const value of Object.values(hiddenValues)) {
    assert.doesNotMatch(result.output, new RegExp(escapeRegExp(value)));
  }
});

test("doctor mcp-private-beta ignores an invalid local-fast Vite port", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture, {
    rootEnvExtra: "VITE_PORT=not-a-port\n",
  });

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /VITE_PORT is not a supported literal/u);
});

test("doctor mcp-private-beta rejects an invalid MCP Vite port", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture, {
    rootEnvExtra: "MCP_PRIVATE_BETA_VITE_PORT=not-a-port\n",
  });

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assertFailure(result);
  assert.match(result.output, /MCP_PRIVATE_BETA_VITE_PORT is not a supported literal/i);
});

test("doctor honors a tunnel credentials path configured in root .env", (t) => {
  const fixture = createFixture(t);
  const missingCredentials = join(fixture.root, "missing-credentials-do-not-print.json");
  configureValidMcpFixture(fixture, {
    baseEnv: `MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE=${missingCredentials}\n`,
  });

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assertFailure(result);
  assert.match(result.output, /named MCP tunnel credentials file is missing/i);
  assert.doesNotMatch(result.output, /missing-credentials-do-not-print/u);
});

test("doctor applies my-app .env last for the tunnel credentials path", (t) => {
  const fixture = createFixture(t);
  const alternateCredentials = join(fixture.root, "alternate-credentials-do-not-print.json");
  writeFileSync(alternateCredentials, "{}\n", { mode: 0o600 });
  configureValidMcpFixture(fixture, {
    baseEnv: `MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE=${join(fixture.root, "missing-credentials.json")}\n`,
    appEnv: `MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE=${alternateCredentials}\n`,
  });

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /alternate-credentials-do-not-print/u);
});
