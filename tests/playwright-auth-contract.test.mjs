import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function readRepositoryFile(relativePath) {
  return readFileSync(join(repositoryRoot, relativePath), "utf8");
}

test("routes only the full Playwright suite through authenticated Clerk state", () => {
  const workflow = readRepositoryFile(".github/workflows/playwright.yml");
  const config = readRepositoryFile("playwright.config.ts");

  assert.match(workflow, /SMOKE_PROJECT="chromium"/);
  assert.match(workflow, /FULL_PROJECT="authenticated-chromium"/);
  assert.match(workflow, /--project="\$PROJECT"/);
  assert.match(config, /name:\s*['"]clerk setup['"]/);
  assert.match(config, /name:\s*['"]authenticated-chromium['"]/);
  assert.match(
    config,
    /name:\s*['"]clerk setup['"][\s\S]*?use:\s*desktopChromeUse/,
  );
  assert.match(config, /dependencies:\s*\[['"]clerk setup['"]\]/);
  assert.match(config, /storageState:\s*CLERK_AUTH_STATE_PATH/);
});

test("does not retain authenticated Playwright traces in CI artifacts", () => {
  const config = readRepositoryFile("playwright.config.ts");
  const setupTraceOff = /name:\s*['"]clerk setup['"][\s\S]*?trace:\s*['"]off['"]/;
  const authenticatedTraceOff =
    /name:\s*['"]authenticated-chromium['"][\s\S]*?trace:\s*['"]off['"]/;

  assert.match(config, setupTraceOff);
  assert.match(config, authenticatedTraceOff);
});

test("passes authenticated state to both parity harness surfaces", () => {
  for (const relativePath of [
    "my-app/scripts/run-resume-font-parity-harness.ts",
    "my-app/scripts/run-proposal-styled-parity-harness.ts",
  ]) {
    const script = readRepositoryFile(relativePath);
    assert.match(script, /PLAYWRIGHT_AUTH_STATE_PATH/);
    assert.ok(
      (script.match(/storageState:/g) ?? []).length >= 2,
      `${relativePath} should authenticate both the live and raster contexts`,
    );
  }
});

test("fails closed unless full-suite Clerk credentials are synthetic development values", () => {
  const workflow = readRepositoryFile(".github/workflows/playwright.yml");
  const setupPath = join(repositoryRoot, "e2e/clerk-auth.setup.ts");

  assert.equal(existsSync(setupPath), true);
  const setup = readFileSync(setupPath, "utf8");
  assert.match(workflow, /CLERK_SECRET_KEY:\s*\$\{\{ secrets\.CLERK_SECRET_KEY \}\}/);
  assert.match(
    workflow,
    /E2E_CLERK_USER_EMAIL:\s*\$\{\{ secrets\.E2E_CLERK_USER_EMAIL \}\}/,
  );
  assert.match(setup, /startsWith\(['"]pk_test_['"]\)/);
  assert.match(setup, /startsWith\(['"]sk_test_['"]\)/);
  assert.match(setup, /includes\(['"]\+clerk_test['"]\)/);
  assert.match(setup, /await clerkSetup\(\)/);
  assert.match(setup, /await clerk\.signIn\(/);
  assert.doesNotMatch(setup, /console\.(?:log|info|warn|error)/);
});

test("keeps Clerk session state out of Git and removes it before CI artifacts", () => {
  const gitignore = readRepositoryFile(".gitignore");
  const workflow = readRepositoryFile(".github/workflows/playwright.yml");

  assert.match(gitignore, /^\/playwright\/\.clerk\/$/m);
  assert.match(workflow, /rm -f playwright\/\.clerk\/user\.json/);
});

test("retains a genuinely signed-out proposal gate inside the authenticated suite", () => {
  const proposalRoundtrip = readRepositoryFile(
    "e2e/proposal-workspace-roundtrip.spec.ts",
  );

  assert.match(
    proposalRoundtrip,
    /test\.describe\(['"]Proposal workspace signed-out gate['"]/,
  );
  assert.match(
    proposalRoundtrip,
    /test\.use\(\{\s*storageState:\s*\{\s*cookies:\s*\[\],\s*origins:\s*\[\]/s,
  );
});

test("pins the Clerk Playwright helper in the root test toolchain", () => {
  const packageJson = JSON.parse(readRepositoryFile("package.json"));
  const packageLock = JSON.parse(readRepositoryFile("package-lock.json"));

  assert.equal(packageJson.devDependencies["@clerk/testing"], "^2.2.16");
  assert.equal(
    packageLock.packages[""].devDependencies["@clerk/testing"],
    "^2.2.16",
  );
  assert.ok(packageLock.packages["node_modules/@clerk/testing"]);
});
