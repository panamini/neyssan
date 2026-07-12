import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  readFileSync,
  renameSync,
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
    "awk",
    "cut",
    "dirname",
    "grep",
    "head",
    "seq",
    "shasum",
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
  info)
    test "\${FAKE_DOCKER_DAEMON:-available}" = available || exit 1
    if test -n "\${FAKE_DOCKER_OPERATING_SYSTEM:-}"; then printf '%s\n' "\${FAKE_DOCKER_OPERATING_SYSTEM}"; fi
    ;;
  image)
    if test "\${2:-}" = ls && test "\${FAKE_DOCKER_INVALID_REFERENCE:-0}" = 1; then exit 1; fi
    if test "\${2:-}" = inspect && test "\${FAKE_DOCKER_IMAGE:-available}" = missing; then exit 1; fi
    if test "\${2:-}" = inspect && test -n "\${FAKE_DOCKER_EXPECT_IMAGE:-}"; then test "\${3:-}" = "\${FAKE_DOCKER_EXPECT_IMAGE}" || exit 1; fi
    if test "\${2:-}" = inspect && test "\${4:-}" = --format && test -n "\${FAKE_DOCKER_TARGET_IMAGE_ID:-}"; then printf '%s\\n' "\${FAKE_DOCKER_TARGET_IMAGE_ID}"; fi
    ;;
  ps)
    if test -n "\${FAKE_DOCKER_RUNNING_NAMES:-}"; then printf '%s\\n' "\${FAKE_DOCKER_RUNNING_NAMES}"; fi
    ;;
  inspect)
    case "\$*" in
      *Mounts*)
        if test -n "\${FAKE_DOCKER_WORKSPACE_ROOT:-}"; then printf '%s -> /app\\n' "\${FAKE_DOCKER_WORKSPACE_ROOT}"; fi
        ;;
      *Image*)
        if test -n "\${FAKE_DOCKER_PARSER_IMAGE_ID:-}"; then printf '%s\\n' "\${FAKE_DOCKER_PARSER_IMAGE_ID}"; fi
        ;;
    esac
    ;;
  exec)
    test "\${FAKE_DOCKER_WORKSPACE_SURFACE:-available}" = available
    ;;
  port)
    if test -n "\${FAKE_DOCKER_PARSER_PORT:-}"; then printf '%s:%s\n' '0.0.0.0' "\${FAKE_DOCKER_PARSER_PORT}"; fi
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
    if test "\${FAKE_NODE_CONVEX_READY:-0}" = 1; then case "\${2:-}" in *instance_name*) exit 0 ;; esac; fi
    ;;
esac
exec ${JSON.stringify(process.execPath)} "\$@"
`,
  );
  for (const name of ["npm", "npx"]) {
    writeExecutable(join(binDirectory, name), "#!/bin/sh\nexit 0\n");
  }
  writeExecutable(
    join(binDirectory, "curl"),
    '#!/bin/sh\ncase "$*" in *127.0.0.1:8001/ready*) test "${FAKE_CURL_PARSER_READY:-ready}" = ready ;; *) exit 0 ;; esac\n',
  );
  writeExecutable(
    join(binDirectory, "lsof"),
    '#!/bin/sh\nif test -n "${FAKE_LSOF_LOG:-}"; then printf "%s\\n" "$*" >> "${FAKE_LSOF_LOG}"; fi\nif test -n "${FAKE_LSOF_BUSY_PATTERN:-}"; then case "$*" in *"${FAKE_LSOF_BUSY_PATTERN}"*) exit 0 ;; esac; fi\nexit 1\n',
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
    timeout: 10_000,
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

test("doctor rejects a regular file where the dev-stack state directory is required", (t) => {
  const fixture = createFixture(t);
  mkdirSync(join(fixture.root, "tmp"));
  writeFileSync(join(fixture.root, "tmp", "dev-stack"), "not-a-directory\n");

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /dev stack state directory is not a writable directory/i);
});

test("doctor rejects an existing runtime directory without search permission", (t) => {
  const fixture = createFixture(t);
  const stateDirectory = join(fixture.root, "tmp", "dev-stack");
  mkdirSync(stateDirectory, { recursive: true });
  chmodSync(stateDirectory, 0o600);

  const result = runDoctor(fixture, ["local-fast"]);
  chmodSync(stateDirectory, 0o700);

  assertFailure(result);
  assert.match(result.output, /dev stack state directory is not a writable directory/i);
});

test("doctor rejects a creatable runtime path under a non-searchable parent", (t) => {
  const fixture = createFixture(t);
  const parent = join(fixture.root, "runtime-parent-do-not-print");
  mkdirSync(parent, { mode: 0o600 });
  writeFileSync(
    fixture.envFile,
    `CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nCONVEX_TMPDIR=${parent}/convex\n`,
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["local-fast"]);
  chmodSync(parent, 0o700);

  assertFailure(result);
  assert.match(result.output, /Convex temporary directory cannot be created/i);
  assert.doesNotMatch(result.output, /runtime-parent-do-not-print/u);
});

test("doctor rejects dotenv shell content without executing it", (t) => {
  const fixture = createFixture(t);
  const marker = join(fixture.root, "dotenv-command-ran");
  writeFileSync(
    join(fixture.root, ".env"),
    `DOCTOR_EXECUTION_PROBE=\$(touch "${marker}")\n`,
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /startup environment files must contain literal assignments only/i);
  assert.equal(existsSync(marker), false, "doctor executed dotenv shell content");
  assert.doesNotMatch(result.output, new RegExp(escapeRegExp(marker)));
});

test("doctor accepts a quoted multi-line literal assignment", (t) => {
  const fixture = createFixture(t);
  writeFileSync(
    join(fixture.root, ".env"),
    'MULTILINE_LITERAL="first-line-do-not-print\nsecond-line-do-not-print"\n',
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /first-line-do-not-print|second-line-do-not-print/u);
});

test("doctor accepts a quoted multi-line runtime override", (t) => {
  const fixture = createFixture(t);
  writeFileSync(
    fixture.envFile,
    'CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nCONVEX_TMPDIR="fixture-convex-do-not-print\nmultiline-do-not-print"\n',
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /fixture-convex-do-not-print|multiline-do-not-print/u);
});

test("doctor treats a leading hash in an assignment value as literal data", (t) => {
  const fixture = createFixture(t);
  writeFileSync(
    fixture.envFile,
    "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nVITE_PORT=#6201\n",
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /VITE_PORT is not a supported literal/i);
  assert.doesNotMatch(result.output, /#6201/u);
});

test("doctor replays earlier dotenv assignments for later simple expansions", (t) => {
  const fixture = createFixture(t);
  writeFileSync(join(fixture.root, ".env"), "doctor_port=6205\n");
  writeFileSync(
    fixture.envFile,
    "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nVITE_PORT=$doctor_port\n",
    { mode: 0o600 },
  );
  const lsofLogPath = join(fixture.root, "lsof.log");

  const result = runDoctor(fixture, ["local-fast"], { FAKE_LSOF_LOG: lsofLogPath });

  assert.equal(result.status, 0, result.output);
  assert.match(readFileSync(lsofLogPath, "utf8"), /iTCP:6205/u);
  assert.doesNotMatch(result.output, /doctor_port|6205/u);
});

test("doctor accepts safe concatenation of quoted and unquoted assignment segments", (t) => {
  const fixture = createFixture(t);
  writeFileSync(join(fixture.root, ".env"), 'VITE_PORT="$DOCTOR_PORT_PREFIX"06\n');
  const lsofLogPath = join(fixture.root, "lsof.log");

  const result = runDoctor(fixture, ["local-fast"], {
    DOCTOR_PORT_PREFIX: "62",
    FAKE_LSOF_LOG: lsofLogPath,
  });

  assert.equal(result.status, 0, result.output);
  assert.match(readFileSync(lsofLogPath, "utf8"), /iTCP:6206/u);
  assert.doesNotMatch(result.output, /DOCTOR_PORT_PREFIX|6206/u);
});

test("doctor rejects shell syntax errors in any sourced environment file", (t) => {
  const fixture = createFixture(t);
  const invalidSyntax = 'UNRELATED="unterminated-do-not-print\n';
  writeFileSync(join(fixture.root, ".env"), invalidSyntax);

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /startup environment file syntax is invalid/i);
  assert.doesNotMatch(result.output, /unterminated-do-not-print/u);
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

test("doctor normalizes a leading-zero Vite port before checking its listener", (t) => {
  const fixture = createFixture(t);
  writeFileSync(
    fixture.envFile,
    "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nVITE_PORT=05200\n",
    { mode: 0o600 },
  );
  const lsofLogPath = join(fixture.root, "lsof.log");

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_LSOF_LOG: lsofLogPath,
  });

  assert.equal(result.status, 0, result.output);
  assert.match(readFileSync(lsofLogPath, "utf8"), /iTCP:5200/u);
  assert.doesNotMatch(result.output, /05200|5200/u);
});

test("doctor rejects CRLF assignments that startup would source with carriage returns", (t) => {
  const fixture = createFixture(t);
  writeFileSync(
    fixture.envFile,
    "CONVEX_TEAM=doctor-fixture-team\r\nCONVEX_PROJECT=doctor-fixture-project\r\nVITE_PORT=5200\r\n",
    { mode: 0o600 },
  );
  const lsofLogPath = join(fixture.root, "lsof.log");

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_LSOF_LOG: lsofLogPath,
  });

  assertFailure(result);
  assert.match(result.output, /startup environment files must contain literal assignments only/i);
  assert.doesNotMatch(result.output, /5200/u);
});

test("doctor seeds simple expansions with the pre-source ROOT_DIR", (t) => {
  const fixture = createFixture(t);
  writeFileSync(fixture.envFile, "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nCONVEX_TMPDIR=$ROOT_DIR/tmp/convex-tmp\n", { mode: 0o600 });
  const result = runDoctor(fixture, ["local-fast"]);
  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /ROOT_DIR|convex-tmp/u);
});

for (const controlKey of [
  "BUILDKIT_PROGRESS",
  "DOCKER_API_VERSION",
  "DOCKER_CERT_PATH",
  "DOCKER_CONFIG",
  "DOCKER_CONTEXT",
  "DOCKER_CUSTOM_HEADERS",
  "DOCKER_DEFAULT_PLATFORM",
  "DOCKER_HIDE_LEGACY_COMMANDS",
  "DOCKER_HOST",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_COLOR",
  "NO_PROXY",
  "IFS",
  "ROOT_DIR",
  "http_proxy",
  "https_proxy",
  "no_proxy",
]) {
  test(`doctor rejects ${controlKey} assignments that change startup execution`, (t) => {
    const fixture = createFixture(t);
    writeFileSync(join(fixture.root, ".env"), `${controlKey}=unsafe-do-not-print\n`);
    const result = runDoctor(fixture, ["local-fast"]);
    assertFailure(result);
    assert.match(result.output, /startup environment files must contain literal assignments only/i);
    assert.doesNotMatch(result.output, /unsafe-do-not-print/u);
  });
}

test("doctor fails an occupied custom Vite port outside startup cleanup", (t) => {
  const fixture = createFixture(t);
  writeFileSync(fixture.envFile, "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nVITE_PORT=6207\n", { mode: 0o600 });
  const result = runDoctor(fixture, ["local-fast"], { FAKE_LSOF_BUSY_PATTERN: "iTCP:6207" });
  assertFailure(result);
  assert.match(result.output, /VITE_PORT is already in use by an untracked process/i);
  assert.doesNotMatch(result.output, /6207/u);
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

test("doctor accepts a valid higher-precedence value after an invalid lower value", (t) => {
  const fixture = createFixture(t);
  writeFileSync(join(fixture.root, ".env"), "VITE_PORT=not-a-port\n");
  writeFileSync(
    fixture.envFile,
    "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nVITE_PORT=6201\n",
    { mode: 0o600 },
  );
  const lsofLogPath = join(fixture.root, "lsof.log");

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_LSOF_LOG: lsofLogPath,
  });

  assert.equal(result.status, 0, result.output);
  assert.match(readFileSync(lsofLogPath, "utf8"), /iTCP:6201/u);
  assert.doesNotMatch(result.output, /6201|not-a-port/u);
});

test("doctor accepts an empty higher-precedence value after an invalid lower value", (t) => {
  const fixture = createFixture(t);
  writeFileSync(join(fixture.root, ".env"), "VITE_PORT=not-a-port\n");
  writeFileSync(
    fixture.envFile,
    "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nVITE_PORT=\n",
    { mode: 0o600 },
  );
  const lsofLogPath = join(fixture.root, "lsof.log");

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_LSOF_LOG: lsofLogPath,
  });

  assert.equal(result.status, 0, result.output);
  assert.match(readFileSync(lsofLogPath, "utf8"), /iTCP:5173/u);
  assert.doesNotMatch(result.output, /5173|not-a-port/u);
});

for (const invalidTimeout of ["0", "not-a-number"]) {
  test(`doctor rejects an invalid local Convex startup timeout (${invalidTimeout})`, (t) => {
    const fixture = createFixture(t);
    writeFileSync(
      fixture.envFile,
      `CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nLOCAL_CONVEX_STARTUP_TIMEOUT=${invalidTimeout}\n`,
      { mode: 0o600 },
    );

    const result = runDoctor(fixture, ["local-fast"]);

    assertFailure(result);
    assert.match(result.output, /LOCAL_CONVEX_STARTUP_TIMEOUT must be a positive integer/i);
    if (invalidTimeout !== "0") {
      assert.doesNotMatch(result.output, new RegExp(escapeRegExp(invalidTimeout)));
    }
  });
}

test("doctor keeps command substitutions blocking after a later literal override", (t) => {
  const fixture = createFixture(t);
  writeFileSync(join(fixture.root, ".env"), "VITE_PORT=$(false)\n");
  writeFileSync(
    fixture.envFile,
    "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nVITE_PORT=6201\n",
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /VITE_PORT is not a supported literal/i);
  assert.doesNotMatch(result.output, /6201/u);
});

test("doctor keeps assignment commands blocking after a later literal override", (t) => {
  const fixture = createFixture(t);
  writeFileSync(join(fixture.root, ".env"), "VITE_PORT=bad command-does-not-exist\n");
  writeFileSync(
    fixture.envFile,
    "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nVITE_PORT=6201\n",
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /startup environment files must contain literal assignments only/i);
  assert.doesNotMatch(result.output, /command-does-not-exist|6201/u);
});

test("doctor keeps parameter expansions blocking after a later literal override", (t) => {
  const fixture = createFixture(t);
  writeFileSync(join(fixture.root, ".env"), "VITE_PORT=$UNSET_PORT\n");
  writeFileSync(
    fixture.envFile,
    "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nVITE_PORT=6201\n",
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /startup environment files must contain literal assignments only/i);
  assert.doesNotMatch(result.output, /UNSET_PORT|6201/u);
});

for (const [label, assignment] of [
  ["unquoted", "VITE_PORT=$DOCTOR_EXPORTED_PORT"],
  ["double-quoted", 'VITE_PORT="$DOCTOR_EXPORTED_PORT"'],
  ["braced", 'VITE_PORT="${DOCTOR_EXPORTED_PORT}"'],
]) {
  test(`doctor resolves a defined ${label} parameter override like startup`, (t) => {
    const fixture = createFixture(t);
    const port = "6204";
    writeFileSync(join(fixture.root, ".env"), `${assignment}\n`);
    const lsofLogPath = join(fixture.root, "lsof.log");

    const result = runDoctor(fixture, ["local-fast"], {
      DOCTOR_EXPORTED_PORT: port,
      FAKE_LSOF_LOG: lsofLogPath,
    });

    assert.equal(result.status, 0, result.output);
    assert.match(readFileSync(lsofLogPath, "utf8"), /iTCP:6204/u);
    assert.doesNotMatch(result.output, /DOCTOR_EXPORTED_PORT|6204/u);
  });
}

test("doctor sanitizes startup environment read failures", (t) => {
  const fixture = createFixture(t);
  mkdirSync(join(fixture.root, ".env"));

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /startup environment files must contain literal assignments only/i);
  assert.doesNotMatch(result.output, new RegExp(escapeRegExp(fixture.root), "u"));
  assert.doesNotMatch(result.output, /EISDIR|readFileSync|node:fs|at Object/u);
});

test("doctor rejects PATH assignments that would change startup command resolution", (t) => {
  const fixture = createFixture(t);
  const configuredPath = "/missing-command-path-do-not-print";
  writeFileSync(join(fixture.root, ".env"), `PATH=${configuredPath}\n`);

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /startup environment files must contain literal assignments only/i);
  assert.doesNotMatch(result.output, new RegExp(configuredPath, "u"));
});

test("doctor rejects NODE_OPTIONS assignments that would change startup Node execution", (t) => {
  const fixture = createFixture(t);
  writeFileSync(join(fixture.root, ".env"), "NODE_OPTIONS=--bad-option-do-not-print\n");

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /startup environment files must contain literal assignments only/i);
  assert.doesNotMatch(result.output, /bad-option-do-not-print/u);
});

for (const readonlyName of ["UID", "EUID", "PPID", "SHELLOPTS", "BASH_VERSINFO"]) {
  test(`doctor rejects assignment to readonly Bash variable ${readonlyName}`, (t) => {
    const fixture = createFixture(t);
    writeFileSync(join(fixture.root, ".env"), `${readonlyName}=readonly-do-not-print\n`);

    const result = runDoctor(fixture, ["local-fast"]);

    assertFailure(result);
    assert.match(result.output, /startup environment files must contain literal assignments only/i);
    assert.doesNotMatch(result.output, /readonly-do-not-print/u);
  });
}

test("doctor rejects assignment to a readonly Bash variable declared without a value", (t) => {
  const fixture = createFixture(t);
  const bashEnvPath = join(fixture.root, "bash-env-do-not-print");
  writeFileSync(bashEnvPath, "readonly DOCTOR_READONLY_WITHOUT_VALUE\n");
  writeFileSync(
    join(fixture.root, ".env"),
    "DOCTOR_READONLY_WITHOUT_VALUE=readonly-do-not-print\n",
  );

  const result = runDoctor(fixture, ["local-fast"], { BASH_ENV: bashEnvPath });

  assertFailure(result);
  assert.match(result.output, /startup environment files must contain literal assignments only/i);
  assert.doesNotMatch(result.output, /DOCTOR_READONLY_WITHOUT_VALUE|readonly-do-not-print/u);
});

test("doctor readonly detection cannot be bypassed by colliding with its transport name", (t) => {
  const fixture = createFixture(t);
  const bashEnvPath = join(fixture.root, "bash-env-do-not-print");
  writeFileSync(bashEnvPath, "readonly DOCTOR_READONLY_NAMES\n");
  writeFileSync(join(fixture.root, ".env"), "UID=readonly-do-not-print\n");

  const result = runDoctor(fixture, ["local-fast"], { BASH_ENV: bashEnvPath });

  assertFailure(result);
  assert.match(result.output, /startup environment files must contain literal assignments only/i);
  assert.doesNotMatch(result.output, /DOCTOR_READONLY_NAMES|readonly-do-not-print/u);
});

test("doctor rejects commands attached to non-allowlisted environment keys", (t) => {
  const fixture = createFixture(t);
  writeFileSync(join(fixture.root, ".env"), "UNRELATED=bad command-does-not-exist\n");

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /startup environment files must contain literal assignments only/i);
  assert.doesNotMatch(result.output, /UNRELATED|command-does-not-exist/u);
});

test("doctor resolves a defined parameter in a path override without leaking it", (t) => {
  const fixture = createFixture(t);
  rmSync(join(fixture.binDirectory, "node"));
  symlinkSync(process.execPath, join(fixture.binDirectory, "node"));
  writeFileSync(
    fixture.envFile,
    'CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nCONVEX_TMPDIR="$HOME/convex"\n',
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, new RegExp(escapeRegExp(fixture.root), "u"));
  assert.doesNotMatch(result.output, /\/convex/u);
});

test("doctor keeps complex parameter expansions blocked", (t) => {
  const fixture = createFixture(t);
  writeFileSync(
    fixture.envFile,
    'CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nCONVEX_TMPDIR="${HOME:-complex-fallback-do-not-print}/convex"\n',
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /startup environment files must contain literal assignments only/i);
  assert.doesNotMatch(result.output, /complex-fallback-do-not-print|\/convex/u);
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
    if (label === "unmatched quote") {
      assert.match(result.output, /startup environment file syntax is invalid/i);
    } else {
      assert.match(result.output, /CONVEX_TMPDIR is not a supported literal/i);
    }
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

test("doctor replays sourced HOME before checking local Convex configuration", (t) => {
  const fixture = createFixture(t);
  const alternateHome = join(fixture.root, "alternate-home-do-not-print");
  const convexDirectory = join(alternateHome, ".convex");
  mkdirSync(convexDirectory, { recursive: true });
  writeFileSync(join(convexDirectory, "config.json"), '{"optOutOfLocalDevDeploymentsUntilBetaOver": true}\n');
  writeFileSync(join(fixture.root, ".env"), `HOME=${alternateHome}\n`);

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /local Convex deployments are disabled/i);
  assert.doesNotMatch(result.output, /alternate-home-do-not-print/u);
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

test("doctor rejects corrupt named local Convex state JSON", (t) => {
  const fixture = createFixture(t);
  const deploymentName = "doctor-corrupt-state-deployment";
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
    '{"ports":{"cloud":7302,"site":7303}, invalid}\n',
  );
  writeFileSync(
    fixture.envFile,
    `CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nCONVEX_DEPLOYMENT=local:${deploymentName}\n`,
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /local Convex state configuration is invalid JSON/i);
  assert.doesNotMatch(result.output, /7302|7303/u);
});

test("doctor checks a configured LOCAL_CONVEX_URL port", (t) => {
  const fixture = createFixture(t);
  writeFileSync(
    fixture.envFile,
    "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nLOCAL_CONVEX_CLOUD_PORT=7402\nLOCAL_CONVEX_URL=http://127.0.0.1:7402\n",
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

test("doctor rejects a LOCAL_CONVEX_URL port that differs from the resolved cloud port", (t) => {
  const fixture = createFixture(t);
  writeFileSync(
    fixture.envFile,
    "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nLOCAL_CONVEX_CLOUD_PORT=7402\nLOCAL_CONVEX_URL=http://127.0.0.1:7403\n",
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /LOCAL_CONVEX_URL port must match the resolved Convex cloud port/i);
  assert.doesNotMatch(result.output, /7402|7403/u);
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

test("native Linux MCP tunnel uses host networking to reach loopback Vite", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture);

  const result = runDoctor(fixture, ["mcp-private-beta"], {
    FAKE_UNAME_S: "Linux",
    FAKE_UNAME_R: "6.8.0-doctor-fixture",
  });

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /native Linux host networking to reach loopback Vite/i);
  const source = readFileSync(join(fixture.root, "run.sh"), "utf8");
  assert.match(source, /tunnel_network_args=\(--network host\)/u);
  assert.match(source, /service_host="127\.0\.0\.1"/u);
});

test("Linux Docker Desktop MCP tunnel keeps the Docker Desktop host gateway", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture);

  const result = runDoctor(fixture, ["mcp-private-beta"], {
    FAKE_UNAME_S: "Linux",
    FAKE_UNAME_R: "6.8.0-doctor-fixture",
    FAKE_DOCKER_OPERATING_SYSTEM: "Docker Desktop",
  });

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Docker Desktop host gateway to reach loopback Vite/i);
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

test("doctor rejects a missing seq command required by startup loops", (t) => {
  const fixture = createFixture(t);
  rmSync(join(fixture.binDirectory, "seq"));

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /seq command is missing/i);
});

test("doctor rejects an untracked listener on the parser port", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_LSOF_BUSY_PATTERN: "iTCP:8001",
  });

  assertFailure(result);
  assert.match(result.output, /parser port is already in use by an untracked process/i);
  assert.doesNotMatch(result.output, /8001/u);
});

test("doctor accepts the parser port held by a reusable tracked workspace parser", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_DOCKER_RUNNING_NAMES: "cv-parser-service-dev",
    FAKE_DOCKER_WORKSPACE_ROOT: realpathSync(fixture.root),
    FAKE_DOCKER_PARSER_PORT: "8001",
    FAKE_LSOF_BUSY_PATTERN: "iTCP:8001",
  });

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /tracked parser is reusable/i);
  assert.doesNotMatch(result.output, /8001/u);
});

test("doctor loads a custom parser name with startup dotenv precedence", (t) => {
  const fixture = createFixture(t);
  const parserName = "doctor-custom-parser-do-not-print";
  writeFileSync(
    join(fixture.root, ".env"),
    "PARSER_NAME=doctor-lower-parser-do-not-print\n",
  );
  writeFileSync(
    fixture.envFile,
    "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nPARSER_NAME=doctor-middle-parser-do-not-print\n",
    { mode: 0o600 },
  );
  writeFileSync(
    join(fixture.root, "my-app", ".env"),
    `PARSER_NAME=${parserName}\n`,
  );

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_DOCKER_RUNNING_NAMES: parserName,
    FAKE_DOCKER_WORKSPACE_ROOT: realpathSync(fixture.root),
    FAKE_DOCKER_PARSER_PORT: "8001",
    FAKE_LSOF_BUSY_PATTERN: "iTCP:8001",
  });

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /tracked parser is reusable/i);
  assert.doesNotMatch(result.output, new RegExp(parserName, "u"));
});

test("doctor restores the default parser name after a higher-precedence empty override", (t) => {
  const fixture = createFixture(t);
  writeFileSync(
    join(fixture.root, ".env"),
    "PARSER_NAME=doctor-lower-parser-do-not-print\n",
  );
  writeFileSync(
    join(fixture.root, "my-app", ".env"),
    "PARSER_NAME=\n",
  );

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_DOCKER_RUNNING_NAMES: "cv-parser-service-dev",
    FAKE_DOCKER_WORKSPACE_ROOT: realpathSync(fixture.root),
    FAKE_DOCKER_PARSER_PORT: "8001",
    FAKE_LSOF_BUSY_PATTERN: "iTCP:8001",
  });

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /tracked parser is reusable/i);
  assert.doesNotMatch(result.output, /doctor-lower-parser-do-not-print/u);
});

test("doctor rejects a parser name that Docker cannot accept", (t) => {
  const fixture = createFixture(t);
  const invalidName = "invalid parser name do-not-print";
  writeFileSync(
    fixture.envFile,
    `CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nPARSER_NAME='${invalidName}'\n`,
    { mode: 0o600 },
  );

  const result = runDoctor(fixture, ["local-fast"]);

  assertFailure(result);
  assert.match(result.output, /PARSER_NAME must be a valid Docker container name/i);
  assert.doesNotMatch(result.output, new RegExp(invalidName, "u"));
});

test("doctor rejects a cloudflared name that Docker cannot accept", (t) => {
  const fixture = createFixture(t);
  writeFileSync(fixture.envFile, "CONVEX_TEAM=doctor-fixture-team\nCONVEX_PROJECT=doctor-fixture-project\nCLOUDFLARED_NAME=-invalid-do-not-print\n", { mode: 0o600 });
  const result = runDoctor(fixture, ["local-fast"]);
  assertFailure(result);
  assert.match(result.output, /CLOUDFLARED_NAME must be a valid Docker container name/i);
  assert.doesNotMatch(result.output, /invalid-do-not-print/u);
});

test("doctor rejects an invalid Docker image reference before treating it as buildable", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture, { rootEnvExtra: "IMAGE_NAME=invalid//image:latest\n" });
  const result = runDoctor(fixture, ["mcp-private-beta"], { FAKE_DOCKER_INVALID_REFERENCE: "1" });
  assertFailure(result);
  assert.match(result.output, /IMAGE_NAME must be a valid Docker image reference/i);
  assert.doesNotMatch(result.output, /invalid\/\/image/u);
});

test("doctor rejects a wildcard Docker image filter that startup cannot tag", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture, { rootEnvExtra: "IMAGE_NAME=review-invalid*\n" });
  const result = runDoctor(fixture, ["mcp-private-beta"]);
  assertFailure(result);
  assert.match(result.output, /IMAGE_NAME must be a valid Docker image reference/i);
  assert.doesNotMatch(result.output, /review-invalid/u);
});

test("doctor rejects a leading hexadecimal Docker character-class filter", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture, { rootEnvExtra: "IMAGE_NAME=[abc]/parser:latest\n" });
  const result = runDoctor(fixture, ["mcp-private-beta"]);
  assertFailure(result);
  assert.match(result.output, /IMAGE_NAME must be a valid Docker image reference/i);
  assert.doesNotMatch(result.output, /\[abc\]/u);
});

test("doctor rejects a colon-containing Docker character-class filter", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture, { rootEnvExtra: "IMAGE_NAME=[a:c]/parser:latest\n" });
  const result = runDoctor(fixture, ["mcp-private-beta"]);
  assertFailure(result);
  assert.match(result.output, /IMAGE_NAME must be a valid Docker image reference/i);
  assert.doesNotMatch(result.output, /\[a:c\]/u);
});

test("doctor accepts a Docker-compatible uppercase registry host", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture, { rootEnvExtra: "IMAGE_NAME=REGISTRY.example.com/team/parser:latest\n" });
  const result = runDoctor(fixture, ["mcp-private-beta"]);
  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /REGISTRY/u);
});

test("doctor accepts a bracketed IPv6 Docker registry authority", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture, { rootEnvExtra: "IMAGE_NAME=[2001:db8::1]:5000/team/parser:latest\n" });
  const result = runDoctor(fixture, ["mcp-private-beta"]);
  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /2001:db8/u);
});

for (const [label, authority] of [
  ["IPv4-mapped", "[::ffff:192.0.2.1]:5000"],
  ["zone-qualified", "[fe80::1%eth0]:5000"],
]) {
  test(`doctor rejects a Docker-incompatible ${label} IPv6 registry authority`, (t) => {
    const fixture = createFixture(t);
    configureValidMcpFixture(fixture, { rootEnvExtra: `IMAGE_NAME=${authority}/team/parser:latest\n` });
    const result = runDoctor(fixture, ["mcp-private-beta"]);
    assertFailure(result);
    assert.match(result.output, /IMAGE_NAME must be a valid Docker image reference/i);
    assert.doesNotMatch(result.output, new RegExp(escapeRegExp(authority), "u"));
  });
}

test("doctor accepts a long Docker reference with a valid tag", (t) => {
  const fixture = createFixture(t);
  const repository = `registry.example.com/${"segment/".repeat(20)}parser`;
  const tag = `release-${"x".repeat(100)}`;
  configureValidMcpFixture(fixture, { rootEnvExtra: `IMAGE_NAME=${repository}:${tag}\n` });
  const result = runDoctor(fixture, ["mcp-private-beta"]);
  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /registry\.example\.com|release-/u);
});

test("doctor local-fast accepts a missing image when a workspace parser is reusable", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_DOCKER_IMAGE: "missing",
    FAKE_DOCKER_RUNNING_NAMES: "cv-parser-service-dev",
    FAKE_DOCKER_WORKSPACE_ROOT: realpathSync(fixture.root),
    FAKE_DOCKER_PARSER_PORT: "8001",
    FAKE_LSOF_BUSY_PATTERN: "iTCP:8001",
  });

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /parser runtime image is not required.*tracked parser is reusable/i);
});

test("doctor local-fast requires the image when tracked env changes restart the parser", (t) => {
  const fixture = createFixture(t);
  const stateDirectory = join(fixture.root, "tmp", "dev-stack");
  mkdirSync(stateDirectory, { recursive: true });
  writeFileSync(
    join(stateDirectory, "pids.env"),
    `VITE_PID=${process.pid}
PARSER_STARTED=1
CONVEX_PID=${process.pid}
CONVEX_URL=http://127.0.0.1:3210
TUNNEL_STARTED=0
STACK_MODE=local-fast
ACTIVE_ORIGIN=http://127.0.0.1:8001
PARSER_RUNTIME_MODE=workspace
PARSER_RELOAD=1
PARSER_OCR=auto
CONVEX_MODE=local
UI_STARTED=1
ENV_HASH=stale-do-not-print
CONVEX_BINDING_HASH=stale-do-not-print
`,
  );

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_DOCKER_IMAGE: "missing",
    FAKE_DOCKER_RUNNING_NAMES: "cv-parser-service-dev",
    FAKE_DOCKER_WORKSPACE_ROOT: realpathSync(fixture.root),
    FAKE_DOCKER_PARSER_PORT: "8001",
    FAKE_NODE_CONVEX_READY: "1",
  });

  assertFailure(result);
  assert.match(result.output, /tracked local-fast stack will restart the parser/i);
  assert.match(result.output, /parser runtime image is missing/i);
  assert.doesNotMatch(result.output, /stale-do-not-print|8001|3210/u);
});

test("doctor suppresses tracked local Convex reuse details", (t) => {
  const fixture = createFixture(t);
  const stateDirectory = join(fixture.root, "tmp", "dev-stack");
  const hiddenConvexUrl = "http://127.0.0.1:3210";
  mkdirSync(stateDirectory, { recursive: true });
  writeFileSync(
    join(stateDirectory, "pids.env"),
    `VITE_PID=
PARSER_STARTED=0
CONVEX_PID=${process.pid}
CONVEX_URL=${hiddenConvexUrl}
TUNNEL_STARTED=0
STACK_MODE=local-fast
`,
  );

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_NODE_CONVEX_READY: "1",
  });

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /tracked local Convex backend is reusable/i);
  assert.doesNotMatch(result.output, new RegExp(escapeRegExp(hiddenConvexUrl), "u"));
  assert.doesNotMatch(result.output, /3210|unknown/u);
});

test("doctor rejects a tracked workspace parser that is not ready", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_DOCKER_RUNNING_NAMES: "cv-parser-service-dev",
    FAKE_DOCKER_WORKSPACE_ROOT: realpathSync(fixture.root),
    FAKE_DOCKER_PARSER_PORT: "8001",
    FAKE_CURL_PARSER_READY: "unavailable",
  });

  assertFailure(result);
  assert.match(result.output, /tracked parser is not ready/i);
});

test("doctor rejects a tracked workspace parser missing runtime dependencies", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_DOCKER_RUNNING_NAMES: "cv-parser-service-dev",
    FAKE_DOCKER_WORKSPACE_ROOT: realpathSync(fixture.root),
    FAKE_DOCKER_PARSER_PORT: "8001",
    FAKE_DOCKER_WORKSPACE_SURFACE: "missing",
  });

  assertFailure(result);
  assert.match(result.output, /tracked workspace parser is missing runtime dependencies/i);
});

test("doctor rejects a matching parser that does not publish the required host port", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_DOCKER_RUNNING_NAMES: "cv-parser-service-dev",
    FAKE_DOCKER_WORKSPACE_ROOT: realpathSync(fixture.root),
    FAKE_LSOF_BUSY_PATTERN: "iTCP:8001",
  });

  assertFailure(result);
  assert.match(result.output, /tracked parser does not publish the required host port/i);
  assert.doesNotMatch(result.output, /8001/u);
});

test("all startup reuse paths require a healthy parser that owns the host port", () => {
  const source = readFileSync(sourceRunScript, "utf8");
  const startParser = source.slice(
    source.indexOf("start_parser() {"),
    source.indexOf("remove_parser_container() {"),
  );
  const trackedStack = source.slice(
    source.indexOf("tracked_stack_is_live() {"),
    source.indexOf("handle_existing_stack_request() {"),
  );

  assert.match(startParser, /&& parser_container_owns_port/u);
  assert.match(startParser, /parser_container_matches_runtime "\$\{RUNTIME_MODE\}"/u);
  assert.match(
    trackedStack,
    /parser_container_matches_runtime "\$\{PARSER_RUNTIME_MODE:-image\}" \|\| return 1/u,
  );
  assert.match(trackedStack, /parser_container_owns_port \|\| return 1/u);
  assert.match(trackedStack, /127\.0\.0\.1:8001\/ready/u);
  assert.match(trackedStack, /workspace_runtime_surface_probe/u);
});

test("doctor accepts a tracked parser that startup will replace before rebinding", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_DOCKER_RUNNING_NAMES: "cv-parser-service-dev",
    FAKE_DOCKER_PARSER_PORT: "8001",
    FAKE_LSOF_BUSY_PATTERN: "iTCP:8001",
  });

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /tracked parser can be replaced by startup/i);
  assert.doesNotMatch(result.output, /8001/u);
});

test("doctor rejects a busy parser port not published by the tracked stale parser", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_DOCKER_RUNNING_NAMES: "cv-parser-service-dev",
    FAKE_LSOF_BUSY_PATTERN: "iTCP:8001",
  });

  assertFailure(result);
  assert.match(result.output, /parser port is already in use by an untracked process/i);
  assert.doesNotMatch(result.output, /8001/u);
});

test("doctor rejects an untracked listener on a resolved Convex port", (t) => {
  const fixture = createFixture(t);

  const result = runDoctor(fixture, ["local-fast"], {
    FAKE_LSOF_BUSY_PATTERN: "iTCP:3210",
  });

  assertFailure(result);
  assert.match(result.output, /resolved Convex cloud port is already in use by an untracked process/i);
  assert.doesNotMatch(result.output, /3210/u);
});

test("doctor warns but does not fail when npm is unavailable", (t) => {
  const fixture = createFixture(t);
  rmSync(join(fixture.binDirectory, "npm"));

  const result = runDoctor(fixture, ["local-fast"]);

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /WARN - npm command is missing; dependency installation commands will be unavailable/i);
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

test("doctor mcp-private-beta sanitizes startup environment read failures", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture);
  mkdirSync(join(fixture.root, ".env"));

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assertFailure(result);
  assert.match(result.output, /startup environment file could not be read/i);
  assert.doesNotMatch(result.output, new RegExp(escapeRegExp(fixture.root), "u"));
  assert.doesNotMatch(result.output, /EISDIR|readFileSync|node:fs|at Object/u);
});

test("doctor mcp-private-beta sanitizes root dotenv metadata races", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture);
  const shimPath = join(fixture.root, "stat-failure-shim.cjs");
  writeFileSync(
    shimPath,
    `const fs = require("node:fs");
const originalStatSync = fs.statSync;
fs.statSync = (path, ...args) => {
  if (String(path).endsWith("/.env.local")) {
    const error = new Error("metadata-race-do-not-print");
    error.code = "EACCES";
    throw error;
  }
  return originalStatSync(path, ...args);
};
`,
  );

  const result = runDoctor(fixture, ["mcp-private-beta"], {
    NODE_OPTIONS: `--require=${shimPath}`,
  });

  assertFailure(result);
  assert.match(result.output, /root \.env\.local could not be inspected/i);
  assert.doesNotMatch(result.output, /metadata-race-do-not-print|stat-failure-shim|EACCES|at Object/u);
  assert.doesNotMatch(result.output, new RegExp(escapeRegExp(fixture.root), "u"));
});

test("doctor rejects a symlinked root MCP environment like startup", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture);
  const target = join(fixture.root, "root-env-target-do-not-print");
  renameSync(fixture.envFile, target);
  symlinkSync(target, fixture.envFile);

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assertFailure(result);
  assert.match(result.output, /root \.env\.local must have mode 600/i);
  assert.doesNotMatch(result.output, /root-env-target-do-not-print/u);
});

test("doctor rejects symlinked MCP credentials like startup", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture);
  const credentials = join(
    fixture.root,
    "home",
    ".cloudflared",
    "935a2064-9473-41bc-bd73-174660892847.json",
  );
  const target = join(fixture.root, "credentials-target-do-not-print.json");
  renameSync(credentials, target);
  symlinkSync(target, credentials);

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assertFailure(result);
  assert.match(result.output, /named MCP tunnel credentials file must have mode 400 or 600/i);
  assert.doesNotMatch(result.output, /credentials-target-do-not-print/u);
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

test("doctor ignores an app-local Clerk key that MCP startup overrides", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture);
  writeFileSync(join(fixture.root, "my-app", ".env.local"), "VITE_CLERK_PUBLISHABLE_KEY=wrong-do-not-print\n");
  const result = runDoctor(fixture, ["mcp-private-beta"]);
  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /wrong-do-not-print/u);
});

test("doctor gives an exported Clerk key precedence over my-app .env.local like Vite", (t) => {
  const fixture = createFixture(t);
  const correctKey = `pk_test_${Buffer.from("doctor.clerk.accounts.dev$", "utf8").toString("base64")}`;
  configureValidMcpFixture(fixture, { baseEnv: "VITE_CLERK_PUBLISHABLE_KEY=wrong-exported-do-not-print\n" });
  writeFileSync(join(fixture.root, "my-app", ".env.local"), `VITE_CLERK_PUBLISHABLE_KEY=${correctKey}\n`);
  const result = runDoctor(fixture, ["mcp-private-beta"]);
  assertFailure(result);
  assert.match(result.output, /configured Clerk publishable key does not match/i);
  assert.doesNotMatch(result.output, /wrong-exported-do-not-print/u);
  assert.doesNotMatch(result.output, new RegExp(escapeRegExp(correctKey), "u"));
});

test("doctor ignores an app-local Clerk key when the exported key is correct", (t) => {
  const fixture = createFixture(t);
  const correctKey = `pk_test_${Buffer.from("doctor.clerk.accounts.dev$", "utf8").toString("base64")}`;
  configureValidMcpFixture(fixture, { baseEnv: `VITE_CLERK_PUBLISHABLE_KEY=${correctKey}\n` });
  writeFileSync(join(fixture.root, "my-app", ".env.local"), "VITE_CLERK_PUBLISHABLE_KEY=wrong-app-local-do-not-print\n");
  const result = runDoctor(fixture, ["mcp-private-beta"]);
  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /wrong-app-local-do-not-print/u);
  assert.doesNotMatch(result.output, new RegExp(escapeRegExp(correctKey), "u"));
});

test("doctor derives default MCP credentials from sourced HOME", (t) => {
  const fixture = createFixture(t);
  const alternateHome = join(fixture.root, "alternate-home-do-not-print");
  const alternateCloudflared = join(alternateHome, ".cloudflared");
  mkdirSync(alternateCloudflared, { recursive: true });
  writeFileSync(join(alternateCloudflared, "935a2064-9473-41bc-bd73-174660892847.json"), "{}\n", { mode: 0o600 });
  configureValidMcpFixture(fixture, { baseEnv: `HOME=${alternateHome}\n` });
  const result = runDoctor(fixture, ["mcp-private-beta"]);
  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /alternate-home-do-not-print/u);
});

test("doctor replays a self-referential HOME exactly once for MCP credentials", (t) => {
  const fixture = createFixture(t);
  const nestedCloudflared = join(fixture.root, "home", "nested-home-do-not-print", ".cloudflared");
  mkdirSync(nestedCloudflared, { recursive: true });
  writeFileSync(join(nestedCloudflared, "935a2064-9473-41bc-bd73-174660892847.json"), "{}\n", { mode: 0o600 });
  configureValidMcpFixture(fixture, { baseEnv: "HOME=$HOME/nested-home-do-not-print\n" });

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /nested-home-do-not-print/u);
});

test("doctor rejects commas in MCP tunnel credentials paths", (t) => {
  const fixture = createFixture(t);
  const credentials = join(fixture.root, "credentials,invalid-do-not-print.json");
  writeFileSync(credentials, "{}\n", { mode: 0o600 });
  configureValidMcpFixture(fixture, { baseEnv: `MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE=${credentials}\n` });
  const result = runDoctor(fixture, ["mcp-private-beta"]);
  assertFailure(result);
  assert.match(result.output, /credentials.*must not contain commas/i);
  assert.doesNotMatch(result.output, /credentials,invalid-do-not-print/u);
});

test("doctor fails an occupied custom MCP Vite port outside startup cleanup", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture, { rootEnvExtra: "MCP_PRIVATE_BETA_VITE_PORT=6208\n" });
  const result = runDoctor(fixture, ["mcp-private-beta"], { FAKE_LSOF_BUSY_PATTERN: "iTCP:6208" });
  assertFailure(result);
  assert.match(result.output, /MCP_PRIVATE_BETA_VITE_PORT is already in use by an untracked process/i);
  assert.doesNotMatch(result.output, /6208/u);
});

test("doctor accepts the parser port held by a reusable tracked image parser", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture);
  const imageId = "sha256:doctor-fixture-image";

  const result = runDoctor(fixture, ["mcp-private-beta"], {
    FAKE_DOCKER_RUNNING_NAMES: "cv-parser-service-dev",
    FAKE_DOCKER_PARSER_IMAGE_ID: imageId,
    FAKE_DOCKER_TARGET_IMAGE_ID: imageId,
    FAKE_DOCKER_PARSER_PORT: "8001",
    FAKE_LSOF_BUSY_PATTERN: "iTCP:8001",
  });

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /tracked parser is reusable/i);
  assert.doesNotMatch(result.output, /doctor-fixture-image|8001/u);
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

test("doctor mcp-private-beta checks buildx for a forced rebuild even when the image exists", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture, {
    rootEnvExtra: "FORCE_REBUILD=true\n",
  });

  const result = runDoctor(fixture, ["mcp-private-beta"], {
    FAKE_DOCKER_BUILDX: "unavailable",
  });

  assertFailure(result);
  assert.match(result.output, /forced parser rebuild requires Docker buildx/i);
  assert.doesNotMatch(result.output, /parser runtime image is available/i);
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

test("doctor clears unsupported MCP values when later startup assignments win", (t) => {
  const fixture = createFixture(t);
  const alternateCredentials = join(fixture.root, "later-credentials-do-not-print.json");
  writeFileSync(alternateCredentials, "{}\n", { mode: 0o600 });
  configureValidMcpFixture(fixture, {
    baseEnv: 'VITE_CLERK_PUBLISHABLE_KEY="$HOME/lower-key"\nMCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE="$HOME/lower-credentials"\n',
    rootEnvExtra: "VITE_CLERK_PUBLISHABLE_KEY=\n",
    appEnv: `MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE=${alternateCredentials}\n`,
  });

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /lower-(key|credentials)|later-credentials-do-not-print/u);
});

test("doctor keeps MCP command substitutions blocking after later overrides", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture, {
    baseEnv: "VITE_CLERK_PUBLISHABLE_KEY=$(false)\n",
    rootEnvExtra: "VITE_CLERK_PUBLISHABLE_KEY=\n",
  });

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assertFailure(result);
  assert.match(result.output, /VITE_CLERK_PUBLISHABLE_KEY must use a supported literal assignment/i);
});

test("doctor keeps MCP assignment commands blocking after later overrides", (t) => {
  const fixture = createFixture(t);
  const alternateCredentials = join(fixture.root, "later-mcp-credentials-do-not-print.json");
  writeFileSync(alternateCredentials, "{}\n", { mode: 0o600 });
  configureValidMcpFixture(fixture, {
    baseEnv: "MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE=bad command-does-not-exist\n",
    appEnv: `MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE=${alternateCredentials}\n`,
  });

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assertFailure(result);
  assert.match(result.output, /startup environment files must contain literal assignments only/i);
  assert.doesNotMatch(result.output, /command-does-not-exist|later-mcp-credentials/u);
});

test("doctor ignores shell-like text inside an MCP inline comment", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture);
  const configured = readFileSync(fixture.envFile, "utf8").replace(
    'MCP_OAUTH_PRODUCTION_RUNTIME="1" # enabled',
    'MCP_OAUTH_PRODUCTION_RUNTIME="1" # $(example)',
  );
  writeFileSync(fixture.envFile, configured, { mode: 0o600 });

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /example/u);
});

test("doctor preserves fatal duplicate MCP assignments within one file", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture, {
    rootEnvExtra:
      "MCP_OAUTH_PRODUCTION_RUNTIME=$(false)\nMCP_OAUTH_PRODUCTION_RUNTIME=1\n",
  });

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assertFailure(result);
  assert.match(result.output, /startup environment files must contain literal assignments only/i);
});

test("doctor matches mcp-check legacy alias scope", (t) => {
  const fixture = createFixture(t);
  configureValidMcpFixture(fixture, {
    baseEnv: "MCP_PRODUCTION_PRIVATE_BETA_CLIENT_IDS=legacy-base-value\n",
    appEnv: "MCP_PRODUCTION_PRIVATE_BETA_RESOURCES=legacy-app-value\n",
  });

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /legacy-(base|app)-value/u);
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

test("doctor resolves a defined parameter in the MCP credentials path", (t) => {
  const fixture = createFixture(t);
  const { hiddenValues } = configureValidMcpFixture(fixture, {
    rootEnvExtra:
      "MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE=$HOME/.cloudflared/935a2064-9473-41bc-bd73-174660892847.json\n",
  });

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /HOME|cloudflared/u);
  for (const value of Object.values(hiddenValues)) {
    assert.doesNotMatch(result.output, new RegExp(escapeRegExp(value)));
  }
});

test("doctor replays and concatenates MCP path assignments like startup", (t) => {
  const fixture = createFixture(t);
  const { hiddenValues } = configureValidMcpFixture(fixture, {
    rootEnvExtra:
      'doctor_credentials_dir="$HOME/.cloudflared"\nMCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE="$doctor_credentials_dir"/935a2064-9473-41bc-bd73-174660892847.json\n',
  });

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /doctor_credentials_dir|cloudflared/u);
  for (const value of Object.values(hiddenValues)) {
    assert.doesNotMatch(result.output, new RegExp(escapeRegExp(value)));
  }
});

test("doctor rejects a tunnel credentials path that is not a regular file", (t) => {
  const fixture = createFixture(t);
  const credentialsDirectory = join(fixture.root, "credentials-directory-do-not-print");
  mkdirSync(credentialsDirectory, { mode: 0o600 });
  configureValidMcpFixture(fixture, {
    baseEnv: `MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE=${credentialsDirectory}\n`,
  });

  const result = runDoctor(fixture, ["mcp-private-beta"]);

  assertFailure(result);
  assert.match(result.output, /named MCP tunnel credentials path must be a regular file/i);
  assert.doesNotMatch(result.output, /credentials-directory-do-not-print/u);
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
