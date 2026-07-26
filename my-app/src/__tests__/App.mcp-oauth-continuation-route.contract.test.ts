import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testFilePath = fileURLToPath(import.meta.url);
const appSource = readFileSync(
  resolve(dirname(testFilePath), "../App.tsx"),
  "utf8",
);

describe("App MCP OAuth continuation route contract", () => {
  it("mounts a concrete continuation route before the dashboard catch-all", () => {
    const continuationRoute =
      '<Route path="/oauth/continue" element={<McpOAuthContinuationPage />} />';
    const catchAllRoute = '<Route path="*" element={<Navigate to="/dashboard" replace />} />';

    expect(appSource).toContain(
      'import { McpOAuthContinuationPage } from "./pages/McpOAuthContinuationPage";',
    );
    expect(appSource).toContain(continuationRoute);
    expect(appSource.indexOf(continuationRoute)).toBeLessThan(
      appSource.indexOf(catchAllRoute),
    );
  });
});
