import React from "react";
import { Button } from "../ui/button";
import {
  getProposalExtensionSourceLinks,
  PROPOSAL_EXTENSION_INSTALL_LINK,
} from "../../lib/proposal-source-platforms";

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
    | "command-palette";
  value?: string;
  tone?: "warm" | "formal" | "natural";
  stylePreview?: "style-1" | "style-2" | "style-3";
};

type OnboardingStep = {
  title: string;
  progressLabel: string;
  copy: string;
  pills?: string[];
  choices: OnboardingChoice[];
};

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: "Two weeks. One offer.",
    progressLabel: "Intro",
    copy: "twoweeks turns your CV into tailored cover letters for jobs that actually match your profile. Let's get you set up in three minutes.",
    pills: ["No spinners.", "No fluff.", "Edit everything."],
    choices: [],
  },
  {
    title: "Bring your CV.",
    progressLabel: "CV",
    copy: "Import a PDF, paste text, or start from scratch. We'll structure the sections automatically.",
    choices: [
      {
        label: "Upload PDF",
        description: "We extract sections in seconds.",
        action: "upload-resume",
      },
      {
        label: "Start blank",
        description: "Build it section by section.",
        action: "new-resume",
      },
    ],
  },
  {
    title: "Pick a starting style.",
    progressLabel: "Style",
    copy: "You can change it any time. Fonts, sizes, accent — everything is editable.",
    choices: [
      {
        label: "Style 1",
        description: "Fraunces × Syne. Workshop layout. Ink accent.",
        action: "select-style",
        value: "style-1",
        stylePreview: "style-1",
      },
      {
        label: "Style 2",
        description: "Geist × Baskervville. Workshop layout. Ink accent.",
        action: "select-style",
        value: "style-2",
        stylePreview: "style-2",
      },
      {
        label: "Style 3",
        description:
          "Special Elite × Courier Prime. Workshop layout. Ink accent.",
        action: "select-style",
        value: "style-3",
        stylePreview: "style-3",
      },
    ],
  },
  {
    title: "How do you sound?",
    progressLabel: "Tone",
    copy: "We'll use this as the default for new cover letters. Override per document any time.",
    choices: [
      {
        label: "Warm",
        description: "Conversational. First-person. A real human sentence.",
        action: "select-tone",
        value: "warm",
        tone: "warm",
      },
      {
        label: "Formal",
        description: "Structured. Senior-track. Light on adjectives.",
        action: "select-tone",
        value: "formal",
        tone: "formal",
      },
      {
        label: "Natural",
        description: "Plain prose. Says what it means and stops.",
        action: "select-tone",
        value: "natural",
        tone: "natural",
      },
    ],
  },
  {
    title: "Catch jobs as you browse.",
    progressLabel: "Jobs",
    copy: "Install the twoweeks extension. Hit one button on any LinkedIn, Welcome to the Jungle, or company careers page — the role lands in your jobs library, ready to score.",
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
    title: "You're set.",
    progressLabel: "Done",
    copy: "Pin the extension, capture a few jobs, and twoweeks will draft your first cover letter. ⌘K opens the command palette from anywhere.",
    choices: [
      { label: "Go to dashboard", action: "dashboard" },
      { label: "Command palette", action: "command-palette" },
    ],
  },
];

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
  const total = ONBOARDING_STEPS.length;
  const step = ONBOARDING_STEPS[stepIndex];
  const extensionSourceLinks = React.useMemo(
    () => getProposalExtensionSourceLinks(),
    [],
  );

  React.useEffect(() => {
    if (open) {
      setStepIndex(0);
      setSupportedSitesOpen(false);
      setSelectedTone("warm");
      setSelectedStyle("style-1");
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
        navigateAndClose("/cv", { state: { cvForgeAction: "importCv" } });
        return;
      case "new-resume":
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
              {step.choices.map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  className="onb-replay__choice"
                  data-selected={isSelected(choice)}
                  onClick={() => handleChoice(choice)}
                >
                  {choice.tone ? (
                    <span className="onb-replay__choice-icon">
                      <span className={`ds-tone ds-tone--${choice.tone}`}>
                        {choice.label}
                      </span>
                    </span>
                  ) : null}
                  {choice.stylePreview ? (
                    <span
                      className={`onb-replay__style-preview onb-replay__style-preview--${choice.stylePreview}`}
                      aria-hidden="true"
                    >
                      <span className="onb-replay__style-preview-title">
                        {choice.label}
                      </span>
                      <span className="onb-replay__style-preview-line onb-replay__style-preview-line--short" />
                      <span className="onb-replay__style-preview-line" />
                      <span className="onb-replay__style-preview-line onb-replay__style-preview-line--mid" />
                    </span>
                  ) : null}
                  <span className="onb-replay__choice-title">
                    {choice.label}
                  </span>
                  {choice.description ? (
                    <span className="onb-replay__choice-desc">
                      {choice.description}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
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
