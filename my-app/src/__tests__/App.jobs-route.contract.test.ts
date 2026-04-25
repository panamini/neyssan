import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testFilePath = fileURLToPath(import.meta.url);
const appSource = readFileSync(
  resolve(dirname(testFilePath), "../App.tsx"),
  "utf8",
);

describe("App jobs route contract", () => {
  it("mounts JobsPage on both /jobs and /jobs/:jobId", () => {
    expect(appSource).toContain('import { JobsPage } from "./pages/JobsPage";');
    expect(appSource).toContain('<Route path="/jobs" element={<JobsPage />} />');
    expect(appSource).toContain('<Route path="/jobs/:jobId" element={<JobsPage />} />');
  });
});
