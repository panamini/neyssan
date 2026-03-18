import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const tunnelFile = path.resolve(process.cwd(), ".parser-tunnel-url");
let parserUrl: string | null = null;

if (existsSync(tunnelFile)) {
  try {
    const raw = readFileSync(tunnelFile, "utf8").trim();
    if (raw) {
      const parsed = new URL(raw);
      parserUrl = parsed.toString();
    }
  } catch {
    parserUrl = null;
  }
}

const suite = parserUrl ? describe : describe.skip;

suite("structuredUpload dev tunnel", () => {
  it("healthcheck responds with 200", async () => {
    if (!parserUrl) throw new Error("parser URL unavailable");
    const health = new URL(parserUrl);
    health.pathname = "/healthz";
    health.search = "";
    const res = await fetch(health, { method: "GET" });
    expect(res.ok).toBe(true);
  });

  it(
    "structuredUpload action returns diagnostics",
    async () => {
      if (!parserUrl) throw new Error("parser URL unavailable");
      const payload = JSON.stringify({
        rawText: `Dev tunnel integration ${new Date().toISOString()}`,
        mode: "text",
      });

      const env = { ...process.env };
      delete env.STRUCTURED_UPLOAD_SKIP_HEALTHCHECK;

      const output = execFileSync(
        "npx",
        [
          "convex",
          "run",
          "actions/structuredUpload:structuredUpload",
          payload,
        ],
        {
          cwd: process.cwd(),
          env,
        },
      ).toString();

      const jsonMatch = output.match(/\{[\s\S]*$/);
      if (!jsonMatch) {
        throw new Error(`structuredUpload output missing JSON payload\n${output}`);
      }
      const parsed = JSON.parse(jsonMatch[0]);

      expect(parsed).toBeTruthy();
      expect(parsed.normalized).toBeTruthy();
      expect(parsed.diagnostics).toBeTruthy();
      expect(parsed.diagnostics).toHaveProperty("hybrid_used");
    },
    30000,
  );
});
