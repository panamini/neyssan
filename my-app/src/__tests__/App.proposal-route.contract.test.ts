import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testFilePath = fileURLToPath(import.meta.url);
const appSource = readFileSync(
  resolve(dirname(testFilePath), "../App.tsx"),
  "utf8",
);

describe("App proposal route contract", () => {
  it("routes /proposal to ProposalForge and keeps /proposal-next as a redirect", () => {
    expect(appSource).toContain('import { ProposalForge } from "./pages/ProposalForge";');
    expect(appSource).toContain('<Route path="/proposal" element={<ProposalForge />} />');
    expect(appSource).toContain(
      '<Route path="/proposal-next" element={<Navigate to="/proposal" replace />} />',
    );
    expect(appSource).not.toContain(
      '<Route path="/proposal" element={<ProposalForgeNext />} />',
    );
  });
});
