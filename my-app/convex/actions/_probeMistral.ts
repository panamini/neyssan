'use node';
import { action } from "../_generated/server";
import { v } from "convex/values";

function nowMs(): number {
  return Date.now();
}

function normalizeOrigin(value?: string): string {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, "");
  }
}

// Minimal-but-accepted one-page PDF with padding (~8KB) so Cloudflare doesn't 502 tiny bodies.
const MINIMAL_PDF = Buffer.from(
  `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources <<>> >>endobj
4 0 obj<< /Length 44 >>stream
BT  /F1 12 Tf  72 128 Td  (Hello OCR) Tj  ET
endstream endobj
xref
0 5
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000116 00000 n
0000000221 00000 n
trailer<< /Size 5 /Root 1 0 R >>
startxref
320
%%EOF
`,
  "utf-8",
);
const PAD = Buffer.alloc(8192, 0x20); // 8KB of spaces
const PROBE_PDF = Buffer.concat([MINIMAL_PDF, PAD]);

export const probe = action({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const traceId = `probe:${nowMs()}`;
    const envGet = (ctx as any)?.env?.get?.bind((ctx as any).env);
    const raw = envGet ? envGet("CONVEX_PARSER_URL") : (process.env.CONVEX_PARSER_URL);
    const cfAccessClientId = envGet
      ? (envGet("CF_ACCESS_CLIENT_ID") as string | undefined)
      : (process.env.CF_ACCESS_CLIENT_ID);
    const cfAccessClientSecret = envGet
      ? (envGet("CF_ACCESS_CLIENT_SECRET") as string | undefined)
      : (process.env.CF_ACCESS_CLIENT_SECRET);
    const useAccessHeaders = Boolean(cfAccessClientId && cfAccessClientSecret);
    if (!useAccessHeaders) {
      console.info("[_probeMistral] CF Access headers: disabled (missing env)");
    } else {
      console.info("[_probeMistral] CF Access headers: enabled");
    }
    const accessHeaders = useAccessHeaders
      ? {
          "CF-Access-Client-Id": cfAccessClientId as string,
          "CF-Access-Client-Secret": cfAccessClientSecret as string,
        }
      : null;

    const origin = normalizeOrigin(raw ?? "");
    if (!origin) return { error: "missing_parser_origin", expectedEnv: "CONVEX_PARSER_URL" };

    const readyUrl = new URL("/ready", origin).toString();
    const parseUrl = new URL("/mistral-ocr/parse", origin).toString();

    // 1) Connectivity: GET /ready
    let readyStatus = 0;
    let readyJson: any = null;
    let readyBody = "";
    const readyStartedAt = nowMs();
    console.info("[resume-import-timing][probe] ready.start", {
      traceId,
      readyUrl,
    });
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (accessHeaders) Object.assign(headers, accessHeaders);
      const r = await fetch(readyUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      readyStatus = r.status;
      readyBody = await r.text();
      const readyType = r.headers.get("content-type") || "";
      if (readyType.includes("application/json")) {
        try {
          readyJson = JSON.parse(readyBody);
        } catch {
          readyJson = null;
        }
      }
      console.info("[resume-import-timing][probe] ready.finish", {
        traceId,
        readyUrl,
        readyStatus,
        elapsedMs: nowMs() - readyStartedAt,
      });
    } catch (err: any) {
      console.info("[resume-import-timing][probe] ready.finish", {
        traceId,
        readyUrl,
        readyStatus: 0,
        elapsedMs: nowMs() - readyStartedAt,
        error: err?.message ?? String(err),
      });
      return {
        route: { origin, readyUrl, parseUrl },
        ready: { status: 0, error: err?.message ?? String(err) },
      };
    }

    // 2) OCR path: POST /mistral-ocr/parse with padded PDF
    const fd = new FormData();
    fd.set("file", new Blob([PROBE_PDF], { type: "application/pdf" }), "probe.pdf");

    let status = 0;
    let diag: any = null;
    let bodySample = "";
    let cfRay: string | null = null;
    const parseStartedAt = nowMs();
    console.info("[resume-import-timing][probe] parse.start", {
      traceId,
      parseUrl,
    });
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (accessHeaders) Object.assign(headers, accessHeaders);
      const res = await fetch(parseUrl, {
        method: "POST",
        headers,
        body: fd,
        signal: AbortSignal.timeout(30_000),
      });
      status = res.status;
      cfRay = res.headers.get("cf-ray");
      const text = await res.text();
      bodySample = text.slice(0, 300);
      const ctype = res.headers.get("content-type") || "";
      if (ctype.includes("application/json")) {
        try {
          diag = JSON.parse(text)?.diagnostics ?? null;
        } catch {
          diag = null;
        }
      }
      console.info("[resume-import-timing][probe] parse.finish", {
        traceId,
        parseUrl,
        status,
        elapsedMs: nowMs() - parseStartedAt,
        cfRay,
      });
    } catch (err: any) {
      console.info("[resume-import-timing][probe] parse.finish", {
        traceId,
        parseUrl,
        status: 0,
        elapsedMs: nowMs() - parseStartedAt,
        error: err?.message ?? String(err),
      });
      return {
        route: { origin, readyUrl, parseUrl },
        ready: { status: readyStatus, json: readyJson ?? null, bodySample: (readyBody ?? "").slice(0, 200) },
        parse: { status: 0, error: err?.message ?? String(err) },
      };
    }

    return {
      route: { origin, readyUrl, parseUrl },
      ready: { status: readyStatus, json: readyJson ?? null, bodySample: (readyBody ?? "").slice(0, 200) },
      parse: { status, diag, bodySample, cfRay },
    };
  },
});
