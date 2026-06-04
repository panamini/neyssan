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
import type { DocumentAppearanceSnapshot } from "../lib/document-style-slots";
import dbg from "../lib/cv-debug";
import {
  parseCvDocumentStrict,
  safeParseCvDocument,
} from "../schemas/cvDocument.schema";
import { mapProfileToCvDocument } from "./profile-mapper";
import {
  resolveVerbatiStyle,
  serializeVerbatiStyle,
} from "../features/verbati/style";
import {
  decodeCvDocumentFromConvex,
  encodeCvDocumentForConvex,
} from "./cvDocumentPersistence";
import {
  getLegacyLocalCvDocumentStorageKey,
  getLocalCvDocumentStorageKey,
  LEGACY_LOCAL_CV_DOC_STORAGE_KEY_PREFIX,
  LOCAL_CV_DOC_STORAGE_KEY_PREFIX,
} from "../lib/cv-local-storage";

function hasLocalStorage(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined"
    );
  } catch {
    return false;
  }
}

const inMemoryStore: Record<string, string> = {};

function writeLocalCvCache(id: string, payload: string): void {
  window.localStorage.setItem(getLocalCvDocumentStorageKey(id), payload);
  window.localStorage.removeItem(getLegacyLocalCvDocumentStorageKey(id));
}

function readLocalCvCache(id: string): string | null {
  const primaryRaw = window.localStorage.getItem(
    getLocalCvDocumentStorageKey(id),
  );
  if (primaryRaw) {
    return primaryRaw;
  }

  const legacyRaw = window.localStorage.getItem(
    getLegacyLocalCvDocumentStorageKey(id),
  );
  if (!legacyRaw) {
    return null;
  }

  try {
    writeLocalCvCache(id, legacyRaw);
  } catch {
    // Best-effort.
  }

  return legacyRaw;
}

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

function isUnauthorizedProfileAccessError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /not authorized to access this profile/i.test(message);
}

function isConvexValueTooLargeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Value is too large/i.test(message);
}

function sanitizeRemoteDocumentDecoration(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const {
    dataUrl: _dataUrl,
    resolvedUrl: _resolvedUrl,
    assetMissing: _assetMissing,
    ...decoration
  } = value as Record<string, unknown>;
  return decoration;
}

function sanitizeRuntimeDocumentDecoration(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const {
    dataUrl: _dataUrl,
    ...decoration
  } = value as Record<string, unknown>;
  return decoration;
}

function isImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.trim().startsWith("data:image/");
}

const REMOTE_RUNTIME_IMAGE_KEYS = new Set([
  "dataUrl",
  "resolvedUrl",
  "imageDataUrl",
  "assetMissing",
]);

const REMOTE_IMAGE_REFERENCE_KEYS = new Set([
  "src",
  "photoUrl",
  "url",
  "href",
]);

const STATE_RUNTIME_IMAGE_KEYS = new Set(["dataUrl", "imageDataUrl"]);

function sanitizeRemoteRuntimeImages(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeRemoteRuntimeImages);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (REMOTE_RUNTIME_IMAGE_KEYS.has(key)) {
      continue;
    }
    if (REMOTE_IMAGE_REFERENCE_KEYS.has(key) && isImageDataUrl(entry)) {
      continue;
    }
    if (
      key === "json" &&
      typeof entry === "string" &&
      entry.includes("data:image")
    ) {
      try {
        next[key] = JSON.stringify(sanitizeRemoteRuntimeImages(JSON.parse(entry)));
      } catch {
        next[key] = entry;
      }
      continue;
    }
    next[key] = sanitizeRemoteRuntimeImages(entry);
  }
  return next;
}

function sanitizeRuntimeStateImages(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeRuntimeStateImages);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (STATE_RUNTIME_IMAGE_KEYS.has(key)) {
      continue;
    }
    if (REMOTE_IMAGE_REFERENCE_KEYS.has(key) && isImageDataUrl(entry)) {
      continue;
    }
    if (
      key === "json" &&
      typeof entry === "string" &&
      entry.includes("data:image")
    ) {
      try {
        next[key] = JSON.stringify(sanitizeRuntimeStateImages(JSON.parse(entry)));
      } catch {
        next[key] = entry;
      }
      continue;
    }
    next[key] = sanitizeRuntimeStateImages(entry);
  }
  return next;
}

function sanitizeRemoteMetadata(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const metadata = { ...(value as Record<string, unknown>) };
  delete metadata.createdAt;
  delete metadata.updatedAt;
  delete metadata.version;
  delete metadata.importRecoverySession;
  delete metadata.authoritativeResume;

  if (
    metadata.profileImage &&
    typeof metadata.profileImage === "object" &&
    !Array.isArray(metadata.profileImage)
  ) {
    const profileImage = {
      ...(metadata.profileImage as Record<string, unknown>),
    };
    if (
      typeof profileImage.src === "string" &&
      profileImage.src.trim().startsWith("data:")
    ) {
      delete profileImage.src;
    }
    metadata.profileImage = sanitizeRemoteRuntimeImages(profileImage);
  }

  if (metadata.documentDecoration !== undefined) {
    metadata.documentDecoration = sanitizeRemoteDocumentDecoration(
      metadata.documentDecoration,
    );
  }

  return metadata;
}

function stripLargeBackendOnlyMetadata<T extends CvDocument>(cv: T): T {
  if (!cv.metadata || typeof cv.metadata !== "object") {
    return cv;
  }

  const metadata = sanitizeRemoteMetadata(cv.metadata) as Record<
    string,
    unknown
  >;

  return {
    ...cv,
    metadata,
  };
}

function stripStructuredSectionBlocksForRemote(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const cv = value as Record<string, unknown>;
  if (!Array.isArray(cv.sections)) {
    return cv;
  }

  return {
    ...cv,
    sections: cv.sections.map((section) => {
      if (!section || typeof section !== "object" || Array.isArray(section)) {
        return section;
      }

      const record = section as Record<string, unknown>;
      const hasStructuredContent =
        Array.isArray(record.structuredContent) &&
        record.structuredContent.length > 0;
      if (!hasStructuredContent || record.type === "text") {
        return record;
      }

      return {
        ...record,
        blocks: [],
      };
    }),
  };
}

function sanitizeRemoteCvDocument(cv: CvDocument): CvDocument {
  const sanitized = sanitizeRemoteRuntimeImages(stripLargeBackendOnlyMetadata(cv));
  return stripStructuredSectionBlocksForRemote(sanitized) as CvDocument;
}

function sanitizeLocalDurableCvDocument(cv: CvDocument): CvDocument {
  return sanitizeRemoteRuntimeImages(cv) as CvDocument;
}

function sanitizeRuntimeCvDocumentForState(cv: CvDocument): CvDocument {
  return sanitizeRuntimeStateImages(cv) as CvDocument;
}

function sanitizeBackendVerbatiStyle(value: unknown):
  | {
      layout?: string;
      typography?: string;
      palette?: string;
      accentHex?: string;
      resumeTemplateId?: string;
    }
  | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const sanitized = {
    layout: typeof candidate.layout === "string" ? candidate.layout : undefined,
    typography:
      typeof candidate.typography === "string"
        ? candidate.typography
        : undefined,
    palette:
      typeof candidate.palette === "string" ? candidate.palette : undefined,
    accentHex:
      typeof candidate.accentHex === "string" ? candidate.accentHex : undefined,
    resumeTemplateId:
      typeof candidate.resumeTemplateId === "string"
        ? candidate.resumeTemplateId
        : undefined,
  };

  return Object.values(sanitized).some((entry) => typeof entry === "string")
    ? sanitized
    : undefined;
}

function sanitizeBackendDocumentAppearanceSnapshot(
  value: unknown,
): DocumentAppearanceSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.layout !== "string" ||
    typeof candidate.typography !== "string" ||
    typeof candidate.palette !== "string"
  ) {
    return undefined;
  }

  return {
    ...(typeof candidate.familyId === "string"
      ? {
          familyId:
            candidate.familyId as DocumentAppearanceSnapshot["familyId"],
        }
      : null),
    layout: candidate.layout as DocumentAppearanceSnapshot["layout"],
    typography:
      candidate.typography as DocumentAppearanceSnapshot["typography"],
    palette: candidate.palette as DocumentAppearanceSnapshot["palette"],
    ...(typeof candidate.accentHex === "string"
      ? { accentHex: candidate.accentHex }
      : null),
    ...(typeof candidate.resumeTemplateId === "string"
      ? { resumeTemplateId: candidate.resumeTemplateId }
      : null),
  };
}

function assignDocumentStyleMetadataPatch(
  metadata: Record<string, unknown>,
  metadataPatch: CvDocument["metadata"],
): void {
  const resumeTemplateId =
    typeof metadataPatch.resumeTemplateId === "string"
      ? metadataPatch.resumeTemplateId
      : metadataPatch.verbatiStyle &&
          typeof metadataPatch.verbatiStyle === "object" &&
          typeof metadataPatch.verbatiStyle.resumeTemplateId === "string"
        ? metadataPatch.verbatiStyle.resumeTemplateId
        : metadataPatch.verbatiStyleBaseSnapshot &&
            typeof metadataPatch.verbatiStyleBaseSnapshot === "object" &&
            typeof metadataPatch.verbatiStyleBaseSnapshot.resumeTemplateId ===
              "string"
          ? metadataPatch.verbatiStyleBaseSnapshot.resumeTemplateId
          : undefined;

  if (resumeTemplateId) {
    metadata.resumeTemplateId = resumeTemplateId;
    if (metadata.verbatiStyle && typeof metadata.verbatiStyle === "object") {
      metadata.verbatiStyle = {
        ...(metadata.verbatiStyle as Record<string, unknown>),
        resumeTemplateId,
      };
    }
  }
  if (
    metadataPatch.verbatiStyleSlotId === 1 ||
    metadataPatch.verbatiStyleSlotId === 2 ||
    metadataPatch.verbatiStyleSlotId === 3
  ) {
    metadata.verbatiStyleSlotId = metadataPatch.verbatiStyleSlotId;
  }
  if (
    metadataPatch.verbatiStyleSlotSource === "factory" ||
    metadataPatch.verbatiStyleSlotSource === "settings"
  ) {
    metadata.verbatiStyleSlotSource = metadataPatch.verbatiStyleSlotSource;
  }
  if (typeof metadataPatch.verbatiStyleSlotNameSnapshot === "string") {
    metadata.verbatiStyleSlotNameSnapshot =
      metadataPatch.verbatiStyleSlotNameSnapshot;
  }
  const baseSnapshot = sanitizeBackendDocumentAppearanceSnapshot(
    metadataPatch.verbatiStyleBaseSnapshot,
  );
  if (baseSnapshot) {
    metadata.verbatiStyleBaseSnapshot = baseSnapshot;
  }
  if (metadataPatch.documentStyleVersion === 1) {
    metadata.documentStyleVersion = 1;
  }
}

function overlayProfileMetadataPatch(
  doc: CvDocument,
  rawProfile: Record<string, unknown>,
): CvDocument {
  const rawMetadata =
    rawProfile.metadata && typeof rawProfile.metadata === "object"
      ? (rawProfile.metadata as CvDocument["metadata"])
      : null;
  if (!rawMetadata) {
    return doc;
  }

  const metadata: Record<string, unknown> = { ...(doc.metadata ?? {}) };

  if (rawMetadata.verbatiStyle !== undefined) {
    metadata.verbatiStyle = serializeVerbatiStyle(
      resolveVerbatiStyle(rawMetadata.verbatiStyle as Record<string, unknown>),
    );
  }

  assignDocumentStyleMetadataPatch(metadata, rawMetadata);

  if (rawMetadata.documentIcons !== undefined) {
    metadata.documentIcons = rawMetadata.documentIcons;
  }

  if (rawMetadata.documentDecoration !== undefined) {
    metadata.documentDecoration = sanitizeRuntimeDocumentDecoration(
      rawMetadata.documentDecoration,
    );
  }

  return {
    ...doc,
    metadata: metadata as CvDocument["metadata"],
  };
}

export function mapPersistedProfileToCvDocument(
  rawProfile: Record<string, unknown> | null | undefined,
  profileId: string,
): CvDocument | null {
  if (!rawProfile || typeof rawProfile !== "object") {
    return null;
  }

  const embeddedDocument = rawProfile.cvDocument;
  if (embeddedDocument && typeof embeddedDocument === "object") {
    const decodedEmbeddedDocument =
      decodeCvDocumentFromConvex(embeddedDocument);
    const embeddedResult = safeParseCvDocument(decodedEmbeddedDocument);
    if (embeddedResult.ok) {
      return sanitizeRuntimeCvDocumentForState(
        overlayProfileMetadataPatch(embeddedResult.value, rawProfile),
      );
    }
  }

  const mapped = mapProfileToCvDocument(rawProfile, profileId);
  return mapped ? sanitizeRuntimeCvDocumentForState(mapped) : null;
}

/* -------------------- ConvexStorageAdapter -------------------- */

export class ConvexStorageAdapter {
  private readonly _patchMutation: (args: {
    profileId: string;
    patch: any;
  }) => Promise<any>;
  private readonly _loadFn?: (profileId: string) => Promise<CvDocument | null>;

  constructor(
    patchMutation: (args: { profileId: string; patch: any }) => Promise<any>,
    loadFn?: (profileId: string) => Promise<CvDocument | null>,
  ) {
    this._patchMutation = patchMutation;
    this._loadFn = loadFn;
  }

  /**
   * Persist a metadata-only CV patch to Convex without sending the embedded cvDocument.
   * The backend treats metadata-only patches as existing-row-only, so this cannot create
   * orphan/duplicate profile rows when the remote CV document has not been created yet.
   */
  public async saveMetadataPatch(
    cvId: string,
    metadataPatch: Partial<
      Pick<
        CvDocument["metadata"],
        | "verbatiStyle"
        | "resumeTemplateId"
        | "verbatiStyleSlotId"
        | "verbatiStyleSlotSource"
        | "verbatiStyleSlotNameSnapshot"
        | "verbatiStyleBaseSnapshot"
        | "documentStyleVersion"
        | "documentIcons"
        | "documentDecoration"
      >
    >,
  ): Promise<any> {
    const metadata: Record<string, unknown> = {};
    if (metadataPatch?.verbatiStyle !== undefined) {
      const verbatiStyle = sanitizeBackendVerbatiStyle(
        metadataPatch.verbatiStyle,
      );
      metadata.verbatiStyle = verbatiStyle;
      if (
        typeof metadataPatch.resumeTemplateId !== "string" &&
        typeof verbatiStyle?.resumeTemplateId === "string"
      ) {
        metadata.resumeTemplateId = verbatiStyle.resumeTemplateId;
      }
    }
    assignDocumentStyleMetadataPatch(
      metadata,
      metadataPatch as CvDocument["metadata"],
    );
    if (metadataPatch?.documentIcons !== undefined) {
      metadata.documentIcons = metadataPatch.documentIcons;
    }
    if (metadataPatch?.documentDecoration !== undefined) {
      metadata.documentDecoration = sanitizeRemoteDocumentDecoration(
        metadataPatch.documentDecoration,
      );
    }

    try {
      return await this._patchMutation({
        profileId: cvId,
        patch: { metadata },
      });
    } catch (error) {
      if (!isUnauthorizedProfileAccessError(error)) {
        throw error;
      }

      try {
        dbg("[ConvexStorageAdapter] unauthorized metadata patch skipped", {
          docId: cvId,
        });
      } catch {
        /* noop */
      }
      return undefined;
    }
  }

  /**
   * Save a CvDocument to Convex and localStorage
   */
  public async save(cv: CvDocument): Promise<void> {
    // Strict validation
    parseCvDocumentStrict(cv);

    // Prepare payload for Convex backend: strip fields that the backend validator
    // does not accept (e.g., metadata.createdAt). Keep a copy for local caching.
    const backendPayload: any = {};
    if (cv.metadata && typeof cv.metadata === "object") {
      const md = sanitizeRemoteMetadata(cv.metadata) as Record<string, any>;
      if ("verbatiStyle" in md) {
        md.verbatiStyle = sanitizeBackendVerbatiStyle(md.verbatiStyle);
        if (
          typeof md.resumeTemplateId !== "string" &&
          typeof md.verbatiStyle?.resumeTemplateId === "string"
        ) {
          md.resumeTemplateId = md.verbatiStyle.resumeTemplateId;
        }
      }
      if ("verbatiStyleBaseSnapshot" in md) {
        md.verbatiStyleBaseSnapshot = sanitizeBackendDocumentAppearanceSnapshot(
          md.verbatiStyleBaseSnapshot,
        );
      }
      // Keep other allowed keys (source, importedAt, confidence, filename)
      backendPayload.metadata = md;
    }
    backendPayload.cvDocument = encodeCvDocumentForConvex(
      sanitizeRemoteCvDocument(cv),
    );

    // Instrument: record metadata keys and short stack to in-app debug stream before mutation
    try {
      const keys =
        backendPayload.metadata && typeof backendPayload.metadata === "object"
          ? Object.keys(backendPayload.metadata)
          : [];
      const stack = new Error("convex-save-stack").stack
        ?.split("\n")
        .slice(0, 6)
        .map((s) => s.trim());
      dbg("[ConvexStorageAdapter] save -> _patchMutation", {
        docId: cv.id,
        backendMetaKeys: keys,
        stack,
      });
    } catch {
      /* noop */
    }

    let remoteSaveError: unknown = null;

    // Convex mutation with backend-shaped payload
    try {
      await this._patchMutation({
        profileId: cv.id,
        patch: backendPayload,
      });
    } catch (error) {
      remoteSaveError = error;

      try {
        dbg("[ConvexStorageAdapter] remote save skipped", {
          docId: cv.id,
          reason: isConvexValueTooLargeError(error)
            ? "convex_value_too_large"
            : "unauthorized",
        });
      } catch {
        /* noop */
      }
    }

    // SSR-safe localStorage - cache durable state only, never runtime image previews.
    try {
      if (hasLocalStorage()) {
        writeLocalCvCache(cv.id, serialize(sanitizeLocalDurableCvDocument(cv)));
      }
    } catch {
      // ignore
    }

    if (
      remoteSaveError &&
      !isUnauthorizedProfileAccessError(remoteSaveError)
    ) {
      throw remoteSaveError;
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
        if (doc) return sanitizeRuntimeCvDocumentForState(doc);
      } catch {
        // fallback
      }
    }

    // Fallback: public Convex query
    try {
      const prof = await convexClient.query(api.profilesPublic.getByProfileId, {
        profileId: id,
      });
      if (prof) {
        const mapped = mapPersistedProfileToCvDocument(
          prof as Record<string, unknown>,
          id,
        );
        if (mapped) {
          try {
            parseCvDocumentStrict(mapped);
            if (hasLocalStorage())
              writeLocalCvCache(
                mapped.id,
                serialize(sanitizeLocalDurableCvDocument(mapped)),
              );
            return mapped;
          } catch {
            // invalid mapping, ignore
          }
        }
      }
    } catch {
      // ignore
    }

    // Final fallback: localStorage
    try {
      if (hasLocalStorage()) {
        const raw = readLocalCvCache(id);
        if (!raw) return null;
        const parsed = deserialize(raw);
        if (!parsed) return null;
        parseCvDocumentStrict(parsed as any);
        const durableParsed = sanitizeLocalDurableCvDocument(parsed);
        if (serialize(durableParsed) !== serialize(parsed)) {
          writeLocalCvCache(id, serialize(durableParsed));
        }
        return durableParsed;
      }
    } catch {
      // ignore
    }

    // Fallback in-memory
    const memoryDocument = deserialize(
      inMemoryStore[getLocalCvDocumentStorageKey(id)] ?? null,
    );
    return memoryDocument ? sanitizeLocalDurableCvDocument(memoryDocument) : null;
  }

  /**
   * Attempt to load and strictly validate a CvDocument
   */
  public async loadValidated(
    id: string,
  ): Promise<
    | { ok: true; value: CvDocument }
    | { ok: false; error: string; loose?: CvDocument | null }
  > {
    try {
      const loose = await this.load(id);
      if (!loose) return { ok: false, error: "not_found", loose: null };
      try {
        const strict = parseCvDocumentStrict(loose);
        return { ok: true, value: strict };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          loose,
        };
      }
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        loose: null,
      };
    }
  }
}

/* -------------------- React Hook -------------------- */

export function useConvexStorageAdapter(): ConvexStorageAdapter {
  const patchMutation = useMutation(api.profiles.patch) as unknown as (args: {
    profileId: string;
    patch: any;
  }) => Promise<any>;
  const loadFn = useCallback(
    async (_profileId: string): Promise<CvDocument | null> => {
      try {
        const prof = await convexClient.query(
          api.profilesPublic.getByProfileId,
          {
            profileId: _profileId,
          },
        );
        if (!prof) return null;
        return mapPersistedProfileToCvDocument(
          prof as Record<string, unknown>,
          _profileId,
        );
      } catch {
        return null;
      }
    },
    [],
  );
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
  const key = getLocalCvDocumentStorageKey(cv.id);
  const payload = serialize(cv);
  try {
    if (hasLocalStorage()) {
      writeLocalCvCache(cv.id, payload);
      return;
    }
  } catch {}
  inMemoryStore[key] = payload;
}

export async function loadCv(id: string): Promise<CvDocument | null> {
  const key = getLocalCvDocumentStorageKey(id);
  try {
    if (hasLocalStorage()) {
      const raw = readLocalCvCache(id);
      return deserialize(raw);
    }
  } catch {}
  return deserialize(inMemoryStore[key] ?? null);
}

export async function deleteCv(id: string): Promise<void> {
  const key = getLocalCvDocumentStorageKey(id);
  try {
    if (hasLocalStorage()) {
      window.localStorage.removeItem(key);
      window.localStorage.removeItem(getLegacyLocalCvDocumentStorageKey(id));
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
        if (k && k.startsWith(LOCAL_CV_DOC_STORAGE_KEY_PREFIX)) {
          out.push(k.replace(LOCAL_CV_DOC_STORAGE_KEY_PREFIX, ""));
          continue;
        }
        if (k && k.startsWith(LEGACY_LOCAL_CV_DOC_STORAGE_KEY_PREFIX)) {
          out.push(k.replace(LEGACY_LOCAL_CV_DOC_STORAGE_KEY_PREFIX, ""));
        }
      }
      return Array.from(new Set(out));
    }
  } catch {}
  return Array.from(
    new Set(
      Object.keys(inMemoryStore)
        .filter((k) => k.startsWith(LOCAL_CV_DOC_STORAGE_KEY_PREFIX))
        .map((k) => k.replace(LOCAL_CV_DOC_STORAGE_KEY_PREFIX, "")),
    ),
  );
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
export function extractSummary(
  summary: CvDocument["summary"],
): string | undefined {
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
