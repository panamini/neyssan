import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "src/pages/ProposalForge.tsx"),
  "utf8",
);

describe("ProposalForge saved heading input contract", () => {
  it("does not restore the saved row whenever a local heading edit changes the compose token", () => {
    const restoreTrace = source.indexOf('step: "saved-restore-effect"');
    const restoreStart = source.lastIndexOf(
      "React.useEffect(() => {",
      restoreTrace,
    );
    const restoreEffect = source.slice(
      restoreStart,
      source.indexOf('if (requestedView !== "compose"', restoreStart),
    );

    expect(restoreEffect).toContain(
      "composeToken: latestComposeAutosaveTokenRef.current",
    );
    expect(restoreEffect).not.toContain("composeAutosaveSnapshot?.token");
    expect(restoreEffect).toContain(
      "lastOpenedSavedProposalRestoreKeyRef.current ===",
    );
    expect(restoreEffect).toContain("openedSavedProposalRestoreKey");
    expect(restoreEffect).toContain(
      "SAVED_PROPOSAL_RESTORE_PENDING_TOKEN",
    );
    expect(restoreEffect).toContain(
      "pendingQueuedComposeSnapshotRef.current = null",
    );
    expect(restoreEffect).toContain(
      "composeAutosavePrimedRef.current = false",
    );
  });
});
