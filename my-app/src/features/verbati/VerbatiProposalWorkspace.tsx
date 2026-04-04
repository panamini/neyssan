import React from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  ArrowSquareOut,
  Check,
  Pencil,
  ScrollText,
  SquaresFour,
  X,
} from "@/lib/icons";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "../../components/ui/dialog";
import ProposalDisplay from "../../components/ProposalDisplay";
import { api } from "../../../convex/_generated/api";
import {
  DEFAULT_PROPOSAL_TEMPLATE_ID,
  PROPOSAL_TEMPLATE_DEFINITIONS,
  type ProposalTemplateId,
} from "../../../convex/lib/proposals/renderTemplates";
import { DEFAULT_PROPOSAL_VOICE_PRESET } from "../../../convex/lib/proposals/voicePresets";
import {
  getLayoutLabel,
  getProposalTwinTemplateId,
} from "./style";
import {
  getActiveLocalPersonalizationSource,
  getProposalApplicantHeaderData,
  getProposalApplicantIdentity,
} from "../../lib/proposal-personalization";
import {
  PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT,
  readStoredProposalOutputDraft,
  resolveProposalStoredText,
  type StoredProposalOutputDraft,
} from "../../lib/proposal-output-draft";
import { resolveProposalRenderState } from "../../lib/proposal-render-state";
import { formatUiDate } from "../../lib/ui-date";
import { getVoicePresetDisplayLabel } from "../../lib/proposal-voice-label";
import type { VerbatiStylePreset } from "./types";

const STYLE_FORGE_PROPOSAL_PREVIEW_ID_STORAGE_KEY =
  "dasti:style-forge-proposal-preview-id:v1";
const LIVE_PROPOSAL_PREVIEW_ID = "__live__";

type SavedProposalPreview = {
  _id: string;
  _creationTime: number;
  status?: string;
  title?: string;
  content?: string;
  sections?: Array<{
    type: "text" | "code" | "image";
    content: string;
  }>;
  metadata?: {
    proposalType?: "cover_letter" | "application_message" | "freelance_proposal";
    voicePreset?:
      | "signature"
      | "expert"
      | "direct"
      | "engaging"
      | "storyteller";
    templateId?: ProposalTemplateId;
    verbatiStyle?: Partial<VerbatiStylePreset>;
  };
};

function cardButtonStyle(active: boolean): React.CSSProperties {
  return {
    borderRadius: "var(--radius-card)",
    border: active
      ? "1px solid color-mix(in srgb, var(--color-text) 18%, var(--color-border-strong) 82%)"
      : "1px solid var(--color-border)",
    background: active
      ? "color-mix(in srgb, var(--color-surface-muted) 88%, var(--color-text) 12%)"
      : "var(--sfr)",
    padding: "var(--s4)",
    boxShadow: active
      ? "inset 0 1px 0 color-mix(in srgb, white 12%, transparent), inset 0 0 0 1px color-mix(in srgb, black 10%, transparent)"
      : "none",
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gap: "8px",
    minHeight: 120,
    transition:
      "border-color .14s var(--ez), box-shadow .14s var(--ez), transform .14s var(--ez)",
  };
}

function useProposalDraftPreview(): StoredProposalOutputDraft | null {
  const [draft, setDraft] = React.useState<StoredProposalOutputDraft | null>(() =>
    readStoredProposalOutputDraft(),
  );

  React.useEffect(() => {
    const refreshDraft = () => {
      setDraft(readStoredProposalOutputDraft());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshDraft();
      }
    };

    window.addEventListener("storage", refreshDraft);
    window.addEventListener(PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT, refreshDraft);
    window.addEventListener("focus", refreshDraft);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("storage", refreshDraft);
      window.removeEventListener(
        PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT,
        refreshDraft,
      );
      window.removeEventListener("focus", refreshDraft);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return draft;
}

function formatPreviewMeta(args: {
  proposalType?: "cover_letter" | "application_message" | "freelance_proposal" | null;
  voicePreset?: string | null;
  createdAt?: number | null;
}): string {
  const typeLabel =
    args.proposalType === "freelance_proposal"
      ? "Proposal"
      : args.proposalType === "application_message"
        ? "Message"
        : "Letter";
  const toneLabel =
    getVoicePresetDisplayLabel(
      args.voicePreset === "signature" ||
        args.voicePreset === "expert" ||
        args.voicePreset === "engaging" ||
        args.voicePreset === "direct" ||
        args.voicePreset === "storyteller"
        ? args.voicePreset
        : undefined,
    );

  return [typeLabel, toneLabel, formatUiDate(args.createdAt ?? null)]
    .filter(Boolean)
    .join(" · ");
}

function formatActiveProposalLabel(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "Choose proposal";
  }
  if (normalized.length <= 22) {
    return normalized;
  }
  return `${normalized.slice(0, 21).trimEnd()}…`;
}

function readStoredStyleForgeProposalPreviewId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(
    STYLE_FORGE_PROPOSAL_PREVIEW_ID_STORAGE_KEY,
  );
  const normalizedValue = String(storedValue ?? "").trim();
  return normalizedValue ? normalizedValue : null;
}

type VerbatiProposalWorkspaceProps = {
  isNarrow: boolean;
  stylePreset: VerbatiStylePreset;
  renderModeSwitch?: React.ReactNode;
};

export function VerbatiProposalWorkspace({
  isNarrow,
  stylePreset,
  renderModeSwitch = null,
}: VerbatiProposalWorkspaceProps): JSX.Element {
  const navigate = useNavigate();
  const {
    isAuthenticated: isConvexAuthenticated,
    isLoading: isConvexAuthLoading,
  } = useConvexAuth();
  const currentProposalSettings = useQuery(
    api.proposalSettings.getCurrent,
    isConvexAuthenticated ? {} : "skip",
  );
  const setCurrentProposalSettings = useMutation(api.proposalSettings.setCurrent);
  const savedProposals = useQuery(
    api.proposalsPublic.default as any,
    isConvexAuthenticated ? {} : "skip",
  ) as SavedProposalPreview[] | undefined;
  const proposalDraft = useProposalDraftPreview();
  const [selectedTemplateId, setSelectedTemplateId] =
    React.useState<ProposalTemplateId>(DEFAULT_PROPOSAL_TEMPLATE_ID);
  const [showTemplatePanels, setShowTemplatePanels] = React.useState(
    () => !isNarrow,
  );
  const [isProposalPickerOpen, setIsProposalPickerOpen] = React.useState(false);
  const [selectedPreviewProposalId, setSelectedPreviewProposalId] =
    React.useState<string | null>(() => readStoredStyleForgeProposalPreviewId());
  const [pendingPreviewProposalId, setPendingPreviewProposalId] =
    React.useState<string | null>(() => readStoredStyleForgeProposalPreviewId());
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [previewMode, setPreviewMode] = React.useState<"preview" | "edit">(
    "preview",
  );
  const [editablePreviewContent, setEditablePreviewContent] = React.useState("");
  const recommendedTemplateId = React.useMemo(
    () => getProposalTwinTemplateId(stylePreset),
    [stylePreset],
  );

  React.useEffect(() => {
    if (!currentProposalSettings?.templateId) {
      setSelectedTemplateId(recommendedTemplateId);
      return;
    }

    setSelectedTemplateId(currentProposalSettings.templateId);
  }, [currentProposalSettings?.templateId, recommendedTemplateId]);

  React.useEffect(() => {
    setShowTemplatePanels(!isNarrow);
  }, [isNarrow]);

  const latestSavedProposal = React.useMemo(
    () => {
      const filteredSavedProposals = (savedProposals ?? []).filter(
        (proposal) => proposal.status === "saved",
      );
      return filteredSavedProposals.length > 0 ? filteredSavedProposals[0] : null;
    },
    [savedProposals],
  );
  const sortedSavedProposals = React.useMemo(
    () =>
      savedProposals
        ? [...savedProposals]
            .filter((proposal) => proposal.status === "saved")
            .sort((left, right) => right._creationTime - left._creationTime)
        : [],
    [savedProposals],
  );
  const selectedSavedProposal = React.useMemo(
    () =>
      selectedPreviewProposalId
        ? sortedSavedProposals.find((proposal) => proposal._id === selectedPreviewProposalId) ??
          null
        : null,
    [selectedPreviewProposalId, sortedSavedProposals],
  );

  React.useEffect(() => {
    if (
      selectedPreviewProposalId &&
      !sortedSavedProposals.some((proposal) => proposal._id === selectedPreviewProposalId)
    ) {
      setSelectedPreviewProposalId(null);
      setPendingPreviewProposalId(null);
    }
  }, [selectedPreviewProposalId, sortedSavedProposals]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (selectedPreviewProposalId) {
      window.localStorage.setItem(
        STYLE_FORGE_PROPOSAL_PREVIEW_ID_STORAGE_KEY,
        selectedPreviewProposalId,
      );
      return;
    }

    window.localStorage.removeItem(STYLE_FORGE_PROPOSAL_PREVIEW_ID_STORAGE_KEY);
  }, [selectedPreviewProposalId]);

  const latestSavedProposalContent = React.useMemo(
    () =>
      latestSavedProposal
        ? resolveProposalStoredText({
            content: latestSavedProposal.content,
            sections: latestSavedProposal.sections,
          })
        : "",
    [latestSavedProposal],
  );
  const selectedSavedProposalContent = React.useMemo(
    () =>
      selectedSavedProposal
        ? resolveProposalStoredText({
            content: selectedSavedProposal.content,
            sections: selectedSavedProposal.sections,
          })
        : "",
    [selectedSavedProposal],
  );
  const hasLiveDraftPreview = Boolean(proposalDraft?.proposalContent?.trim());
  const hasLiveSavedPreview = Boolean(latestSavedProposalContent);
  const hasLiveProposalPreview = hasLiveDraftPreview || hasLiveSavedPreview;
  const activeSavedProposal = selectedSavedProposal ?? latestSavedProposal;
  const previewContent =
    selectedSavedProposal
      ? selectedSavedProposalContent || null
      : proposalDraft?.proposalContent ?? (latestSavedProposalContent || null);
  const previewProposalType =
    selectedSavedProposal?.metadata?.proposalType ??
    proposalDraft?.proposalType ??
    latestSavedProposal?.metadata?.proposalType ??
    null;
  const previewVoicePreset =
    selectedSavedProposal?.metadata?.voicePreset ??
    proposalDraft?.proposalVoicePreset ??
    latestSavedProposal?.metadata?.voicePreset ??
    currentProposalSettings?.voicePreset ??
    DEFAULT_PROPOSAL_VOICE_PRESET;
  const previewApplicantIdentity = getProposalApplicantIdentity(
    getActiveLocalPersonalizationSource(),
  );
  const previewApplicantHeader = getProposalApplicantHeaderData(
    getActiveLocalPersonalizationSource(),
  );
  const persistedVoicePreset =
    currentProposalSettings?.voicePreset ??
    proposalDraft?.proposalVoicePreset ??
    latestSavedProposal?.metadata?.voicePreset ??
    DEFAULT_PROPOSAL_VOICE_PRESET;
  const resolvedPreviewRenderState = React.useMemo(
    () =>
      resolveProposalRenderState({
        preferredStylePreset: stylePreset,
        preferredTemplateId: selectedTemplateId,
        storedStylePreset: activeSavedProposal?.metadata?.verbatiStyle,
        storedTemplateId: activeSavedProposal?.metadata?.templateId,
        activeCvStylePreset: stylePreset,
      }),
    [
      activeSavedProposal?.metadata?.templateId,
      activeSavedProposal?.metadata?.verbatiStyle,
      selectedTemplateId,
      stylePreset,
    ],
  );
  const previewTitle =
    selectedSavedProposal?.title ||
    proposalDraft?.proposalDocumentTitle ||
    latestSavedProposal?.title ||
    "Generated proposal";
  const previewMeta =
    (selectedSavedProposal
      ? formatPreviewMeta({
          proposalType: selectedSavedProposal.metadata?.proposalType ?? null,
          voicePreset: selectedSavedProposal.metadata?.voicePreset ?? null,
          createdAt: selectedSavedProposal._creationTime,
        })
      : proposalDraft?.proposalDocumentMeta) ||
    formatPreviewMeta({
      proposalType: previewProposalType,
      voicePreset: previewVoicePreset,
      createdAt: activeSavedProposal?._creationTime ?? null,
    }) ||
    "Generate a proposal to preview it here";

  const previewSourceLabel = selectedSavedProposal
    ? `Previewing the selected saved proposal${selectedSavedProposal.title ? `: ${selectedSavedProposal.title}` : ""}.`
    : proposalDraft?.proposalContent
      ? "Previewing the current Proposal Forge draft."
      : latestSavedProposal?.content || latestSavedProposalContent
        ? "Previewing the latest saved proposal because no live draft is open."
        : "Generate a proposal in Proposal Forge to preview a real proposal template.";
  const isLoadedProposalPreview = Boolean(selectedSavedProposal);
  const activeProposalControlLabel = selectedSavedProposal?.title
    ? selectedSavedProposal.title
    : proposalDraft?.proposalDocumentTitle || latestSavedProposal?.title || null;

  React.useEffect(() => {
    setEditablePreviewContent(previewContent ?? "");
    setPreviewMode("preview");
  }, [previewContent, previewMeta, previewTitle, selectedPreviewProposalId]);

  const handleOpenProposalPicker = React.useCallback(() => {
    setPendingPreviewProposalId(selectedPreviewProposalId);
    setIsProposalPickerOpen(true);
  }, [selectedPreviewProposalId]);

  const handleToggleActiveProposalPreview = React.useCallback(() => {
    if (isLoadedProposalPreview) {
      setSelectedPreviewProposalId(null);
      setPendingPreviewProposalId(null);
      return;
    }

    handleOpenProposalPicker();
  }, [handleOpenProposalPicker, isLoadedProposalPreview]);

  const handleConfirmSelectedProposal = React.useCallback(() => {
    setSelectedPreviewProposalId(pendingPreviewProposalId);
    setIsProposalPickerOpen(false);
  }, [pendingPreviewProposalId]);

  const handleOpenSelectedProposal = React.useCallback(() => {
    if (pendingPreviewProposalId) {
      const params = new URLSearchParams();
      params.set("view", "saved");
      params.set("id", pendingPreviewProposalId);
      navigate(`/proposal?${params.toString()}`);
      setIsProposalPickerOpen(false);
      return;
    }

    navigate("/proposal");
    setIsProposalPickerOpen(false);
  }, [navigate, pendingPreviewProposalId]);

  const proposalPickerOptions = React.useMemo(() => {
    const liveOption = {
      id: LIVE_PROPOSAL_PREVIEW_ID,
      title:
        proposalDraft?.proposalDocumentTitle ||
        latestSavedProposal?.title ||
        "Live proposal preview",
      subtitle: proposalDraft?.proposalContent
        ? "Current Proposal Forge draft"
        : latestSavedProposal
          ? "Default live preview from the latest saved proposal"
          : "Return to the live Proposal Forge preview source",
      stamp: proposalDraft?.proposalContent
        ? "Live draft"
        : formatUiDate(latestSavedProposal?._creationTime ?? null) || "Live",
    };

    const savedOptions = sortedSavedProposals.map((proposal) => ({
      id: proposal._id,
      title: proposal.title || "Untitled proposal",
      subtitle: formatPreviewMeta({
        proposalType: proposal.metadata?.proposalType ?? null,
        voicePreset: proposal.metadata?.voicePreset ?? null,
        createdAt: proposal._creationTime,
      }),
      stamp: formatUiDate(proposal._creationTime) || "No date",
    }));

    return [liveOption, ...savedOptions];
  }, [latestSavedProposal, proposalDraft?.proposalContent, proposalDraft?.proposalDocumentTitle, sortedSavedProposals]);

  const handleSelectTemplate = React.useCallback(
    (templateId: ProposalTemplateId) => {
      setSelectedTemplateId(templateId);
      setSaveError(null);

      if (!isConvexAuthenticated) {
        setSaveError(
          "Template preview updated locally. Sign in to save the shared default.",
        );
        return;
      }

      void setCurrentProposalSettings({
        templateId,
        voicePreset: persistedVoicePreset,
      }).catch((error) => {
        console.warn(
          "[VerbatiProposalWorkspace] Failed to persist proposal template",
          error,
        );
        setSaveError(
          "Template preview updated locally, but the shared default could not be saved.",
        );
      });
    },
    [isConvexAuthenticated, persistedVoicePreset, setCurrentProposalSettings],
  );

  const controlsColumn = (
    <aside
      className="dasti-flow"
      style={
        { "--flow-gap": "var(--layout-panel-stack)" } as React.CSSProperties
      }
    >
      <section className="dasti-panel dasti-panel--spacious">
        <div style={{ display: "grid", gap: "4px" }}>
          <div
            style={{
              fontSize: "var(--tx)",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--am)",
              fontWeight: 700,
            }}
          >
            Proposal Templates
          </div>
          <div
            style={{
              fontFamily: '"Fraunces", serif',
              fontSize: "var(--tl)",
              lineHeight: 1.08,
              color: "var(--ti)",
            }}
          >
            Select the proposal renderer.
          </div>
          <p
            style={{
              margin: 0,
              color: "var(--tm2)",
              lineHeight: 1.6,
            }}
          >
            These templates are bound to the live proposal output path. The
            chosen template becomes the current default and is stamped onto new
            and active proposal drafts.
          </p>
        </div>

        <div style={{ display: "grid", gap: "var(--s3)" }}>
          {PROPOSAL_TEMPLATE_DEFINITIONS.map((template) => {
            const active = template.id === selectedTemplateId;

            return (
              <button
                key={template.id}
                type="button"
                onClick={() => handleSelectTemplate(template.id)}
                className={
                  active
                    ? "styleforge-choice-card styleforge-choice-card--active"
                    : "styleforge-choice-card"
                }
                style={cardButtonStyle(active)}
              >
                <div
                  style={{
                    display: "grid",
                    gap: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "var(--s2)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "var(--tb)",
                        fontWeight: 600,
                        color: "var(--ti)",
                      }}
                    >
                      {template.name}
                    </div>
                    {template.id === recommendedTemplateId ? (
                      <span
                        style={{
                          padding: "var(--s1) var(--s2)",
                          borderRadius: "var(--radius-pill)",
                          border:
                            "1px solid color-mix(in srgb, var(--color-accent) 16%, var(--color-border) 84%)",
                          background:
                            "color-mix(in srgb, var(--color-accent-soft) 82%, transparent)",
                          fontSize: "var(--tx)",
                          color: "var(--ti)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        current twin
                      </span>
                    ) : active ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "var(--space-5)",
                          height: "var(--space-5)",
                          borderRadius: "999px",
                          background: "var(--as)",
                          color: "var(--ti)",
                        }}
                      >
                        <Check size={14} strokeWidth={2.2} />
                      </span>
                    ) : null}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--ts)",
                      color: "var(--tm2)",
                      lineHeight: 1.6,
                    }}
                  >
                    {template.description}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--tx)",
                      color: "var(--am)",
                      letterSpacing: ".08em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    Twin of {template.twinLabel}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "var(--s2)",
                  }}
                >
                  <span
                    style={{
                      padding: "var(--s1) var(--s2)",
                      borderRadius: "var(--radius-pill)",
                      border: "1px solid var(--color-border)",
                      fontSize: "var(--tx)",
                      color: "var(--tm2)",
                    }}
                  >
                    left zone {template.leftZoneMm} mm
                  </span>
                  <span
                    style={{
                      padding: "var(--s1) var(--s2)",
                      borderRadius: "var(--radius-pill)",
                      border: "1px solid var(--color-border)",
                      fontSize: "var(--tx)",
                      color: "var(--tm2)",
                    }}
                  >
                    top offset {template.topOffsetMm} mm
                  </span>
                  <span
                    style={{
                      padding: "var(--s1) var(--s2)",
                      borderRadius: "var(--radius-pill)",
                      border: "1px solid var(--color-border)",
                      fontSize: "var(--tx)",
                      color: "var(--tm2)",
                    }}
                  >
                    right / bottom {template.rightMarginMm} mm
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="dasti-panel dasti-panel--spacious">
        <div style={{ display: "grid", gap: "8px" }}>
          <div
            style={{
              fontSize: "var(--tx)",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--am)",
              fontWeight: 700,
            }}
          >
            Grid Rationale
          </div>
          <p style={{ margin: 0, color: "var(--tm2)", lineHeight: 1.65 }}>
            Proposal templates now twin the live resume style preset rather than
            floating as a detached letter skin. Layout stays proposal-specific,
            but paper color, typography families, and accent logic inherit from
            the active Style Forge preset and get stamped onto each proposal at
            save time.
          </p>
          {saveError ? (
            <div
              style={{
                borderRadius: "var(--radius-card)",
                border:
                  "1px solid color-mix(in srgb, var(--wa) 20%, transparent)",
                background: "var(--wab)",
                color: "var(--wat)",
                padding: "var(--s3) var(--s4)",
                lineHeight: 1.55,
              }}
            >
              {saveError}
            </div>
          ) : null}
        </div>
      </section>
    </aside>
  );

  const previewColumn = (
    <section
      className="dasti-flow"
      style={
        {
          "--flow-gap": "var(--layout-panel-stack)",
          alignContent: "start",
        } as React.CSSProperties
      }
    >
      <div className="dasti-panel dasti-panel--spacious">
        <div className="dasti-page-header">
          <div style={{ display: "grid", gap: "6px", minWidth: 0 }}>
            <div
              style={{
                fontSize: "var(--tx)",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--am)",
                fontWeight: 700,
              }}
            >
              Proposal Preview
            </div>
            <div
              style={{
                fontFamily: '"Fraunces", serif',
                fontSize: "var(--tx2)",
                lineHeight: 1.04,
                color: "var(--ti)",
              }}
            >
              {
                PROPOSAL_TEMPLATE_DEFINITIONS.find(
                  (template) => template.id === selectedTemplateId,
                )?.name
              }
            </div>
            <p
              style={{
                margin: 0,
                color: "var(--tm2)",
                lineHeight: 1.6,
                maxWidth: 760,
              }}
            >
              {previewSourceLabel} Current resume twin:{" "}
              {getLayoutLabel(stylePreset.layout)}.
              {!isConvexAuthenticated && !isConvexAuthLoading ? (
                <> Sign in to save the shared proposal default.</>
              ) : null}
            </p>
          </div>

          <div className="dasti-page-actions">
            {renderModeSwitch}
            <div
              className={
                isLoadedProposalPreview
                  ? "styleforge-active-cv-control styleforge-active-cv-control--loaded"
                  : "styleforge-active-cv-control styleforge-active-cv-control--ghost"
              }
            >
              <button
                type="button"
                onClick={handleToggleActiveProposalPreview}
                className="styleforge-active-cv-control__icon-button"
                aria-label={
                  isLoadedProposalPreview
                    ? "Return to live proposal preview"
                    : "Choose proposal preview"
                }
                data-toolbar-tooltip={
                  isLoadedProposalPreview ? "Close" : "Preview"
                }
              >
                <span
                  className="styleforge-active-cv-control__icon styleforge-active-cv-control__icon--base"
                  aria-hidden
                >
                  <ScrollText size={15} strokeWidth={1.5} />
                </span>
                {isLoadedProposalPreview ? (
                  <span
                    className="styleforge-active-cv-control__icon styleforge-active-cv-control__icon--hover"
                    aria-hidden
                  >
                    <X size={15} strokeWidth={1.8} />
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={handleOpenProposalPicker}
                className="styleforge-active-cv-control__body"
                aria-label={activeProposalControlLabel ?? "Choose proposal"}
                data-toolbar-tooltip="Proposal"
              >
                <span className="dasti-proposal-chip__label dasti-proposal-chip__label--resume">
                  {formatActiveProposalLabel(activeProposalControlLabel)}
                </span>
              </button>
            </div>
            {isNarrow ? (
              <div
                className="styleforge-preview-toolbar"
                role="group"
                aria-label="Proposal preview tools"
              >
                <button
                  type="button"
                  className={[
                    "styleforge-preview-toolbar__button",
                    showTemplatePanels
                      ? "styleforge-preview-toolbar__button--active"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setShowTemplatePanels((value) => !value)}
                  aria-label={
                    showTemplatePanels
                      ? "Hide template controls"
                      : "Show template controls"
                  }
                  data-toolbar-tooltip={
                    showTemplatePanels ? "Hide" : "Templates"
                  }
                  aria-pressed={showTemplatePanels}
                >
                  <SquaresFour size={16} strokeWidth={1.7} aria-hidden="true" />
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className="dasti-button dasti-button--secondary dasti-button--sm"
              onClick={() => void navigate("/proposal")}
            >
              <span>Open Proposal Forge</span>
              <ArrowSquareOut size={15} strokeWidth={1.7} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <div className="dasti-stage-card dasti-stage-card--document styleforge-stage-card">
        <ProposalDisplay
          proposalContent={editablePreviewContent}
          loading={false}
          error={null}
          proposalType={previewProposalType}
          voicePreset={previewVoicePreset}
          templateId={resolvedPreviewRenderState.templateId}
          stylePreset={resolvedPreviewRenderState.stylePreset}
          railTitle={
            proposalDraft?.proposalApplicantName ||
            previewApplicantIdentity.name
          }
          railMeta={
            proposalDraft?.proposalApplicantRole ||
            previewApplicantIdentity.role
          }
          applicantHeader={previewApplicantHeader}
          documentTitle={previewTitle}
          documentMeta={previewMeta}
          mode={previewMode}
          onModeChange={setPreviewMode}
          showModeToggle
          showZoomControls
          zoomStorageKey={null}
          documentHeaderMode="hidden"
          previewAnchor="body"
          onContentChange={setEditablePreviewContent}
        />
      </div>
    </section>
  );

  return (
    <>
      <Dialog
        open={isProposalPickerOpen}
        onClose={() => {
          setPendingPreviewProposalId(selectedPreviewProposalId);
          setIsProposalPickerOpen(false);
        }}
        title="Choose proposal preview"
        className="max-w-3xl"
      >
        <DialogContent className="space-y-3">
          <p
            style={{
              margin: 0,
              color: "var(--tm2)",
              lineHeight: 1.6,
            }}
          >
            Select which real proposal Style Forge should preview in place. The
            chosen proposal stays inside this workspace until you switch back to
            the live Proposal Forge source.
          </p>
          {proposalPickerOptions.length === 0 || (!hasLiveProposalPreview && sortedSavedProposals.length === 0) ? (
            <div
              style={{
                borderRadius: "var(--radius-card)",
                border: "1px solid var(--color-border)",
                background: "var(--sf1)",
                padding: "var(--s4)",
                color: "var(--tm2)",
              }}
            >
              No proposals are available yet. Generate one in Proposal Forge,
              then return here to style it.
            </div>
          ) : (
            <div
              className="dasti-grid-auto"
              style={
                {
                  "--grid-min-col": "260px",
                  "--grid-gap": "var(--space-3)",
                  maxHeight: "58vh",
                  overflowY: "auto",
                } as React.CSSProperties
              }
            >
              {proposalPickerOptions
                .filter((option) =>
                  option.id === LIVE_PROPOSAL_PREVIEW_ID ? hasLiveProposalPreview : true,
                )
                .map((option) => {
                  const isSelected =
                    option.id === LIVE_PROPOSAL_PREVIEW_ID
                      ? pendingPreviewProposalId === null
                      : option.id === pendingPreviewProposalId;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setPendingPreviewProposalId(
                          option.id === LIVE_PROPOSAL_PREVIEW_ID ? null : option.id,
                        )
                      }
                      className={
                        isSelected
                          ? "dasti-doc-card dasti-doc-card--library dasti-doc-card--chooser dasti-doc-card--selected"
                          : "dasti-doc-card dasti-doc-card--library dasti-doc-card--chooser"
                      }
                      aria-pressed={isSelected}
                    >
                      <div className="dasti-doc-card__stack">
                        <div className="dasti-doc-card__header">
                          <div className="dasti-doc-card__title-frame">
                            <h3 className="dasti-doc-card__title">
                              {option.title}
                            </h3>
                          </div>
                        </div>
                        <div className="dasti-doc-card__meta">
                          {option.subtitle}
                        </div>
                        <div className="dasti-doc-card__footer dasti-doc-card__footer--chooser">
                          <div className="dasti-doc-card__stamp">{option.stamp}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
          <div
            className="dasti-cluster"
            style={
              {
                "--cluster-gap": "var(--space-2)",
                justifyContent: "flex-end",
                paddingTop: "var(--space-2)",
              } as React.CSSProperties
            }
          >
            <button
              type="button"
              className="dasti-button dasti-button--secondary dasti-button--sm"
              onClick={handleOpenSelectedProposal}
            >
              <Pencil size={15} strokeWidth={1.6} aria-hidden />
              <span>Open</span>
            </button>
            <button
              type="button"
              className="dasti-button dasti-button--accent dasti-button--sm"
              onClick={handleConfirmSelectedProposal}
              disabled={!hasLiveProposalPreview && pendingPreviewProposalId === null}
            >
              <Check size={16} strokeWidth={1.9} aria-hidden />
              <span>Confirm</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <div
        className="dasti-grid-split"
        style={
          {
            "--grid-columns": isNarrow ? "1fr" : "360px minmax(0, 1fr)",
            "--grid-gap": "var(--layout-split-gap)",
            "--grid-align": "start",
          } as React.CSSProperties
        }
      >
        {isNarrow ? (
          <>
            {previewColumn}
            {showTemplatePanels ? controlsColumn : null}
          </>
        ) : (
          <>
            {controlsColumn}
            {previewColumn}
          </>
        )}
      </div>
    </>
  );
}
