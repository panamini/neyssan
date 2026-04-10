import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeParserResult } from "../convex/lib/parsing/canonicalize";

type FixtureSpec = {
  file: string;
  route: "/parse-cv" | "/mistral-ocr/parse" | "unavailable";
  unavailableReason?: string;
};

type PythonEnvelope = {
  ok?: boolean;
  status?: number;
  route?: string;
  payload?: any;
  stage?: string;
  error?: string;
  traceback?: string;
};

type HarnessMode = {
  mistralOnly: boolean;
  remoteProductPath: boolean;
};

type RemoteConfig = {
  parserOrigin: string | null;
  accessHeaders: Record<string, string> | null;
  sourceLabel: string | null;
};

type RemoteEnvelope = {
  ok: boolean;
  status?: number;
  route: string;
  parserOrigin?: string;
  payload?: any;
  error?: string;
  bodyText?: string;
};

const FIXTURES: FixtureSpec[] = [
  { file: "fixtures/cv_png.pdf", route: "/parse-cv" },
  { file: "fixtures/sample_textpdf_resume.pdf", route: "/parse-cv" },
  { file: "fixtures/cv (13).pdf", route: "/parse-cv" },
  { file: "fixtures/cv (13).png", route: "/mistral-ocr/parse" },
  { file: "fixtures/sample_text_resume.pdf", route: "/parse-cv" },
  { file: "fixtures/sample_scanned_resume.pdf", route: "/parse-cv" },
  {
    file: "fixtures/1dbd975457f48780.docx",
    route: "unavailable",
    unavailableReason: "local product parser path does not accept DOCX uploads",
  },
  { file: "fixtures/1dbd975457f48780.png", route: "/mistral-ocr/parse" },
  { file: "fixtures/cv (14).pdf", route: "/parse-cv" },
  { file: "fixtures/cv (308).pdf", route: "/parse-cv" },
];

const PYTHON_SNIPPET = String.raw`
import json
import mimetypes
import logging
import sys
import traceback
import types
from pathlib import Path

fixture = Path(sys.argv[1])
route = sys.argv[2]

if "mistralai" not in sys.modules:
    mistralai_module = types.ModuleType("mistralai")
    models_module = types.ModuleType("mistralai.models")
    sdk_module = types.ModuleType("mistralai.sdk")

    class DummyMistral:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

    sdk_module.Mistral = DummyMistral
    mistralai_module.models = models_module
    mistralai_module.sdk = sdk_module
    sys.modules["mistralai"] = mistralai_module
    sys.modules["mistralai.models"] = models_module
    sys.modules["mistralai.sdk"] = sdk_module

try:
    from fastapi.testclient import TestClient
    from cv_parser_service.main import app
    logging.getLogger().setLevel(logging.ERROR)
except Exception as exc:
    print(json.dumps({
        "ok": False,
        "stage": "python_boot",
        "error": f"{type(exc).__name__}: {exc}",
    }))
    raise SystemExit(0)

try:
    client = TestClient(app)
    mime_type = mimetypes.guess_type(fixture.name)[0] or "application/octet-stream"
    with fixture.open("rb") as fh:
        files = {"file": (fixture.name, fh.read(), mime_type)}
    response = client.post(route, files=files)
    try:
        payload = response.json()
    except Exception:
        payload = {"non_json_body": response.text}
    print(json.dumps({
        "ok": bool(response.status_code < 400),
        "status": int(response.status_code),
        "route": route,
        "payload": payload,
    }))
except Exception as exc:
    print(json.dumps({
        "ok": False,
        "stage": "request",
        "error": f"{type(exc).__name__}: {exc}",
        "traceback": traceback.format_exc(),
    }))
`;

function coerceString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseSimpleEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  const text = readFileSync(filePath, "utf-8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, "") || null;
  }
}

function resolveRemoteConfig(repoRoot: string): RemoteConfig {
  const envLayers = [
    process.env,
    parseSimpleEnvFile(path.join(repoRoot, "my-app/.env.local")),
    parseSimpleEnvFile(path.join(repoRoot, "my-app/.env")),
    parseSimpleEnvFile(path.join(repoRoot, ".env.local")),
    parseSimpleEnvFile(path.join(repoRoot, ".env")),
  ];

  const originKeys = [
    "CONVEX_PARSER_URL",
    "PARSER_ORIGIN",
    "VITE_CONVEX_PARSER_URL",
    "VITE_PARSER_URL",
  ] as const;

  let parserOrigin: string | null = null;
  let sourceLabel: string | null = null;
  for (const layer of envLayers) {
    for (const key of originKeys) {
      const candidate = normalizeOrigin(String(layer[key] ?? ""));
      if (candidate) {
        parserOrigin = candidate;
        sourceLabel = key;
        break;
      }
    }
    if (parserOrigin) break;
  }

  const cfId = envLayers.map((layer) => coerceString(layer.CF_ACCESS_CLIENT_ID)).find(Boolean) || "";
  const cfSecret = envLayers.map((layer) => coerceString(layer.CF_ACCESS_CLIENT_SECRET)).find(Boolean) || "";
  const accessHeaders = cfId && cfSecret
    ? {
        "CF-Access-Client-Id": cfId,
        "CF-Access-Client-Secret": cfSecret,
      }
    : null;

  return { parserOrigin, accessHeaders, sourceLabel };
}

function getFileType(file: string): string {
  const ext = path.extname(file).toLowerCase();
  return ext ? ext.slice(1) : "unknown";
}

function supportsMistralRoute(file: string): boolean {
  const ext = path.extname(file).toLowerCase();
  return ext === ".pdf" || ext === ".png" || ext === ".jpg" || ext === ".jpeg";
}

function resolveRequestedRoute(spec: FixtureSpec, mistralOnly: boolean): FixtureSpec["route"] {
  if (spec.route === "unavailable") return "unavailable";
  if (mistralOnly && supportsMistralRoute(spec.file)) return "/mistral-ocr/parse";
  return spec.route;
}

function getExperienceRawSections(payload: any): string[] {
  const rawSections = Array.isArray(payload?.result?.rawSections)
    ? payload.result.rawSections
    : Array.isArray(payload?.rawSections)
      ? payload.rawSections
      : Array.isArray(payload?.normalized?.rawSections)
        ? payload.normalized.rawSections
        : [];
  return rawSections
    .filter((section: any) => {
      const label = coerceString(section?.label ?? section?.title ?? section?.fieldKey).toUpperCase();
      return label.includes("EXPERIENCE") || label.includes("EMPLOYMENT");
    })
    .map((section: any) => coerceString(section?.content ?? section?.text))
    .filter(Boolean);
}

function summarizeEntry(entry: any): string {
  const company = coerceString(entry?.company) || "-";
  const position = coerceString(entry?.position) || "-";
  const location = coerceString(entry?.location);
  const startDate = coerceString(entry?.startDate);
  const endDate = entry?.isCurrent ? "current" : coerceString(entry?.endDate);
  const datePart = startDate || endDate ? `${startDate || "?"} -> ${endDate || "?"}` : "";
  return [company, position, location ? `@ ${location}` : "", datePart]
    .filter(Boolean)
    .join(" | ");
}

function summarizeEntries(entries: any[]): string {
  if (!Array.isArray(entries) || entries.length === 0) return "none";
  return entries.slice(0, 2).map(summarizeEntry).join(" || ");
}

function summarizeUnavailableReason(result: PythonEnvelope): string {
  const payload = result.payload;
  const detail = coerceString(payload?.detail ?? payload?.error ?? payload?.payload?.detail);
  if (detail) return detail;
  if (coerceString(result.error)) return coerceString(result.error);
  if (coerceString(result.stage)) return coerceString(result.stage);
  return "unknown error";
}

function previewRawSection(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 180) || "none";
}

function didOcrPathRun(payload: any): boolean {
  const diagnostics = payload?.diagnostics ?? payload?.result?.diagnostics ?? {};
  const route = coerceString(diagnostics?.route);
  const routeReason = coerceString(diagnostics?.route_reason);
  const requestPath = coerceString(diagnostics?.ocr_request_path);
  const fileUploadMode = coerceString(diagnostics?.file_upload_mode);
  if (requestPath) return true;
  if (route === "external_ocr") return true;
  if (routeReason === "pdf_image_only") return true;
  if (fileUploadMode === "ocr" && route !== "pdf_has_text" && route !== "non_pdf_text") return true;
  return false;
}

function didMistralActuallySucceed(payload: any, requestedRoute: string): boolean {
  if (requestedRoute !== "/mistral-ocr/parse") return false;
  const diagnostics = payload?.diagnostics ?? payload?.result?.diagnostics ?? {};
  const runtime = coerceString(diagnostics?.mistral_runtime);
  const fallbackFlag = Boolean(diagnostics?.mistral_fallback);
  const model = coerceString(diagnostics?.mistral_model);
  if (runtime === "mistral") return true;
  if (fallbackFlag) return false;
  if (model === "mistral-fallback-dev") return false;
  return Boolean(payload?.ok);
}

function didNativeTextPathRun(payload: any, requestedRoute: string): boolean {
  const diagnostics = payload?.diagnostics ?? payload?.result?.diagnostics ?? {};
  const route = coerceString(diagnostics?.route);
  const runtime = coerceString(diagnostics?.mistral_runtime);
  const fallbackFlag = Boolean(diagnostics?.mistral_fallback);
  const model = coerceString(diagnostics?.mistral_model);
  if (requestedRoute === "/parse-cv") {
    return route === "pdf_has_text" || route === "non_pdf_text";
  }
  return runtime === "local_fallback" || fallbackFlag || model === "mistral-fallback-dev";
}

async function runRemoteFixture(
  absoluteFixturePath: string,
  requestedRoute: string,
  remoteConfig: RemoteConfig,
): Promise<RemoteEnvelope> {
  if (!remoteConfig.parserOrigin) {
    return {
      ok: false,
      route: requestedRoute,
      error: "remote parser origin unavailable",
    };
  }
  const endpoint = new URL(requestedRoute, remoteConfig.parserOrigin).toString();
  const mimeType = getFileType(absoluteFixturePath) === "pdf"
    ? "application/pdf"
    : getFileType(absoluteFixturePath) === "png"
      ? "image/png"
      : getFileType(absoluteFixturePath) === "jpg" || getFileType(absoluteFixturePath) === "jpeg"
        ? "image/jpeg"
        : "application/octet-stream";
  const bodyFile = path.join(path.dirname(absoluteFixturePath), `.remote-harness-${path.basename(absoluteFixturePath)}.body`);
  const curlArgs = [
    "--http1.1",
    "-sS",
    "-o",
    bodyFile,
    "-w",
    "%{http_code}",
    "-H",
    "Accept: application/json",
  ];
  if (remoteConfig.accessHeaders) {
    for (const [key, value] of Object.entries(remoteConfig.accessHeaders)) {
      curlArgs.push("-H", `${key}: ${value}`);
    }
  }
  curlArgs.push(
    "-F",
    `file=@${absoluteFixturePath};type=${mimeType}`,
    "-F",
    "mode=auto",
    endpoint,
  );

  const result = spawnSync("curl", curlArgs, {
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
  });

  const bodyText = existsSync(bodyFile) ? readFileSync(bodyFile, "utf-8") : "";
  try {
    if (existsSync(bodyFile)) {
      unlinkSync(bodyFile);
    }
  } catch {}

  if (result.status !== 0) {
    return {
      ok: false,
      route: requestedRoute,
      parserOrigin: remoteConfig.parserOrigin,
      error: result.stderr?.trim() || result.stdout?.trim() || `curl exited with code ${result.status}`,
      bodyText,
    };
  }

  const statusCode = Number((result.stdout || "").trim()) || 0;
  let payload: any = null;
  try {
    payload = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    payload = bodyText ? { non_json_body: bodyText } : null;
  }

  return {
    ok: statusCode >= 200 && statusCode < 400,
    status: statusCode,
    route: requestedRoute,
    parserOrigin: remoteConfig.parserOrigin,
    payload,
    error:
      statusCode >= 200 && statusCode < 400
        ? undefined
        : coerceString(payload?.detail ?? payload?.error ?? payload?.message) || bodyText.slice(0, 200) || undefined,
    bodyText,
  };
}

function runPythonFixture(repoRoot: string, absoluteFixturePath: string, route: string): PythonEnvelope {
  const pythonBin = process.env.PYTHON_BIN || "python3";
  const result = spawnSync(
    pythonBin,
    ["-c", PYTHON_SNIPPET, absoluteFixturePath, route],
    {
      cwd: repoRoot,
      encoding: "utf-8",
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  const stdout = result.stdout?.trim();
  if (!stdout) {
    return {
      ok: false,
      stage: "python_exec",
      error: result.stderr?.trim() || `python exited with code ${result.status ?? -1}`,
    };
  }

  try {
    const jsonLine = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .reverse()
      .find((line) => line.startsWith("{") && line.endsWith("}"));
    if (!jsonLine) {
      throw new Error("no json line in python output");
    }
    return JSON.parse(jsonLine) as PythonEnvelope;
  } catch {
    return {
      ok: false,
      stage: "python_parse",
      error: stdout,
      traceback: result.stderr?.trim() || undefined,
    };
  }
}

async function printFixtureReport(spec: FixtureSpec, repoRoot: string, mode: HarnessMode, remoteConfig: RemoteConfig): Promise<void> {
  const absoluteFixturePath = path.join(repoRoot, spec.file);
  const requestedRoute = resolveRequestedRoute(spec, mode.mistralOnly);
  const fileType = getFileType(spec.file);
  const mistralAttempted = requestedRoute === "/mistral-ocr/parse";
  const remoteModeAttempted = mode.remoteProductPath;
  console.log(`\n=== ${spec.file} ===`);

  if (!existsSync(absoluteFixturePath)) {
    console.log(`source file: ${spec.file}`);
    console.log(`file type: ${fileType}`);
    console.log(`attempted route: ${requestedRoute}`);
    console.log(`remote mode attempted: ${remoteModeAttempted ? "yes" : "no"}`);
    console.log(`Convex/product path used: ${mode.remoteProductPath ? "yes" : "no"}`);
    console.log(`parser origin used: ${mode.remoteProductPath ? (remoteConfig.parserOrigin ?? "unavailable") : "local-testclient"}`);
    console.log(`mistral attempted: ${mistralAttempted ? "yes" : "no"}`);
    console.log("mistral succeeded: no");
    console.log("native text path used: no");
    console.log("ocr path ran: unavailable");
    console.log("ocr/raw extraction layer: unavailable (fixture missing locally)");
    console.log("python normalized layer: unavailable (fixture missing locally)");
    console.log("app canonicalization layer: unavailable (fixture missing locally)");
    return;
  }

  if (spec.route === "unavailable") {
    console.log(`source file: ${spec.file}`);
    console.log(`file type: ${fileType}`);
    console.log(`attempted route: ${requestedRoute}`);
    console.log(`remote mode attempted: ${remoteModeAttempted ? "yes" : "no"}`);
    console.log(`Convex/product path used: no`);
    console.log(`parser origin used: ${mode.remoteProductPath ? (remoteConfig.parserOrigin ?? "unavailable") : "local-testclient"}`);
    console.log(`mistral attempted: ${mistralAttempted ? "yes" : "no"}`);
    console.log("mistral succeeded: no");
    console.log("native text path used: no");
    console.log("ocr path ran: unavailable");
    console.log(`ocr/raw extraction layer: unavailable (${spec.unavailableReason})`);
    console.log(`python normalized layer: unavailable (${spec.unavailableReason})`);
    console.log(`app canonicalization layer: unavailable (${spec.unavailableReason})`);
    return;
  }

  const executionResult = mode.remoteProductPath
    ? await runRemoteFixture(absoluteFixturePath, requestedRoute, remoteConfig)
    : runPythonFixture(repoRoot, absoluteFixturePath, requestedRoute);
  if (!executionResult.ok) {
    const reason = mode.remoteProductPath
      ? (executionResult.error || "unknown error")
      : summarizeUnavailableReason(executionResult as PythonEnvelope);
    console.log(`source file: ${spec.file}`);
    console.log(`file type: ${fileType}`);
    console.log(`attempted route: ${requestedRoute}`);
    console.log(`remote mode attempted: ${remoteModeAttempted ? "yes" : "no"}`);
    console.log(`Convex/product path used: ${mode.remoteProductPath ? "yes" : "no"}`);
    console.log(`parser origin used: ${mode.remoteProductPath ? (remoteConfig.parserOrigin ?? "unavailable") : "local-testclient"}`);
    console.log(`mistral attempted: ${mistralAttempted ? "yes" : "no"}`);
    console.log("mistral succeeded: no");
    console.log("native text path used: no");
    console.log("ocr path ran: unavailable");
    console.log(`ocr/raw extraction layer: unavailable (${reason})`);
    console.log(`python normalized layer: unavailable (${reason})`);
    console.log("app canonicalization layer: unavailable (parser payload unavailable)");
    return;
  }

  if (!executionResult.payload) {
    console.log(`source file: ${spec.file}`);
    console.log(`file type: ${fileType}`);
    console.log(`attempted route: ${requestedRoute}`);
    console.log(`remote mode attempted: ${remoteModeAttempted ? "yes" : "no"}`);
    console.log(`Convex/product path used: ${mode.remoteProductPath ? "yes" : "no"}`);
    console.log(`parser origin used: ${mode.remoteProductPath ? (remoteConfig.parserOrigin ?? "unavailable") : "local-testclient"}`);
    console.log(`mistral attempted: ${mistralAttempted ? "yes" : "no"}`);
    console.log("mistral succeeded: no");
    console.log("native text path used: no");
    console.log("ocr path ran: unavailable");
    console.log("ocr/raw extraction layer: unavailable (parser payload missing)");
    console.log("python normalized layer: unavailable (parser payload missing)");
    console.log("app canonicalization layer: unavailable (parser payload unavailable)");
    return;
  }

  const parserPayload = executionResult.payload;
  const parserResult = parserPayload?.result && typeof parserPayload.result === "object"
    ? parserPayload.result
    : parserPayload;
  const parserNormalized = parserResult?.normalized && typeof parserResult.normalized === "object"
    ? parserResult.normalized
    : {};
  const parserExperience = Array.isArray(parserNormalized?.experience) ? parserNormalized.experience : [];
  const rawExperienceSections = getExperienceRawSections(parserPayload);
  const appCanonical = canonicalizeParserResult(parserResult, {
    rawText:
      coerceString(parserNormalized?.raw) ||
      coerceString(parserNormalized?.rawText) ||
      rawExperienceSections.join("\n\n"),
    mode: didOcrPathRun(parserPayload) ? "ocr" : "text",
    parserUrl: requestedRoute,
  });
  const appExperience = Array.isArray(appCanonical?.normalized?.experience)
    ? appCanonical.normalized.experience
    : [];
  const appExperienceSource = coerceString(appCanonical?.diagnostics?.experience_source) || "n/a";
  const mistralSucceeded = didMistralActuallySucceed(parserPayload, requestedRoute);
  const nativeTextPathUsed = didNativeTextPathRun(parserPayload, requestedRoute);

  console.log(`source file: ${spec.file}`);
  console.log(`file type: ${fileType}`);
  console.log(`attempted route: ${requestedRoute}`);
  console.log(`remote mode attempted: ${remoteModeAttempted ? "yes" : "no"}`);
  console.log(`Convex/product path used: ${mode.remoteProductPath ? "yes" : "no"}`);
  console.log(`parser origin used: ${mode.remoteProductPath ? (executionResult.parserOrigin ?? remoteConfig.parserOrigin ?? "unavailable") : "local-testclient"}`);
  console.log(`mistral attempted: ${mistralAttempted ? "yes" : "no"}`);
  console.log(`mistral succeeded: ${mistralSucceeded ? "yes" : "no"}`);
  console.log(`native text path used: ${nativeTextPathUsed ? "yes" : "no"}`);
  console.log(`ocr path ran: ${didOcrPathRun(parserPayload) ? "yes" : "no"}`);
  console.log(
    `ocr/raw extraction layer: route=${coerceString(parserPayload?.diagnostics?.route || parserResult?.diagnostics?.route) || "n/a"} raw_experience_sections=${rawExperienceSections.length} preview=${previewRawSection(rawExperienceSections[0] || "")}`,
  );
  console.log(
    `python normalized layer: experience_count=${parserExperience.length} first2=${summarizeEntries(parserExperience)}`,
  );
  console.log(
    `app canonicalization layer: experience_count=${appExperience.length} experience_source=${appExperienceSource} first2=${summarizeEntries(appExperience)}`,
  );
}

async function main(): Promise<void> {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "../..");
  const mode: HarnessMode = {
    mistralOnly: process.argv.includes("--mistral-only"),
    remoteProductPath: process.argv.includes("--remote-product-path"),
  };
  const remoteConfig = resolveRemoteConfig(repoRoot);

  console.log("CV parsing regression harness");
  console.log(`repo root: ${repoRoot}`);
  console.log(`fixtures: ${FIXTURES.length}`);
  console.log(`mode: ${mode.remoteProductPath ? (mode.mistralOnly ? "remote-product-path+mistral-only" : "remote-product-path") : (mode.mistralOnly ? "mistral-only" : "default")}`);
  if (mode.remoteProductPath) {
    console.log(`remote parser origin: ${remoteConfig.parserOrigin ?? "unavailable"}`);
    console.log(`remote parser origin source: ${remoteConfig.sourceLabel ?? "none"}`);
    console.log(`cf access headers: ${remoteConfig.accessHeaders ? "enabled" : "disabled"}`);
  }

  for (const spec of FIXTURES) {
    await printFixtureReport(spec, repoRoot, mode, remoteConfig);
  }
}

await main();
