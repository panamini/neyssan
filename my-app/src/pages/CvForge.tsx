import React from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useLocation, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { Check, Eye, Palette, PenLine, X } from "@/lib/icons";
import { api } from "../../convex/_generated/api";
import { ProfileReviewCard } from "../components/ProfileReviewCard";
import ResumeExportControl from "../components/ResumeExportControl";
import type { ResumeExportRequest } from "../components/ResumeExportControl";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { VerbatiCvPreviewPanel } from "../features/verbati/VerbatiCvPreviewPanel";
import EmbeddedStyleInspector from "../components/EmbeddedStyleInspector";
import type {
  ResumeActiveTarget,
  ResumeLinkIntent,
} from "../features/verbati/resumeLinking";
import { useBoundVerbatiCvStyle } from "../features/verbati/useBoundVerbatiCvStyle";
import {
  resolveVerbatiStyle,
  sanitizePersistedVerbatiStyle,
} from "../features/verbati/style";
import {
  getProposalStyleDefinition,
  type ProposalStyleChoice,
} from "../lib/proposal-style-choice";
import type { ProposalPaletteId } from "../lib/proposal-style-display";
import type { VerbatiFontPairId } from "../features/verbati/fontCatalog";
import type { VerbatiStylePreset } from "../features/verbati/types";
import { useToast } from "../components/ui/toast";
import {
  buildAuthoritativeResumeDebugSnapshot,
  buildAuthoritativeResumeExportModel,
  readAuthoritativeResumeFromCv,
} from "../lib/authoritative-resume";
import {
  TRUSTED_MISTRAL_FILE_INPUT_ACCEPT,
  useStructuredMistralImport,
} from "../components/useStructuredMistralImport";
import {
  downloadAuthoritativeResumeExport,
  downloadStandardResumeExport,
} from "../lib/cv-export";
import dbg from "../lib/cv-debug";
import {
  buildResumePrintDebugSnapshot,
  buildResumeExportSource,
  buildStyledResumePrintSource,
} from "../lib/document-export-models";
import {
  applyHiddenSectionsToCvDocument,
  readStoredHiddenSectionIds,
  sanitizeHiddenSectionIds,
  writeStoredHiddenSectionIds,
} from "../lib/cv-section-organization";
import {
  buildResumeTypographyAuditMetadata,
  readResumePreviewDebugCapture,
  setStyledResumeExportContext,
} from "../lib/document-export-debug";
import { exportDocumentFile } from "../lib/exportDocumentFile";
import type { CvDocument } from "../types/cvDocument";
import {
  formatCvDisplayTitle,
} from "../lib/proposal-personalization";
import { deriveCvTitleFromSections } from "../lib/normalize-cv";
import {
  CvPickerCard,
  type CvPickerCardOption,
} from "../components/cv/CvPickerCard";

type CvForgeWorkspaceMode = "edit" | "preview";
type PresetSlotIndex = 1 | 2 | 3;
type SavedStylePresetSlot = {
  fontPairId: VerbatiFontPairId | null;
  styleChoice: ProposalStyleChoice;
  paletteOverride: ProposalPaletteId | null;
  accentHex: string | null;
  verbatiStyle?: Partial<VerbatiStylePreset> | null;
  voicePreset: "signature" | "expert" | "engaging" | null;
  name?: string;
};

type CvForgeCanonicalJob = {
  id: string;
  title: string;
  company: string;
} | null;

const CV_FORGE_WORKSPACE_MODE_STORAGE_KEY = "dasti:cv-forge-workspace-mode:v1";
const DEFAULT_PRESET_SLOT_NAMES: Record<PresetSlotIndex, string> = {
  1: "Style 1",
  2: "Style 2",
  3: "Style 3",
};

function readStoredCvForgeWorkspaceMode(): CvForgeWorkspaceMode {
  if (typeof window === "undefined") {
    return "edit";
  }

  return window.localStorage.getItem(CV_FORGE_WORKSPACE_MODE_STORAGE_KEY) ===
    "preview"
    ? "preview"
    : "edit";
}

function normalizePresetSlot(value: unknown): SavedStylePresetSlot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    fontPairId:
      typeof record.fontPairId === "string"
        ? (record.fontPairId as VerbatiFontPairId)
        : null,
    styleChoice:
      typeof record.styleChoice === "string"
        ? (record.styleChoice as ProposalStyleChoice)
        : "auto",
    paletteOverride:
      record.paletteOverride === "sauge" ||
      record.paletteOverride === "ocre" ||
      record.paletteOverride === "pierre" ||
      record.paletteOverride === "bordeaux" ||
      record.paletteOverride === "encre"
        ? (record.paletteOverride as ProposalPaletteId)
        : null,
    accentHex: typeof record.accentHex === "string" ? record.accentHex : null,
    verbatiStyle: sanitizePersistedVerbatiStyle(
      record.verbatiStyle as Partial<VerbatiStylePreset> | null | undefined,
    ),
    voicePreset:
      record.voicePreset === "signature" ||
      record.voicePreset === "expert" ||
      record.voicePreset === "engaging"
        ? record.voicePreset
        : null,
    name: typeof record.name === "string" ? record.name : undefined,
  };
}

function buildStylePresetFromSettingsSlot(
  preset: SavedStylePresetSlot,
): VerbatiStylePreset {
  const baseStyle = preset.verbatiStyle
    ? resolveVerbatiStyle(preset.verbatiStyle)
    : getProposalStyleDefinition(preset.styleChoice).stylePreset;

  return resolveVerbatiStyle({
    ...baseStyle,
    typography: preset.fontPairId ?? baseStyle.typography,
    ...(preset.accentHex
      ? {
          palette: "custom" as const,
          accentHex: preset.accentHex,
        }
      : preset.paletteOverride
        ? { palette: preset.paletteOverride }
      : null),
  });
}

function readCvPickerProfilePreview(
  cv: CvDocument,
): Record<string, unknown> | null {
  const profileSection = Array.isArray(cv.sections)
    ? cv.sections.find((section) => String(section.type) === "profile")
    : null;
  const profileEntry = Array.isArray(profileSection?.structuredContent)
    ? profileSection.structuredContent[0]
    : null;

  return profileEntry && typeof profileEntry === "object"
    ? (profileEntry as Record<string, unknown>)
    : null;
}

function readCvPickerString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function buildCvForgePickerOption(
  cv: CvDocument,
): CvPickerCardOption {
  const profilePreview = readCvPickerProfilePreview(cv);
  const profileName = readCvPickerString(profilePreview?.name);
  const desiredPosition =
    readCvPickerString(profilePreview?.desiredPosition) ??
    readCvPickerString(profilePreview?.title);

  return {
    id: String(cv.id),
    title: formatCvDisplayTitle({
      title: String(cv.title ?? "Untitled CV"),
      profileName,
      desiredPosition,
      email: readCvPickerString(profilePreview?.email),
      phone: readCvPickerString(profilePreview?.phone),
      linkedin: readCvPickerString(profilePreview?.linkedin),
      website: readCvPickerString(profilePreview?.website),
      location: readCvPickerString(profilePreview?.location),
    }),
    updatedAt:
      typeof cv.metadata?.updatedAt === "string" ? cv.metadata.updatedAt : undefined,
    createdAt:
      typeof cv.metadata?.createdAt === "string" ? cv.metadata.createdAt : undefined,
    profileName,
    desiredPosition,
    email: readCvPickerString(profilePreview?.email),
    phone: readCvPickerString(profilePreview?.phone),
    linkedin: readCvPickerString(profilePreview?.linkedin),
    website: readCvPickerString(profilePreview?.website),
  };
}

/**
 * CvForge — page Resume
 *
 * CvLibraryProvider et Sidebar sont montés au niveau App.tsx.
 * Cette page rend uniquement le contenu scrollable.
 * Intro panel .ip : eyebrow + h2 Fraunces + description (§13 dasti-spec-v1).
 */
export function CvForge(): JSX.Element {
  const location = useLocation();
  const { search } = location;
  const navigate = useNavigate();
  const {
    isAuthenticated: isConvexAuthenticated,
  } = useConvexAuth();
  const {
    currentCv,
    currentCvId,
    createNewCv,
    importCv,
    cvs,
    isLibraryHydrated,
    lastLibraryFetchFailed,
    loadCv,
  } = useCvLibrary();
  const { importFile: importStructuredCvFile } = useStructuredMistralImport({
    probeOnMount: false,
  });
  const cvImportInputRef = React.useRef<HTMLInputElement | null>(null);
  const presetMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [workspaceMode, setWorkspaceMode] =
    React.useState<CvForgeWorkspaceMode>(() =>
      readStoredCvForgeWorkspaceMode(),
    );
  const [resumeLinkIntent, setResumeLinkIntent] =
    React.useState<ResumeLinkIntent | null>(null);
  const [resumeActiveTarget, setResumeActiveTarget] =
    React.useState<ResumeActiveTarget | null>(null);
  const [hiddenSectionIds, setHiddenSectionIds] = React.useState<string[]>([]);

  const handleResumeLinkIntent = React.useCallback(
    (intent: ResumeLinkIntent) => {
      setResumeLinkIntent(intent);
      setResumeActiveTarget({
        sectionType: intent.sectionType,
        previewSectionType: intent.previewSectionType,
        itemId: intent.itemId,
        sectionId: intent.sectionId,
        source: intent.source,
      });
      if (workspaceMode === "preview" && !intent.shouldOpenModal) {
        setWorkspaceMode("edit");
      }
    },
    [workspaceMode],
  );

  const handleResumeLinkIntentHandled = React.useCallback(
    (requestId: string) => {
      setResumeLinkIntent((currentIntent) =>
        currentIntent?.requestId === requestId ? null : currentIntent,
      );
    },
    [],
  );
  const { stylePreset, setStylePreset } = useBoundVerbatiCvStyle({
    currentCv,
    importCv,
    debounceMs: 700,
    logPrefix: "[CvForge]",
  });
  const filteredPreviewCv = React.useMemo(
    () => applyHiddenSectionsToCvDocument(currentCv, hiddenSectionIds),
    [currentCv, hiddenSectionIds],
  );
  const sanitizedHiddenSectionIds = React.useMemo(
    () => sanitizeHiddenSectionIds(currentCv?.sections ?? [], hiddenSectionIds),
    [currentCv?.sections, hiddenSectionIds],
  );
  const savedStylePresets = useQuery(api.proposalSettings.getPresets);
  const [isStylePresetMenuOpen, setIsStylePresetMenuOpen] =
    React.useState(false);
  const [exportingFormat, setExportingFormat] = React.useState<string | null>(
    null,
  );
  const { showToast } = useToast();
  const [isCreatingEntryCv, setIsCreatingEntryCv] = React.useState(false);
  const [isImportingEntryCv, setIsImportingEntryCv] = React.useState(false);
  const [pendingEntryCvId, setPendingEntryCvId] = React.useState<string | null>(
    null,
  );
  const [pendingFreshEntryBaseCvId, setPendingFreshEntryBaseCvId] =
    React.useState<string | null>(null);
  const requestedCvId = React.useMemo(
    () => new URLSearchParams(search).get("id") || undefined,
    [search],
  );
  const cvPickerOptions = React.useMemo(
    () => cvs.map((cv) => buildCvForgePickerOption(cv)),
    [cvs],
  );
  const shouldShowEntryPicker =
    isLibraryHydrated && !lastLibraryFetchFailed && !requestedCvId;
  const entryPickerDefaultCvId = React.useMemo(() => {
    if (cvPickerOptions.length === 1) {
      return cvPickerOptions[0].id;
    }
    if (
      currentCvId &&
      cvPickerOptions.some((option) => option.id === currentCvId)
    ) {
      return currentCvId;
    }
    return cvPickerOptions[0]?.id ?? null;
  }, [currentCvId, cvPickerOptions]);

  React.useEffect(() => {
    if (!shouldShowEntryPicker) {
      setPendingEntryCvId(null);
      return;
    }

    setPendingEntryCvId((current) => {
      if (current && cvPickerOptions.some((option) => option.id === current)) {
        return current;
      }

      return entryPickerDefaultCvId;
    });
  }, [cvPickerOptions, entryPickerDefaultCvId, shouldShowEntryPicker]);

  const navigateToSelectedCv = React.useCallback(
    (cvId: string) => {
      const nextParams = new URLSearchParams(search);
      nextParams.set("id", cvId);
      const nextSearch = nextParams.toString();
      void navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : "",
        },
        {
          replace: true,
          state: location.state,
        },
      );
    },
    [location.pathname, location.state, navigate, search],
  );

  React.useEffect(() => {
    if (!pendingFreshEntryBaseCvId || !currentCvId) {
      return;
    }
    if (currentCvId === pendingFreshEntryBaseCvId) {
      return;
    }

    setPendingFreshEntryBaseCvId(null);
    navigateToSelectedCv(currentCvId);
  }, [currentCvId, navigateToSelectedCv, pendingFreshEntryBaseCvId]);

  React.useEffect(() => {
    const nextCvId = currentCv?.id ? String(currentCv.id) : null;
    if (!nextCvId) {
      setHiddenSectionIds([]);
      return;
    }

    setHiddenSectionIds(
      sanitizeHiddenSectionIds(
        currentCv?.sections ?? [],
        readStoredHiddenSectionIds(nextCvId),
      ),
    );
  }, [currentCv?.id]);

  React.useEffect(() => {
    if (
      sanitizedHiddenSectionIds.join("|") === hiddenSectionIds.join("|")
    ) {
      return;
    }

    setHiddenSectionIds(sanitizedHiddenSectionIds);
  }, [hiddenSectionIds, sanitizedHiddenSectionIds]);

  React.useEffect(() => {
    writeStoredHiddenSectionIds(
      currentCv?.id ? String(currentCv.id) : null,
      hiddenSectionIds,
    );
  }, [currentCv?.id, hiddenSectionIds]);
  const requestedJobId = React.useMemo(
    () => new URLSearchParams(search).get("jobId") || undefined,
    [search],
  );
  const requestedJobRecord = useQuery(
    ((api as any).jobsPublic?.getById ?? "jobsPublic.getById") as any,
    requestedJobId && isConvexAuthenticated ? { jobId: requestedJobId } : "skip",
  ) as CvForgeCanonicalJob | undefined;
  const selectedJobRecord = requestedJobRecord ?? null;
  const isSplitCanvas = viewportWidth >= 1240;
  const editorGridMaxWidth =
    workspaceMode === "edit"
      ? "100%"
      : isSplitCanvas
        ? "1240px"
        : "var(--cv-editor-shell-max-width)";
  const cvPreviewShellBlockSize =
    "min(var(--document-viewer-shell-max-block), calc(100dvh - var(--header-height) - (var(--space-2) * 2)))";

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      CV_FORGE_WORKSPACE_MODE_STORAGE_KEY,
      workspaceMode,
    );
  }, [workspaceMode]);

  React.useEffect(() => {
    if (!isStylePresetMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && !presetMenuRef.current?.contains(target)) {
        setIsStylePresetMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsStylePresetMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isStylePresetMenuOpen]);

  const authoritativeResume = React.useMemo(
    () => readAuthoritativeResumeFromCv(currentCv),
    [currentCv],
  );
  const authoritativeExportModel = React.useMemo(
    () => buildAuthoritativeResumeExportModel(authoritativeResume),
    [authoritativeResume],
  );
  const hasTrustedExport = authoritativeExportModel !== null;
  const exportStatusLabel = hasTrustedExport ? "ATS Ready" : "Standard Export";
  const exportStatusDescription = hasTrustedExport
    ? "Trusted Mistral v3"
    : "Not ATS-verified";

  const handleResumeExport = React.useCallback(
    async (request: ResumeExportRequest) => {
      dbg(
        "[CvForge] export authoritative snapshot",
        buildAuthoritativeResumeDebugSnapshot({
          authoritativeResume,
          metadataAuthoritativeResumePresent: Boolean(
            currentCv?.metadata?.authoritativeResume,
          ),
        }),
      );

      if (!currentCv) {
        showToast("Open or create a CV before exporting", {
          variant: "warning",
        });
        return;
      }

      const exportCurrentCv = filteredPreviewCv ?? currentCv;

      const exportKey =
        request.format === "pdf" ? `pdf:${request.mode}` : request.format;
      setExportingFormat(exportKey);
      try {
        const exported =
          request.format === "pdf" || request.format === "docx"
            ? await (async () => {
                const source =
                  request.format === "pdf" && request.mode === "styled"
                    ? buildStyledResumePrintSource({
                        currentCv: exportCurrentCv,
                        stylePreset,
                      })
                    : buildResumeExportSource({
                        currentCv: exportCurrentCv,
                        authoritativeResume,
                        stylePreset,
                      });

                if (!source) {
                  throw new Error("Resume export source is unavailable.");
                }

                if (
                  request.format === "pdf" &&
                  request.mode === "styled" &&
                  "renderSource" in source
                ) {
                  const previewCapture = readResumePreviewDebugCapture();
                  const exportContext = {
                    cvId: currentCv?.id ? String(currentCv.id) : null,
                    cvUrl:
                      typeof window !== "undefined"
                        ? window.location.href
                        : null,
                    rendererVariantId: source.rendererVariantId,
                    stylePreset: source.stylePreset,
                    previewCapture,
                    timestamp: Date.now(),
                  } as const;
                  setStyledResumeExportContext(exportContext);

                  dbg(
                    "[CvForge] styled resume export snapshot",
                    buildResumePrintDebugSnapshot({
                      stylePreset: source.stylePreset,
                      rendererVariantId: source.rendererVariantId,
                    }),
                  );
                }

                return exportDocumentFile({
                  kind: "resume",
                  format: request.format,
                  mode: request.format === "pdf" ? request.mode : undefined,
                  data: source,
                  stylePreset: stylePreset,
                  fileNameBase:
                    request.format === "docx"
                      ? "Resume - Editable"
                      : request.mode === "ats"
                        ? "Resume - ATS"
                        : "Resume - Styled",
                  metadata:
                    request.format === "pdf" && request.mode === "styled"
                      ? {
                          resumeTypographyAudit:
                            buildResumeTypographyAuditMetadata(
                              currentCv
                                ? {
                                    cvId: String(currentCv.id),
                                    cvUrl:
                                      typeof window !== "undefined"
                                        ? window.location.href
                                        : null,
                                    rendererVariantId: source.rendererVariantId,
                                    stylePreset: source.stylePreset,
                                    previewCapture:
                                      readResumePreviewDebugCapture(),
                                    timestamp: Date.now(),
                                  }
                                : null,
                            ),
                        }
                      : undefined,
                });
              })()
            : hasTrustedExport && authoritativeResume
              ? await downloadAuthoritativeResumeExport({
                  authoritativeResume,
                  format: request.format,
                })
              : await downloadStandardResumeExport({
                  document: exportCurrentCv,
                  format: request.format,
                });
        showToast(`Exported ${exported.filename}`, { variant: "success" });
      } catch (error) {
        console.error("[CvForge] export failed", error);
        showToast("Resume export failed", { variant: "error" });
      } finally {
        setExportingFormat(null);
      }
    },
    [
      authoritativeResume,
      currentCv,
      filteredPreviewCv,
      hasTrustedExport,
      showToast,
      stylePreset,
    ],
  );

  const stylePresetSlots = React.useMemo(
    () =>
      ([1, 2, 3] as const).map((slot) => {
        const rawPreset =
          slot === 1
            ? savedStylePresets?.preset1
            : slot === 2
              ? savedStylePresets?.preset2
              : savedStylePresets?.preset3;
        const preset = normalizePresetSlot(rawPreset);
        const nextStylePreset = preset
          ? buildStylePresetFromSettingsSlot(preset)
          : null;
        return {
          slot,
          label: preset?.name?.trim() || DEFAULT_PRESET_SLOT_NAMES[slot],
          preset,
          stylePreset: nextStylePreset,
          isActive:
            nextStylePreset !== null &&
            nextStylePreset.layout === stylePreset.layout &&
            nextStylePreset.typography === stylePreset.typography &&
            nextStylePreset.palette === stylePreset.palette &&
            String(nextStylePreset.accentHex ?? "") ===
              String(stylePreset.accentHex ?? ""),
        };
      }),
    [savedStylePresets, stylePreset],
  );
  const hasAnySavedStylePreset = stylePresetSlots.some(({ preset }) =>
    Boolean(preset),
  );
  const stylePresetToolbarLabel = hasAnySavedStylePreset
    ? "Open saved resume styles"
    : "Open resume style controls";
  const stylePresetToolbarTooltip = hasAnySavedStylePreset
    ? "Saved styles"
    : "Style controls";
  const stylePresetToolbarControl = (
    <div
      className="dasti-icon-cluster"
      style={{ alignItems: "center", gap: "var(--proposal-chrome-tight-gap)" }}
    >
      <div
        ref={presetMenuRef}
        className="dasti-import-dropdown dasti-cv-style-presets"
        data-open={isStylePresetMenuOpen ? "true" : "false"}
        style={{ flex: "0 0 auto" }}
      >
        <button
          type="button"
          className="dasti-icon-button"
          aria-label={stylePresetToolbarLabel}
          aria-expanded={
            hasAnySavedStylePreset ? isStylePresetMenuOpen : undefined
          }
          aria-haspopup={hasAnySavedStylePreset ? "menu" : undefined}
          data-toolbar-tooltip={stylePresetToolbarTooltip}
          onClick={() => {
            if (!hasAnySavedStylePreset) {
              setWorkspaceMode("preview");
              return;
            }
            setIsStylePresetMenuOpen((current) => !current);
          }}
        >
          <Palette size={16} strokeWidth={1.7} aria-hidden="true" />
        </button>
        {isStylePresetMenuOpen ? (
          <div
            className="dasti-import-dropdown__menu dasti-import-dropdown__menu--compact dasti-toolbar-drawer-surface dasti-cv-style-presets__menu"
            role="menu"
            aria-label="Saved resume styles"
          >
            {stylePresetSlots.map(
              ({ slot, label, preset, stylePreset: nextStyle, isActive }) => (
                <button
                  key={slot}
                  type="button"
                  role="menuitemradio"
                  className="dasti-cv-style-presets__option"
                  disabled={!preset || !nextStyle}
                  aria-checked={isActive}
                  onClick={() => {
                    if (!nextStyle) {
                      return;
                    }
                    setStylePreset(nextStyle);
                    setIsStylePresetMenuOpen(false);
                  }}
                >
                  <span className="dasti-cv-style-presets__option-copy">
                    <span className="dasti-cv-style-presets__option-title">
                      {label}
                    </span>
                    <span className="dasti-cv-style-presets__option-description">
                      {preset
                        ? `${nextStyle ? nextStyle.layout : "swiss"} / ${preset.fontPairId ?? "default"}`
                        : "No saved style"}
                    </span>
                  </span>
                  {isActive ? (
                    <Check size={14} strokeWidth={1.8} aria-hidden="true" />
                  ) : null}
                </button>
              ),
            )}
          </div>
        ) : null}
      </div>

      <EmbeddedStyleInspector
        stylePreset={stylePreset}
        copyMode="title-only"
        controlMode="direct"
        showCustomizeControl={false}
        showPromptControl={false}
        onSelectBundle={() => {}}
        onSelectLayout={(layout) =>
          setStylePreset((current) =>
            resolveVerbatiStyle({
              ...current,
              familyId: layout,
              layout,
            }),
          )
        }
        onSelectTypography={(typography) =>
          setStylePreset((current) =>
            resolveVerbatiStyle({ ...current, typography }),
          )
        }
        onSelectPalette={(palette) =>
          setStylePreset((current) => ({
            ...resolveVerbatiStyle(current),
            palette,
            accentHex: undefined,
          }))
        }
        onSelectCustomAccent={(accentHex) =>
          setStylePreset((current) => ({
            ...resolveVerbatiStyle(current),
            palette: "custom",
            accentHex,
          }))
        }
      />
    </div>
  );

  const editModeToggle = (
    <button
      type="button"
      className="dasti-icon-button"
      aria-label="Open resume preview"
      onClick={() => setWorkspaceMode("preview")}
      data-toolbar-tooltip="Switch to preview"
      data-no-pan="true"
    >
      <Eye size={15} strokeWidth={1.7} aria-hidden="true" />
    </button>
  );

  const previewModeLeadControl = (
    <button
      type="button"
      className="dasti-cv-workbench-toggle__button"
      aria-label="Back to resume editing"
      onClick={() => setWorkspaceMode("edit")}
      data-toolbar-tooltip="Back to edit"
      data-no-pan="true"
    >
      <PenLine size={15} strokeWidth={1.9} aria-hidden="true" />
    </button>
  );
  const resumeExportControl = (
    <ResumeExportControl
      exportingFormat={exportingFormat}
      menuLabel="More export formats"
      onExport={handleResumeExport}
      statusDescription={exportStatusDescription}
      statusLabel={exportStatusLabel}
      statusTone={hasTrustedExport ? "trusted" : "standard"}
    />
  );
  const cvWorkbenchShellStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: editorGridMaxWidth,
    marginInline: "auto",
  };
  const cvPreviewWorkbenchStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "100%",
    marginInline: 0,
    minWidth: 0,
    "--cv-preview-shell-block-size": cvPreviewShellBlockSize,
    "--document-viewer-shell-inline-size": "100%",
  } as React.CSSProperties;
  const showJobBriefContext = Boolean(requestedJobId);
  const isEntryPickerBusy = isCreatingEntryCv || isImportingEntryCv;

  const handleReturnToJob = React.useCallback(() => {
    if (!requestedJobId) {
      return;
    }
    void navigate(`/jobs/${encodeURIComponent(requestedJobId)}`);
  }, [navigate, requestedJobId]);

  const handleClearJobContext = React.useCallback(() => {
    const nextParams = new URLSearchParams(search);
    nextParams.delete("jobId");
    const nextSearch = nextParams.toString();
    void navigate({
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : "",
    });
  }, [location.pathname, navigate, search]);

  const handleOpenSelectedCv = React.useCallback(() => {
    if (!pendingEntryCvId) {
      return;
    }

    loadCv(pendingEntryCvId);
    navigateToSelectedCv(pendingEntryCvId);
  }, [loadCv, navigateToSelectedCv, pendingEntryCvId]);

  const handleImportEntryCv = React.useCallback(() => {
    if (isEntryPickerBusy) {
      return;
    }

    cvImportInputRef.current?.click();
  }, [isEntryPickerBusy]);

  const handleEntryImportFileChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || isEntryPickerBusy) {
        return;
      }

      setIsImportingEntryCv(true);

      try {
        const outcome = await importStructuredCvFile(file);

        if (outcome.status === "rejected") {
          showToast(outcome.message, { variant: "error" });
          return;
        }

        if (!Array.isArray(outcome.sections) || outcome.sections.length === 0) {
          showToast(
            outcome.emptyReason
              ? `Import failed: ${outcome.emptyReason}`
              : "No importable sections were found.",
            { variant: "error" },
          );
          return;
        }

        const nextCvId = uuidv4();
        const now = new Date().toISOString();
        await importCv({
          id: nextCvId,
          title: deriveCvTitleFromSections(
            outcome.sections as any,
            "Imported CV",
          ),
          metadata: {
            createdAt: now,
            updatedAt: now,
            version: 1,
            ...(outcome.authoritativeResume
              ? { authoritativeResume: outcome.authoritativeResume }
              : {}),
          },
          sections: outcome.sections as any,
        });
        loadCv(nextCvId);
        navigateToSelectedCv(nextCvId);
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Resume import failed.",
          { variant: "error" },
        );
      } finally {
        if (cvImportInputRef.current) {
          cvImportInputRef.current.value = "";
        }
        setIsImportingEntryCv(false);
      }
    },
    [
      importCv,
      importStructuredCvFile,
      isEntryPickerBusy,
      loadCv,
      navigateToSelectedCv,
      showToast,
    ],
  );

  const handleStartFreshEntryCv = React.useCallback(async () => {
    if (isEntryPickerBusy) {
      return;
    }

    setIsCreatingEntryCv(true);
    setPendingFreshEntryBaseCvId(currentCvId ?? "__none__");
    try {
      await createNewCv(undefined, { forceV1: true });
    } catch (error) {
      setPendingFreshEntryBaseCvId(null);
      showToast(
        error instanceof Error ? error.message : "Could not create a new CV.",
        { variant: "error" },
      );
    } finally {
      setIsCreatingEntryCv(false);
    }
  }, [createNewCv, currentCvId, isEntryPickerBusy, showToast]);

  return (
    <div
      className="dasti-page-scroll"
      style={{
        minWidth: 0,
      }}
    >
      <div
        className="dasti-page-shell dasti-page-shell--cv-forge"
        style={
          {
            "--page-shell-max-width": "100%",
            "--page-shell-gap": "var(--space-2)",
            "--page-shell-pad-top":
              workspaceMode === "preview" ? "var(--space-2)" : "var(--space-2)",
            "--page-shell-pad-inline":
              "var(--space-4)",
            "--page-shell-pad-bottom": "var(--space-1)",
            "--cv-preview-toolbar-inset":
              workspaceMode === "preview" ? "0px" : undefined,
            "--page-shell-pad-top-mobile":
              workspaceMode === "preview" ? "var(--space-2)" : "var(--space-2)",
            "--page-shell-pad-inline-mobile":
              "var(--space-4)",
            "--page-shell-pad-bottom-mobile": "var(--space-1)",
          } as React.CSSProperties
        }
      >
        {showJobBriefContext ? (
          <div className="dasti-cv-job-context">
            {requestedJobRecord === undefined ? (
              <p className="dasti-hint">Loading job context…</p>
            ) : selectedJobRecord ? (
              <div className="dasti-proposal-context-row dasti-proposal-context-row--below">
                <button
                  type="button"
                  className="dasti-proposal-context-chip"
                  onClick={handleReturnToJob}
                >
                  <span className="dasti-proposal-context-row__text">
                    {`For: ${selectedJobRecord.title} @ ${selectedJobRecord.company || "Unknown company"}`}
                  </span>
                </button>
                <button
                  type="button"
                  className="dasti-icon-button dasti-icon-button--compact"
                  aria-label="Clear job context"
                  onClick={handleClearJobContext}
                >
                  <X size={14} strokeWidth={1.9} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <p className="dasti-hint">
                Saved job context is unavailable for this resume session.
              </p>
            )}
          </div>
        ) : null}
        {shouldShowEntryPicker ? (
          <div
            className="dasti-proposal-sheet dasti-proposal-sheet--composer"
            style={{
              width: "100%",
              maxWidth: "960px",
              marginInline: "auto",
            }}
          >
            <div className="dasti-proposal-sheet__header dasti-proposal-sheet__header--composer">
              <div className="dasti-proposal-sheet__heading dasti-proposal-sheet__heading--full">
                <p className="dasti-proposal-compose-shell__status-heading">
                  Choose your CV
                </p>
                <h1 className="dasti-proposal-title-input">
                  Open a saved CV, import a new one, or start from scratch.
                </h1>
              </div>
            </div>
            <div className="dasti-proposal-sheet__body dasti-proposal-sheet__body--composer">
              {cvPickerOptions.length === 0 ? (
                <div className="dasti-empty-state dasti-jobs-empty-state">
                  <div className="dasti-empty-state__title">
                    No saved CVs yet
                  </div>
                  <p className="dasti-empty-state__subtitle">
                    Import an existing CV or create a fresh one to open CvForge.
                  </p>
                </div>
              ) : (
                <div
                  className="dasti-grid-auto"
                  style={
                    {
                      "--grid-min-col": "280px",
                      "--grid-gap": "var(--layout-card-grid)",
                    } as React.CSSProperties
                  }
                >
                  {cvPickerOptions.map((option) => (
                    <CvPickerCard
                      key={option.id}
                      option={option}
                      selected={pendingEntryCvId === option.id}
                      onSelect={setPendingEntryCvId}
                    />
                  ))}
                </div>
              )}
            </div>
            <div
              className="dasti-cluster"
              style={
                {
                  "--cluster-gap": "var(--space-2)",
                  justifyContent: "flex-end",
                  padding: "0 var(--space-4) var(--space-4)",
                } as React.CSSProperties
              }
            >
              <button
                type="button"
                className="dasti-button dasti-button--secondary dasti-button--sm"
                onClick={handleImportEntryCv}
                disabled={isEntryPickerBusy}
              >
                <span>{isImportingEntryCv ? "Importing..." : "Import new"}</span>
              </button>
              <button
                type="button"
                className="dasti-button dasti-button--secondary dasti-button--sm"
                onClick={() => {
                  void handleStartFreshEntryCv();
                }}
                disabled={isEntryPickerBusy}
              >
                <span>
                  {isCreatingEntryCv ? "Creating..." : "Start from scratch"}
                </span>
              </button>
              <button
                type="button"
                className="dasti-button dasti-button--accent dasti-button--sm"
                onClick={handleOpenSelectedCv}
                disabled={!pendingEntryCvId || isEntryPickerBusy}
              >
                <Check size={16} strokeWidth={1.9} aria-hidden="true" />
                <span>Open selected CV</span>
              </button>
            </div>
            <input
              ref={cvImportInputRef}
              type="file"
              accept={TRUSTED_MISTRAL_FILE_INPUT_ACCEPT}
              style={{ display: "none" }}
              onChange={handleEntryImportFileChange}
            />
          </div>
        ) : workspaceMode === "preview" ? (
          <>
            {currentCv ? (
              <div style={{ display: "none" }} aria-hidden="true">
                <ProfileReviewCard
                  cvId={requestedCvId}
                  exportingFormat={exportingFormat}
                  exportStatusDescription={exportStatusDescription}
                  exportStatusLabel={exportStatusLabel}
                  exportStatusTone={hasTrustedExport ? "trusted" : "standard"}
                  onRequestExport={handleResumeExport}
                  resumeLinkIntent={
                    resumeLinkIntent?.shouldOpenModal ? resumeLinkIntent : null
                  }
                  onResumeLinkIntentHandled={handleResumeLinkIntentHandled}
                  activeTarget={resumeActiveTarget}
                  onActiveTargetChange={setResumeActiveTarget}
                  hiddenSectionIds={hiddenSectionIds}
                  onHiddenSectionIdsChange={setHiddenSectionIds}
                />
              </div>
            ) : null}
            <div
              className="dasti-cv-preview-workbench"
              style={cvPreviewWorkbenchStyle}
            >
              <div className="dasti-cv-preview-workbench__main">
                <VerbatiCvPreviewPanel
                  layoutMode="stacked"
                  hostMode="workspace"
                  cvDocumentOverride={filteredPreviewCv}
                  railLeadControl={previewModeLeadControl}
                  railTrailingControl={resumeExportControl}
                  stylePreset={stylePreset}
                  onStylePresetChange={setStylePreset}
                  onLinkIntent={handleResumeLinkIntent}
                  activeTarget={resumeActiveTarget}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              className="dasti-cv-edit-workbench-shell"
              style={cvWorkbenchShellStyle}
            >
              <div
                className="dasti-grid-split"
                style={
                  {
                    "--grid-columns": isSplitCanvas
                      ? "minmax(0, 1fr) clamp(392px, 36vw, 468px)"
                      : "minmax(0, 1fr)",
                    "--grid-gap": "var(--layout-card-grid)",
                    "--grid-align": "start",
                  } as React.CSSProperties
                }
              >
                <ProfileReviewCard
                  cvId={requestedCvId}
                  exportingFormat={exportingFormat}
                  exportStatusDescription={exportStatusDescription}
                  exportStatusLabel={exportStatusLabel}
                  exportStatusTone={hasTrustedExport ? "trusted" : "standard"}
                  toolbarLeadControl={editModeToggle}
                  toolbarPrimaryControl={stylePresetToolbarControl}
                  onRequestExport={handleResumeExport}
                  resumeLinkIntent={resumeLinkIntent}
                  onResumeLinkIntentHandled={handleResumeLinkIntentHandled}
                  activeTarget={resumeActiveTarget}
                  onActiveTargetChange={setResumeActiveTarget}
                  hiddenSectionIds={hiddenSectionIds}
                  onHiddenSectionIdsChange={setHiddenSectionIds}
                />
                <div
                  className={
                    isSplitCanvas
                      ? "dasti-cv-preview-panel-slot dasti-cv-preview-panel-slot--sticky"
                      : "dasti-cv-preview-panel-slot"
                  }
                >
                  <VerbatiCvPreviewPanel
                    layoutMode={isSplitCanvas ? "rail" : "stacked"}
                    hostMode="panel"
                    cvDocumentOverride={filteredPreviewCv}
                    stylePreset={stylePreset}
                    onStylePresetChange={setStylePreset}
                    onLinkIntent={handleResumeLinkIntent}
                    activeTarget={resumeActiveTarget}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
