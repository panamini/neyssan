import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const LOCAL_MCP_DIR = resolve(TEST_DIR, "..");
const PACKAGE_JSON_PATH = resolve(LOCAL_MCP_DIR, "../../../package.json");

const APPROVED_PACKAGE_ONLY_DEPENDENCIES = ["@modelcontextprotocol/sdk"] as const;
const LOCAL_MCP_SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

const FORBIDDEN_SDK_IMPORT_PATTERNS = [
  /(?:from\s+["']|import\s*\(\s*["']|import\s+["'])(?:@modelcontextprotocol\/(?:sdk|ext-apps)|openai)(?:[\/"'])/u,
  /(?:from\s+["']|import\s*\(\s*["']|import\s+["'])@openai(?:[\/"'])/u,
] as const;

const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bMcpServer\b/u,
  /\bStreamableHTTPServerTransport\b/u,
  /\bSSEServerTransport\b/u,
  /\bregisterTool\b/u,
  /\bregisterResource\b/u,
  /\bserver\.connect\b/u,
  /\bcreateServer\s*\(/u,
  /\.listen\s*\(/u,
  /\bnew\s+(Request|Response|WebSocket|EventSource)\b/u,
] as const;

type PackageJson = Readonly<{
  dependencies?: Readonly<Record<string, string>>;
  devDependencies?: Readonly<Record<string, string>>;
}>;

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8")) as PackageJson;
}

function localMcpSourceFiles(dir = LOCAL_MCP_DIR): readonly string[] {
  return readdirSync(dir)
    .flatMap((entry) => {
      const path = resolve(dir, entry);
      const stats = statSync(path);
      if (stats.isDirectory()) {
        return entry === "__tests__" ? [] : localMcpSourceFiles(path);
      }
      return LOCAL_MCP_SOURCE_EXTENSIONS.has(extname(path)) ? [path] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

function localMcpSourceEntries(): readonly { path: string; source: string }[] {
  return localMcpSourceFiles().map((path) => ({
    path: relative(LOCAL_MCP_DIR, path),
    source: readFileSync(path, "utf8"),
  }));
}

describe("local MCP dependency import boundary", () => {
  it("keeps the approved MCP package package-only and leaves OpenAI imports out of local MCP", () => {
    const packageJson = readPackageJson();
    const dependencies = packageJson.dependencies ?? {};
    const devDependencies = packageJson.devDependencies ?? {};

    for (const dependency of APPROVED_PACKAGE_ONLY_DEPENDENCIES) {
      expect(dependencies).toHaveProperty(dependency);
      expect(devDependencies).not.toHaveProperty(dependency);
    }

    expect(dependencies).not.toHaveProperty("@modelcontextprotocol/ext-apps");
    expect(devDependencies).not.toHaveProperty("@modelcontextprotocol/ext-apps");
  });

  it("does not import MCP/App SDK or OpenAI packages from local MCP modules", () => {
    const entries = localMcpSourceEntries();
    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      for (const pattern of FORBIDDEN_SDK_IMPORT_PATTERNS) {
        expect(entry.source, `${entry.path} must keep SDK packages package-only`).not.toMatch(pattern);
      }
    }
  });

  it("does not create hidden server, transport, tools/list, or tools/call runtime markers", () => {
    const entries = localMcpSourceEntries();
    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
        expect(entry.source, `${entry.path} must not define runtime wiring`).not.toMatch(pattern);
      }
    }
  });
});
