import React from "react";
import { useQuery } from "convex/react";
import { Button } from "../ui/button";
import { Check } from "@/lib/icons";
import { api } from "../../../convex/_generated/api";
import {
  getProposalExtensionSourceLinks,
  PROPOSAL_EXTENSION_INSTALL_LINK,
} from "../../lib/proposal-source-platforms";
import {
  getFactoryDocumentStyleSlot,
  type DocumentStyleSlotId,
} from "../../lib/document-style-slots";
import {
  getVerbatiFontPairOption,
  type VerbatiFontPairId,
} from "../../features/verbati/fontCatalog";
import {
  PROPOSAL_PALETTE_OPTIONS,
  isProposalPaletteId,
} from "../../lib/proposal-style-display";
import {
  WORKSHOP_RESUME_ONECOL_TEMPLATE_ID,
  WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID,
  type ResumeTemplateId,
} from "../../lib/layout/resumeTemplates";

type OnboardingNavigateOptions = {
  state?: unknown;
  replace?: boolean;
};

type OnboardingReplayProps = {
  open: boolean;
  onClose: () => void;
  onNavigate: (to: string, options?: OnboardingNavigateOptions) => void;
  onOpenCommandPalette: () => void;
};

type OnboardingChoice = {
  label: string;
  description?: string;
  action:
    | "select-tone"
    | "select-style"
    | "upload-resume"
    | "new-resume"
    | "install-chrome"
    | "supported-sites"
    | "dashboard"
    | "match-job"
    | "write-proposal"
    | "command-palette";
  value?: string;
  tone?: "warm" | "formal" | "natural";
  stylePreview?: OnboardingStylePreviewId;
  layoutLabel?: string;
  metadata?: string;
};

type OnboardingStep = {
  id: "intro" | "style" | "tone" | "cv" | "jobs" | "done";
  title: string;
  progressLabel: string;
  copy: string;
  helperText?: string;
  pills?: string[];
  choices: OnboardingChoice[];
};

type OnboardingStylePreviewId = "style-1" | "style-2" | "style-3";

type OnboardingStylePreviewDefinition = {
  slotId: DocumentStyleSlotId;
};

const ONBOARDING_STYLE_PREVIEW_DEFINITIONS: Record<
  OnboardingStylePreviewId,
  OnboardingStylePreviewDefinition
> = {
  "style-1": {
    slotId: 1,
  },
  "style-2": {
    slotId: 2,
  },
  "style-3": {
    slotId: 3,
  },
};

type OnboardingStylePresetRecord = {
  fontPairId?: unknown;
  paletteOverride?: unknown;
  accentHex?: string | null;
  verbatiStyle?: {
    typography?: unknown;
    palette?: unknown;
    accentHex?: string | null;
    resumeTemplateId?: unknown;
  } | null;
};

type OnboardingStylePresetsQuery = {
  preset1?: OnboardingStylePresetRecord | null;
  preset2?: OnboardingStylePresetRecord | null;
  preset3?: OnboardingStylePresetRecord | null;
};

type ResolvedOnboardingStyleSlot = {
  slotId: DocumentStyleSlotId;
  fontPairId: VerbatiFontPairId;
  resumeTemplateId: ResumeTemplateId;
  accentColor?: string;
};

function getPresetForOnboardingSlot(
  presets: OnboardingStylePresetsQuery | undefined,
  slotId: DocumentStyleSlotId,
): OnboardingStylePresetRecord | null | undefined {
  if (slotId === 1) return presets?.preset1;
  if (slotId === 2) return presets?.preset2;
  return presets?.preset3;
}

function resolveOnboardingResumeTemplateId(
  value: unknown,
  fallback: ResumeTemplateId,
): ResumeTemplateId {
  if (
    value === WORKSHOP_RESUME_ONECOL_TEMPLATE_ID ||
    value === WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID
  ) {
    return value;
  }
  return fallback;
}

function resolveOnboardingAccentColor(
  raw: OnboardingStylePresetRecord | null | undefined,
  factorySlot: ReturnType<typeof getFactoryDocumentStyleSlot>,
): string | undefined {
  const accentHex =
    raw?.accentHex ??
    raw?.verbatiStyle?.accentHex ??
    factorySlot.appearance.accentHex;
  if (accentHex) return accentHex;

  const paletteCandidate =
    raw?.paletteOverride ??
    (raw?.verbatiStyle?.palette !== "custom"
      ? raw?.verbatiStyle?.palette
      : undefined) ??
    factorySlot.appearance.palette;
  if (!isProposalPaletteId(paletteCandidate)) return undefined;

  return PROPOSAL_PALETTE_OPTIONS.find(
    (option) => option.id === paletteCandidate,
  )?.color;
}

function resolveOnboardingStyleSlot(
  previewId: OnboardingStylePreviewId,
  presets: OnboardingStylePresetsQuery | undefined,
): ResolvedOnboardingStyleSlot {
  const definition = ONBOARDING_STYLE_PREVIEW_DEFINITIONS[previewId];
  const factorySlot = getFactoryDocumentStyleSlot(definition.slotId);
  const raw = getPresetForOnboardingSlot(presets, definition.slotId);
  const fontPair = getVerbatiFontPairOption(
    raw?.fontPairId ??
      raw?.verbatiStyle?.typography ??
      factorySlot.appearance.typography,
  );

  return {
    slotId: definition.slotId,
    fontPairId: fontPair.id,
    resumeTemplateId: resolveOnboardingResumeTemplateId(
      raw?.verbatiStyle?.resumeTemplateId,
      factorySlot.defaultCvTemplateId,
    ),
    accentColor: resolveOnboardingAccentColor(raw, factorySlot),
  };
}

function getOnboardingLayoutName(templateId: ResumeTemplateId): string {
  if (templateId === WORKSHOP_RESUME_ONECOL_TEMPLATE_ID) return "Minimal";
  if (templateId === WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID) return "French";
  return "Auto";
}

function getOnboardingStyleChoiceClassName(choice: OnboardingChoice): string {
  return [
    "onb-replay__choice",
    choice.stylePreview ? "onb-replay__choice--style" : "",
    choice.stylePreview ? "dasti-settings-hero-preview" : "",
    choice.stylePreview ? "onb-replay__settings-preview" : "",
    choice.stylePreview
      ? `onb-replay__settings-preview--${choice.stylePreview}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function getOnboardingStyleFontLabel(
  styleSlot: ResolvedOnboardingStyleSlot,
): string {
  const fontPair = getVerbatiFontPairOption(styleSlot.fontPairId);
  const headingLabel = fontPair.headingLabel.replace(
    /\s+(?:Bold|Regular)$/u,
    "",
  );
  const bodyLabel = fontPair.bodyLabel
    .replace(/\s+(?:Bold|Regular)$/u, "")
    .replace(/^Courier Prime$/u, "Courier");
  return `${headingLabel} × ${bodyLabel}`;
}

function OnboardingStylePreviewContent({
  styleSlot,
}: {
  styleSlot: ResolvedOnboardingStyleSlot;
}): JSX.Element {
  const fontPair = getVerbatiFontPairOption(styleSlot.fontPairId);

  return (
    <span className="dasti-settings-hero-preview__inner">
      <span className="dasti-settings-hero-preview__heading-block">
        <span
          className="dasti-settings-hero-preview__title"
          style={{
            fontFamily: fontPair.headingFamily,
            fontWeight: styleSlot.slotId === 3 ? 400 : 700,
          }}
        >
          Protection Guard
        </span>
        <span
          className="dasti-settings-hero-preview__subtitle"
          style={{ fontFamily: fontPair.bodyFamily }}
        >
          Robert Cooper
        </span>
      </span>
      <span
        className="dasti-settings-hero-preview__divider"
        aria-hidden="true"
      />
      <span
        className="dasti-settings-hero-preview__body-lines"
        style={{ fontFamily: fontPair.bodyFamily }}
      >
        <span className="dasti-settings-hero-preview__body-text">
          I bring calm judgment, clear communication, and a dependable record of
          keeping people and sites safe.
        </span>
      </span>
      <span className="dasti-settings-hero-preview__signature">
        robert cooper
      </span>
    </span>
  );
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "intro",
    title: "Two weeks. One offer.",
    progressLabel: "Intro",
    copy: "twoweeks turns your CV into tailored cover letters for jobs that actually match your profile. Let's get you set up in three minutes.",
    pills: ["No spinners.", "No fluff.", "Edit everything."],
    choices: [],
  },
  {
    id: "style",
    title: "Pick a starting style.",
    progressLabel: "Style",
    copy: "You can change it any time. Fonts, sizes, accent — everything is editable.",
    choices: [
      {
        label: "Style 1",
        action: "select-style",
        value: "style-1",
        stylePreview: "style-1",
      },
      {
        label: "Style 2",
        action: "select-style",
        value: "style-2",
        stylePreview: "style-2",
      },
      {
        label: "Style 3",
        action: "select-style",
        value: "style-3",
        stylePreview: "style-3",
      },
    ],
  },
  {
    id: "tone",
    title: "How do you sound?",
    progressLabel: "Tone",
    copy: "Your default voice. Change it per letter.",
    choices: [
      {
        label: "Warm",
        description: "Human. Direct.\nStill professional.",
        action: "select-tone",
        value: "warm",
        tone: "warm",
      },
      {
        label: "Natural",
        description: "Plain prose.\nClear. Done.",
        action: "select-tone",
        value: "natural",
        tone: "natural",
      },
      {
        label: "Formal",
        description: "Structured. Senior.\nNo theater.",
        action: "select-tone",
        value: "formal",
        tone: "formal",
      },
    ],
  },
  {
    id: "cv",
    title: "Bring your CV.",
    progressLabel: "CV",
    copy: "Import a PDF, paste text, or start from scratch. We'll keep your style and tone choices in place.",
    choices: [
      {
        label: "Upload PDF",
        description: "Choose a PDF now, then continue when it is ready.",
        action: "upload-resume",
      },
      {
        label: "Start blank",
        description: "Create a blank CV setup and continue.",
        action: "new-resume",
      },
    ],
  },
  {
    id: "jobs",
    title: "Catch jobs as you browse.",
    progressLabel: "Jobs",
    copy: "Install the twoweeks extension. Capture roles from supported job sites.",
    choices: [
      {
        label: "Install for Chrome",
        description:
          "One click install. Pin it for fastest capture. Also works on Edge, Brave, Arc — Firefox coming soon.",
        action: "install-chrome",
      },
      {
        label: "Supported websites",
        description:
          "Open a supported site, then capture the job with the extension.",
        action: "supported-sites",
      },
    ],
  },
  {
    id: "done",
    title: "You're set.",
    progressLabel: "Done",
    copy: "Start with the next document step that matters most.",
    helperText: "⌘K opens the command palette from anywhere.",
    choices: [
      { label: "Import CV", action: "upload-resume" },
      { label: "Match a job", action: "match-job" },
      { label: "Write first proposal", action: "write-proposal" },
    ],
  },
];

type OnboardingCvChoice = "upload" | "blank" | null;

function openExternalUrl(url: string): void {
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function OnboardingReplay({
  open,
  onClose,
  onNavigate,
  onOpenCommandPalette,
}: OnboardingReplayProps): JSX.Element | null {
  const [stepIndex, setStepIndex] = React.useState(0);
  const [supportedSitesOpen, setSupportedSitesOpen] = React.useState(false);
  const [selectedTone, setSelectedTone] = React.useState("warm");
  const [selectedStyle, setSelectedStyle] = React.useState("style-1");
  const [cvChoice, setCvChoice] = React.useState<OnboardingCvChoice>(null);
  const [selectedCvFileName, setSelectedCvFileName] = React.useState<
    string | null
  >(null);
  const cvFileInputRef = React.useRef<HTMLInputElement>(null);
  const stylePresetsQuery = useQuery(
    api.proposalSettings.getPresets,
    open ? {} : "skip",
  ) as OnboardingStylePresetsQuery | undefined;
  const total = ONBOARDING_STEPS.length;
  const step = ONBOARDING_STEPS[stepIndex];
  const extensionSourceLinks = React.useMemo(
    () => getProposalExtensionSourceLinks(),
    [],
  );
  const resolvedStyleSlots = React.useMemo(
    () => ({
      "style-1": resolveOnboardingStyleSlot("style-1", stylePresetsQuery),
      "style-2": resolveOnboardingStyleSlot("style-2", stylePresetsQuery),
      "style-3": resolveOnboardingStyleSlot("style-3", stylePresetsQuery),
    }),
    [stylePresetsQuery],
  );

  React.useEffect(() => {
    if (open) {
      setStepIndex(0);
      setSupportedSitesOpen(false);
      setSelectedTone("warm");
      setSelectedStyle("style-1");
      setCvChoice(null);
      setSelectedCvFileName(null);
    }
  }, [open]);

  React.useEffect(() => {
    setSupportedSitesOpen(false);
  }, [stepIndex]);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const visibleChoices = React.useMemo(() => {
    if (step.id !== "done") return step.choices;

    const [importCv, matchJob, writeProposal] = step.choices;
    if (!cvChoice) return [importCv, matchJob, writeProposal];
    return [matchJob, writeProposal, importCv];
  }, [cvChoice, step]);

  if (!open) {
    return null;
  }

  const navigateAndClose = (
    to: string,
    options?: OnboardingNavigateOptions,
  ) => {
    onClose();
    onNavigate(to, options);
  };

  const handleChoice = (choice: OnboardingChoice) => {
    switch (choice.action) {
      case "select-tone":
        setSelectedTone(choice.value ?? "warm");
        return;
      case "select-style":
        setSelectedStyle(choice.value ?? "style-1");
        return;
      case "upload-resume":
        if (step.id === "cv") {
          setCvChoice("upload");
          cvFileInputRef.current?.click();
          return;
        }
        navigateAndClose("/cv", { state: { cvForgeAction: "importCv" } });
        return;
      case "new-resume":
        if (step.id === "cv") {
          setCvChoice("blank");
          setSelectedCvFileName(null);
          setStepIndex((current) => Math.min(total - 1, current + 1));
          return;
        }
        navigateAndClose("/cv", { state: { cvForgeAction: "createBlank" } });
        return;
      case "install-chrome":
        openExternalUrl(PROPOSAL_EXTENSION_INSTALL_LINK.href);
        return;
      case "supported-sites":
        setSupportedSitesOpen((current) => !current);
        return;
      case "dashboard":
        navigateAndClose("/dashboard");
        return;
      case "match-job":
        navigateAndClose("/jobs");
        return;
      case "write-proposal":
        navigateAndClose("/proposal");
        return;
      case "command-palette":
        onClose();
        onOpenCommandPalette();
        return;
      default:
        return;
    }
  };

  const goNext = () => {
    if (stepIndex < total - 1) {
      setStepIndex((current) => current + 1);
      return;
    }
    onClose();
    onNavigate("/dashboard");
  };

  const isSelected = (choice: OnboardingChoice) => {
    if (choice.action === "select-tone") return choice.value === selectedTone;
    if (choice.action === "select-style") return choice.value === selectedStyle;
    if (step.id === "cv" && choice.action === "upload-resume") {
      return cvChoice === "upload";
    }
    if (step.id === "cv" && choice.action === "new-resume") {
      return cvChoice === "blank";
    }
    return undefined;
  };

  return (
    <div
      className="onb-replay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="onb-replay__bar">
        <div className="onb-replay__brand">
          twoweeks<span>.</span>
        </div>
        <div
          className="onb-replay__steps"
          aria-label={`Step ${stepIndex + 1} of ${total}`}
        >
          {ONBOARDING_STEPS.map((item, index) => (
            <span
              key={item.title}
              className="onb-replay__segment"
              data-state={index <= stepIndex ? "active" : "pending"}
              aria-current={index === stepIndex ? "step" : undefined}
            >
              <span className="onb-replay__dot" aria-hidden="true" />
              <span>{item.progressLabel}</span>
            </span>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Skip for now
        </Button>
      </div>

      <div className="onb-replay__body">
        <section className="onb-replay__pane">
          <h2 id="onboarding-title" className="onb-replay__title">
            {step.title}
          </h2>
          <p className="onb-replay__copy">{step.copy}</p>
          {step.pills ? (
            <div
              className="onb-replay__pills"
              aria-label="Quick start promises"
            >
              {step.pills.map((pill) => (
                <span key={pill} className="ds-pill ds-pill--accent">
                  {pill}
                </span>
              ))}
            </div>
          ) : null}
          {step.choices.length > 0 ? (
            <div className="onb-replay__choices">
              {visibleChoices.map((choice, choiceIndex) => {
                const styleSlot = choice.stylePreview
                  ? resolvedStyleSlots[choice.stylePreview]
                  : null;
                const choiceButton = (
                  <button
                    key={choice.label}
                    type="button"
                    className={getOnboardingStyleChoiceClassName(choice)}
                    data-selected={isSelected(choice)}
                    data-primary={step.id === "done" && choiceIndex === 0}
                    style={
                      styleSlot?.accentColor
                        ? ({
                            "--hero-accent": styleSlot.accentColor,
                          } as React.CSSProperties)
                        : undefined
                    }
                    onClick={() => handleChoice(choice)}
                  >
                    {choice.stylePreview && styleSlot ? (
                      <>
                        <span className="onb-replay__choice-title">
                          {choice.label}
                          {isSelected(choice) ? (
                            <span
                              className="onb-replay__choice-check"
                              aria-hidden="true"
                            >
                              <Check size={11} strokeWidth={2.5} />
                            </span>
                          ) : null}
                        </span>
                        <OnboardingStylePreviewContent styleSlot={styleSlot} />
                        <span className="onb-replay__choice-footer">
                          <span className="onb-replay__choice-layout">
                            {getOnboardingLayoutName(styleSlot.resumeTemplateId)}
                          </span>
                          <span className="onb-replay__choice-meta">
                            {getOnboardingStyleFontLabel(styleSlot)}
                          </span>
                        </span>
                      </>
                    ) : choice.tone ? (
                      <span className="onb-replay__choice-icon">
                        <span className={`ds-tone ds-tone--${choice.tone}`}>
                          {choice.label}
                        </span>
                      </span>
                    ) : null}
                    {!choice.stylePreview && !choice.tone && (
                      <span className="onb-replay__choice-title">
                        {choice.label}
                      </span>
                    )}
                    {!choice.stylePreview && choice.description ? (
                      <span className="onb-replay__choice-desc">
                        {choice.description}
                      </span>
                    ) : null}
                  </button>
                );

                return choiceButton;
              })}
            </div>
          ) : null}
          {step.id === "cv" ? (
            <>
              <input
                ref={cvFileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                aria-label="Choose CV PDF"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  setCvChoice("upload");
                  setSelectedCvFileName(file?.name ?? null);
                }}
              />
              {cvChoice ? (
                <p className="onb-replay__helper" aria-live="polite">
                  {cvChoice === "blank"
                    ? "Blank CV setup is ready. Your style and tone choices are saved for this onboarding run."
                    : selectedCvFileName
                      ? `${selectedCvFileName} is ready for the next step.`
                      : "PDF import is selected. Choose a file now or continue and import it from the final step."}
                </p>
              ) : null}
            </>
          ) : null}
          {supportedSitesOpen ? (
            <div
              className="onb-replay__supported-sites"
              aria-label="Supported job websites"
            >
              <div className="onb-replay__supported-sites-head">
                <strong>Supported websites</strong>
                <span>
                  Open a site, then capture the job with the extension.
                </span>
              </div>
              <div className="onb-replay__site-grid">
                {extensionSourceLinks.map((source) => (
                  <a
                    key={source.key}
                    href={source.href}
                    target="_blank"
                    rel="noreferrer"
                    className="onb-replay__site-link"
                  >
                    {source.label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          {step.helperText ? (
            <p className="onb-replay__helper">{step.helperText}</p>
          ) : null}
        </section>
      </div>

      <div className="onb-replay__foot">
        <Button
          variant="ghost"
          size="md"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
        >
          Back
        </Button>
        <span>
          Step {stepIndex + 1} of {total}
        </span>
        <Button size="md" onClick={goNext}>
          {stepIndex === total - 1 ? "Done" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
