/**
 * Thin HTTP client for a minimal spaCy + spacy-layout service.
 * - No dependency on pdf-ingest. Designed to be called from Convex actions ("use node").
 * - Safe-by-default: timeouts, limited retries, and null-return on failures.
 *
 * Expected service (Option C):
 *   - POST /ner
 *     in:  { text: string, locale?: string, options?: { layout?: boolean } }
 *     out: {
 *       entities: { label: "PER"|"ORG"|"GPE"|"LOC"|"DATE"; text: string; start: number; end: number; score?: number }[],
 *       layout?: { blocks: { text: string; start: number; end: number; order: number }[] }
 *     }
 *   - (Phase C) POST /skills
 *     in:  { text: string, topK?: number }
 *     out: { skills: { name: string; text?: string; start?: number; end?: number; score?: number }[] }
 *
 * Environment (Convex):
 *   - ENABLE_NER            => "1"/"true" to enable usage from actions (optional gate)
 *   - NER_SERVICE_URL       => e.g., https://spa-layout.example.com
 *   - NER_SERVICE_KEY       => Bearer token for the service (optional but recommended)
 */

export interface NEREntity {
  label: "PER" | "ORG" | "GPE" | "LOC" | "DATE" | (string & {});
  text: string;
  start: number;
  end: number;
  score?: number;
}

export interface LayoutBlock {
  text: string;
  start: number;
  end: number;
  order: number;
  // Optional layout geometry from spaCyLayout (when available)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  page_no?: number;
  label?: string;
  heading?: string;
}

export interface NERResponse {
  entities: NEREntity[];
  layout?: {
    blocks: LayoutBlock[];
  };
}

export interface SkillsTag {
  name: string;
  text?: string;
  start?: number;
  end?: number;
  score?: number;
}

export interface SkillsResponse {
  skills: SkillsTag[];
}

export interface ClientOptions {
  timeoutMs?: number; // default 3000
  retry?: number;     // default 1, max 3
  locale?: string;    // e.g., "fr", "es", "en"
  signal?: AbortSignal;
}

interface ServiceConfig {
  enabled: boolean;
  url: string | null;
  key: string | null;
}

function readEnv(): ServiceConfig {
  try {
    const env = (process as unknown as { env?: Record<string, string | undefined> })?.env ?? {};
    const enabled = !/^(0|false|no|off)$/i.test((env.ENABLE_NER ?? "1").trim());
    const url = (env.NER_SERVICE_URL ?? "").trim() || null;
    const key = (env.NER_SERVICE_KEY ?? "").trim() || null;
    return { enabled, url, key };
  } catch {
    return { enabled: false, url: null, key: null };
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function withTimeout(upstream: AbortSignal | undefined, ms: number): AbortController {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  if (upstream) upstream.addEventListener("abort", () => controller.abort(), { once: true });
  controller.signal.addEventListener("abort", () => clearTimeout(t), { once: true });
  return controller;
}

function isNEREntity(x: unknown): x is NEREntity {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.text === "string"
    && typeof o.start === "number"
    && typeof o.end === "number"
    && typeof o.label === "string";
}

function isLayoutBlock(x: unknown): x is LayoutBlock {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const base = typeof o.text === "string"
    && typeof o.start === "number"
    && typeof o.end === "number"
    && typeof o.order === "number";
  if (!base) return false;
  // geometry keys are optional but when present must be numbers
  const keys = ["x","y","width","height","page_no"] as const;
  for (const k of keys) {
    if (o[k] !== undefined && typeof o[k] !== "number") return false;
  }
  if (o.label !== undefined && typeof o.label !== "string") return false;
  if (o.heading !== undefined && typeof o.heading !== "string") return false;
  return true;
}

function isNERResponse(x: unknown): x is NERResponse {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const ents = o.entities;
  if (!Array.isArray(ents) || !ents.every(isNEREntity)) return false;
  if (o.layout !== undefined) {
    const layout = o.layout as Record<string, unknown>;
    if (!layout || typeof layout !== "object") return false;
    const blocks = (layout as Record<string, unknown>).blocks;
    if (blocks !== undefined && (!Array.isArray(blocks) || !blocks.every(isLayoutBlock))) return false;
  }
  return true;
}

function isSkillsTag(x: unknown): x is SkillsTag {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.name === "string";
}

function isSkillsResponse(x: unknown): x is SkillsResponse {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const arr = o.skills;
  return Array.isArray(arr) && arr.every(isSkillsTag);
}

async function postJSON<T>(
  path: string,
  body: unknown,
  cfg: ServiceConfig,
  opts?: ClientOptions
): Promise<T | null> {
  if (!cfg.url) return null;

  const base = cfg.url.replace(/\/+$/, "");
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const timeoutMs = clamp(opts?.timeoutMs ?? 3000, 500, 10000);
  const retry = clamp(opts?.retry ?? 1, 0, 3);

  for (let attempt = 0; attempt <= retry; attempt++) {
    const controller = withTimeout(opts?.signal, timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cfg.key ? { Authorization: `Bearer ${cfg.key}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      } as RequestInit);

      if (!res.ok) {
        // retry on 5xx, otherwise return null
        if (res.status >= 500 && attempt < retry) continue;
        return null;
      }
      const json = (await res.json()) as unknown;
      return json as T;
    } catch {
      if (attempt < retry) continue;
      return null;
    }
  }
  return null;
}

/**
 * Request NER entities (and optional layout blocks).
 * Returns null on any failure (timeouts, 4xx/5xx, validation), so caller can treat NER as optional.
 */
export async function requestNER(
  text: string,
  options?: ClientOptions & { layout?: boolean }
): Promise<NERResponse | null> {
  const cfg = readEnv();
  if (!cfg.enabled || !cfg.url) return null;

  const payload: { text: string; locale?: string; options?: { layout?: boolean } } = {
    text: String(text ?? ""),
    ...(options?.locale ? { locale: options.locale } : {}),
    ...(options?.layout ? { options: { layout: options.layout } } : {}),
  };

  const raw = await postJSON<unknown>("/ner", payload, cfg, options);
  if (isNERResponse(raw)) return raw;
  return null;
}

/**
 * Request skills tags (Phase C). May be called later.
 * Returns null on any failure.
 */
export async function requestSkills(
  text: string,
  options?: ClientOptions & { topK?: number }
): Promise<SkillsResponse | null> {
  const cfg = readEnv();
  if (!cfg.enabled || !cfg.url) return null;

  const payload: { text: string; topK?: number; locale?: string } = {
    text: String(text ?? ""),
    ...(typeof options?.topK === "number" ? { topK: clamp(options.topK, 1, 200) } : {}),
    ...(options?.locale ? { locale: options.locale } : {}),
  };

  const raw = await postJSON<unknown>("/skills", payload, cfg, options);
  if (isSkillsResponse(raw)) return raw;
  return null;
}

/**
 * Utility: quick gate to check if NER is usable in this environment.
 */
export function isNEREnabled(): boolean {
  const cfg = readEnv();
  return cfg.enabled && !!cfg.url;
}
