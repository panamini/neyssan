import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function readRepositoryFile(relativePath) {
  return readFileSync(join(repositoryRoot, relativePath), "utf8");
}

test("ProposalForge binds compose writes to its mounted account scope", () => {
  const source = readRepositoryFile("my-app/src/pages/ProposalForge.tsx");

  assert.match(source, /proposalAccountOwnerRef/);
  assert.match(source, /readAccountLocalDataOwner\(\)/);
  assert.match(source, /mountedRef\.current/);
  assert.match(source, /nextSnapshot\.accountOwner/);
});

test("ProposalInputForm cancels and ignores generation after unmount", () => {
  const source = readRepositoryFile(
    "my-app/src/components/ProposalInputForm.tsx",
  );

  assert.match(source, /requestProposalGenerationCancel\(\{ clientRunId \}\)/);
  assert.match(source, /mountedRef\.current/);
  assert.match(source, /onSubmitAccepted|onSubmitResult|onSubmit\(/);
});

test("authenticated print routes prepare the account-local scope", () => {
  const source = readRepositoryFile("my-app/src/App.tsx");

  assert.match(
    source,
    /function PrintRouteAccountCleanup[\s\S]*prepareAccountLocalDataScope\(userId\)/,
  );
});

test("unmarked private storage is not claimed by the first authenticated user", () => {
  const source = readRepositoryFile(
    "my-app/src/lib/account-local-data.ts",
  );

  assert.match(source, /hasAccountLocalData/);
  assert.match(
    source,
    /previousOwner === null &&\s+previousSessionOwner === null[\s\S]*unownedAccountLocalData[\s\S]*purgeStorage\("localStorage"\)[\s\S]*purgeStorage\("sessionStorage"\)/,
  );
});
