import {
  existsSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import * as path from "node:path";
import { homedir } from "node:os";

import * as dotenv from "dotenv";

export type LocalBackendConfig = {
  name: string;
  url: string;
  adminKey: string;
};

export function loadEnvFiles(workdir: string): void {
  const preexistingEnvKeys = new Set(
    Object.entries(process.env)
      .filter(([, value]) => value != null && value !== "")
      .map(([key]) => key),
  );
  const envFiles = [
    path.resolve(workdir, ".env"),
    path.resolve(workdir, ".env.local"),
  ];

  for (const filePath of envFiles) {
    if (!existsSync(filePath)) continue;

    const parsed = dotenv.parse(readFileSync(filePath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (preexistingEnvKeys.has(key)) continue;
      process.env[key] = value;
    }
  }
}

export function readLocalBackendConfig(): LocalBackendConfig | null {
  const backendStateRoot = path.resolve(
    homedir(),
    ".convex",
    "convex-backend-state",
  );
  if (!existsSync(backendStateRoot)) {
    return null;
  }

  for (const entry of readdirSync(backendStateRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const configPath = path.join(backendStateRoot, entry.name, "config.json");
    if (!existsSync(configPath)) continue;

    try {
      const parsed = JSON.parse(readFileSync(configPath, "utf8")) as {
        adminKey?: unknown;
        ports?: { cloud?: unknown };
      };
      const port = Number(parsed.ports?.cloud);
      const adminKey =
        typeof parsed.adminKey === "string" ? parsed.adminKey.trim() : "";
      if (!Number.isFinite(port) || port <= 0 || !adminKey) {
        continue;
      }

      return {
        name: entry.name,
        url: `http://127.0.0.1:${port}`,
        adminKey,
      };
    } catch {
      continue;
    }
  }

  return null;
}

export function isLikelyJwt(rawValue: string | null | undefined): rawValue is string {
  if (!rawValue) return false;
  return rawValue.trim().split(".").length === 3;
}

export function buildStructuredMatchIdentity(): {
  email: string;
  subject: string;
  tokenIdentifier: string;
} {
  return {
    email: "internal@example.com",
    subject: "user_31W4qTfkBAzLnf5LDarxyf4ARDh",
    tokenIdentifier: "user_31W4qTfkBAzLnf5LDarxyf4ARDh",
  };
}
