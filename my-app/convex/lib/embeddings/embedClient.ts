/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, no-empty -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { llmConfig } from "../../../config/llmConfig";
import { recordTelemetry } from "../../../config/llmTelemetry";

export type EmbeddingVector = number[];

const embedCache = new Map<string, EmbeddingVector>();
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 150;
const MISTRAL_EMBED_ENDPOINT = process.env.MISTRAL_EMBED_URL ?? "https://api.mistral.ai/v1/embeddings";
const MISTRAL_EMBED_MODEL = process.env.MISTRAL_EMBED_MODEL ?? "mistral-embed";
const OPENAI_EMBED_ENDPOINT = process.env.OPENAI_EMBED_URL ?? "https://api.openai.com/v1/embeddings";
const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small";

function normalizeCacheKey(text: string): string {
  return text.trim().toLowerCase();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateEmbeddingVector(vec: unknown): vec is EmbeddingVector {
  return Array.isArray(vec) && vec.every(isFiniteNumber);
}

function normalizeVectors(data: any, expected: number): EmbeddingVector[] {
  if (!data || typeof data !== "object" || !Array.isArray((data as any).data)) {
    throw new Error("Embedding response missing data array");
  }
  const entries = (data as any).data as Array<{ embedding: unknown; index?: number }>;
  if (entries.length !== expected) {
    throw new Error(`Embedding response count mismatch: expected ${expected}, received ${entries.length}`);
  }
  return entries.map((entry, idx) => {
    const embedding = (entry && (entry as any).embedding) ?? null;
    if (!validateEmbeddingVector(embedding)) {
      throw new Error(`Embedding at index ${idx} is invalid`);
    }
    return embedding;
  });
}

function mockEmbedding(text: string): EmbeddingVector {
  const key = normalizeCacheKey(text);
  const out: number[] = [];
  const modulus = 9973;
  let seed = 0;
  for (let i = 0; i < key.length; i++) {
    seed = (seed * 31 + key.charCodeAt(i)) % modulus;
  }
  const length = 32;
  for (let i = 0; i < length; i++) {
    seed = (seed * 1664525 + 1013904223) % modulus;
    out.push((seed % 2000) / 1000 - 1); // range [-1, 1)
  }
  return out;
}

async function callMistralEmbeddings(texts: string[]): Promise<EmbeddingVector[]> {
  const apiKey = (llmConfig.mistralKey && llmConfig.mistralKey.trim()) ?? process.env.MISTRAL_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("Mistral API key not configured");
  }
  try { recordTelemetry("embedding.call", { provider: "mistral", count: texts.length }); } catch {}
  const res = await fetch(MISTRAL_EMBED_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MISTRAL_EMBED_MODEL,
      input: texts,
    }),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Mistral embeddings failed: ${res.status} ${res.statusText} ${errorText}`.trim());
  }
  const json = await res.json();
  return normalizeVectors(json, texts.length);
}

async function callOpenAIEmbeddings(texts: string[]): Promise<EmbeddingVector[]> {
  const apiKey = (llmConfig.openaiKey && llmConfig.openaiKey.trim()) ?? process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }
  try { recordTelemetry("embedding.call", { provider: "openai", count: texts.length }); } catch {}
  const res = await fetch(OPENAI_EMBED_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBED_MODEL,
      input: texts,
    }),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`OpenAI embeddings failed: ${res.status} ${res.statusText} ${errorText}`.trim());
  }
  const json = await res.json();
  return normalizeVectors(json, texts.length);
}

async function callWithProviderFallback(texts: string[]): Promise<EmbeddingVector[]> {
  const preferOpenAI = llmConfig.forceGpt5NanoOnly === true;
  const mistralKey = (llmConfig.mistralKey && llmConfig.mistralKey.trim()) ?? process.env.MISTRAL_API_KEY ?? "";
  const openaiKey = (llmConfig.openaiKey && llmConfig.openaiKey.trim()) ?? process.env.OPENAI_API_KEY ?? "";

  const providers: Array<() => Promise<EmbeddingVector[]>> = [];

  if (!preferOpenAI && mistralKey) {
    providers.push(() => callMistralEmbeddings(texts));
  }
  if (openaiKey) {
    providers.push(() => callOpenAIEmbeddings(texts));
  }
  if (!providers.length && mistralKey) {
    providers.push(() => callMistralEmbeddings(texts));
  }

  let lastError: unknown = null;
  for (const provider of providers) {
    try {
      return await provider();
    } catch (err) {
      lastError = err;
      try { recordTelemetry("embedding.error", { message: String((err as Error)?.message ?? err) }); } catch {}
    }
  }

  if (!mistralKey && !openaiKey) {
    try { recordTelemetry("embedding.mock", { reason: "no_api_keys" }); } catch {}
    return texts.map(mockEmbedding);
  }

  throw lastError instanceof Error ? lastError : new Error("Embedding providers failed");
}

async function embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < MAX_RETRIES) {
    try {
      return await callWithProviderFallback(texts);
    } catch (err: unknown) {
      lastError = err;
      attempt += 1;
      if (attempt >= MAX_RETRIES) break;
      const backoff = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      const jitter = Math.random() * BASE_DELAY_MS;
      await sleep(backoff + jitter);
    }
  }

  if (!lastError) {
    throw new Error("Embedding failed without error details");
  }

  try { recordTelemetry("embedding.gave_up", { attempts: attempt, message: String((lastError as Error)?.message ?? lastError) }); } catch {}
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function embedText(texts: string[]): Promise<EmbeddingVector[]> {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const uniqueLookup = new Map<string, { indexes: number[]; text: string }>();
  const results: EmbeddingVector[] = new Array(texts.length);

  texts.forEach((text, idx) => {
    const cacheKey = normalizeCacheKey(text);
    const cached = embedCache.get(cacheKey);
    if (cached) {
      results[idx] = cached;
      return;
    }
    const existing = uniqueLookup.get(cacheKey);
    if (existing) {
      existing.indexes.push(idx);
    } else {
      uniqueLookup.set(cacheKey, { indexes: [idx], text });
    }
  });

  if (uniqueLookup.size === 0) {
    return results;
  }

  const pendingEntries = Array.from(uniqueLookup.values());
  const pendingTexts = pendingEntries.map((entry) => entry.text);
  const embeddings = await embedBatch(pendingTexts);

  embeddings.forEach((vector, idx) => {
    const { indexes, text } = pendingEntries[idx];
    const cacheKey = normalizeCacheKey(text);
    embedCache.set(cacheKey, vector);
    indexes.forEach((originalIdx) => {
      results[originalIdx] = vector;
    });
  });

  return results;
}

export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < length; i++) {
    const ai = a[i];
    const bi = b[i];
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (!denom || !Number.isFinite(denom)) return 0;
  const similarity = dot / denom;
  if (Number.isNaN(similarity)) return 0;
  return Math.max(-1, Math.min(1, similarity));
}
