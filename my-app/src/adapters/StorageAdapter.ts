/**
 * my-app/src/adapters/StorageAdapter.ts
 *
 * Storage adapter for CV documents.
 *
 * Features:
 * - Convex-backed save/load using mutations and queries
 * - SSR-safe localStorage fallback
 * - In-memory fallback for tests/SSR
 * - Zod strict validation
 * - Structured content extraction for experience/education
 * - Summary and text extraction helpers
 * - React hook factory for use in components
 */

import { useCallback, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { convexClient } from "../lib/convex-client";
import type { CvDocument } from "../types/cvDocument";
import dbg from "../lib/cv-debug";
import { parseCvDocumentStrict } from "../schemas/cvDocument.schema";

const STORAGE_PREFIX = "cv-doc:";

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

const inMemoryStore: Record<string, string> = {};

/* -------------------- Serialization -------------------- */

function serialize(cv: CvDocument): string {
  return JSON.stringify(cv);
}

function deserialize(payload: string | null): CvDocument | null {
  if (!payload) return null;
  try {
    return JSON.parse(payload) as CvDocument;
  } catch {
    return null;
  }
}

/* -------------------- ConvexStorageAdapter -------------------- */

export class ConvexStorageAdapter {
  private readonly _patchMutation: (args: { profileId: string; patch: any }) => Promise<any>;
  private readonly _loadFn?: (profileId: string) => Promise<CvDocument | null>;

  constructor(
    patchMutation: (args: { profileId: string; patch: any }) => Promise<any>,
    loadFn?: (profileId: string) => Promise<CvDocument | null>
  ) {
    this._patchMutation = patchMutation;
    this._loadFn = loadFn;
  }

  /**
   * Save a CvDocument to Convex and localStorage
   */
  public async save(cv: CvDocument): Promise<void> {
    // Strict validation
    parseCvDocumentStrict(cv);

    // Prepare payload for Convex backend: strip fields that the backend validator
    // does not accept (e.g., metadata.createdAt). Keep a copy for local caching.
    const backendPayload: any = { ...cv };
    if (backendPayload.metadata && typeof backendPayload.metadata === "object") {
      // shallow clone metadata and remove fields that the backend validator does not accept
      const md = { ...backendPayload.metadata } as Record<string, any>;
      delete md.createdAt;
      delete md.updatedAt;
      delete md.version;
      // Keep other allowed keys (source, importedAt, confidence, filename)
      backendPayload.metadata = md;
    }

    // Instrument: record metadata keys and short stack to in-app debug stream before mutation
    try {
      const keys = backendPayload.metadata && typeof backendPayload.metadata === "object" ? Object.keys(backendPayload.metadata) : [];
      const stack = (new Error("convex-save-stack")).stack?.split("\n").slice(0, 6).map((s) => s.trim());
      dbg("[ConvexStorageAdapter] save -> _patchMutation", { docId: cv.id, backendMetaKeys: keys, stack });
    } catch {
      /* noop */
    }

    // Convex mutation with backend-shaped payload
    await this._patchMutation({
      profileId: cv.id,
      patch: backendPayload,
    });

    // SSR-safe localStorage - cache the original cv (not the backend-mapped payload)
    try {
      if (hasLocalStorage()) {
        window.localStorage.setItem(`${STORAGE_PREFIX}${cv.id}`, serialize(cv));
      }
    } catch {
      // ignore
    }
  }

  /**
   * Load a CvDocument from Convex or fallback
   */
  public async load(id: string): Promise<CvDocument | null> {
    // Try Convex loader first
    if (this._loadFn) {
      try {
        const doc = await this._loadFn(id);
        if (doc) return doc;
      } catch {
        // fallback
      }
    }

    // Fallback: public Convex query
    try {
      const prof = await convexClient.query(api.profilesPublic.get);
      if (prof) {
        try {
          // Validate and map Convex profile -> CvDocument using schema
          const mapped = parseCvDocumentStrict(prof as unknown);
          // Cache locally
          if (hasLocalStorage()) window.localStorage.setItem(`${STORAGE_PREFIX}${mapped.id}`, serialize(mapped));
          return mapped;
        } catch {
          // invalid mapping, ignore
        }
      }
    } catch {
      // ignore
    }

    // Final fallback: localStorage
    try {
      if (hasLocalStorage()) {
        const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${id}`);
        if (!raw) return null;
        const parsed = deserialize(raw);
        if (!parsed) return null;
        parseCvDocumentStrict(parsed as any);
        return parsed;
      }
    } catch {
      // ignore
    }

    // Fallback in-memory
    return deserialize(inMemoryStore[`${STORAGE_PREFIX}${id}`] ?? null);
  }

  /**
   * Attempt to load and strictly validate a CvDocument
   */
  public async loadValidated(
    id: string
  ): Promise<{ ok: true; value: CvDocument } | { ok: false; error: string; loose?: CvDocument | null }> {
    try {
      const loose = await this.load(id);
      if (!loose) return { ok: false, error: "not_found", loose: null };
      try {
        const strict = parseCvDocumentStrict(loose);
        return { ok: true, value: strict };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e), loose };
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e), loose: null };
    }
  }
}

/* -------------------- React Hook -------------------- */

export function useConvexStorageAdapter(): ConvexStorageAdapter {
  const patchMutation = useMutation(api.profiles.patch) as unknown as (args: { profileId: string; patch: any }) => Promise<any>;
  const loadFn = useCallback(async (_profileId: string): Promise<CvDocument | null> => {
    try {
      const prof = await convexClient.query(api.profilesPublic.get);
      if (!prof) return null;
      try {
        return parseCvDocumentStrict(prof as unknown);
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  }, []);
  const patchMutationRef = useRef(patchMutation);
  const loadFnRef = useRef(loadFn);
  const adapterRef = useRef<ConvexStorageAdapter | null>(null);

  useEffect(() => {
    patchMutationRef.current = patchMutation;
  }, [patchMutation]);

  useEffect(() => {
    loadFnRef.current = loadFn;
  }, [loadFn]);

  if (!adapterRef.current) {
    adapterRef.current = new ConvexStorageAdapter(
      (args) => patchMutationRef.current(args),
      (profileId) => loadFnRef.current(profileId),
    );
  }

  return adapterRef.current;
}

/* -------------------- Local/Memory Utilities -------------------- */

export async function saveCv(cv: CvDocument): Promise<void> {
  const key = `${STORAGE_PREFIX}${cv.id}`;
  const payload = serialize(cv);
  try {
    if (hasLocalStorage()) {
      window.localStorage.setItem(key, payload);
      return;
    }
  } catch {}
  inMemoryStore[key] = payload;
}

export async function loadCv(id: string): Promise<CvDocument | null> {
  const key = `${STORAGE_PREFIX}${id}`;
  try {
    if (hasLocalStorage()) {
      const raw = window.localStorage.getItem(key);
      return deserialize(raw);
    }
  } catch {}
  return deserialize(inMemoryStore[key] ?? null);
}

export async function deleteCv(id: string): Promise<void> {
  const key = `${STORAGE_PREFIX}${id}`;
  try {
    if (hasLocalStorage()) {
      window.localStorage.removeItem(key);
      return;
    }
  } catch {}
  delete inMemoryStore[key];
}

export async function listCvIds(): Promise<string[]> {
  try {
    if (hasLocalStorage()) {
      const out: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) out.push(k.replace(STORAGE_PREFIX, ""));
      }
      return out;
    }
  } catch {}
  return Object.keys(inMemoryStore).filter((k) => k.startsWith(STORAGE_PREFIX)).map((k) => k.replace(STORAGE_PREFIX, ""));
}

export async function loadAnyCv(): Promise<CvDocument | null> {
  const ids = await listCvIds();
  if (ids.length === 0) return null;
  return loadCv(ids[0]);
}

/* -------------------- Helpers -------------------- */

/**
 * Extract text from a Remirror JSON node
 */
export function extractTextFromRemirror(node: unknown): string {
  function collectText(n: any): string {
    if (!n) return "";
    if (typeof n === "string") return n;
    if (typeof n.text === "string") return n.text;
    if (Array.isArray(n.content)) return n.content.map(collectText).join(" ");
    return "";
  }
  try {
    return collectText(node);
  } catch {
    return "";
  }
}

/**
 * Extract a human-readable summary string from CvDocument.summary
 */
export function extractSummary(summary: CvDocument["summary"]): string | undefined {
  if (!summary) return undefined;
  if (typeof summary === "string") return summary;
  try {
    return JSON.stringify(summary);
  } catch {
    return undefined;
  }
}

export default {
  saveCv,
  loadCv,
  deleteCv,
  listCvIds,
  loadAnyCv,
  useConvexStorageAdapter,
  extractTextFromRemirror,
  extractSummary,
};
