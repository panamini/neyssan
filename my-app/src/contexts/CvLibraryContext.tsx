import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { useAuth } from "@clerk/clerk-react";
import { v4 as uuidv4 } from "uuid";
import { useConvexAuth, useMutation } from "convex/react";
import { convexClient } from "../lib/convex-client";
import { useConvexStorageAdapter } from "../adapters/StorageAdapter";
import { mapProfileToCvDocument } from "../adapters/profile-mapper";
import type {
  CvDocument,
  CvSection,
  CvBlock,
  IProfileItem,
} from "../types/cvDocument";
import { safeParseCvDocument } from "../schemas/cvDocument.schema";
import type { RemirrorJSON } from "remirror";
import { ensureRemirrorDoc } from "../components/remirror-editor/utils/conversion";
import {
  generateCvTemplate,
  generateCvTemplateV1,
  makeExperienceItem,
  makeEducationItem,
  makeProfileItem,
  makeSummaryItem,
  makeSkillItem,
  makeLanguageItem,
} from "../lib/cv-template";
import {
  deriveCvTitleCandidateFromSections,
  deriveCvTitleFromSections,
  isPlaceholderCvTitle,
  normalizeAndValidateCvDocument,
  ensureRepresentativeBlocks,
} from "../lib/normalize-cv";
import { buildAuthoritativeResumeDebugSnapshot } from "../lib/authoritative-resume";
// Toggle verbose debug logging for editor flows. Enable by setting window.__CV_EDITOR_DEBUG__ = true in the dev console.
import { isV1SectionsEnabled } from "../lib/flags";
import dbg from "../lib/cv-debug";
import { api } from "../../convex/_generated/api";
import {
  buildActiveCvSnapshotFromCvDocument,
  type ActiveCvSnapshot,
} from "../lib/proposal-personalization";
import {
  ACTIVE_CV_STORAGE_KEY,
  getLegacyLocalCvDocumentStorageKey,
  getLocalCvDocumentStorageKey,
  LEGACY_ACTIVE_CV_STORAGE_KEY,
  LEGACY_LOCAL_CV_DOC_STORAGE_KEY_PREFIX,
  LEGACY_LOCAL_CV_LIBRARY_STORAGE_KEY,
  LOCAL_CV_LIBRARY_STORAGE_KEY,
} from "../lib/cv-local-storage";
import { resolveVerbatiStyle, serializeVerbatiStyle } from "../features/verbati/style";
import type { VerbatiStylePreset } from "../features/verbati/types";
import type { DocumentStyleMetadata } from "../lib/document-style-slots";
import type { DocumentIconSettings } from "../lib/document-icons";
import type { DocumentDecoration } from "../lib/document-decoration";
import {
  isResumeTemplateId,
  type ResumeTemplateId,
} from "../lib/layout/resumeTemplates";

type CvVisualMetadataPatch = DocumentStyleMetadata & {
  resumeTemplateId?: ResumeTemplateId;
  documentIcons?: DocumentIconSettings;
  documentDecoration?: DocumentDecoration;
};

type RemoteSaveStatus =
  | { status: "idle"; documentId?: undefined; error?: undefined; reason?: undefined }
  | { status: "saving"; documentId: string; error?: undefined; reason?: undefined }
  | { status: "synced"; documentId: string; error?: undefined; reason?: undefined }
  | { status: "failed"; documentId: string; error: string; reason: string };

/**
 * Small, safe deep equality check used for dirty detection.
 * It's intentionally simple (JSON stringify) — acceptable for our snapshot comparisons.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function cvDecorationBoundaryInfo(
  label: string,
  payload: Record<string, unknown>,
): void {
  if (!import.meta.env.DEV && !isCvEditorDebugEnabled()) {
    return;
  }

  console.info(label, payload);
}

function isImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.trim().startsWith("data:image/");
}

const DURABLE_RUNTIME_IMAGE_KEYS = new Set([
  "dataUrl",
  "resolvedUrl",
  "imageDataUrl",
  "assetMissing",
]);

const DURABLE_IMAGE_REFERENCE_KEYS = new Set([
  "src",
  "photoUrl",
  "url",
  "href",
]);

const RUNTIME_STATE_IMAGE_KEYS = new Set(["dataUrl", "imageDataUrl"]);

function sanitizeDurableImageRuntimeFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDurableImageRuntimeFields(item)) as T;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (DURABLE_RUNTIME_IMAGE_KEYS.has(key)) {
      continue;
    }
    if (DURABLE_IMAGE_REFERENCE_KEYS.has(key) && isImageDataUrl(entry)) {
      continue;
    }
    if (
      key === "json" &&
      typeof entry === "string" &&
      entry.includes("data:image")
    ) {
      try {
        next[key] = JSON.stringify(
          sanitizeDurableImageRuntimeFields(JSON.parse(entry)),
        );
      } catch {
        next[key] = entry;
      }
      continue;
    }
    next[key] = sanitizeDurableImageRuntimeFields(entry);
  }

  return next as T;
}

function sanitizeRuntimeImageStateFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRuntimeImageStateFields(item)) as T;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (RUNTIME_STATE_IMAGE_KEYS.has(key)) {
      continue;
    }
    if (DURABLE_IMAGE_REFERENCE_KEYS.has(key) && isImageDataUrl(entry)) {
      continue;
    }
    if (
      key === "json" &&
      typeof entry === "string" &&
      entry.includes("data:image")
    ) {
      try {
        next[key] = JSON.stringify(
          sanitizeRuntimeImageStateFields(JSON.parse(entry)),
        );
      } catch {
        next[key] = entry;
      }
      continue;
    }
    next[key] = sanitizeRuntimeImageStateFields(entry);
  }

  return next as T;
}

function sanitizeDurableCvDocument(doc: CvDocument): CvDocument {
  return sanitizeDurableImageRuntimeFields(doc);
}

function sanitizeRuntimeCvDocument(doc: CvDocument): CvDocument {
  return sanitizeRuntimeImageStateFields(doc);
}

function readDecorationRuntimeDebug(doc: CvDocument | null | undefined) {
  const decoration = doc?.metadata?.documentDecoration;
  if (!decoration || typeof decoration !== "object") {
    return {
      hasDecoration: false,
      hasAssetId: false,
      hasResolvedUrl: false,
    };
  }

  return {
    hasDecoration: true,
    assetId:
      typeof decoration.assetId === "string" ? decoration.assetId : null,
    hasAssetId:
      typeof decoration.assetId === "string" && decoration.assetId.length > 0,
    hasResolvedUrl:
      typeof decoration.resolvedUrl === "string" &&
      decoration.resolvedUrl.length > 0,
    resolvedUrlPreview:
      typeof decoration.resolvedUrl === "string"
        ? decoration.resolvedUrl.slice(0, 120)
        : null,
    assetMissing: decoration.assetMissing === true,
  };
}

function canOverlayRuntimeDocumentDecoration(
  localDoc: CvDocument | null | undefined,
  remoteDoc: CvDocument | null | undefined,
): boolean {
  if (!localDoc || !remoteDoc) return false;
  if (String(localDoc.id) !== String(remoteDoc.id)) return false;

  const localDecoration = localDoc.metadata?.documentDecoration;
  const remoteDecoration = remoteDoc.metadata?.documentDecoration;
  if (!localDecoration || !remoteDecoration) return false;
  if (localDecoration.visible !== true) return false;
  if (!localDecoration.assetId) return false;
  if (localDecoration.dataUrl || localDecoration.resolvedUrl) return false;
  if (remoteDecoration.assetId !== localDecoration.assetId) return false;
  return Boolean(remoteDecoration.resolvedUrl || remoteDecoration.assetMissing);
}

function overlayRuntimeDocumentDecoration(
  localDoc: CvDocument,
  remoteDoc: CvDocument,
): CvDocument {
  const localDecoration = localDoc.metadata?.documentDecoration ?? {};
  const remoteDecoration = remoteDoc.metadata?.documentDecoration ?? {};
  return {
    ...localDoc,
    metadata: {
      ...(localDoc.metadata ?? {}),
      documentDecoration: {
        ...localDecoration,
        resolvedUrl: remoteDecoration.resolvedUrl,
        assetMissing: remoteDecoration.assetMissing,
        mimeType: localDecoration.mimeType ?? remoteDecoration.mimeType,
        fileName: localDecoration.fileName ?? remoteDecoration.fileName,
      },
    },
  };
}

function sanitizeDurableVisualMetadataPatch(
  patch: CvVisualMetadataPatch,
): CvVisualMetadataPatch {
  return sanitizeDurableImageRuntimeFields(patch);
}

function applyAutoTitleIfPlaceholder(doc: CvDocument): CvDocument {
  if (doc.metadata?.titleLocked === true) return doc;
  if (!isPlaceholderCvTitle(doc.title)) return doc;
  const derived = deriveCvTitleCandidateFromSections(doc.sections);
  if (!derived || derived === doc.title) return doc;
  return { ...doc, title: derived };
}

function applyManualTitle(doc: CvDocument, newTitle: string): CvDocument {
  return {
    ...doc,
    title: newTitle,
    metadata: {
      ...(doc.metadata ?? {}),
      updatedAt: new Date().toISOString(),
      titleLocked: true,
    },
  };
}

function readUpdatedAtMs(doc: CvDocument | null | undefined): number | null {
  const value = doc?.metadata?.updatedAt;
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function collectTextContent(value: unknown, sink: string[]): void {
  if (typeof value === "string") {
    const compact = value.replace(/\s+/g, " ").trim();
    if (compact) sink.push(compact);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectTextContent(entry, sink));
    return;
  }

  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    if (typeof objectValue.text === "string") {
      collectTextContent(objectValue.text, sink);
      return;
    }

    Object.entries(objectValue).forEach(([key, entry]) => {
      if (key === "type" || key === "id" || key === "attrs") {
        return;
      }
      collectTextContent(entry, sink);
    });
  }
}

function hasTextContent(value: unknown): boolean {
  const fragments: string[] = [];
  collectTextContent(value, fragments);
  return fragments.some((fragment) => fragment.length > 0);
}

function isProfileStructuredItem(value: unknown): value is IProfileItem {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasMeaningfulCvContent(doc: CvDocument | null): boolean {
  if (!doc) return false;
  if (!isPlaceholderCvTitle(doc.title)) return true;
  if (deriveCvTitleCandidateFromSections(doc.sections)) return true;

  for (const section of doc.sections ?? []) {
    const structured = Array.isArray(section.structuredContent)
      ? section.structuredContent
      : [];

    if (section.type === "profile") {
      const profileItems = structured.filter(isProfileStructuredItem);
      if (
        profileItems.some((item) =>
          [
            item?.name,
            item?.email,
            item?.phone,
            item?.linkedin,
            item?.website,
            item?.desiredPosition,
            item?.location,
          ].some((value) => String(value ?? "").trim().length > 0),
        )
      ) {
        return true;
      }
    }

    if (section.type === "summary") {
      if (structured.some((item) => hasTextContent((item as any)?.summary))) {
        return true;
      }
    }

    if (section.type === "experience") {
      if (
        structured.some((item) => {
          const experience = item as Record<string, unknown>;
          return (
            String(experience.company ?? "").trim().length > 0 ||
            String(experience.position ?? "").trim().length > 0 ||
            String(experience.location ?? "").trim().length > 0 ||
            hasTextContent(experience.responsibilities) ||
            (Array.isArray(experience.achievements) &&
              experience.achievements.some((entry) => hasTextContent(entry))) ||
            (typeof experience.startDate === "string" &&
              experience.startDate !== "1970-01-01T00:00:00.000Z") ||
            experience.endDate !== null ||
            experience.isCurrent === true ||
            experience.currentlyWorking === true
          );
        })
      ) {
        return true;
      }
    }

    if (section.type === "education") {
      if (
        structured.some((item) => {
          const education = item as Record<string, unknown>;
          return (
            String(education.institution ?? "").trim().length > 0 ||
            String(education.degree ?? "").trim().length > 0 ||
            String(education.fieldOfStudy ?? "").trim().length > 0 ||
            String(education.grade ?? "").trim().length > 0 ||
            hasTextContent(education.description) ||
            Boolean(education.startDate) ||
            Boolean(education.endDate) ||
            education.isCurrent === true
          );
        })
      ) {
        return true;
      }
    }

    if (section.type === "skills" || section.type === "languages") {
      if (
        structured.some(
          (item) =>
            String((item as Record<string, unknown>).name ?? "").trim().length >
            0,
        )
      ) {
        return true;
      }
    }

    if (section.type === "achievements") {
      if (structured.some((item) => hasTextContent(item))) {
        return true;
      }
    }

    if (Array.isArray(section.blocks)) {
      const hasMeaningfulBlock = section.blocks.some((block) => {
        const plainText = String(block.plainText ?? "").trim();
        return plainText.length > 0 || hasTextContent(block.content);
      });
      if (hasMeaningfulBlock) {
        return true;
      }
    }
  }

  return false;
}

type CvLibraryIndexEntry = {
  id: string;
  title: string;
  metadata?: CvDocument["metadata"] & {
    librarySummaryOnly?: boolean;
  };
  profilePreview?: Record<string, unknown> | null;
};

function buildProfilePreviewFromDocument(
  doc: CvDocument,
): Record<string, unknown> | null {
  const profileSection = Array.isArray(doc.sections)
    ? doc.sections.find((section) => section.type === "profile")
    : null;
  const profileItem = Array.isArray(profileSection?.structuredContent)
    ? (profileSection.structuredContent[0] as
        | Record<string, unknown>
        | undefined)
    : undefined;

  if (!profileItem) {
    return null;
  }

  const preview = {
    name: profileItem.name,
    desiredPosition: profileItem.desiredPosition ?? profileItem.title,
    email: profileItem.email,
    linkedin: profileItem.linkedin,
    website: profileItem.website,
    phone: profileItem.phone,
  };

  return Object.values(preview).some(
    (value) => String(value ?? "").trim().length > 0,
  )
    ? preview
    : null;
}

function buildCvLibraryIndexEntry(doc: CvDocument): CvLibraryIndexEntry {
  return {
    id: String(doc.id),
    title: String(doc.title ?? "Untitled CV"),
    metadata: {
      ...(doc.metadata ?? {}),
      librarySummaryOnly: true,
    },
    profilePreview: buildProfilePreviewFromDocument(doc),
  };
}

function inflateCvLibraryIndexEntry(entry: CvLibraryIndexEntry): CvDocument {
  const now = new Date().toISOString();
  const profilePreview = entry.profilePreview;
  const profileSection =
    profilePreview &&
    Object.values(profilePreview).some(
      (value) => String(value ?? "").trim().length > 0,
    )
      ? [
          {
            id: `profile-${entry.id}`,
            type: "profile",
            title: "Profile",
            blocks: [],
            structuredContent: [
              {
                id: `profile-item-${entry.id}`,
                ...profilePreview,
              },
            ],
          } as CvSection,
        ]
      : [];

  return {
    id: entry.id,
    title: entry.title,
    metadata: {
      createdAt: entry.metadata?.createdAt ?? now,
      updatedAt: entry.metadata?.updatedAt ?? now,
      version: entry.metadata?.version ?? 1,
      ...(entry.metadata ?? {}),
      librarySummaryOnly: true,
    } as CvDocument["metadata"],
    sections: profileSection,
  };
}

function isCvLibraryIndexEntry(value: unknown): value is CvLibraryIndexEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    !Array.isArray(item.sections)
  );
}

function isLibrarySummaryOnlyCv(doc: CvDocument | null): boolean {
  return Boolean(
    (doc?.metadata as { librarySummaryOnly?: boolean } | undefined)
      ?.librarySummaryOnly,
  );
}

function expandLibrarySummaryOnlyCv(doc: CvDocument): CvDocument {
  const template = generateCvTemplateV1(doc.title);
  const metadata = doc.metadata ?? template.metadata;
  const { librarySummaryOnly: _librarySummaryOnly, ...restMetadata } =
    (metadata as { librarySummaryOnly?: boolean } & CvDocument["metadata"]) ??
    template.metadata;

  const existingProfileSection = Array.isArray(doc.sections)
    ? doc.sections.find((section) => String(section.type) === "profile")
    : undefined;
  const existingProfileItem = Array.isArray(
    existingProfileSection?.structuredContent,
  )
    ? existingProfileSection.structuredContent.find(isProfileStructuredItem)
    : undefined;

  const mergedSections = template.sections.map((section) => {
    if (String(section.type) !== "profile" || !existingProfileItem) {
      return section;
    }

    const templateProfileItem = Array.isArray(section.structuredContent)
      ? section.structuredContent.find(isProfileStructuredItem)
      : undefined;
    if (!templateProfileItem) {
      return section;
    }

    return {
      ...section,
      structuredContent: [
        {
          ...templateProfileItem,
          ...existingProfileItem,
          id:
            (existingProfileItem as { id?: string } | undefined)?.id ??
            templateProfileItem.id,
        },
      ],
    } as CvSection;
  });

  return {
    ...template,
    id: doc.id,
    title: doc.title,
    metadata: {
      ...template.metadata,
      ...restMetadata,
      createdAt: restMetadata.createdAt ?? template.metadata.createdAt,
      updatedAt: restMetadata.updatedAt ?? template.metadata.updatedAt,
      version: restMetadata.version ?? template.metadata.version,
    },
    sections: mergedSections,
    tags: doc.tags ?? template.tags,
    summary: doc.summary ?? template.summary,
  };
}

function buildRemoteLibrarySummary(
  profile: Record<string, unknown>,
): CvDocument | null {
  const embeddedDocument = profile.cvDocument;
  let sourceDocument: CvDocument | null = null;

  if (embeddedDocument && typeof embeddedDocument === "object") {
    const embeddedResult = safeParseCvDocument(embeddedDocument);
    if (embeddedResult.ok) {
      sourceDocument = embeddedResult.value;
    }
  }

  if (!sourceDocument) {
    const forcedId =
      typeof profile.profileId === "string" &&
      profile.profileId.trim().length > 0
        ? profile.profileId
        : typeof profile._id === "string"
          ? profile._id
          : undefined;
    sourceDocument = mapProfileToCvDocument(profile, forcedId);
  }

  if (!sourceDocument) {
    return null;
  }

  return sourceDocument;
}

/**
 * Context shape for the new CV library using CvDocument + ConvexStorageAdapter.
 */
export interface ICvLibraryContext {
  cvs: CvDocument[];
  currentCv: CvDocument | null;
  /** Back-compat id exposure for older tests */
  currentCvId: string | null;
  isLoading: boolean;
  // True once the library has fully resolved its authoritative source:
  // - signed-out users: immediately after auth resolves
  // - signed-in users: after the remote profile list query completes
  //   (regardless of outcome — success or error)
  // Use this to avoid first-render flash on onboarding/empty-state gates.
  isLibraryHydrated: boolean;
  // True when the last remote authoritative fetch errored. A transient fetch
  // failure must NOT be treated as "new user / empty library" by consumers
  // making onboarding or empty-state decisions.
  lastLibraryFetchFailed: boolean;
  // True when the visible CV came from a source without explicit visual template
  // metadata while a stronger remote restore can still replace it.
  isVisualRestorePending: boolean;
  isDirty: boolean;
  remoteSaveStatus: RemoteSaveStatus;
  // New: runtime detector for v1-shaped documents
  isV1Active: boolean;
  // True when currentCv carries user-provided content beyond the blank template.
  hasMeaningfulContent: boolean;
  loadCv: (id: string) => boolean;
  hydrateCvDocument: (id: string) => Promise<CvDocument | null>;
  saveCurrentCv: () => Promise<void>;
  // Create a CV document from an ICvState snapshot (used by LocalBackupsPanel)
  createCvFromState: (
    state: import("../types/cv").ICvState,
    title?: string,
  ) => void;
  // Create a new CV from a built-in template
  createNewCv: (
    title?: string,
    opts?: { forceV1?: boolean; resumeTemplateId?: ResumeTemplateId },
  ) => Promise<void>;
  // Import a fully-normalized CvDocument (used by file import workflows).
  // This replaces the current CV with the provided document and schedules persistence.
  importCv: (doc: CvDocument) => Promise<void>;
  // Persist visual style metadata without sending the full cvDocument to Convex.
  saveCurrentCvStyleOnly: (
    style: VerbatiStylePreset,
    styleMetadata?: CvVisualMetadataPatch,
  ) => Promise<void>;
  // Atomic actions for block-based editor
  updateSectionTitle: (sectionId: string, newTitle: string) => void;
  updateBlockTitle: (
    sectionId: string,
    blockId: string,
    newTitle: string,
  ) => void;
  updateBlockContent: (
    sectionId: string,
    blockId: string,
    newContent: RemirrorJSON,
  ) => void;
  addBlock: (sectionId: string, block: CvBlock, index?: number) => void;
  deleteBlock: (sectionId: string, blockId: string) => void;
  reorderBlocks: (sectionId: string, newOrder: CvBlock[]) => void;
  // Reorder sections (top-level) by supplying a new ordered array of sections.
  reorderSections: (newOrder: CvSection[]) => void;
  // Add a new, empty or prefilled section to the current document
  addSection: (section: CvSection) => void;
  // Update a structured entry (experience/education) by id within a section
  updateStructuredItem: (
    sectionId: string,
    itemId: string,
    patch: Partial<Record<string, any>>,
  ) => void;

  // Back-compat provider API shims for legacy tests
  updateCurrentCv: (newState: Partial<CvDocument>) => void;
  deleteCv: (id: string) => void;
  renameCv: (id: string, newTitle: string) => void;

  // Flush: register callbacks for components to flush buffered local edits before doc mutations.
  // Legacy global-style registration (kept for compatibility)
  registerFlushCallback: (cb: () => void) => () => void;
  // Preferred: block-scoped registration
  registerBlockFlushCallback: (blockId: string, cb: () => void) => () => void;
  flushPendingEdits: () => void;

  // Inspector selection API: single top-level inspector selection so modal state
  // survives remounts of BlockRenderer (prevents inspector closing when subtree remounts).
  // `openTypedModal` is an optional hint to route Edit into typed Experience/Education modal.
  selectedInspector: {
    sectionId: string;
    blockId: string;
    block?: CvBlock;
    linkedStructured?: Record<string, any>;
    openTypedModal?: boolean;
  } | null;
  openInspector: (payload: {
    sectionId: string;
    block: CvBlock;
    linkedStructured?: Record<string, any>;
    openTypedModal?: boolean;
  }) => void;
  closeInspector: () => void;

  // active editor control (single writer)
  activeEditorBlockId: string | null;
  setActiveEditorBlockId: React.Dispatch<React.SetStateAction<string | null>>;

  // Back-compat undo/redo over legacy cvState
  canUndo?: boolean;
  canRedo?: boolean;
  undo?: () => void;
  redo?: () => void;
}

function readRequestedCvIdFromWindowLocation(): string | null {
  if (typeof window === "undefined" || !window.location) {
    return null;
  }

  try {
    if (String(window.location.pathname ?? "") !== "/cv") {
      return null;
    }

    const requestedId = String(
      new URLSearchParams(window.location.search).get("id") ?? "",
    ).trim();
    return requestedId || null;
  } catch {
    return null;
  }
}

function isCvEditorDebugEnabled(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as { __CV_EDITOR_DEBUG__?: unknown })
      .__CV_EDITOR_DEBUG__ === true
  );
}

function cvEditorDebugInfo(label: string, payload: Record<string, unknown>): void {
  if (!isCvEditorDebugEnabled()) {
    return;
  }

  console.info(label, payload);
}

function classifyRemoteSaveError(error: unknown): {
  message: string;
  reason: string;
} {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/Value is too large/i.test(message)) {
    return { message, reason: "convex_value_too_large" };
  }
  if (/not authorized to access this profile/i.test(message)) {
    return { message, reason: "unauthorized" };
  }
  return { message, reason: "remote_save_failed" };
}

function readStoredActiveCvId(): string {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return "";
    }
    return String(
      window.localStorage.getItem(ACTIVE_CV_STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_ACTIVE_CV_STORAGE_KEY) ??
        "",
    ).trim();
  } catch {
    return "";
  }
}

function writeStoredActiveCvId(id: string | null): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    const cleanId = String(id ?? "").trim();
    if (!cleanId) {
      window.localStorage.removeItem(ACTIVE_CV_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_ACTIVE_CV_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(ACTIVE_CV_STORAGE_KEY, cleanId);
    window.localStorage.setItem(LEGACY_ACTIVE_CV_STORAGE_KEY, cleanId);
  } catch {
    // Active selection is a best-effort preference; storage failures must not
    // block editor rendering or document edits.
  }
}

/* Debounce default (can be overridden via TEST_DEBOUNCE_MS env var) */
const _envDebounce =
  (typeof globalThis !== "undefined" &&
    (globalThis as any).process?.env?.TEST_DEBOUNCE_MS) ??
  (typeof process !== "undefined"
    ? (process as any).env?.TEST_DEBOUNCE_MS
    : undefined) ??
  "1000";
const DEBOUNCE_MS = Number(_envDebounce) || 1000;

/* generateCvTemplate moved to src/lib/cv-template.ts — use the exported generateCvTemplate function */

const CvLibraryContext = createContext<ICvLibraryContext | undefined>(
  undefined,
);

/**
 * Small safe JSON parse helper for arrays of potential CvDocument objects from localStorage.
 */
function safeParseDocuments(raw: string | null): CvDocument[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: CvDocument[] = [];
    for (const item of parsed) {
      const res = safeParseCvDocument(item);
      if (res.ok) out.push(res.value);
      else {
        if (isCvLibraryIndexEntry(item)) {
          out.push(inflateCvLibraryIndexEntry(item));
          continue;
        }
        // best-effort: attempt to coerce minimal shape if it looks similar
        if (item && typeof item === "object" && typeof item.id === "string") {
          out.push({
            id: String(item.id),
            title: String(item.title ?? "Untitled CV"),
            metadata: item.metadata ?? {
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              version: 1,
            },
            sections: Array.isArray(item.sections) ? item.sections : [],
            tags: Array.isArray(item.tags) ? item.tags : undefined,
            summary: item.summary ?? undefined,
          } as CvDocument);
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Migrate legacy prefixed IDs (sec- / blk- / st- / sum-) to UUIDs for loaded documents.
 * This is necessary because older persisted documents may contain Date.now()-based ids
 * that cause remount churn and unstable React keys. The migration is conservative:
 * - replaces section ids beginning with "sec-" with a uuid
 * - replaces block ids beginning with "blk-" with a uuid
 * - replaces structured item ids starting with "st-" or "sum-" with a uuid
 *
 * Returns a new CvDocument (shallow-cloned) with ids remapped. This runs on load to
 * transparently repair legacy documents in localStorage or backend fallbacks.
 */
function migrateLegacyIds(doc: CvDocument): CvDocument {
  try {
    if (!doc || !Array.isArray(doc.sections)) return doc;
    const sectionIdMap = new Map<string, string>();
    const blockIdMap = new Map<string, string>();
    const itemIdMap = new Map<string, string>();

    const migratedSections = doc.sections.map((s) => {
      const rawSid = String(s.id ?? "");
      const sid = /^sec-/.test(rawSid) ? uuidv4() : rawSid || uuidv4();
      sectionIdMap.set(rawSid, sid);

      const migratedBlocks = (s.blocks ?? []).map((b) => {
        const rawBid = String((b as any).id ?? "");
        const bid = /^blk-/.test(rawBid) ? uuidv4() : rawBid || uuidv4();
        blockIdMap.set(rawBid, bid);

        // Clone attributes but remap linkedStructuredId if it uses legacy prefixes.
        const attrs = (b as any).attributes
          ? { ...(b as any).attributes }
          : undefined;
        if (attrs && typeof attrs.linkedStructuredId === "string") {
          const rawLinked = String(attrs.linkedStructuredId);
          if (/^(st-|sum-)/.test(rawLinked)) {
            const newItemId = uuidv4();
            itemIdMap.set(rawLinked, newItemId);
            attrs.linkedStructuredId = newItemId;
          }
        }
        return { ...(b as any), id: bid, attributes: attrs } as CvBlock;
      });

      // Migrate structuredContent item ids if present
      let migratedStructured: any = s.structuredContent;
      if (Array.isArray(s.structuredContent)) {
        migratedStructured = (s.structuredContent as any[]).map((it) => {
          const rawItemId = String(it?.id ?? "");
          const itemId =
            /^(st-|sum-)/.test(rawItemId) || rawItemId === ""
              ? uuidv4()
              : rawItemId;
          if (rawItemId && itemId !== rawItemId)
            itemIdMap.set(rawItemId, itemId);
          return { ...(it ?? {}), id: itemId };
        });
      }

      return {
        ...(s as any),
        id: sid,
        blocks: migratedBlocks,
        structuredContent: migratedStructured,
      } as CvSection;
    });

    // If any mappings existed, return the migrated doc
    if (sectionIdMap.size || blockIdMap.size || itemIdMap.size) {
      const migrated: CvDocument = { ...doc, sections: migratedSections };
      dbg("[CvLibraryContext] migrateLegacyIds applied", {
        originalIdCount: {
          sections: sectionIdMap.size,
          blocks: blockIdMap.size,
          items: itemIdMap.size,
        },
      });
      return migrated;
    }
  } catch {
    // noop - on error, return original doc
  }
  return doc;
}

/**
 * Provider implementing the new CV library backed by ConvexStorageAdapter.
 * Responsibilities:
 * - maintain in-memory list of CvDocument (cvs) and the active currentCv
 * - provide loadCv which uses adapter.load(id) with localStorage fallback
 * - provide saveCurrentCv which uses adapter.save(cv) with debouncing and local cache
 */
export const CvLibraryProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const {
    isAuthenticated: isConvexAuthenticated,
    isLoading: isConvexAuthLoading,
  } = useConvexAuth();
  const canUseRemoteCv =
    Boolean(isAuthLoaded) &&
    Boolean(isSignedIn) &&
    Boolean(isConvexAuthenticated) &&
    !isConvexAuthLoading;
  const canUseRemoteCvRef = useRef(canUseRemoteCv);
  useEffect(() => {
    canUseRemoteCvRef.current = canUseRemoteCv;
  }, [canUseRemoteCv]);
  const adapter = useConvexStorageAdapter(() => canUseRemoteCvRef.current);
  const setActiveCvSnapshot = useMutation(api.activeCvSnapshots.setCurrent);

  const [cvs, setCvs] = useState<CvDocument[]>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw =
          window.localStorage.getItem(LOCAL_CV_LIBRARY_STORAGE_KEY) ??
          window.localStorage.getItem(LEGACY_LOCAL_CV_LIBRARY_STORAGE_KEY);
        return safeParseDocuments(raw);
      }
    } catch {
      // ignore storage errors — fallback to empty list
    }
    return [];
  });

  const [currentCv, setCurrentCv] = useState<CvDocument | null>(null);
  const hasHydratedActiveCvRef = useRef(false);
  const hasHydratedRemoteLibraryRef = useRef(false);
  const [isLibraryHydrated, setIsLibraryHydrated] = useState(false);
  // Distinct from isLibraryHydrated: tracks whether the remote authoritative
  // fetch errored on its last attempt. A transient failure must NOT be treated
  // as "new user empty library" by consumers making onboarding decisions.
  const [lastLibraryFetchFailed, setLastLibraryFetchFailed] = useState(false);
  const [isVisualRestorePending, setIsVisualRestorePending] = useState(false);
  const [remoteSaveStatus, setRemoteSaveStatus] = useState<RemoteSaveStatus>({
    status: "idle",
  });
  const pendingActiveRestoreIdRef = useRef<string | null>(null);
  const failedActiveRestoreIdsRef = useRef<Set<string>>(new Set());
  const routeRemoteRefreshKeyRef = useRef<string | null>(null);
  const cvsRef = useRef<CvDocument[]>(cvs);
  const currentCvRef = useRef<CvDocument | null>(null);
  const pendingSwitchTargetRef = useRef<string | null>(null);
  const activeLoadTargetRef = useRef<string | null>(null);
  const activeCvSnapshotSyncTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const lastSyncedActiveCvSnapshotRef = useRef<
    ActiveCvSnapshot | null | undefined
  >(undefined);

  // Derived runtime detector: treat a document as v1-active when all top-level sections
  // match the canonical v1-full set. Memoized to avoid recomputation on every render.
  const isV1Active = useMemo(() => {
    try {
      return Boolean(
        currentCv &&
          Array.isArray(currentCv.sections) &&
          currentCv.sections.length > 0 &&
          currentCv.sections.every((s: any) =>
            [
              "profile",
              "summary",
              "experience",
              "achievements",
              "education",
              "skills",
              "languages",
            ].includes(String((s as any)?.type)),
          ),
      );
    } catch {
      return false;
    }
  }, [currentCv]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    cvsRef.current = cvs;
  }, [cvs]);

  useEffect(() => {
    if (!isSignedIn) {
      hasHydratedRemoteLibraryRef.current = false;
      setIsLibraryHydrated(false);
      setLastLibraryFetchFailed(false);
    }
  }, [isSignedIn]);

  // Mark library hydrated once auth is resolved; for signed-out users this is
  // immediate (no remote fetch), for signed-in users this flips after the
  // remote list resolves in the effect below.
  useEffect(() => {
    if (!isAuthLoaded) return;
    if (!isSignedIn) {
      setIsLibraryHydrated(true);
      setLastLibraryFetchFailed(false);
    }
  }, [isAuthLoaded, isSignedIn]);

  useEffect(() => {
    if (
      !isAuthLoaded ||
      !isSignedIn ||
      isConvexAuthLoading ||
      !isConvexAuthenticated ||
      hasHydratedRemoteLibraryRef.current
    ) {
      return;
    }

    let cancelled = false;
    let fetchFailed = false;

    void (async () => {
      try {
        const remoteProfiles = await convexClient.query(
          api.profilesPublic.listMine,
          { includeCvDocument: true },
        );
        if (
          cancelled ||
          !Array.isArray(remoteProfiles) ||
          remoteProfiles.length === 0
        ) {
          return;
        }

        const remoteDocs = remoteProfiles
          .map((profile) =>
            buildRemoteLibrarySummary(profile as Record<string, unknown>),
          )
          .filter((doc): doc is CvDocument => Boolean(doc));

        if (cancelled || remoteDocs.length === 0) {
          return;
        }

        setCvs((prev) => {
          const byId = new Map(prev.map((doc) => [String(doc.id), doc]));
          let changed = false;

          remoteDocs.forEach((remoteDoc) => {
            const existing = byId.get(String(remoteDoc.id));
            if (!existing) {
              byId.set(String(remoteDoc.id), remoteDoc);
              changed = true;
              return;
            }

            if (isLibrarySummaryOnlyCv(existing)) {
              byId.set(String(remoteDoc.id), remoteDoc);
              changed = true;
            }
          });

          return changed ? Array.from(byId.values()) : prev;
        });
      } catch (error) {
        fetchFailed = true;
        dbg("[CvLibraryContext] remote library hydration failed", error);
      } finally {
        if (!cancelled) {
          hasHydratedRemoteLibraryRef.current = true;
          setLastLibraryFetchFailed(fetchFailed);
          setIsLibraryHydrated(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isAuthLoaded,
    isSignedIn,
    isConvexAuthenticated,
    isConvexAuthLoading,
  ]);

  useEffect(() => {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return;
      }

      const currentLibraryRaw = window.localStorage.getItem(
        LOCAL_CV_LIBRARY_STORAGE_KEY,
      );
      const legacyLibraryRaw = window.localStorage.getItem(
        LEGACY_LOCAL_CV_LIBRARY_STORAGE_KEY,
      );

      if (!currentLibraryRaw && legacyLibraryRaw) {
        window.localStorage.setItem(
          LOCAL_CV_LIBRARY_STORAGE_KEY,
          legacyLibraryRaw,
        );
      }
      if (legacyLibraryRaw) {
        window.localStorage.removeItem(LEGACY_LOCAL_CV_LIBRARY_STORAGE_KEY);
      }

      const knownIds = new Set(
        safeParseDocuments(
          window.localStorage.getItem(LOCAL_CV_LIBRARY_STORAGE_KEY) ??
            legacyLibraryRaw,
        ).map((doc) => String(doc.id)),
      );

      for (const id of knownIds) {
        const currentDocKey = getLocalCvDocumentStorageKey(id);
        const legacyDocKey = getLegacyLocalCvDocumentStorageKey(id);
        const currentRaw = window.localStorage.getItem(currentDocKey);
        const legacyRaw = window.localStorage.getItem(legacyDocKey);

        if (!currentRaw && legacyRaw) {
          window.localStorage.setItem(currentDocKey, legacyRaw);
        }
        if (legacyRaw) {
          window.localStorage.removeItem(legacyDocKey);
        }
      }

      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key || !key.startsWith(LEGACY_LOCAL_CV_DOC_STORAGE_KEY_PREFIX)) {
          continue;
        }

        const id = key.slice(LEGACY_LOCAL_CV_DOC_STORAGE_KEY_PREFIX.length);
        const currentDocKey = getLocalCvDocumentStorageKey(id);
        const currentRaw = window.localStorage.getItem(currentDocKey);
        const legacyRaw = window.localStorage.getItem(key);

        if (!legacyRaw) {
          continue;
        }

        if (!currentRaw) {
          window.localStorage.setItem(currentDocKey, legacyRaw);
        }
        window.localStorage.removeItem(key);
      }
    } catch {
      // Best-effort storage cleanup only.
    }
  }, []);

  // Top-level inspector selection — kept in context so modal stays mounted even
  // when BlockRenderer subtrees remount (prevents inspector losing local state).
  const [selectedInspector, setSelectedInspector] = useState<{
    sectionId: string;
    blockId: string;
    block?: CvBlock;
    linkedStructured?: Record<string, any>;
    openTypedModal?: boolean;
  } | null>(null);

  const openInspector = useCallback(
    (payload: {
      sectionId: string;
      block: CvBlock;
      linkedStructured?: Record<string, any>;
      openTypedModal?: boolean;
    }) => {
      try {
        const linkedIdAttr = (() => {
          try {
            return (
              (payload.block as any)?.attributes?.linkedStructuredId ??
              (payload.block as any)?.attributes?.linkedstructuredid ??
              null
            );
          } catch {
            return null;
          }
        })();

        // Resolve latest block and owning section from currentCv to avoid stale references
        let effectiveSectionId: string = payload.sectionId;
        let effectiveBlock: CvBlock = payload.block;
        const blockIdStr = String((payload.block as any)?.id ?? "");

        if (currentCv && blockIdStr) {
          for (const s of currentCv.sections ?? []) {
            const found = (s.blocks ?? []).find(
              (b: any) => String(b?.id) === blockIdStr,
            );
            if (found) {
              effectiveSectionId = String(s.id);
              effectiveBlock = found as CvBlock;
              break;
            }
          }
        }

        // Resolve the linked structured item from the live document by id when possible
        // to avoid passing a stale object reference from callers. Fallback to payload when not found.
        let effectiveLinked: Record<string, any> | undefined = undefined;
        if (linkedIdAttr && currentCv && Array.isArray(currentCv.sections)) {
          for (const s of currentCv.sections) {
            const list = (s as any)?.structuredContent;
            if (!Array.isArray(list)) continue;
            const found = (list as any[]).find(
              (it) =>
                String((it as any)?.id ?? (it as any)?._id) ===
                String(linkedIdAttr),
            );
            if (found) {
              effectiveLinked = found as any;
              break;
            }
          }
        }
        if (!effectiveLinked) {
          effectiveLinked = payload.linkedStructured as any;
        }

        const preferTypedModal = Boolean((payload as any)?.openTypedModal);

        dbg("[CvLibraryContext] openInspector", {
          requestedSectionId: payload.sectionId,
          resolvedSectionId: effectiveSectionId,
          requestedBlockId: payload.block?.id,
          resolvedBlockId: (effectiveBlock as any)?.id,
          resolvedLinked: Boolean(effectiveLinked),
          linkedIdAttr,
          effectiveLinkedKeys: effectiveLinked
            ? Object.keys(effectiveLinked).slice(0, 12)
            : null,
          preferTypedModal,
        });

        setSelectedInspector({
          sectionId: effectiveSectionId,
          blockId: String((effectiveBlock as any)?.id ?? ""),
          block: effectiveBlock,
          linkedStructured: effectiveLinked,
          openTypedModal: preferTypedModal,
        });
      } catch {
        setSelectedInspector({
          sectionId: payload.sectionId,
          blockId: String((payload.block as any)?.id ?? ""),
          block: payload.block,
          linkedStructured: payload.linkedStructured,
          openTypedModal: Boolean((payload as any)?.openTypedModal),
        });
      }
    },
    [currentCv],
  );

  const closeInspector = useCallback(() => {
    dbg("[CvLibraryContext] closeInspector");
    setSelectedInspector(null);
  }, []);

  /**
   * Update currentCv only when the incoming value differs from existing to avoid
   * redundant re-renders that can steal focus from inputs.
   */
  function safeSetCurrentCv(next: CvDocument | null) {
    /**
     * Attempt to preserve object identity for unchanged nested objects (sections/blocks)
     * so React does not remount large subtrees unnecessarily.
     */
    if (next?.id) {
      writeStoredActiveCvId(String(next.id));
    }
    if (!next || readAnyResumeTemplateId(next)) {
      setIsVisualRestorePending(false);
    }
    currentCvRef.current = next;
    setCurrentCv((prev) => {
      if (deepEqual(prev, next)) {
        dbg(
          "[CvLibraryContext] safeSetCurrentCv: documents deeply equal -> reusing prev",
        );
        return prev;
      }
      try {
        dbg("[CvLibraryContext] safeSetCurrentCv called", {
          prevId: prev?.id ?? null,
          nextId: next?.id ?? null,
        });

        if (prev === null && next === null) {
          dbg("[CvLibraryContext] safeSetCurrentCv: both null, returning prev");
          return prev;
        }
        if (prev === null && next !== null) {
          dbg(
            "[CvLibraryContext] safeSetCurrentCv: prev null, next non-null, returning next",
          );
          return next;
        }
        if (next === null && prev !== null) {
          dbg(
            "[CvLibraryContext] safeSetCurrentCv: next null, prev non-null, returning null",
          );
          return null;
        }

        // Both non-null: if deeply equal, reuse previous reference.
        if (deepEqual(prev, next)) {
          dbg(
            "[CvLibraryContext] safeSetCurrentCv: documents deeply equal -> reusing prev",
          );
          return prev;
        }
        // Helper: preserve block identity where possible.
        function mergeBlocks(
          prevBlocks: CvBlock[] = [],
          nextBlocks: CvBlock[] = [],
        ) {
          const out: CvBlock[] = [];
          for (const nb of nextBlocks) {
            const pb = prevBlocks.find((p) => String(p.id) === String(nb.id));
            if (pb && deepEqual(pb, nb)) out.push(pb);
            else if (pb && typeof nb === "object" && typeof pb === "object") {
              // Merge block shallowly but attempt to reuse unchanged nested props.
              const mergedBlock: CvBlock = {
                ...nb,
                // prefer prev content if equal otherwise keep next's content
                content: deepEqual(pb.content, nb.content)
                  ? pb.content
                  : nb.content,
                plainText: deepEqual(pb.plainText, nb.plainText)
                  ? pb.plainText
                  : nb.plainText,
                attributes: deepEqual(pb.attributes, nb.attributes)
                  ? pb.attributes
                  : nb.attributes,
              };
              out.push(mergedBlock);
            } else {
              out.push(nb);
            }
          }
          return out;
        }

        // Merge sections preserving identity when possible.
        const mergedSections = (next!.sections ?? []).map((ns) => {
          const ps = (prev!.sections ?? []).find(
            (s) => String(s.id) === String(ns.id),
          );
          if (!ps) return ns;
          if (deepEqual(ps, ns)) {
            return ps;
          }
          // Create merged section, preserving block identities where possible.
          const mergedSection: CvSection = {
            ...ns,
            blocks: mergeBlocks(ps.blocks ?? [], ns.blocks ?? []),
            structuredContent:
              ps.structuredContent &&
              ns.structuredContent &&
              deepEqual(ps.structuredContent, ns.structuredContent)
                ? ps.structuredContent
                : ns.structuredContent,
            collapsed: ns.collapsed ?? ps.collapsed,
            order: ns.order ?? ps.order,
          } as CvSection;
          return mergedSection;
        });

        const merged: CvDocument = {
          ...next!,
          sections: mergedSections,
        };

        dbg("[CvLibraryContext] safeSetCurrentCv produced merged document", {
          prevSections: prev!.sections.length,
          nextSections: next!.sections.length,
          mergedSections: mergedSections.length,
        });

        return merged;
      } catch (err) {
        // if anything goes wrong fall back to assigning next (safe).
        // eslint-disable-next-line no-console
        console.warn(
          "[CvLibraryContext] safeSetCurrentCv merge failed, falling back",
          err,
        );
        return next;
      }
    });
  }

  // Track last saved snapshot for dirty detection.
  const lastSavedRef = useRef<CvDocument | null>(null);
  const isDirtyRef = useRef<boolean>(false);
  const pendingRemoteSaveRef = useRef<CvDocument | null>(null);

  // Debounce machinery for saves
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSavePromiseRef = useRef<Promise<void> | null>(null);
  // Guard to indicate an in-flight save (prevents re-entrant scheduling while adapter.save is running)
  const isSavingRef = useRef<boolean>(false);

  /**
   * Helper: produce a content-only snapshot of a document which excludes the volatile
   * `metadata` field. This prevents metadata bumps (updatedAt/version) from being
   * considered as content changes in dirty detection.
   */
  function stripMetadata(doc: CvDocument | null): unknown {
    if (!doc) return null;
    // Return a shallow copy without volatile fields (metadata).
    // Do not strip legacy cvState because dirty detection should reflect cvState changes.
    const { metadata: _meta, ...rest } = doc as any;
    return rest;
  }

  function readExplicitResumeTemplateId(
    doc: CvDocument | null | undefined,
  ): ResumeTemplateId | undefined {
    return sanitizeResumeTemplateId(doc?.metadata?.resumeTemplateId);
  }

  function sanitizeResumeTemplateId(value: unknown): ResumeTemplateId | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    return isResumeTemplateId(value as ResumeTemplateId)
      ? (value as ResumeTemplateId)
      : undefined;
  }

  function readAnyResumeTemplateId(
    doc: CvDocument | null | undefined,
  ): ResumeTemplateId | undefined {
    const metadata = doc?.metadata;
    const explicit = readExplicitResumeTemplateId(doc);
    if (explicit) return explicit;

    const verbatiTemplate =
      metadata?.verbatiStyle &&
      typeof metadata.verbatiStyle === "object" &&
      "resumeTemplateId" in metadata.verbatiStyle
        ? metadata.verbatiStyle.resumeTemplateId
        : undefined;
    const sanitizedVerbatiTemplate = sanitizeResumeTemplateId(verbatiTemplate);
    if (sanitizedVerbatiTemplate) return sanitizedVerbatiTemplate;

    const baseSnapshotTemplate =
      metadata?.verbatiStyleBaseSnapshot?.resumeTemplateId;
    return sanitizeResumeTemplateId(baseSnapshotTemplate);
  }

  function shouldHoldTemplateLessRestoreForRemote(
    doc: CvDocument | null | undefined,
    targetId?: string | null,
  ): boolean {
    if (!doc || readAnyResumeTemplateId(doc)) {
      return false;
    }

    const requestedRouteCvId = readRequestedCvIdFromWindowLocation();
    if (
      targetId &&
      requestedRouteCvId &&
      String(requestedRouteCvId) !== String(targetId)
    ) {
      return false;
    }

    return (
      !isAuthLoaded ||
      isConvexAuthLoading ||
      (Boolean(isSignedIn) && !isConvexAuthenticated) ||
      canUseRemoteCvRef.current
    );
  }

  function preserveLocalResumeTemplateWhenRemoteIsImplicit(
    remoteDoc: CvDocument,
    localDoc: CvDocument | null | undefined,
  ): CvDocument {
    if (readExplicitResumeTemplateId(remoteDoc)) {
      return remoteDoc;
    }

    const localResumeTemplateId = readAnyResumeTemplateId(localDoc);
    if (!localResumeTemplateId) {
      return remoteDoc;
    }

    const remoteMetadata = remoteDoc.metadata ?? ({} as CvDocument["metadata"]);
    return {
      ...remoteDoc,
      metadata: {
        ...remoteMetadata,
        resumeTemplateId: localResumeTemplateId,
        verbatiStyle:
          remoteMetadata.verbatiStyle &&
          typeof remoteMetadata.verbatiStyle === "object"
            ? {
                ...remoteMetadata.verbatiStyle,
                resumeTemplateId: localResumeTemplateId,
              }
            : remoteMetadata.verbatiStyle,
        verbatiStyleBaseSnapshot: remoteMetadata.verbatiStyleBaseSnapshot
          ? {
              ...remoteMetadata.verbatiStyleBaseSnapshot,
              resumeTemplateId:
                remoteMetadata.verbatiStyleBaseSnapshot.resumeTemplateId ??
                localResumeTemplateId,
            }
          : remoteMetadata.verbatiStyleBaseSnapshot,
      },
    };
  }

  function mergeRemoteVisualMetadataWhenLocalTemplateIsImplicit(
    localDoc: CvDocument,
    remoteDoc: CvDocument | null | undefined,
  ): CvDocument {
    const remoteResumeTemplateId = readAnyResumeTemplateId(remoteDoc);
    if (!remoteResumeTemplateId) {
      return localDoc;
    }
    if (readAnyResumeTemplateId(localDoc)) {
      return localDoc;
    }

    const localMetadata = localDoc.metadata ?? ({} as CvDocument["metadata"]);
    const remoteMetadata = remoteDoc?.metadata ?? ({} as CvDocument["metadata"]);
    const nextMetadata: CvDocument["metadata"] = {
      ...localMetadata,
      resumeTemplateId: remoteResumeTemplateId,
    };

    if (
      remoteMetadata.verbatiStyle &&
      typeof remoteMetadata.verbatiStyle === "object"
    ) {
      nextMetadata.verbatiStyle = {
        ...remoteMetadata.verbatiStyle,
        resumeTemplateId: remoteResumeTemplateId,
      };
    } else if (
      localMetadata.verbatiStyle &&
      typeof localMetadata.verbatiStyle === "object"
    ) {
      nextMetadata.verbatiStyle = {
        ...localMetadata.verbatiStyle,
        resumeTemplateId: remoteResumeTemplateId,
      };
    }

    if (remoteMetadata.verbatiStyleBaseSnapshot) {
      nextMetadata.verbatiStyleBaseSnapshot = {
        ...remoteMetadata.verbatiStyleBaseSnapshot,
        resumeTemplateId:
          remoteMetadata.verbatiStyleBaseSnapshot.resumeTemplateId ??
          remoteResumeTemplateId,
      };
    } else if (localMetadata.verbatiStyleBaseSnapshot) {
      nextMetadata.verbatiStyleBaseSnapshot = {
        ...localMetadata.verbatiStyleBaseSnapshot,
        resumeTemplateId:
          localMetadata.verbatiStyleBaseSnapshot.resumeTemplateId ??
          remoteResumeTemplateId,
      };
    }

    for (const key of [
      "verbatiStyleSlotId",
      "verbatiStyleSlotSource",
      "verbatiStyleSlotNameSnapshot",
      "documentStyleVersion",
      "documentIcons",
    ] as const) {
      if (remoteMetadata[key] !== undefined) {
        (nextMetadata as Record<string, unknown>)[key] = remoteMetadata[key];
      }
    }

    return {
      ...localDoc,
      metadata: nextMetadata,
    };
  }

  const FLUSH_THROTTLE_MS = 150;

  /**
   * Replace Set-based registry with a Map keyed by block id to avoid duplicate callbacks on remount.
   * Also add lightweight throttling references to prevent flush storms when many components call
   * flushPendingEdits in quick succession.
   */
  const blockFlushCallbacksRef = useRef<Map<string, Set<() => void>>>(
    new Map(),
  );
  const lastFlushAtRef = useRef<number>(0);
  const pendingFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Guard to indicate we are actively running a flush. Suppress nested flush requests
  // while callbacks are being invoked to avoid tight re-entrancy loops.
  const inFlushRef = useRef<boolean>(false);

  // Registration-burst detector (diagnostic only).
  // Follow project conventions: gate heavy work by window.__CV_EDITOR_DEBUG__ and keep the detector low-cost.
  // The detector only records counts and prunes stale entries; it does not change registration semantics.
  const REG_BURST_WINDOW_MS = 1000;
  const REG_BURST_THRESHOLD = 5;
  const REG_BURST_PRUNE_MS = REG_BURST_WINDOW_MS * 5;
  const recentRegisterCountsRef = useRef<
    Map<string, { count: number; firstTs: number }>
  >(new Map());

  // Per-key registration cooldown (diagnostic-only). When enabled via debug flag,
  // this avoids extremely tight register/unregister churn for the same key by
  // suppressing immediate re-registrations for a short interval.
  const REG_COOLDOWN_MS = 800;
  const recentRegisterCooldownRef = useRef<Map<string, number>>(new Map());

  // Lightweight detector for flushPendingEdits request bursts (diagnostic only)
  const FLUSH_REQ_WINDOW_MS = 1000;
  const FLUSH_REQ_THRESHOLD = 12;
  const recentFlushRequestsRef = useRef<{ count: number; firstTs: number }>({
    count: 0,
    firstTs: 0,
  });

  /**
   * Idempotent registration + stable identities:
   * Wrap registration and flush functions in useCallback so their references remain stable
   * across provider re-renders. This prevents consumer useEffect deps from re-running
   * solely due to changing function identity.
   */
  const registerBlockFlushCallback = useCallback(
    (blockId: string, cb: () => void): (() => void) => {
      try {
        const key = String(blockId);
        const now = Date.now();

        // Diagnostic: sliding-window registration count per key (gated by debug flag)
        const isDebug =
          typeof window !== "undefined" &&
          (window as any).__CV_EDITOR_DEBUG__ === true;

        try {
          if (isDebug) {
            const counts = recentRegisterCountsRef.current;
            // Prune stale entries occasionally to avoid unbounded map growth
            for (const [k, v] of counts) {
              if (now - v.firstTs > REG_BURST_PRUNE_MS) counts.delete(k);
            }

            const entry = counts.get(key);
            if (!entry) counts.set(key, { count: 1, firstTs: now });
            else {
              if (now - entry.firstTs > REG_BURST_WINDOW_MS)
                counts.set(key, { count: 1, firstTs: now });
              else entry.count++;
            }
            const curCount = counts.get(key)?.count ?? 0;
            if (curCount > REG_BURST_THRESHOLD) {
              dbg("[CvLibraryContext] registration burst detected", {
                key,
                count: curCount,
                windowMs: REG_BURST_WINDOW_MS,
                note: "Consider debouncing registration or stabilizing effect deps in consumers",
              });
              counts.set(key, { count: 1, firstTs: now });
            }

            // Cooldown suppression (diagnostic-only)
            const cooldownMap = recentRegisterCooldownRef.current;
            const lastTs = cooldownMap.get(key) ?? 0;
            if (now - lastTs < REG_COOLDOWN_MS) {
              dbg(
                "[CvLibraryContext] registerBlockFlushCallback suppressed by cooldown",
                {
                  key,
                  sinceLastMs: now - lastTs,
                  cooldownMs: REG_COOLDOWN_MS,
                },
              );
              return () => {
                dbg("[CvLibraryContext] suppressed unregister noop", key);
              };
            }
            cooldownMap.set(key, now);
          }
        } catch {
          /* diagnostics must be non-fatal */
        }

        // Multi-subscriber registry: Map<string, Set<cb>>
        let listeners = blockFlushCallbacksRef.current.get(key);
        if (!listeners) {
          listeners = new Set<() => void>();
          blockFlushCallbacksRef.current.set(key, listeners);
        }

        if (listeners.has(cb)) {
          dbg(
            "[CvLibraryContext] registerBlockFlushCallback noop - already registered",
            {
              key,
              listeners: listeners.size,
              keys: blockFlushCallbacksRef.current.size,
            },
          );
        } else {
          listeners.add(cb);
          dbg("[CvLibraryContext] registerBlockFlushCallback add", {
            key,
            listeners: listeners.size,
            keys: blockFlushCallbacksRef.current.size,
          });
        }
      } catch {
        /* noop */
      }

      // Unregister removes only this cb; deletes key when the set becomes empty
      return () => {
        try {
          const key = String(blockId);
          const listeners = blockFlushCallbacksRef.current.get(key);
          if (!listeners) {
            dbg(
              "[CvLibraryContext] unregisterBlockFlushCallback noop - no set for key",
              key,
            );
            return;
          }
          if (listeners.delete(cb)) {
            if (listeners.size === 0) {
              blockFlushCallbacksRef.current.delete(key);
              dbg(
                "[CvLibraryContext] unregisterBlockFlushCallback deleted key",
                key,
                {
                  keys: blockFlushCallbacksRef.current.size,
                },
              );
            } else {
              dbg(
                "[CvLibraryContext] unregisterBlockFlushCallback removed listener",
                key,
                {
                  listeners: listeners.size,
                },
              );
            }
          } else {
            dbg(
              "[CvLibraryContext] unregisterBlockFlushCallback noop - listener not found",
              key,
              {
                listeners: listeners.size,
              },
            );
          }
        } catch {
          /* noop */
        }
      };
    },
    [],
  );

  // Legacy wrapper kept for backwards compatibility with existing components.
  const registerFlushCallback = useCallback(
    (cb: () => void): (() => void) => {
      // Use UUIDs for legacy wrapper keys to avoid introducing prefixed Date.now()-based ids.
      const key = uuidv4();
      return registerBlockFlushCallback(key, cb);
    },
    [registerBlockFlushCallback],
  );

  /**
   * Throttled + microtask-batched flush. Stable reference via useCallback to avoid consumer effects re-running.
   * Also includes a lightweight diagnostic to detect bursty requests to flushPendingEdits.
   */
  const flushPendingEdits = useCallback((): void => {
    try {
      // Suppress re-entrant flush requests while we're already running a flush.
      if (inFlushRef.current) {
        dbg(
          "[CvLibraryContext] flushPendingEdits suppressed - already flushing",
        );
        return;
      }

      const now = Date.now();
      const timeSinceLast = now - lastFlushAtRef.current;
      const snapshotEntries = Array.from(
        blockFlushCallbacksRef.current.entries(),
      ) as Array<[string, Set<() => void>]>;
      const totalCallbacks = snapshotEntries.reduce(
        (sum, [, set]) => sum + set.size,
        0,
      );

      // Diagnostic: count flush requests within window when dev debug flag is enabled.
      try {
        const isDebug =
          typeof window !== "undefined" &&
          (window as any).__CV_EDITOR_DEBUG__ === true;
        if (isDebug) {
          const rf = recentFlushRequestsRef.current;
          if (rf.firstTs === 0 || now - rf.firstTs > FLUSH_REQ_WINDOW_MS) {
            recentFlushRequestsRef.current = { count: 1, firstTs: now };
          } else {
            recentFlushRequestsRef.current.count++;
          }
          const cur = recentFlushRequestsRef.current.count;
          if (cur > FLUSH_REQ_THRESHOLD) {
            dbg("[CvLibraryContext] flushPendingEdits request burst detected", {
              count: cur,
              windowMs: FLUSH_REQ_WINDOW_MS,
              keys: snapshotEntries.length,
              callbacks: totalCallbacks,
              note: "Investigate callers invoking flushPendingEdits frequently (debounce caller-side)",
            });
            recentFlushRequestsRef.current = { count: 1, firstTs: now };
          }
        }
      } catch {
        /* diagnostics non-fatal */
      }

      try {
        const isDebug =
          typeof window !== "undefined" &&
          (window as any).__CV_EDITOR_DEBUG__ === true;
        let stackLines: string[] | undefined = undefined;
        if (isDebug) {
          try {
            stackLines = (new Error().stack ?? "")
              .split("\n")
              .slice(2, 8)
              .map((l) => l.trim());
          } catch {
            stackLines = undefined;
          }
        }
        dbg("[CvLibraryContext] flushPendingEdits requested", {
          requestedAt: new Date().toISOString(),
          keys: snapshotEntries.length,
          callbacks: totalCallbacks,
          timeSinceLast,
          stack: stackLines,
        });
        dbg(
          "[CvLibraryContext] flushPendingEdits keys",
          snapshotEntries.map(([id]) => id),
        );
      } catch {
        /* noop */
      }

      const performFlush = (entries: Array<[string, Set<() => void>]>) => {
        lastFlushAtRef.current = Date.now();
        if (pendingFlushTimerRef.current) {
          clearTimeout(pendingFlushTimerRef.current);
          pendingFlushTimerRef.current = null;
        }
        inFlushRef.current = true;
        queueMicrotask(() => {
          try {
            for (const [key, listeners] of entries) {
              try {
                dbg("[CvLibraryContext] flushing key", key);
                // Use a shallow copy to avoid mutation issues during iteration
                for (const cb of Array.from(listeners)) {
                  try {
                    cb();
                  } catch (err) {
                    dbg("[CvLibraryContext] flush listener error", err);
                  }
                }
              } catch (err) {
                dbg("[CvLibraryContext] flush key error", err);
              }
            }
            try {
              dbg("[CvLibraryContext] flushPendingEdits completed", {
                keysRemaining: blockFlushCallbacksRef.current.size,
                completedAt: new Date().toISOString(),
              });
            } catch {
              /* noop */
            }
          } finally {
            setTimeout(() => {
              inFlushRef.current = false;
            }, 0);
          }
        });
      };

      if (timeSinceLast < FLUSH_THROTTLE_MS) {
        if (!pendingFlushTimerRef.current) {
          const wait = FLUSH_THROTTLE_MS - timeSinceLast;
          dbg("[CvLibraryContext] flushPendingEdits throttled - scheduling", {
            waitMs: wait,
          });
          pendingFlushTimerRef.current = setTimeout(() => {
            const laterSnapshot = Array.from(
              blockFlushCallbacksRef.current.entries(),
            ) as Array<[string, Set<() => void>]>;
            pendingFlushTimerRef.current = null;
            performFlush(laterSnapshot);
          }, wait);
        } else {
          dbg(
            "[CvLibraryContext] flushPendingEdits throttled - already scheduled",
          );
        }
      } else {
        performFlush(snapshotEntries);
      }
    } catch (err) {
      dbg("[CvLibraryContext] flushPendingEdits top-level error", err);
    }
  }, []);

  // Persist library index to localStorage whenever cvs changes.
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const payload = JSON.stringify(cvs.map(buildCvLibraryIndexEntry));
        try {
          window.localStorage.setItem(LOCAL_CV_LIBRARY_STORAGE_KEY, payload);
        } catch {
          /* best-effort */
        }
        try {
          window.localStorage.removeItem(LEGACY_LOCAL_CV_LIBRARY_STORAGE_KEY);
        } catch {
          /* best-effort */
        }
      }
    } catch {
      // ignore
    }
  }, [cvs]);

  const isDirty = Boolean(
    currentCv && lastSavedRef.current
      ? !deepEqual(
          stripMetadata(currentCv),
          stripMetadata(lastSavedRef.current),
        )
      : false,
  );

  useEffect(() => {
    currentCvRef.current = currentCv;
  }, [currentCv]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    if (!currentCv || !isDirty) {
      return;
    }
    cacheDocumentLocally(currentCv);
  }, [currentCv, isDirty]);

  // --- New: active editor tracking (single-writer) ---
  const [activeEditorBlockId, setActiveEditorBlockId] = useState<string | null>(
    null,
  );
  // Back-compat: maintain per-document undo/redo stacks for legacy cvState
  const undoStackRef = useRef<Map<string, any[]>>(new Map());
  const redoStackRef = useRef<Map<string, any[]>>(new Map());

  /**
   * Persist a document to localStorage cache (best-effort).
   */
  function cacheDocumentLocally(doc: CvDocument) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const now = new Date().toISOString();
        const durableDoc = sanitizeDurableCvDocument(doc);
        const snapshot: CvDocument = {
          ...durableDoc,
          metadata: {
            ...(durableDoc.metadata ?? { createdAt: now, version: 1 }),
            createdAt: durableDoc.metadata?.createdAt ?? now,
            updatedAt: durableDoc.metadata?.updatedAt ?? now,
            version: durableDoc.metadata?.version ?? 1,
          } as any,
        };
        window.localStorage.setItem(
          getLocalCvDocumentStorageKey(doc.id),
          JSON.stringify(snapshot),
        );
        window.localStorage.removeItem(
          getLegacyLocalCvDocumentStorageKey(doc.id),
        );
      }
    } catch {
      // ignore
    }
  }

  const readCachedFullCvDocument = useCallback(
    (id: string): CvDocument | null => {
      if (typeof window === "undefined" || !window.localStorage) {
        return null;
      }

      const keys = [
        getLocalCvDocumentStorageKey(id),
        getLegacyLocalCvDocumentStorageKey(id),
      ];

      for (const key of keys) {
        try {
          const raw = window.localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const parsedResult = safeParseCvDocument(parsed);
          const doc = parsedResult.ok
            ? parsedResult.value
            : parsed &&
                typeof parsed === "object" &&
                typeof parsed.id === "string" &&
                Array.isArray(parsed.sections)
              ? (parsed as CvDocument)
              : null;
          if (doc && !isLibrarySummaryOnlyCv(doc)) {
            const durableDoc = sanitizeDurableCvDocument(doc);
            if (!deepEqual(durableDoc, doc)) {
              cacheDocumentLocally(durableDoc);
            }
            return durableDoc;
          }
        } catch {
          /* ignore malformed cached documents */
        }
      }

      return null;
    },
    [],
  );

  const normalizeHydratedCvDocument = useCallback((doc: CvDocument) => {
    let migrated = doc;
    try {
      migrated = migrateLegacyIds(doc);
    } catch {
      /* noop */
    }
    const docV1 = normalizeToV1Document(migrated);
    return sanitizeRuntimeCvDocument(ensureRepresentativeBlocks(docV1));
  }, []);

  const hydrateCvDocument = useCallback(
    async (id: string): Promise<CvDocument | null> => {
      const targetId = String(id).trim();
      if (!targetId) return null;

      const inMemoryDoc =
        currentCvRef.current && String(currentCvRef.current.id) === targetId
          ? currentCvRef.current
          : cvsRef.current.find((candidate) => String(candidate.id) === targetId) ??
            null;

      if (inMemoryDoc && !isLibrarySummaryOnlyCv(inMemoryDoc)) {
        return normalizeHydratedCvDocument(inMemoryDoc);
      }

      const cachedDoc = readCachedFullCvDocument(targetId);
      if (cachedDoc) {
        const normalized = normalizeHydratedCvDocument(cachedDoc);
        cacheDocumentLocally(normalized);
        setCvs((prev) =>
          prev.some((candidate) => String(candidate.id) === targetId)
            ? prev.map((candidate) =>
                String(candidate.id) === targetId ? normalized : candidate,
              )
            : [...prev, normalized],
        );
        return normalized;
      }

      try {
        const remoteDoc = await adapter.load(targetId);
        if (!remoteDoc || isLibrarySummaryOnlyCv(remoteDoc)) {
          return null;
        }
        const normalized = normalizeHydratedCvDocument(remoteDoc);
        cacheDocumentLocally(normalized);
        setCvs((prev) =>
          prev.some((candidate) => String(candidate.id) === targetId)
            ? prev.map((candidate) =>
                String(candidate.id) === targetId ? normalized : candidate,
              )
            : [...prev, normalized],
        );
        return normalized;
      } catch (error) {
        console.warn("[CvLibraryContext] hydrateCvDocument failed", error);
        return null;
      }
    },
    [adapter, normalizeHydratedCvDocument, readCachedFullCvDocument],
  );

  function removeDocumentLocally(id: string) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(getLocalCvDocumentStorageKey(id));
        window.localStorage.removeItem(getLegacyLocalCvDocumentStorageKey(id));
      }
    } catch {
      /* best-effort */
    }
  }

  /**
   * Immediately mirror an edited in-memory document into the active local cache.
   * This keeps proposal-generation reads fresh without waiting for the debounced save path.
   */
  function syncEditedDocumentLocally(doc: CvDocument) {
    try {
      cacheDocumentLocally(doc);
    } catch {
      /* best-effort */
    }
  }

  function hasUnsavedContent(doc: CvDocument | null): boolean {
    if (!doc) return false;
    return !deepEqual(stripMetadata(doc), stripMetadata(lastSavedRef.current));
  }

  function readCachedDocumentLocally(id: string): CvDocument | null {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      const raw = window.localStorage.getItem(getLocalCvDocumentStorageKey(id));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const parsedRes = safeParseCvDocument(parsed);
      if (parsedRes.ok) return parsedRes.value;
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.id === "string"
      ) {
        return {
          id: String(parsed.id),
          title: String(parsed.title ?? "Untitled CV"),
          metadata: (parsed as any).metadata ?? {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
          },
          sections: Array.isArray(parsed.sections) ? parsed.sections : [],
          tags: Array.isArray(parsed.tags) ? parsed.tags : undefined,
          summary: parsed.summary ?? undefined,
        } as CvDocument;
      }
    } catch {
      /* best-effort */
    }
    return null;
  }

  function getDocumentCompletenessMetrics(doc: CvDocument | null): {
    sections: number;
    blocks: number;
    structuredItems: number;
    payloadSize: number;
  } {
    if (!doc) {
      return { sections: 0, blocks: 0, structuredItems: 0, payloadSize: 0 };
    }

    let blocks = 0;
    let structuredItems = 0;
    for (const section of doc.sections ?? []) {
      blocks += Array.isArray(section.blocks) ? section.blocks.length : 0;
      structuredItems += Array.isArray((section as any)?.structuredContent)
        ? ((section as any).structuredContent as any[]).length
        : 0;
    }

    let payloadSize = 0;
    try {
      payloadSize = JSON.stringify(stripMetadata(doc)).length;
    } catch {
      payloadSize = 0;
    }

    return {
      sections: Array.isArray(doc.sections) ? doc.sections.length : 0,
      blocks,
      structuredItems,
      payloadSize,
    };
  }

  function shouldApplyBackgroundRefresh(
    targetId: string,
    localBaseline: CvDocument | null,
    remoteDoc: CvDocument | null,
  ): boolean {
    const requestedRouteCvId = readRequestedCvIdFromWindowLocation();
    if (
      requestedRouteCvId &&
      String(requestedRouteCvId) !== String(targetId)
    ) {
      dbg(
        "[CvLibraryContext] background refresh skipped: route target changed",
        {
          targetId,
          requestedRouteCvId,
        },
      );
      return false;
    }

    if (!remoteDoc) return false;

    if (String(remoteDoc.id) !== String(targetId)) {
      dbg(
        "[CvLibraryContext] background refresh skipped: adapter doc id mismatch",
        {
          targetId,
          remoteId: remoteDoc.id,
        },
      );
      return false;
    }

    const activeDoc = currentCvRef.current;
    if (activeDoc && String(activeDoc.id) !== String(targetId)) {
      dbg("[CvLibraryContext] background refresh skipped: user switched away", {
        targetId,
        activeId: activeDoc.id,
      });
      return false;
    }

    const freshestLocal =
      (activeDoc && String(activeDoc.id) === String(targetId)
        ? activeDoc
        : null) ??
      readCachedDocumentLocally(targetId) ??
      localBaseline;

    if (!freshestLocal) return true;

    const localUpdatedAtMs = readUpdatedAtMs(freshestLocal);
    const remoteUpdatedAtMs = readUpdatedAtMs(remoteDoc);
    if (
      localUpdatedAtMs !== null &&
      remoteUpdatedAtMs !== null &&
      localUpdatedAtMs > remoteUpdatedAtMs
    ) {
      dbg(
        "[CvLibraryContext] background refresh skipped: local snapshot is newer than remote",
        {
          targetId,
          localUpdatedAt: freshestLocal.metadata?.updatedAt,
          remoteUpdatedAt: remoteDoc.metadata?.updatedAt,
        },
      );
      return false;
    }

    if (deepEqual(stripMetadata(freshestLocal), stripMetadata(remoteDoc)))
      return true;

    const localMetrics = getDocumentCompletenessMetrics(freshestLocal);
    const remoteMetrics = getDocumentCompletenessMetrics(remoteDoc);
    const materiallyWeaker =
      remoteMetrics.sections < localMetrics.sections ||
      remoteMetrics.structuredItems < localMetrics.structuredItems ||
      remoteMetrics.payloadSize + 120 < localMetrics.payloadSize;

    if (materiallyWeaker) {
      dbg(
        "[CvLibraryContext] background refresh skipped: remote doc is materially weaker than local snapshot",
        {
          targetId,
          localMetrics,
          remoteMetrics,
        },
      );
      return false;
    }

    return true;
  }

  function applySkippedBackgroundRefreshVisualOverlay(
    targetCvId: string,
    localDoc: CvDocument | null | undefined,
    remoteDoc: CvDocument | null | undefined,
  ): boolean {
    if (!localDoc || !remoteDoc) {
      return false;
    }
    if (
      String(localDoc.id) !== String(remoteDoc.id) ||
      String(localDoc.id) !== String(targetCvId)
    ) {
      return false;
    }

    const runtimeOverlaid = canOverlayRuntimeDocumentDecoration(
      localDoc,
      remoteDoc,
    )
      ? overlayRuntimeDocumentDecoration(localDoc, remoteDoc)
      : localDoc;
    const overlaid = mergeRemoteVisualMetadataWhenLocalTemplateIsImplicit(
      runtimeOverlaid,
      remoteDoc,
    );
    if (deepEqual(localDoc, overlaid)) {
      return false;
    }

    safeSetCurrentCv(overlaid);
    setCvs((prev) => {
      const exists = prev.some(
        (doc) => String(doc.id) === String(overlaid.id),
      );
      if (exists) {
        return prev.map((doc) =>
          String(doc.id) === String(overlaid.id) ? overlaid : doc,
        );
      }
      return [...prev, overlaid];
    });
    cacheDocumentLocally(overlaid);
    lastSavedRef.current = overlaid;
    return true;
  }

  async function performSave(
    documentToSave: CvDocument,
    options?: {
      preserveVisibleUpdatedAt?: boolean;
      preserveVisibleUpdatedAtValue?: string;
    },
  ): Promise<void> {
    cvEditorDebugInfo("[cv-save-debug] performSave", {
      docId: documentToSave.id,
      routeProfileId: readRequestedCvIdFromWindowLocation(),
      dirty: isDirtyRef.current,
    });

    try {
      // Ensure metadata exists and bump updatedAt/version conservatively
      // Strip legacy cvState before persisting to satisfy schema validation.
      const { cvState: legacyCvState, ...coreDoc } = documentToSave as any;
      const normalizedResult = normalizeAndValidateCvDocument(
        coreDoc,
        typeof coreDoc?.title === "string" ? coreDoc.title : undefined,
      );
      if (!normalizedResult.success) {
        throw new Error(
          `Save normalization failed: ${normalizedResult.errors.join("; ")}`,
        );
      }

      const normalizedCore = applyAutoTitleIfPlaceholder(
        ensureRepresentativeBlocks(
          normalizeToV1Document(normalizedResult.document),
        ),
      );
      const docCopy: CvDocument = {
        ...normalizedCore,
        metadata: {
          ...(normalizedCore.metadata ?? {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
          }),
          updatedAt: options?.preserveVisibleUpdatedAt
            ? options.preserveVisibleUpdatedAtValue ??
              (typeof normalizedCore.metadata?.updatedAt === "string"
                ? normalizedCore.metadata.updatedAt
                : new Date().toISOString())
            : new Date().toISOString(),
          version: (normalizedCore.metadata?.version ?? 0) + 1,
        },
      };

      if (!canUseRemoteCvRef.current) {
        pendingRemoteSaveRef.current = docCopy;
        try {
          setCvs((prev) =>
            prev.map((doc) =>
              String(doc.id) === String(docCopy.id) ? docCopy : doc,
            ),
          );
        } catch {
          /* noop */
        }
        cacheDocumentLocally(docCopy);
        setRemoteSaveStatus({ status: "idle" });
        dbg("[CvLibraryContext] performSave: remote save deferred until Convex auth is ready", {
          docId: docCopy.id,
        });
        return;
      }

      dbg(
        "[CvLibraryContext] performSave authoritative snapshot",
        buildAuthoritativeResumeDebugSnapshot({
          authoritativeResume: docCopy.metadata?.authoritativeResume,
          metadataAuthoritativeResumePresent: Boolean(
            docCopy.metadata?.authoritativeResume,
          ),
        }),
      );

      try {
        const stack = new Error("save-call-stack").stack
          ?.split("\n")
          .slice(0, 4)
          .map((s) => s.trim());
        dbg("[CvLibraryContext] performSave invoking adapter.save", {
          docId: docCopy.id,
          lastSavedId: lastSavedRef.current?.id ?? null,
          backendMetaKeys: docCopy.metadata
            ? Object.keys(docCopy.metadata)
            : [],
          stack,
        });
      } catch {
        /* noop */
      }

      isSavingRef.current = true;
      setRemoteSaveStatus({ status: "saving", documentId: String(docCopy.id) });
      try {
        await adapter.save(docCopy as any);
        try {
          const activeDoc = currentCvRef.current;
          const withLegacy = {
            ...(docCopy as any),
            cvState: legacyCvState ?? (activeDoc as any)?.cvState,
          };
          lastSavedRef.current = stripMetadata(withLegacy) as CvDocument | null;
          dbg(
            "[CvLibraryContext] performSave: lastSavedRef updated (metadata stripped, cvState preserved for dirty detection)",
            { docId: docCopy.id },
          );
        } catch {
          lastSavedRef.current = {
            ...(docCopy as any),
            cvState: (currentCvRef.current as any)?.cvState,
          } as any;
        }
        setRemoteSaveStatus({ status: "synced", documentId: String(docCopy.id) });
      } finally {
        isSavingRef.current = false;
      }

      try {
        const activeDoc = currentCvRef.current;
        if (
          typeof setCurrentCv === "function" &&
          activeDoc &&
          String(activeDoc.id) === String(docCopy.id)
        ) {
          const normalizedActiveDoc = {
            ...(docCopy as any),
            cvState: legacyCvState ?? (activeDoc as any)?.cvState,
          } as CvDocument;
          const shouldSyncContent =
            !deepEqual(
              stripMetadata(activeDoc),
              stripMetadata(normalizedActiveDoc),
            ) ||
            !deepEqual(
              (activeDoc as any).metadata ?? null,
              (normalizedActiveDoc as any).metadata ?? null,
            );
          if (shouldSyncContent) {
            safeSetCurrentCv(normalizedActiveDoc);
            dbg(
              "[CvLibraryContext] performSave: synced normalized currentCv with saved snapshot",
              { docId: docCopy.id },
            );
          } else {
            dbg(
              "[CvLibraryContext] performSave: currentCv already matches saved snapshot",
              { docId: docCopy.id },
            );
          }
        }
      } catch {
        /* noop */
      }

      try {
        setCvs((prev) =>
          prev.map((doc) =>
            String(doc.id) === String(docCopy.id) ? docCopy : doc,
          ),
        );
      } catch {
        /* noop */
      }

      cacheDocumentLocally(docCopy);
    } catch (err) {
      console.error("[CvLibraryContext] save failed", err);
      const classified = classifyRemoteSaveError(err);
      setRemoteSaveStatus({
        status: "failed",
        documentId: String(documentToSave.id),
        error: classified.message,
        reason: classified.reason,
      });
      cacheDocumentLocally(documentToSave);
    }
  }

  async function saveImmediately(
    documentToSave: CvDocument,
    options?: {
      preserveVisibleUpdatedAt?: boolean;
      preserveVisibleUpdatedAtValue?: string;
    },
  ): Promise<void> {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const inFlight = isSavingRef.current ? pendingSavePromiseRef.current : null;
    if (inFlight) {
      try {
        await inFlight;
      } catch {
        /* best-effort */
      }
    }

    const p = performSave(documentToSave, options);
    pendingSavePromiseRef.current = p;
    try {
      await p;
    } finally {
      if (pendingSavePromiseRef.current === p) {
        pendingSavePromiseRef.current = null;
      }
    }
  }

  const prepareCurrentCvForReplacement =
    useCallback(async (): Promise<void> => {
      const outgoingBeforeFlush = currentCvRef.current;
      if (!outgoingBeforeFlush) {
        return;
      }

      try {
        flushPendingEdits();
      } catch {
        /* noop */
      }

      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), 0);
      });

      const latestOutgoing = currentCvRef.current ?? outgoingBeforeFlush;
      if (!latestOutgoing) {
        return;
      }

      if (!hasMeaningfulCvContent(latestOutgoing)) {
        removeDocumentLocally(String(latestOutgoing.id));
        setCvs((prev) =>
          prev.filter((doc) => String(doc.id) !== String(latestOutgoing.id)),
        );
        return;
      }

      syncEditedDocumentLocally(latestOutgoing);
      setCvs((prev) => {
        const existingIndex = prev.findIndex(
          (doc) => String(doc.id) === String(latestOutgoing.id),
        );
        if (existingIndex === -1) {
          return [latestOutgoing, ...prev];
        }

        const next = [...prev];
        next[existingIndex] = latestOutgoing;
        return next;
      });
      cacheDocumentLocally(latestOutgoing);

      const shouldPersist =
        isDirtyRef.current ||
        hasUnsavedContent(latestOutgoing) ||
        Boolean(saveTimeoutRef.current) ||
        Boolean(isSavingRef.current);

      if (shouldPersist) {
        await saveImmediately(latestOutgoing, {
          preserveVisibleUpdatedAt: true,
        });
      }
    }, [flushPendingEdits]);

  /**
   * Create a normalized CvBlock from a loose input.
   * Ensures stable id, a human-readable title, and Remirror JSON content (placeholder when empty).
   */
  function createNormalizedBlock(
    input: Partial<CvBlock> | CvBlock,
    fallbackIndex = 0,
  ): CvBlock {
    const id = String((input as any).id ?? uuidv4());
    const rawContent = (input as any).content;
    const content = rawContent
      ? typeof rawContent === "string"
        ? ensureRemirrorDoc(rawContent as any)
        : (rawContent as RemirrorJSON)
      : ensureRemirrorDoc(undefined as any);
    const plainText = (input as any).plainText ?? undefined;
    const titleFromPlain =
      typeof plainText === "string" && plainText.trim().length > 0
        ? plainText.trim().slice(0, 64)
        : undefined;
    const title =
      typeof (input as any).title === "string" &&
      (input as any).title.trim().length > 0
        ? (input as any).title
        : titleFromPlain ?? `Block ${fallbackIndex + 1}`;
    return {
      ...(input as any),
      id,
      title,
      content,
      plainText,
      order:
        typeof (input as any).order === "number"
          ? (input as any).order
          : undefined,
      attributes: (input as any).attributes ?? undefined,
      type: (input as any).type ?? "text",
    } as CvBlock;
  }

  /**
   * Debounced internal save that invokes adapter.save and updates local caches.
   * Returns a promise that resolves when the save attempt finishes (success or handled error).
   */
  function scheduleSave(documentToSave: CvDocument): Promise<void> {
    cvEditorDebugInfo("[cv-save-debug] scheduleSave", {
      docId: documentToSave.id,
      routeProfileId: readRequestedCvIdFromWindowLocation(),
      sectionCount: documentToSave.sections?.length,
    });

    // clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const p = new Promise<void>((resolve) => {
      saveTimeoutRef.current = setTimeout(async () => {
        // mark no outstanding timeout
        saveTimeoutRef.current = null;
        try {
          await performSave(documentToSave);
        } finally {
          resolve();
        }
      }, DEBOUNCE_MS);
    });

    pendingSavePromiseRef.current = p;
    void p.finally(() => {
      if (pendingSavePromiseRef.current === p) {
        pendingSavePromiseRef.current = null;
      }
    });
    return p;
  }

  /**
   * Public: load a cv by id. Uses adapter.load(id) with fallback to localStorage cache.
   * Sets currentCv and ensures it's present in the cvs array (and cached).
   */
  const loadCv = useCallback(
    (id: string): boolean => {
      const targetId = String(id);
      activeLoadTargetRef.current = targetId;
      const isLoadTargetStillCurrent = (): boolean => {
        const requestedRouteCvId = readRequestedCvIdFromWindowLocation();
        if (
          requestedRouteCvId &&
          String(requestedRouteCvId) !== String(targetId)
        ) {
          return false;
        }
        return activeLoadTargetRef.current === targetId;
      };
      const visibleTargetDoc = cvsRef.current.find(
        (candidate) => String(candidate.id) === targetId,
      );
      const visibleTargetCreatedAt =
        typeof visibleTargetDoc?.metadata?.createdAt === "string"
          ? visibleTargetDoc.metadata.createdAt
          : undefined;
      const visibleTargetUpdatedAt =
        typeof visibleTargetDoc?.metadata?.updatedAt === "string"
          ? visibleTargetDoc.metadata.updatedAt
          : undefined;

      const persistOutgoingCvBeforeSwitch = async (): Promise<void> => {
        const outgoingBeforeFlush = currentCvRef.current;
        if (
          !outgoingBeforeFlush ||
          String(outgoingBeforeFlush.id) === targetId
        ) {
          return;
        }

        try {
          flushPendingEdits();
        } catch {
          /* noop */
        }

        // Allow flush callbacks and queued state updates to land before reading currentCv.
        await new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), 0);
        });

        const latestOutgoing = currentCvRef.current;
        if (!latestOutgoing || String(latestOutgoing.id) === targetId) {
          return;
        }

        const visibleLibraryDoc = cvsRef.current.find(
          (candidate) => String(candidate.id) === String(latestOutgoing.id),
        );
        const visibleLibraryUpdatedAt =
          typeof visibleLibraryDoc?.metadata?.updatedAt === "string"
            ? visibleLibraryDoc.metadata.updatedAt
            : undefined;

        syncEditedDocumentLocally(latestOutgoing);

        const shouldPersist =
          isDirtyRef.current ||
          hasUnsavedContent(latestOutgoing) ||
          Boolean(saveTimeoutRef.current) ||
          Boolean(isSavingRef.current);

        if (!shouldPersist) {
          return;
        }

        await saveImmediately(latestOutgoing, {
          preserveVisibleUpdatedAt: true,
          preserveVisibleUpdatedAtValue: visibleLibraryUpdatedAt,
        });
      };

      const performLoad = (): boolean => {
        // Synchronous API expected by some legacy tests: return true when we immediately set currentCv,
        // otherwise return false and perform async background attempts.
        setIsLoading(true);
        try {
          let summaryOnlyFallbackDoc: CvDocument | null = null;
          let doc: CvDocument | null =
            currentCvRef.current && String(currentCvRef.current.id) === targetId
              ? currentCvRef.current
              : cvsRef.current.find(
                  (candidate) => String(candidate.id) === targetId,
                ) ?? null;

          if (doc && isLibrarySummaryOnlyCv(doc)) {
            summaryOnlyFallbackDoc = doc;
            doc = null;
          }

          if (doc) {
            try {
              doc = migrateLegacyIds(doc);
            } catch {
              /* noop */
            }

            const docV1 = normalizeToV1Document(doc as CvDocument);
            const docNorm = ensureRepresentativeBlocks(docV1 as CvDocument);
            const shouldHoldTemplateLessRestore =
              shouldHoldTemplateLessRestoreForRemote(docNorm, targetId);
            if (shouldHoldTemplateLessRestore) {
              setIsVisualRestorePending(true);
            }
            dbg(
              "[CvLibraryContext] loadCv in-memory authoritative snapshot",
              buildAuthoritativeResumeDebugSnapshot({
                authoritativeResume: docNorm.metadata?.authoritativeResume,
                metadataAuthoritativeResumePresent: Boolean(
                  docNorm.metadata?.authoritativeResume,
                ),
              }),
            );

            safeSetCurrentCv(docNorm);
            setCvs((prev) => {
              const exists = prev.some((c) => c.id === docNorm.id);
              if (exists)
                return prev.map((c) => (c.id === docNorm.id ? docNorm : c));
              return [...prev, docNorm];
            });
            cacheDocumentLocally(docNorm);
            lastSavedRef.current = docNorm;
            setIsLoading(false);
            return true;
          }
          doc = null;

          // 1) Try fast local cache first (immediate UI response)
          try {
            if (typeof window !== "undefined" && window.localStorage) {
              const raw = window.localStorage.getItem(
                getLocalCvDocumentStorageKey(targetId),
              );
              if (raw) {
                const parsed = JSON.parse(raw);
                const parsedRes = safeParseCvDocument(parsed);
                if (parsedRes.ok) doc = parsedRes.value;
                else if (
                  parsed &&
                  typeof parsed === "object" &&
                  typeof parsed.id === "string"
                ) {
                  doc = {
                    id: String(parsed.id),
                    title: String(parsed.title ?? "Untitled CV"),
                    metadata: (parsed as any).metadata ?? {
                      createdAt:
                        visibleTargetCreatedAt ?? new Date().toISOString(),
                      updatedAt:
                        visibleTargetUpdatedAt ??
                        visibleTargetCreatedAt ??
                        new Date().toISOString(),
                      version: 1,
                    },
                    sections: Array.isArray(parsed.sections)
                      ? parsed.sections
                      : [],
                    tags: Array.isArray(parsed.tags) ? parsed.tags : undefined,
                    summary: parsed.summary ?? undefined,
                  } as CvDocument;
                }
                if (doc && isLibrarySummaryOnlyCv(doc)) {
                  summaryOnlyFallbackDoc = doc;
                  doc = null;
                }
              }
            }
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn("[CvLibraryContext] local cache read failed", err);
          }

          // If we found a cached doc, use it immediately and then attempt a background refresh.
          if (doc) {
            try {
              doc = migrateLegacyIds(doc);
            } catch {
              /* noop */
            }

            const docV1 = normalizeToV1Document(doc as CvDocument);
            const docNorm = ensureRepresentativeBlocks(docV1 as CvDocument);
            const shouldHoldTemplateLessRestore =
              shouldHoldTemplateLessRestoreForRemote(docNorm, targetId);
            if (shouldHoldTemplateLessRestore) {
              setIsVisualRestorePending(true);
            }
            dbg(
              "[CvLibraryContext] loadCv cached authoritative snapshot",
              buildAuthoritativeResumeDebugSnapshot({
                authoritativeResume: docNorm.metadata?.authoritativeResume,
                metadataAuthoritativeResumePresent: Boolean(
                  docNorm.metadata?.authoritativeResume,
                ),
              }),
            );

            safeSetCurrentCv(docNorm);
            setCvs((prev) => {
              const exists = prev.some((c) => c.id === docNorm.id);
              if (exists)
                return prev.map((c) => (c.id === docNorm.id ? docNorm : c));
              return [...prev, docNorm];
            });
            cacheDocumentLocally(docNorm);
            lastSavedRef.current = docNorm;

            // Background refresh from adapter (do not block UI).
            (async () => {
              try {
                const remoteLoaded = await adapter.load(targetId);
                if (!remoteLoaded) return;
                let migratedRemote: CvDocument;
                try {
                  migratedRemote = migrateLegacyIds(remoteLoaded as CvDocument);
                } catch {
                  migratedRemote = remoteLoaded as CvDocument;
                }
                const remoteV1 = normalizeToV1Document(
                  migratedRemote as CvDocument,
                );
                const remoteNorm = ensureRepresentativeBlocks(
                  remoteV1 as CvDocument,
                );
                dbg(
                  "[CvLibraryContext] loadCv remote authoritative snapshot",
                  buildAuthoritativeResumeDebugSnapshot({
                    authoritativeResume:
                      remoteNorm.metadata?.authoritativeResume,
                    metadataAuthoritativeResumePresent: Boolean(
                      remoteNorm.metadata?.authoritativeResume,
                    ),
                  }),
                );
                if (
                  deepEqual(stripMetadata(docNorm), stripMetadata(remoteNorm)) &&
                  deepEqual(docNorm.metadata ?? null, remoteNorm.metadata ?? null)
                ) {
                  return;
                }
                if (
                  !shouldApplyBackgroundRefresh(targetId, docNorm, remoteNorm)
                ) {
                  if (!isLoadTargetStillCurrent()) {
                    return;
                  }
                  applySkippedBackgroundRefreshVisualOverlay(
                    targetId,
                    currentCvRef.current ?? docNorm,
                    remoteNorm,
                  );
                  return;
                }
                if (!isLoadTargetStillCurrent()) {
                  return;
                }
                const remoteWithLocalVisualTemplate =
                  preserveLocalResumeTemplateWhenRemoteIsImplicit(
                    remoteNorm,
                    currentCvRef.current ?? docNorm,
                  );
                safeSetCurrentCv(remoteWithLocalVisualTemplate);
                setCvs((prev) => {
                  const exists = prev.some(
                    (c) => c.id === remoteWithLocalVisualTemplate.id,
                  );
                  if (exists)
                    return prev.map((c) =>
                      c.id === remoteWithLocalVisualTemplate.id
                        ? remoteWithLocalVisualTemplate
                        : c,
                    );
                  return [...prev, remoteWithLocalVisualTemplate];
                });
                cacheDocumentLocally(remoteWithLocalVisualTemplate);
                lastSavedRef.current = remoteWithLocalVisualTemplate;
              } catch (err) {
                // eslint-disable-next-line no-console
                console.warn(
                  "[CvLibraryContext] background adapter.load failed",
                  err,
                );
              } finally {
                setIsVisualRestorePending(false);
                setIsLoading(false);
              }
            })();

            setIsLoading(false);
            return true;
          }

          // 2) No local cache -> try adapter.load asynchronously (do not block caller)
          (async () => {
            let preserveVisualRestorePending = false;
            try {
              let remoteDoc: CvDocument | null = null;
              try {
                remoteDoc = await adapter.load(targetId);
                if (remoteDoc) {
                  try {
                    remoteDoc = migrateLegacyIds(remoteDoc);
                  } catch {
                    /* noop */
                  }
                }
              } catch (err) {
                // eslint-disable-next-line no-console
                console.warn(
                  "[CvLibraryContext] adapter.load failed, attempting local fallback",
                  err,
                );
              }

              if (!remoteDoc) {
                try {
                  if (typeof window !== "undefined" && window.localStorage) {
                    const raw = window.localStorage.getItem(
                      getLocalCvDocumentStorageKey(targetId),
                    );
                    if (raw) {
                      const parsed = JSON.parse(raw);
                      const parsedRes = safeParseCvDocument(parsed);
                      if (parsedRes.ok) remoteDoc = parsedRes.value;
                      else if (
                        parsed &&
                        typeof parsed === "object" &&
                        typeof parsed.id === "string"
                      ) {
                        remoteDoc = {
                          id: String(parsed.id),
                          title: String(parsed.title ?? "Untitled CV"),
                          metadata: (parsed as any).metadata ?? {
                            createdAt:
                              visibleTargetCreatedAt ??
                              new Date().toISOString(),
                            updatedAt:
                              visibleTargetUpdatedAt ??
                              visibleTargetCreatedAt ??
                              new Date().toISOString(),
                            version: 1,
                          },
                          sections: Array.isArray(parsed.sections)
                            ? parsed.sections
                            : [],
                          tags: Array.isArray(parsed.tags)
                            ? parsed.tags
                            : undefined,
                          summary: parsed.summary ?? undefined,
                        } as CvDocument;
                      }
                      if (remoteDoc && isLibrarySummaryOnlyCv(remoteDoc)) {
                        summaryOnlyFallbackDoc = remoteDoc;
                        remoteDoc = null;
                      }
                      try {
                        if (remoteDoc) remoteDoc = migrateLegacyIds(remoteDoc);
                      } catch {
                        /* noop */
                      }
                    }
                  }
                } catch {
                  /* ignore fallback parse errors */
                }
              }

              const pendingRestoreTarget = pendingActiveRestoreIdRef.current;
              if (
                pendingRestoreTarget &&
                String(pendingRestoreTarget) !== targetId
              ) {
                return;
              }
              if (!isLoadTargetStillCurrent()) {
                return;
              }

              if (remoteDoc) {
                const docV1 = normalizeToV1Document(remoteDoc as CvDocument);
                const docNorm = ensureRepresentativeBlocks(docV1 as CvDocument);
                const shouldHoldTemplateLessRestore =
                  shouldHoldTemplateLessRestoreForRemote(docNorm, targetId);
                if (shouldHoldTemplateLessRestore) {
                  setIsVisualRestorePending(true);
                }
                dbg(
                  "[CvLibraryContext] loadCv async authoritative snapshot",
                  buildAuthoritativeResumeDebugSnapshot({
                    authoritativeResume: docNorm.metadata?.authoritativeResume,
                    metadataAuthoritativeResumePresent: Boolean(
                      docNorm.metadata?.authoritativeResume,
                    ),
                  }),
                );
                safeSetCurrentCv(docNorm);
                setCvs((prev) => {
                  const exists = prev.some((c) => c.id === docNorm.id);
                  if (exists)
                    return prev.map((c) => (c.id === docNorm.id ? docNorm : c));
                  return [...prev, docNorm];
                });
                cacheDocumentLocally(docNorm);
                lastSavedRef.current = docNorm;
              } else if (summaryOnlyFallbackDoc) {
                let repairedDoc = expandLibrarySummaryOnlyCv(
                  summaryOnlyFallbackDoc,
                );
                try {
                  repairedDoc = migrateLegacyIds(repairedDoc);
                } catch {
                  /* noop */
                }
                const repairedV1 = normalizeToV1Document(
                  repairedDoc as CvDocument,
                );
                const repairedNorm = ensureRepresentativeBlocks(
                  repairedV1 as CvDocument,
                );
                const requestedRouteCvId = readRequestedCvIdFromWindowLocation();
                const shouldDeferTemplateLessSummaryFallback =
                  requestedRouteCvId === targetId &&
                  !readAnyResumeTemplateId(repairedNorm) &&
                  (!isAuthLoaded ||
                    isConvexAuthLoading ||
                    (Boolean(isSignedIn) && !isConvexAuthenticated));

                if (shouldDeferTemplateLessSummaryFallback) {
                  // Keep the visual restore gate open so the generated fallback
                  // does not flash as the active preview while auth/remote is
                  // still capable of replacing it with the saved template.
                  preserveVisualRestorePending = true;
                  setIsVisualRestorePending(true);
                  return;
                }

                safeSetCurrentCv(repairedNorm);
                setCvs((prev) => {
                  const exists = prev.some((c) => c.id === repairedNorm.id);
                  if (exists)
                    return prev.map((c) =>
                      c.id === repairedNorm.id ? repairedNorm : c,
                    );
                  return [...prev, repairedNorm];
                });
                cacheDocumentLocally(repairedNorm);
                lastSavedRef.current = repairedNorm;
              } else {
                const requestedRouteCvId = readRequestedCvIdFromWindowLocation();
                const shouldDeferRouteNullHydration =
                  requestedRouteCvId === targetId &&
                  (isConvexAuthLoading ||
                    (Boolean(isSignedIn) && !isConvexAuthenticated));
                if (shouldDeferRouteNullHydration) {
                  return;
                }
                safeSetCurrentCv(null);
              }
            } catch (err) {
              // eslint-disable-next-line no-console
              console.warn(
                "[CvLibraryContext] asynchronous loadCv failed",
                err,
              );
            } finally {
              if (!preserveVisualRestorePending) {
                setIsVisualRestorePending(false);
              }
              setIsLoading(false);
            }
          })();

          // Caller did not get an immediate document
          return false;
        } finally {
          // ensure loading cleared for synchronous paths
          if (isLoading) setIsLoading(false);
        }
      };

      const activeId = currentCvRef.current
        ? String(currentCvRef.current.id)
        : null;
      if (activeId && activeId !== targetId) {
        pendingSwitchTargetRef.current = targetId;
        void (async () => {
          try {
            await persistOutgoingCvBeforeSwitch();
            if (pendingSwitchTargetRef.current !== targetId) return;
            performLoad();
          } finally {
            if (pendingSwitchTargetRef.current === targetId) {
              pendingSwitchTargetRef.current = null;
            }
          }
        })();
        return false;
      }

      return performLoad();
    },
    [
      adapter,
      flushPendingEdits,
      isConvexAuthenticated,
      isConvexAuthLoading,
      isAuthLoaded,
      isSignedIn,
    ],
  );

  useEffect(() => {
    if (hasHydratedActiveCvRef.current || pendingActiveRestoreIdRef.current) {
      return;
    }
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        hasHydratedActiveCvRef.current = true;
        return;
      }

      const activeId = readStoredActiveCvId();
      const requestedRouteCvId = readRequestedCvIdFromWindowLocation();
      let restoreId = requestedRouteCvId || activeId;
      if (!restoreId) {
        restoreId =
          [...cvs]
            .sort(
              (a, b) => (readUpdatedAtMs(b) ?? 0) - (readUpdatedAtMs(a) ?? 0),
            )
            .find((doc) => doc?.id)?.id ?? "";
        restoreId = String(restoreId).trim();
      }

      if (!restoreId) {
        hasHydratedActiveCvRef.current = true;
        return;
      }

      if (currentCv && String(currentCv.id) === restoreId) {
        hasHydratedActiveCvRef.current = true;
        return;
      }

      const cachedExisting = readCachedFullCvDocument(restoreId);
      const existing =
        cachedExisting ?? cvs.find((doc) => String(doc.id) === restoreId);
      if (existing && !isLibrarySummaryOnlyCv(existing)) {
        let restored = existing;
        try {
          restored = migrateLegacyIds(existing);
        } catch {
          /* noop */
        }
        const restoredV1 = normalizeToV1Document(restored as CvDocument);
        const restoredNorm = ensureRepresentativeBlocks(
          restoredV1 as CvDocument,
        );
        const shouldHoldTemplateLessRestore =
          shouldHoldTemplateLessRestoreForRemote(restoredNorm, restoreId);
        if (shouldHoldTemplateLessRestore) {
          setIsVisualRestorePending(true);
        }
        safeSetCurrentCv(restoredNorm);
        setCvs((prev) => {
          const idx = prev.findIndex(
            (doc) => String(doc.id) === String(restoredNorm.id),
          );
          if (idx === -1) return [...prev, restoredNorm];
          const copy = [...prev];
          copy[idx] = restoredNorm;
          return copy;
        });
        cacheDocumentLocally(restoredNorm);
        lastSavedRef.current = restoredNorm;
        hasHydratedActiveCvRef.current = true;
        return;
      }

      pendingActiveRestoreIdRef.current = restoreId;
      const restoredImmediately = loadCv(restoreId);
      if (restoredImmediately) {
        pendingActiveRestoreIdRef.current = null;
        hasHydratedActiveCvRef.current = true;
      }
    } catch {
      pendingActiveRestoreIdRef.current = null;
      hasHydratedActiveCvRef.current = true;
    }
  }, [cvs, currentCv, loadCv, readCachedFullCvDocument]);

  useEffect(() => {
    const pendingId = pendingActiveRestoreIdRef.current;
    if (!pendingId) return;
    if (currentCv && String(currentCv.id) === String(pendingId)) {
      failedActiveRestoreIdsRef.current.clear();
      pendingActiveRestoreIdRef.current = null;
      hasHydratedActiveCvRef.current = true;
      return;
    }
    const requestedRouteCvId = readRequestedCvIdFromWindowLocation();
    if (
      requestedRouteCvId &&
      String(requestedRouteCvId) === String(pendingId)
    ) {
      if (!isLoading) {
        if (
          isConvexAuthLoading ||
          (Boolean(isSignedIn) && !isConvexAuthenticated)
        ) {
          return;
        }
        if (
          Boolean(isSignedIn) &&
          isConvexAuthenticated &&
          !failedActiveRestoreIdsRef.current.has(String(pendingId))
        ) {
          failedActiveRestoreIdsRef.current.add(String(pendingId));
          loadCv(pendingId);
          return;
        }
        pendingActiveRestoreIdRef.current = null;
        hasHydratedActiveCvRef.current = true;
      }
      return;
    }
    if (!isLoading) {
      failedActiveRestoreIdsRef.current.add(String(pendingId));
      const fallbackId =
        [...cvs]
          .filter(
            (doc) =>
              doc?.id && !failedActiveRestoreIdsRef.current.has(String(doc.id)),
          )
          .sort((a, b) => (readUpdatedAtMs(b) ?? 0) - (readUpdatedAtMs(a) ?? 0))
          .find((doc) => doc?.id)?.id ?? "";
      const cleanFallbackId = String(fallbackId).trim();
      if (cleanFallbackId) {
        pendingActiveRestoreIdRef.current = cleanFallbackId;
        const restoredImmediately = loadCv(cleanFallbackId);
        if (restoredImmediately) {
          failedActiveRestoreIdsRef.current.clear();
          pendingActiveRestoreIdRef.current = null;
          hasHydratedActiveCvRef.current = true;
        }
        return;
      }

      writeStoredActiveCvId(null);
      pendingActiveRestoreIdRef.current = null;
      hasHydratedActiveCvRef.current = true;
    }
  }, [
    currentCv,
    cvs,
    isConvexAuthenticated,
    isConvexAuthLoading,
    isLoading,
    isSignedIn,
    loadCv,
  ]);

  useEffect(() => {
    if (!canUseRemoteCv || !currentCv) {
      return;
    }
    const requestedRouteCvId = readRequestedCvIdFromWindowLocation();
    const activeCvId = String(currentCv.id);
    const targetCvId = requestedRouteCvId || activeCvId;
    if (requestedRouteCvId && activeCvId !== requestedRouteCvId) {
      return;
    }
    const refreshKey = `${targetCvId}:${currentCv.metadata?.updatedAt ?? ""}`;
    if (routeRemoteRefreshKeyRef.current === refreshKey) {
      return;
    }
    routeRemoteRefreshKeyRef.current = refreshKey;

    const localBaseline = currentCv;
    void (async () => {
      try {
        const remoteState = await adapter.loadRemoteState(targetCvId);
        if (remoteState.status !== "ok") return;
        const remoteLoaded = remoteState.document;
        let migratedRemote: CvDocument;
        try {
          migratedRemote = migrateLegacyIds(remoteLoaded as CvDocument);
        } catch {
          migratedRemote = remoteLoaded as CvDocument;
        }
        const remoteNorm = ensureRepresentativeBlocks(
          normalizeToV1Document(migratedRemote as CvDocument),
        );
        if (
          !shouldApplyBackgroundRefresh(
            targetCvId,
            localBaseline,
            remoteNorm,
          )
        ) {
          applySkippedBackgroundRefreshVisualOverlay(
            targetCvId,
            currentCvRef.current ?? localBaseline,
            remoteNorm,
          );
          return;
        }
        const latestRouteCvId = readRequestedCvIdFromWindowLocation();
        if (
          (latestRouteCvId && latestRouteCvId !== targetCvId) ||
          String(currentCvRef.current?.id ?? "") !== targetCvId
        ) {
          return;
        }
        const remoteWithLocalVisualTemplate =
          preserveLocalResumeTemplateWhenRemoteIsImplicit(
            remoteNorm,
            currentCvRef.current ?? localBaseline,
          );
        cvDecorationBoundaryInfo("[cv-decoration-context-refresh]", {
          targetCvId,
          routeCvId: latestRouteCvId,
          current: readDecorationRuntimeDebug(
            currentCvRef.current ?? localBaseline,
          ),
          remote: readDecorationRuntimeDebug(remoteNorm),
          candidate: readDecorationRuntimeDebug(remoteWithLocalVisualTemplate),
        });
        if (
          deepEqual(
            stripMetadata(currentCvRef.current ?? localBaseline),
            stripMetadata(remoteWithLocalVisualTemplate),
          ) &&
          deepEqual(
            (currentCvRef.current ?? localBaseline).metadata ?? null,
            remoteWithLocalVisualTemplate.metadata ?? null,
          )
        ) {
          cvDecorationBoundaryInfo("[cv-decoration-context-refresh-skipped]", {
            targetCvId,
            reason: "deep_equal",
            current: readDecorationRuntimeDebug(
              currentCvRef.current ?? localBaseline,
            ),
            candidate: readDecorationRuntimeDebug(remoteWithLocalVisualTemplate),
          });
          return;
        }
        safeSetCurrentCv(remoteWithLocalVisualTemplate);
        setCvs((prev) => {
          const exists = prev.some(
            (doc) => String(doc.id) === String(remoteWithLocalVisualTemplate.id),
          );
          if (exists) {
            return prev.map((doc) =>
              String(doc.id) === String(remoteWithLocalVisualTemplate.id)
                ? remoteWithLocalVisualTemplate
                : doc,
            );
          }
          return [...prev, remoteWithLocalVisualTemplate];
        });
        cacheDocumentLocally(remoteWithLocalVisualTemplate);
        lastSavedRef.current = remoteWithLocalVisualTemplate;
      } catch (error) {
        console.warn("[CvLibraryContext] route remote refresh failed", error);
      } finally {
        setIsVisualRestorePending(false);
      }
    })();
  }, [adapter, canUseRemoteCv, currentCv]);

  /**
   * Create a CvDocument from an ICvState snapshot and set it as the current CV.
   * This is used to restore backups or import exported CV state.
   */
  function createCvFromState(
    state: import("../types/cv").ICvState,
    title?: string,
  ) {
    try {
      const now = new Date().toISOString();
      const id = uuidv4();
      const draft = state?.draftProfile ?? {};
      const cv: CvDocument = {
        id,
        title: title ?? (draft.name ? String(draft.name) : `Imported CV ${id}`),
        metadata: {
          createdAt: now,
          updatedAt: now,
          version: 1,
          locale: undefined,
          authorId: undefined,
          lastEditedBy: undefined,
        },
        sections: Array.isArray(state.sections)
          ? state.sections.map((s) => ({
              id: s.id || uuidv4(),
              title: s.title || "",
              type: "text",
              // keep section content as-is (string or RemirrorJSON). Blocks must be an array for CvSection shape.
              blocks: Array.isArray((s as any).blocks) ? (s as any).blocks : [],
              structuredContent: undefined,
              collapsed: false,
            }))
          : [],
        tags: Array.isArray(draft.skills) ? draft.skills : undefined,
        summary: draft.summary ?? undefined,
      };
      // Update in-memory state and persist
      safeSetCurrentCv(cv);
      setCvs((prev) => {
        const exists = prev.some((c) => c.id === cv.id);
        if (exists) return prev.map((c) => (c.id === cv.id ? cv : c));
        return [cv, ...prev]; // prepend — newest first
      });
      cacheDocumentLocally(cv);
      // Schedule save like other entry points for consistency
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      void scheduleSave(cv);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[CvLibraryContext] createCvFromState failed", err);
    }
  }

  /**
   * Create a new CV from the built-in template and set it as current.
   * This function uses generateCvTemplate() to ensure a fresh document.
   */
  const createNewCv = useCallback(
    async (
      title?: string,
      opts?: { forceV1?: boolean; resumeTemplateId?: ResumeTemplateId },
    ) => {
      try {
        await prepareCurrentCvForReplacement();

        // Aggressive enforcement: always create new CVs using the v1 template
        // unless explicitly opted out (forceV1 === false). This ensures newly created
        // documents are v1-shaped and avoid legacy UI being shown for new docs.
        const explicitDisableV1 = opts?.forceV1 === false;
        const shouldUseV1 = !explicitDisableV1;
        const requestedResumeTemplateId = isResumeTemplateId(
          opts?.resumeTemplateId,
        )
          ? opts.resumeTemplateId
          : null;
        const initialVerbatiStyle = requestedResumeTemplateId
          ? serializeVerbatiStyle(
              resolveVerbatiStyle({
                familyId: "workshop",
                typography: "geist-baskervville",
                palette: "sauge",
                resumeTemplateId: requestedResumeTemplateId,
              }),
            )
          : null;

        let cvRaw = shouldUseV1
          ? generateCvTemplateV1(title)
          : generateCvTemplate(title);

        // Development-only diagnostic: log which template was selected and its section types.
        // This helps QA/devs confirm whether the v1 template (or legacy) is being used at runtime.
        if (process.env.NODE_ENV !== "production") {
          try {
            // eslint-disable-next-line no-console
            console.debug(
              "[CvLibraryContext] createNewCv chose template (aggressive v1)",
              {
                explicitDisableV1,
                usedV1: shouldUseV1,
                sectionTypes: Array.isArray((cvRaw as any)?.sections)
                  ? (cvRaw as any).sections.map((s: any) => s.type)
                  : undefined,
              },
            );
          } catch {
            /* non-fatal diagnostics */
          }
        }

        // Defensive guard: if we intended v1 but the selected template still contains unexpected section types,
        // replace with the canonical v1 template to avoid regressions.
        // v1(full) allowed types: profile, summary, experience, education, skills, languages
        if (shouldUseV1) {
          try {
            const allowed = new Set([
              "profile",
              "summary",
              "experience",
              "achievements",
              "education",
              "skills",
              "languages",
            ]);
            const types: string[] = Array.isArray((cvRaw as any)?.sections)
              ? (cvRaw as any).sections.map((s: any) => String(s.type))
              : [];
            const unexpected = types.filter((t: string) => !allowed.has(t));
            if (unexpected.length > 0) {
              // eslint-disable-next-line no-console
              console.warn(
                "[CvLibraryContext] createNewCv expected v1 template but found unexpected section types, replacing with canonical v1 template",
                {
                  unexpected,
                  types,
                },
              );
              cvRaw = generateCvTemplateV1(title);
            }
          } catch {
            /* non-fatal */
          }
        }

        const cv = {
          ...(ensureRepresentativeBlocks(cvRaw as CvDocument) as CvDocument),
          metadata: {
            ...((cvRaw as CvDocument).metadata ?? {}),
            ...(initialVerbatiStyle
              ? { verbatiStyle: initialVerbatiStyle }
              : null),
          },
          // Back-compat: seed legacy cvState so tests relying on it can function
          cvState: { sections: [], source: "manual", history: [] } as any,
        } as CvDocument;

        // Dev helper: surface the exact created document id and section types after normalization.
        // This is intentionally gated to dev to avoid noise in production.
        if (process.env.NODE_ENV !== "production") {
          try {
            // eslint-disable-next-line no-console
            console.debug("[CvLibraryContext] createNewCv created document", {
              createdId: cv.id,
              sectionTypes: Array.isArray(cv.sections)
                ? cv.sections.map((s) => (s as any).type)
                : undefined,
            });
            // Expose the id on window for quick manual inspection (dev only)
            try {
              (window as any).__LAST_CREATED_CV_ID__ = String(cv.id);
            } catch {
              /* ignore */
            }
          } catch {
            /* non-fatal diagnostics */
          }
        }

        safeSetCurrentCv(cv);
        setCvs((prev) => {
          const exists = prev.some((c) => c.id === cv.id);
          if (exists) return prev.map((c) => (c.id === cv.id ? cv : c));
          return [cv, ...prev]; // prepend — newest first
        });
        cacheDocumentLocally(cv);
        // Trigger a debounced save but do not await here.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        void scheduleSave(cv);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[CvLibraryContext] createNewCv failed", err);
      }
    },
    [prepareCurrentCvForReplacement],
  );

  /**
   * Import a fully-normalized CvDocument (e.g. from file upload).
   * This replaces the current document, ensures it's present in the in-memory library,
   * caches it locally and schedules a debounced save.
   */
  async function importCv(doc: unknown): Promise<void> {
    try {
      // Normalize and strictly validate incoming document before importing.
      const result = normalizeAndValidateCvDocument(
        doc,
        typeof (doc as any)?.title === "string"
          ? (doc as any).title
          : undefined,
      );
      if (!result.success) {
        // Surface validation errors to the caller so UI can display them.
        const msg = `Import validation failed: ${result.errors.join("; ")}`;
        // eslint-disable-next-line no-console
        console.warn(
          "[CvLibraryContext] importCv validation failed",
          result.errors,
        );
        throw new Error(msg);
      }
      const validated = result.document;

      // Ensure minimal metadata and id are present (normalizer/template should provide these).
      if (!validated.id) validated.id = uuidv4();
      if (!validated.metadata) {
        validated.metadata = {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        } as any;
      }

      // Apply canonical section ordering so imported CVs always show sections in the right order
      const preferredImportOrder = [
        "profile",
        "contact",
        "summary",
        "experience",
        "education",
        "skills",
        "languages",
        "projects",
        "certifications",
        "achievements",
        "text",
      ] as const;
      const importOrderIndex = new Map(
        preferredImportOrder.map((t, i) => [t, i]),
      );
      const hasExplicitSectionOrder = validated.sections.some(
        (section) => typeof section.order === "number",
      );
      const reorderedSections = [...validated.sections]
        .map((section, index) => ({ section, index }))
        .sort((a, b) => {
          if (hasExplicitSectionOrder) {
            const aOrder =
              typeof a.section.order === "number" ? a.section.order : a.index;
            const bOrder =
              typeof b.section.order === "number" ? b.section.order : b.index;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.index - b.index;
          }

          const aRank =
            importOrderIndex.get(String((a.section as any).type ?? "") as any) ?? 999;
          const bRank =
            importOrderIndex.get(String((b.section as any).type ?? "") as any) ?? 999;
          if (aRank !== bRank) return aRank - bRank;
          return a.index - b.index;
        })
        .map(({ section }) => section);
      const validatedReordered = {
        ...validated,
        sections: reorderedSections,
      } as CvDocument;

      const validatedWithReps = applyAutoTitleIfPlaceholder(
        ensureRepresentativeBlocks(validatedReordered),
      );
      dbg(
        "[CvLibraryContext] importCv authoritative snapshot",
        buildAuthoritativeResumeDebugSnapshot({
          authoritativeResume: validatedWithReps.metadata?.authoritativeResume,
          metadataAuthoritativeResumePresent: Boolean(
            validatedWithReps.metadata?.authoritativeResume,
          ),
        }),
      );

      // Replace current CV atomically with validated document
      safeSetCurrentCv(validatedWithReps);
      setCvs((prev) => {
        const exists = prev.some((c) => c.id === validatedWithReps.id);
        if (exists)
          return prev.map((c) =>
            c.id === validatedWithReps.id ? validatedWithReps : c,
          );
        return [...prev, validatedWithReps];
      });
      cacheDocumentLocally(validatedWithReps);
      // Schedule a save and await to ensure persistent storage is updated in background.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      await scheduleSave(validatedWithReps);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[CvLibraryContext] importCv failed", err);
      throw err;
    }
  }

  /**
   * Public: save currentCv (debounced). If no currentCv, resolves immediately.
   * Returns a promise that resolves when the debounced save completes.
   */
  const saveCurrentCv = useCallback(async (): Promise<void> => {
    const doc = currentCv;
    if (!doc) return Promise.resolve();
    return scheduleSave(doc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCv, adapter]);

  const saveCurrentCvStyleOnly = useCallback(
    async (
      style: VerbatiStylePreset,
      styleMetadata: CvVisualMetadataPatch = {},
    ): Promise<void> => {
      const activeDoc = currentCvRef.current;
      if (!activeDoc) return;
      const durableStyleMetadata =
        sanitizeDurableVisualMetadataPatch(styleMetadata);

      const verbatiStyle = serializeVerbatiStyle(style);
      const resumeTemplateId = isResumeTemplateId(
        verbatiStyle.resumeTemplateId,
      )
        ? verbatiStyle.resumeTemplateId
        : isResumeTemplateId(durableStyleMetadata.resumeTemplateId)
          ? durableStyleMetadata.resumeTemplateId
          : isResumeTemplateId(
                durableStyleMetadata.verbatiStyleBaseSnapshot?.resumeTemplateId,
              )
            ? durableStyleMetadata.verbatiStyleBaseSnapshot.resumeTemplateId
            : undefined;
      const nextMetadata = {
        ...(activeDoc.metadata ?? {}),
        updatedAt: new Date().toISOString(),
        verbatiStyle,
        ...(resumeTemplateId ? { resumeTemplateId } : null),
        ...durableStyleMetadata,
      };
      const nextDoc: CvDocument = {
        ...activeDoc,
        metadata: nextMetadata,
      };

      safeSetCurrentCv(nextDoc);
      setCvs((prev) =>
        prev.map((doc) =>
          String(doc.id) === String(nextDoc.id) ? nextDoc : doc,
        ),
      );
      cacheDocumentLocally(nextDoc);

      if (!canUseRemoteCvRef.current) {
        pendingRemoteSaveRef.current = nextDoc;
        setRemoteSaveStatus({ status: "idle" });
        dbg(
          "[CvLibraryContext] saveCurrentCvStyleOnly: remote metadata save deferred until Convex auth is ready",
          { docId: nextDoc.id },
        );
        return;
      }

      setRemoteSaveStatus({
        status: "saving",
        documentId: String(nextDoc.id),
      });
      try {
        const metadataSaveResult = await adapter.saveMetadataPatch(nextDoc.id, {
          verbatiStyle,
          ...(resumeTemplateId ? { resumeTemplateId } : null),
          ...durableStyleMetadata,
        } as any);
        if (
          metadataSaveResult &&
          typeof metadataSaveResult === "object" &&
          (metadataSaveResult as { written?: unknown }).written === false &&
          (metadataSaveResult as { reason?: unknown }).reason ===
            "not_found_metadata_only"
        ) {
          const { cvState: _legacyCvState, ...persistableDoc } =
            nextDoc as any;
          await adapter.save(persistableDoc as CvDocument);
        }
        setRemoteSaveStatus({
          status: "synced",
          documentId: String(nextDoc.id),
        });
      } catch (error) {
        const classified = classifyRemoteSaveError(error);
        setRemoteSaveStatus({
          status: "failed",
          documentId: String(nextDoc.id),
          error: classified.message,
          reason: classified.reason,
        });
        throw error;
      }
    },
    [adapter],
  );

  // Trigger debounced persistence whenever the current CV is mutated and considered dirty.
  // Re-introducing a more controlled and stable save trigger. The previous effect,
  // which was dependent on the entire `currentCv` object, was the source of the
  // re-render loops. The deep equality check was insufficient to prevent re-renders
  // when object identities for nested properties changed, even if values were the same.
  //
  // This revised effect is triggered *only* by the `isDirty` flag. When the document
  // is dirty, it schedules a save. Once the save completes, `lastSavedRef` is updated,
  // `isDirty` becomes false, and the effect stabilizes until the next user edit.
  // This decouples the save logic from the volatile `currentCv` object identity.
  useEffect(() => {
    if (isDirty && currentCv && !isSavingRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      void scheduleSave(currentCv);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  useEffect(() => {
    if (!canUseRemoteCv || isSavingRef.current) {
      return;
    }
    const pendingDoc =
      pendingRemoteSaveRef.current ??
      (isDirtyRef.current ? currentCvRef.current ?? currentCv : null);
    if (!pendingDoc) {
      return;
    }
    pendingRemoteSaveRef.current = null;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    void scheduleSave(pendingDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseRemoteCv]);

  // Atomic actions implementations -------------------------------------------------
  function updateSectionTitle(sectionId: string, newTitle: string) {
    if (!currentCv) return;
    const prev = currentCv.sections.find(
      (s) => String(s.id) === String(sectionId),
    );
    if (prev && String(prev.title ?? "") === String(newTitle ?? "")) {
      // No effective change; avoid state update to prevent churn
      return;
    }
    safeSetCurrentCv({
      ...currentCv,
      sections: currentCv.sections.map((s) =>
        String(s.id) === String(sectionId) ? { ...s, title: newTitle } : s,
      ),
    });
  }

  function updateBlockContent(
    sectionId: string,
    blockId: string,
    newContent: RemirrorJSON,
  ) {
    if (!currentCv) return;

    try {
      dbg("[CvLibraryContext] updateBlockContent called", {
        passedSectionId: sectionId,
        blockId,
        contentHasNodes: Array.isArray((newContent as any)?.content),
      });
    } catch {
      /* noop */
    }

    // Locate the section that actually contains the block, falling back if the passed sectionId is stale
    let targetSectionIdx = currentCv.sections.findIndex(
      (s) =>
        String(s.id) === String(sectionId) &&
        Array.isArray(s.blocks) &&
        s.blocks.some((b) => String(b.id) === String(blockId)),
    );
    if (targetSectionIdx === -1) {
      targetSectionIdx = currentCv.sections.findIndex(
        (s) =>
          Array.isArray(s.blocks) &&
          s.blocks.some((b) => String(b.id) === String(blockId)),
      );
    }
    if (targetSectionIdx === -1) {
      try {
        dbg(
          "[CvLibraryContext] updateBlockContent no target section found for block",
          { blockId },
        );
      } catch {
        /* noop */
      }
      return;
    }

    const sec = currentCv.sections[targetSectionIdx];
    const prevBlock = sec?.blocks?.find(
      (b) => String(b.id) === String(blockId),
    );
    if (prevBlock && deepEqual(prevBlock.content, newContent)) {
      try {
        dbg("[CvLibraryContext] updateBlockContent noop (deepEqual)", {
          blockId,
        });
      } catch {
        /* noop */
      }
      return;
    }

    safeSetCurrentCv({
      ...currentCv,
      sections: currentCv.sections.map((s, i) =>
        i === targetSectionIdx
          ? {
              ...s,
              blocks: (s.blocks ?? []).map((b) =>
                String(b.id) === String(blockId)
                  ? { ...b, content: newContent }
                  : b,
              ),
            }
          : s,
      ),
    });

    try {
      const nextSections = currentCv.sections.map((s, i) =>
        i === targetSectionIdx
          ? {
              ...s,
              blocks: (s.blocks ?? []).map((b) =>
                String(b.id) === String(blockId)
                  ? { ...b, content: newContent }
                  : b,
              ),
            }
          : s,
      );
      const next = applyAutoTitleIfPlaceholder({
        ...currentCv,
        sections: nextSections,
      });
      syncEditedDocumentLocally(next);
    } catch {
      /* noop */
    }

    try {
      dbg("[CvLibraryContext] updateBlockContent applied", {
        sectionId: String(currentCv.sections[targetSectionIdx].id),
        blockId,
      });
    } catch {
      /* noop */
    }
  }
  // removed duplicate unsafe block left by a previous replacement

  function updateBlockTitle(
    sectionId: string,
    blockId: string,
    newTitle: string,
  ) {
    try {
      dbg("[CvLibraryContext] updateBlockTitle called", {
        sectionId,
        blockId,
        newTitle,
      });
    } catch {
      /* noop */
    }

    if (!currentCv) return;
    const sec = currentCv.sections.find(
      (s) => String(s.id) === String(sectionId),
    );
    const prevBlock = sec?.blocks?.find(
      (b) => String(b.id) === String(blockId),
    );
    if (prevBlock && String(prevBlock.title ?? "") === String(newTitle ?? "")) {
      try {
        dbg("[CvLibraryContext] updateBlockTitle noop (same title)", {
          blockId,
          newTitle,
        });
      } catch {
        /* noop */
      }
      // No title change; avoid unnecessary updates
      return;
    }
    safeSetCurrentCv({
      ...currentCv,
      sections: currentCv.sections.map((s) =>
        String(s.id) === String(sectionId)
          ? {
              ...s,
              blocks: (s.blocks ?? []).map((b) =>
                String(b.id) === String(blockId)
                  ? { ...b, title: newTitle }
                  : b,
              ),
            }
          : s,
      ),
    });

    try {
      dbg("[CvLibraryContext] updateBlockTitle applied", {
        sectionId,
        blockId,
        newTitle,
      });
    } catch {
      /* noop */
    }
  }

  /**
   * Patch a structured item (experience/education) inside a section by id.
   * Early-return when the patch is a no-op to avoid unnecessary remounts.
   * Note: legacy items may store identifier under _id instead of id.
   */
  function updateStructuredItem(
    sectionId: string,
    itemId: string,
    patch: Partial<Record<string, any>>,
  ) {
    try {
      dbg("[CvLibraryContext] updateStructuredItem called", {
        sectionId,
        itemId,
        patchKeys: Object.keys(patch || {}),
      });
    } catch {
      /* noop */
    }

    if (!currentCv) return;

    // Find owning section and item indices for targeted updates
    const secIdx = currentCv.sections.findIndex(
      (s) => String(s.id) === String(sectionId),
    );
    if (secIdx === -1) return;

    const sec = currentCv.sections[secIdx];
    if (!Array.isArray((sec as any).structuredContent)) return;

    const items = (sec as any).structuredContent as any[];
    const itemIdx = items.findIndex((it) => {
      const curId = String((it as any)?.id ?? (it as any)?._id ?? "");
      return curId === String(itemId);
    });
    if (itemIdx === -1) return;

    const prevItem = items[itemIdx];
    // Preserve existing identifiers; ensure id populated for consistent lookups
    const preservedId =
      (prevItem as any)?.id ?? (prevItem as any)?._id ?? itemId;
    const nextItem = { ...prevItem, ...patch, id: preservedId };

    // Compute changed keys for diagnostics
    try {
      const keys = Array.from(
        new Set([
          ...Object.keys(prevItem ?? {}),
          ...Object.keys(nextItem ?? {}),
        ]),
      );
      const changed = keys.filter(
        (k) =>
          JSON.stringify((prevItem as any)?.[k]) !==
          JSON.stringify((nextItem as any)?.[k]),
      );
      try {
        const previewObj = {
          company: (nextItem as any)?.company,
          position: (nextItem as any)?.position,
          location: (nextItem as any)?.location,
          achievementsLen: Array.isArray((nextItem as any)?.achievements)
            ? (nextItem as any).achievements.length
            : undefined,
          institution: (nextItem as any)?.institution,
          degree: (nextItem as any)?.degree,
          fieldOfStudy: (nextItem as any)?.fieldOfStudy,
          grade: (nextItem as any)?.grade,
          startDate: (nextItem as any)?.startDate,
          endDate: (nextItem as any)?.endDate,
        };
        dbg("[CvLibraryContext] updateStructuredItem diff", {
          sectionId,
          itemId,
          changedKeys: changed.slice(0, 16),
          preview: previewObj,
          previewJson: JSON.stringify(previewObj),
        });
      } catch {
        dbg("[CvLibraryContext] updateStructuredItem diff", {
          sectionId,
          itemId,
          changedKeys: changed.slice(0, 16),
        });
      }
    } catch {
      /* noop */
    }

    // No-op short-circuit
    if (deepEqual(prevItem, nextItem)) {
      try {
        dbg("[CvLibraryContext] updateStructuredItem noop (deepEqual)", {
          sectionId,
          itemId,
        });
      } catch {
        /* noop */
      }
      return;
    }

    // Construct next arrays preserving identities where possible
    const nextStructured = items.map((it, i) =>
      i === itemIdx ? nextItem : it,
    );
    const nextSections = currentCv.sections.map((s, i) =>
      i === secIdx
        ? ({ ...s, structuredContent: nextStructured } as CvSection)
        : s,
    );

    const next = applyAutoTitleIfPlaceholder({
      ...currentCv,
      sections: nextSections,
    });

    try {
      dbg("[CvLibraryContext] updateStructuredItem applied", {
        sectionId,
        itemId,
        newKeys: Object.keys(nextItem).slice(0, 12),
      });
    } catch {
      /* noop */
    }

    safeSetCurrentCv(next);
    setCvs((prev) =>
      prev.map((doc) => (String(doc.id) === String(next.id) ? next : doc)),
    );
    syncEditedDocumentLocally(next);
  }

  function addBlock(sectionId: string, block: CvBlock, index?: number) {
    // Ensure any buffered local edits are flushed before mutating the document.
    try {
      flushPendingEdits();
    } catch {
      /* noop */
    }
    setCurrentCv((prev) => {
      // If there is no current CV, create a new CV with a single section (fallback)
      if (!prev) {
        const cvId = uuidv4();
        const secId = sectionId ?? uuidv4();
        const toInsertBlock = createNormalizedBlock(block, 0);
        const newSection: CvSection = {
          id: secId,
          title: "New Section",
          type: "text",
          blocks: [toInsertBlock],
          structuredContent: undefined,
          collapsed: false,
        } as CvSection;
        const newCv: CvDocument = {
          id: cvId,
          title: "Untitled CV",
          metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
          } as any,
          sections: [newSection],
        } as CvDocument;
        return newCv;
      }

      const nextSections = prev.sections.map((s) => {
        if (String(s.id) !== String(sectionId)) return s;

        const blocks = Array.isArray(s.blocks) ? [...s.blocks] : [];
        const stype = String((s as any)?.type ?? "")
          .toLowerCase()
          .trim();
        const isTyped = stype === "experience" || stype === "education";

        // Ensure representative linking for typed sections (experience/education)
        let nextStructured: any[] = Array.isArray(s.structuredContent)
          ? [...(s.structuredContent as any[])]
          : [];
        let toInsertInput: any = block;

        if (isTyped) {
          const existingLinked =
            (block as any)?.attributes?.linkedStructuredId ??
            (block as any)?.attributes?.linkedstructuredid;

          if (!existingLinked) {
            // Auto-generate a structured item and link the new block to it
            const newItem =
              stype === "experience"
                ? (makeExperienceItem as any)()
                : (makeEducationItem as any)();
            nextStructured.push(newItem);
            toInsertInput = {
              ...(block as any),
              attributes: {
                ...((block as any).attributes ?? {}),
                linkedStructuredId: newItem.id,
              },
              title:
                (block as any).title ??
                (stype === "experience"
                  ? String(newItem.company ?? newItem.position ?? "Experience")
                  : String(newItem.institution ?? "Education")),
            };
            try {
              dbg(
                "[CvLibraryContext] addBlock: auto-linked block for typed section",
                {
                  sectionId: String(s.id),
                  newItemId: String(newItem.id),
                },
              );
            } catch {
              /* noop */
            }
          } else {
            // If the caller provided a linked id, ensure structuredContent contains a matching item (id or _id)
            const exists = nextStructured.some(
              (it) =>
                String((it as any)?.id ?? (it as any)?._id) ===
                String(existingLinked),
            );
            if (!exists) {
              // Create a minimal placeholder structured item with the provided id so the inspector can resolve it.
              const placeholder =
                stype === "experience"
                  ? {
                      ...(makeExperienceItem as any)(),
                      id: String(existingLinked),
                    }
                  : {
                      ...(makeEducationItem as any)(),
                      id: String(existingLinked),
                    };
              nextStructured.push(placeholder);
              try {
                dbg(
                  "[CvLibraryContext] addBlock: linked id not found in structuredContent, created placeholder",
                  {
                    sectionId: String(s.id),
                    linkedId: String(existingLinked),
                  },
                );
              } catch {
                /* noop */
              }
            }
          }
        }

        const toInsert = createNormalizedBlock(toInsertInput, blocks.length);
        if (typeof index === "number" && index >= 0 && index <= blocks.length) {
          blocks.splice(index, 0, toInsert);
        } else {
          blocks.push(toInsert);
        }

        return {
          ...s,
          blocks,
          structuredContent: isTyped
            ? (nextStructured as any)
            : s.structuredContent,
        };
      });

      const next: CvDocument = { ...prev, sections: nextSections };
      return next;
    });
  }

  function deleteBlock(sectionId: string, blockId: string) {
    try {
      flushPendingEdits();
    } catch {
      /* noop */
    }
    setCurrentCv((prev) => {
      if (!prev) return prev;
      const nextSections = prev.sections.map((s) =>
        s.id === sectionId
          ? { ...s, blocks: (s.blocks ?? []).filter((b) => b.id !== blockId) }
          : s,
      );
      const next: CvDocument = { ...prev, sections: nextSections };
      return next;
    });
  }

  function reorderBlocks(sectionId: string, newOrder: CvBlock[]) {
    try {
      flushPendingEdits();
    } catch {
      /* noop */
    }
    setCurrentCv((prev) => {
      if (!prev) return prev;
      const nextSections = prev.sections.map((s) =>
        s.id === sectionId ? { ...s, blocks: [...newOrder] } : s,
      );
      const next: CvDocument = { ...prev, sections: nextSections };
      return next;
    });
  }

  /**
   * Add a new section to the currentCv. The provided section is shallow-copied and
   * assigned an id if missing. For typed sections (experience/education) that include
   * structuredContent but no blocks we auto-generate representative blocks so the
   * block-based UI has an editable block to attach to each structured entry.
   */
  function addSection(section: CvSection) {
    try {
      flushPendingEdits();
    } catch {
      /* noop */
    }
    setCurrentCv((prev) => {
      const generatedId = section.id ?? uuidv4();
      let toInsert = {
        ...section,
        id: generatedId,
        blocks: Array.isArray(section.blocks) ? [...section.blocks] : [],
      } as CvSection;

      // Aggressive v1 enforcement: normalize any v1-typed section to v1 shape at insertion time.
      // This seeds structuredContent for profile/summary/experience/education/skills/languages,
      // and ensures a linked summary block exists.
      try {
        const before = toInsert;
        toInsert = normalizeToV1Section(toInsert);
        try {
          dbg("[CvLibraryContext] addSection.normalizeToV1Section applied", {
            sectionId: String(toInsert.id ?? ""),
            type: String((toInsert as any)?.type ?? ""),
            hadChange: !deepEqual(before, toInsert),
            blocks: Array.isArray((toInsert as any)?.blocks)
              ? (toInsert as any).blocks.length
              : 0,
            structuredCount: Array.isArray((toInsert as any)?.structuredContent)
              ? (toInsert as any).structuredContent.length
              : 0,
          });
        } catch {
          /* noop */
        }
      } catch {
        /* non-fatal */
      }

      let nextCv: CvDocument;

      // If there is no current CV, create a new one containing this section.
      if (!prev) {
        const cvId = uuidv4();
        nextCv = {
          id: cvId,
          title: toInsert.title || "Untitled CV",
          metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
          } as any,
          sections: [toInsert],
        } as CvDocument;
      } else {
        const preferredSectionOrder = [
          "profile",
          "summary",
          "experience",
          "achievements",
          "education",
          "skills",
          "languages",
        ] as const;
        const preferredOrderIndex = new Map(
          preferredSectionOrder.map(
            (sectionType, index) => [sectionType, index] as const,
          ),
        );
        const nextSections = [...prev.sections, toInsert]
          .map((entry, index) => ({ entry, index }))
          .sort((a, b) => {
            const aType = String((a.entry as any)?.type ?? "");
            const bType = String((b.entry as any)?.type ?? "");
            const aRank =
              preferredOrderIndex.get(aType as any) ?? Number.MAX_SAFE_INTEGER;
            const bRank =
              preferredOrderIndex.get(bType as any) ?? Number.MAX_SAFE_INTEGER;
            if (aRank !== bRank) return aRank - bRank;
            return a.index - b.index;
          })
          .map(({ entry }) => entry);
        nextCv = { ...prev, sections: nextSections };
      }

      // Centralized: generate representative blocks for typed sections
      return ensureRepresentativeBlocks(nextCv);
    });
  }

  /**
   * Reorder top-level sections by providing the new ordered array.
   */
  function reorderSections(newOrder: CvSection[]) {
    try {
      flushPendingEdits();
    } catch {
      /* noop */
    }
    if (!Array.isArray(newOrder) || newOrder.length === 0) {
      return;
    }

    const now = new Date().toISOString();
    const creatingImportedCv = !currentCv;
    const base: CvDocument = currentCv
      ? {
          ...currentCv,
          metadata: {
            ...(currentCv.metadata as any),
            updatedAt: now,
          },
        }
      : ({
          id: uuidv4(),
          title: deriveCvTitleFromSections(newOrder),
          metadata: {
            createdAt: now,
            updatedAt: now,
            version: 1,
          } as any,
          sections: [],
        } as CvDocument);

    const nextDoc = applyAutoTitleIfPlaceholder(
      ensureRepresentativeBlocks({ ...base, sections: [...newOrder] }),
    );

    safeSetCurrentCv(nextDoc);
    setCvs((prevList) => {
      const idx = prevList.findIndex(
        (doc) => String(doc.id) === String(nextDoc.id),
      );
      if (idx >= 0) {
        const copy = [...prevList];
        copy[idx] = nextDoc;
        return copy;
      }
      return [...prevList, nextDoc];
    });
    cacheDocumentLocally(nextDoc);
    if (creatingImportedCv) {
      void scheduleSave(nextDoc);
    }
  }
  // Back-compat: expose current CV id for older tests
  const currentCvId = currentCv ? String(currentCv.id) : null;

  useEffect(() => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      if (!hasHydratedActiveCvRef.current || pendingActiveRestoreIdRef.current)
        return;
      if (currentCvId) {
        writeStoredActiveCvId(currentCvId);
      }
    } catch {
      /* best-effort */
    }
  }, [currentCvId, isLoading]);

  useEffect(() => {
    if (!canUseRemoteCv) {
      return;
    }
    if (!hasHydratedActiveCvRef.current || pendingActiveRestoreIdRef.current) {
      return;
    }

    const nextSnapshot = currentCv
      ? buildActiveCvSnapshotFromCvDocument(currentCv)
      : null;
    if (deepEqual(lastSyncedActiveCvSnapshotRef.current, nextSnapshot)) {
      return;
    }

    if (activeCvSnapshotSyncTimeoutRef.current) {
      clearTimeout(activeCvSnapshotSyncTimeoutRef.current);
      activeCvSnapshotSyncTimeoutRef.current = null;
    }

    activeCvSnapshotSyncTimeoutRef.current = setTimeout(() => {
      const snapshotToSync = nextSnapshot;
      activeCvSnapshotSyncTimeoutRef.current = null;
      void setActiveCvSnapshot({ snapshot: snapshotToSync })
        .then(() => {
          lastSyncedActiveCvSnapshotRef.current = snapshotToSync;
        })
        .catch((err) => {
          console.warn(
            "[CvLibraryContext] active CV snapshot sync failed",
            err,
          );
        });
    }, DEBOUNCE_MS);

    return () => {
      if (activeCvSnapshotSyncTimeoutRef.current) {
        clearTimeout(activeCvSnapshotSyncTimeoutRef.current);
        activeCvSnapshotSyncTimeoutRef.current = null;
      }
    };
  }, [canUseRemoteCv, currentCv, isLoading, setActiveCvSnapshot]);

  // ------- Back-compat API shims used by legacy tests -------
  function updateCurrentCv(newState: Partial<CvDocument>): void {
    if (!currentCv) return;
    const id = String(currentCv.id);
    cvEditorDebugInfo("[cv-context-debug] updateCurrentCv", {
      patchKeys: Object.keys(newState ?? {}),
      routeProfileId: readRequestedCvIdFromWindowLocation(),
      currentCvId: id,
      hasSections: Array.isArray((newState as any)?.sections),
    });

    const hasLegacyCvStateShape =
      "source" in (newState as Record<string, unknown>) ||
      "history" in (newState as Record<string, unknown>);
    const looksLikeCvDocumentPatch =
      Array.isArray((newState as any).sections) &&
      !hasLegacyCvStateShape &&
      (((newState as any).sections as unknown[]).length === 0 ||
        ((newState as any).sections as unknown[]).some(
          (section) =>
            section &&
            typeof section === "object" &&
            (typeof (section as any).type === "string" ||
              Array.isArray((section as any).blocks) ||
              Array.isArray((section as any).structuredContent)),
        )
      );

    if (looksLikeCvDocumentPatch) {
      const now = new Date().toISOString();
      const nextDoc = applyAutoTitleIfPlaceholder(
        ensureRepresentativeBlocks(
          normalizeToV1Document({
            ...currentCv,
            ...newState,
            id,
            metadata: {
              ...(currentCv.metadata ?? {
                createdAt: now,
                version: 1,
              }),
              ...((newState as CvDocument).metadata ?? {}),
              createdAt:
                (newState as CvDocument).metadata?.createdAt ??
                currentCv.metadata?.createdAt ??
                now,
              updatedAt: now,
              version:
                (newState as CvDocument).metadata?.version ??
                currentCv.metadata?.version ??
                1,
            } as CvDocument["metadata"],
          } as CvDocument),
        ),
      );

      safeSetCurrentCv(nextDoc);
      setCvs((prev) =>
        prev.map((doc) => (String(doc.id) === id ? nextDoc : doc)),
      );
      syncEditedDocumentLocally(nextDoc);
      void scheduleSave(nextDoc);
      return;
    }

    // Push previous cvState to undo stack
    const undoStack = undoStackRef.current.get(id) ?? [];
    const prevState = (currentCv as any).cvState;
    if (prevState !== undefined) undoStack.push(prevState);
    undoStackRef.current.set(id, undoStack);
    // Clear redo on new edit
    redoStackRef.current.set(id, []);
    // Set new legacy cvState without mutating the normalized sections
    const nextAny = { ...(currentCv as any), cvState: newState as any };
    safeSetCurrentCv(nextAny as CvDocument);
    // Also update library index so persisted copy contains the legacy cvState for back-compat tests
    try {
      setCvs((prev) =>
        prev.map((c) =>
          String(c.id) === id
            ? ({ ...(c as any), cvState: newState as any } as any)
            : c,
        ),
      );
    } catch {
      /* noop */
    }
  }

  function deleteCvCtx(id: string): void {
    try {
      if (typeof window !== "undefined" && (window as any).localStorage) {
        if (readStoredActiveCvId() === String(id)) {
          writeStoredActiveCvId(null);
        }
        (window as any).localStorage.removeItem(
          getLocalCvDocumentStorageKey(id),
        );
        (window as any).localStorage.removeItem(
          getLegacyLocalCvDocumentStorageKey(id),
        );
      }
    } catch {
      /* noop */
    }
    setCvs((prev) => prev.filter((c) => String(c.id) !== String(id)));
    if (currentCv && String(currentCv.id) === String(id)) {
      safeSetCurrentCv(null);
    }
  }

  function renameCvCtx(id: string, newTitle: string): void {
    let renamedCurrent: CvDocument | null = null;
    setCvs((prev) =>
      prev.map((c) =>
        String(c.id) === String(id) ? applyManualTitle(c, newTitle) : c,
      ),
    );
    const activeCv = currentCvRef.current ?? currentCv;
    if (activeCv && String(activeCv.id) === String(id)) {
      renamedCurrent = applyManualTitle(activeCv, newTitle);
      safeSetCurrentCv(renamedCurrent);
    }
    if (renamedCurrent) {
      cacheDocumentLocally(renamedCurrent);
      void scheduleSave(renamedCurrent);
    }
  }

  // Back-compat undo/redo operating on legacy cvState only
  function undoCtx(): void {
    if (!currentCv) return;
    const id = String(currentCv.id);
    const stack = undoStackRef.current.get(id) ?? [];
    if (stack.length === 0) return;
    const previous = stack.pop()!;
    undoStackRef.current.set(id, stack);
    const cur = (currentCv as any).cvState;
    const redo = redoStackRef.current.get(id) ?? [];
    if (cur !== undefined) {
      redo.push(cur);
      redoStackRef.current.set(id, redo);
    }
    const nextAny = { ...(currentCv as any), cvState: previous };
    safeSetCurrentCv(nextAny as CvDocument);
    try {
      setCvs((prev) =>
        prev.map((c) =>
          String(c.id) === id
            ? ({ ...(c as any), cvState: previous } as any)
            : c,
        ),
      );
    } catch {
      /* noop */
    }
  }

  function redoCtx(): void {
    if (!currentCv) return;
    const id = String(currentCv.id);
    const redo = redoStackRef.current.get(id) ?? [];
    if (redo.length === 0) return;
    const nextState = redo.pop()!;
    redoStackRef.current.set(id, redo);
    const cur = (currentCv as any).cvState;
    const undo = undoStackRef.current.get(id) ?? [];
    if (cur !== undefined) {
      undo.push(cur);
      undoStackRef.current.set(id, undo);
    }
    const nextAny = { ...(currentCv as any), cvState: nextState };
    safeSetCurrentCv(nextAny as CvDocument);
    try {
      setCvs((prev) =>
        prev.map((c) =>
          String(c.id) === id
            ? ({ ...(c as any), cvState: nextState } as any)
            : c,
        ),
      );
    } catch {
      /* noop */
    }
  }

  // Expose provider value (memoized to reduce rerenders)
  const value: ICvLibraryContext = useMemo(
    () => ({
      cvs,
      currentCv,
      currentCvId,
      isLoading,
      isLibraryHydrated,
      lastLibraryFetchFailed,
      isVisualRestorePending,
      isDirty,
      remoteSaveStatus,
      // runtime v1 detector exposed to consumers
      isV1Active,
      hasMeaningfulContent: hasMeaningfulCvContent(currentCv),
      loadCv,
      hydrateCvDocument,
      saveCurrentCv,
      createCvFromState,
      createNewCv,
      importCv,
      saveCurrentCvStyleOnly,
      updateSectionTitle,
      updateBlockTitle,
      updateBlockContent,
      addBlock,
      deleteBlock,
      reorderBlocks,
      reorderSections,
      addSection,
      updateStructuredItem,

      // Back-compat API expected by legacy tests
      updateCurrentCv,
      deleteCv: deleteCvCtx,
      renameCv: renameCvCtx,

      registerFlushCallback,
      registerBlockFlushCallback,
      flushPendingEdits,

      // Inspector API (top-level) so modal state survives BlockRenderer remounts
      selectedInspector,
      openInspector,
      closeInspector,

      activeEditorBlockId,
      setActiveEditorBlockId,

      // Back-compat undo/redo state derived from stacks for current document
      canUndo: Boolean(
        currentCv &&
          (undoStackRef.current.get(String(currentCv.id))?.length ?? 0) > 0,
      ),
      canRedo: Boolean(
        currentCv &&
          (redoStackRef.current.get(String(currentCv.id))?.length ?? 0) > 0,
      ),
      undo: undoCtx,
      redo: redoCtx,
    }),
    [
      cvs,
      currentCv,
      currentCvId,
      isLoading,
      isLibraryHydrated,
      lastLibraryFetchFailed,
      isVisualRestorePending,
      isDirty,
      remoteSaveStatus,
      loadCv,
      hydrateCvDocument,
      saveCurrentCv,
      createCvFromState,
      createNewCv,
      importCv,
      saveCurrentCvStyleOnly,
      updateSectionTitle,
      updateBlockTitle,
      updateBlockContent,
      addBlock,
      deleteBlock,
      reorderBlocks,
      reorderSections,
      addSection,
      updateStructuredItem,

      updateCurrentCv,
      deleteCvCtx,
      renameCvCtx,

      registerFlushCallback,
      registerBlockFlushCallback,
      flushPendingEdits,
      selectedInspector,
      openInspector,
      closeInspector,
      activeEditorBlockId,
      setActiveEditorBlockId,
      undoCtx,
      redoCtx,
    ],
  );

  return (
    <CvLibraryContext.Provider value={value}>
      {children}
    </CvLibraryContext.Provider>
  );
};

/**
 * Aggressive v1 normalization helpers
 * - normalizeToV1Section: coerces a section into v1 shape for known v1 types
 * - normalizeToV1Document: applies section normalization across the document
 *
 * Behaviors:
 * - profile/skills/languages: ensure structuredContent with a single skeleton item
 * - experience/education: ensure structuredContent exists (blocks will be handled by ensureRepresentativeBlocks)
 * - summary: ensure structuredContent with a summary item AND a linked text block pointing to that item
 */
function normalizeToV1Section(input: CvSection): CvSection {
  try {
    const t = String((input as any)?.type ?? "")
      .toLowerCase()
      .trim();
    if (
      ![
        "profile",
        "summary",
        "experience",
        "education",
        "skills",
        "languages",
      ].includes(t)
    ) {
      return input;
    }

    let s: CvSection = {
      ...input,
      blocks: Array.isArray((input as any).blocks)
        ? [...(input as any).blocks]
        : [],
    } as CvSection;

    if (t === "profile" && !Array.isArray((s as any).structuredContent)) {
      s = {
        ...(s as any),
        structuredContent: [(makeProfileItem as any)()],
      } as CvSection;
    }

    if (t === "skills" && !Array.isArray((s as any).structuredContent)) {
      s = {
        ...(s as any),
        structuredContent: [(makeSkillItem as any)()],
      } as CvSection;
    }

    if (t === "languages" && !Array.isArray((s as any).structuredContent)) {
      s = {
        ...(s as any),
        structuredContent: [(makeLanguageItem as any)()],
      } as CvSection;
    }

    if (t === "experience" && !Array.isArray((s as any).structuredContent)) {
      s = {
        ...(s as any),
        structuredContent: [(makeExperienceItem as any)()],
      } as CvSection;
    }

    if (t === "education" && !Array.isArray((s as any).structuredContent)) {
      s = {
        ...(s as any),
        structuredContent: [(makeEducationItem as any)()],
      } as CvSection;
    }

    if (t === "summary") {
      const hasStructured = Array.isArray((s as any).structuredContent);
      let summaryItem: any | null = null;

      if (
        !hasStructured ||
        ((s as any).structuredContent as any[]).length === 0
      ) {
        summaryItem = (makeSummaryItem as any)();
        s = { ...(s as any), structuredContent: [summaryItem] } as CvSection;
      } else {
        summaryItem = ((s as any).structuredContent as any[])[0];
        if (!summaryItem || !summaryItem.id) {
          summaryItem = (makeSummaryItem as any)();
          s = { ...(s as any), structuredContent: [summaryItem] } as CvSection;
        }
      }

      // Ensure at least one block links to the summary structured item
      const hasLinked = (s.blocks ?? []).some((b: any) => {
        try {
          const linked =
            (b as any)?.attributes?.linkedStructuredId ??
            (b as any)?.attributes?.linkedstructuredid;
          return String(linked) === String(summaryItem.id);
        } catch {
          return false;
        }
      });

      if (!hasLinked) {
        const newBlock: CvBlock = {
          id: uuidv4(),
          title: "Summary",
          type: "text",
          content: ensureRemirrorDoc((summaryItem as any).summary),
          attributes: { linkedStructuredId: summaryItem.id },
        } as any;
        s = { ...s, blocks: [...(s.blocks ?? []), newBlock] } as CvSection;
      }
    }

    return s;
  } catch {
    return input;
  }
}

function normalizeToV1Document(doc: CvDocument): CvDocument {
  try {
    if (!doc || !Array.isArray(doc.sections)) return doc;
    const nextSections = (doc.sections as any[]).map((sec) =>
      normalizeToV1Section(sec as CvSection),
    );
    const out: CvDocument = {
      ...(doc as any),
      sections: nextSections,
    } as CvDocument;
    try {
      dbg("[CvLibraryContext] normalizeToV1Document applied", {
        sectionTypes: nextSections.map((s: any) => String(s?.type ?? "")),
      });
    } catch {
      /* noop */
    }
    return out;
  } catch {
    return doc;
  }
}

export function useCvLibrary(): ICvLibraryContext {
  const ctx = useContext(CvLibraryContext);
  if (!ctx)
    throw new Error("useCvLibrary must be used within a CvLibraryProvider");
  return ctx;
}
