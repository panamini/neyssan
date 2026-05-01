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
  action:
    | "tone-settings"
    | "templates"
    | "style-settings"
    | "upload-resume"
    | "new-resume"
    | "install-chrome"
    | "supported-sites"
    | "jobs"
    | "dashboard"
    | "command-palette";
};

type OnboardingStep = {
  title: string;
  copy: string;
  choices: OnboardingChoice[];
};

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: "Choose your tone.",
    copy: "Set the default voice before writing. You can still override tone per proposal.",
    choices: [{ label: "Open tone settings", action: "tone-settings" }],
  },
  {
    title: "Pick your style.",
    copy: "Choose the visual system for resumes and cover letters before exporting.",
    choices: [
      { label: "Browse templates", action: "templates" },
      { label: "Customize style", action: "style-settings" },
    ],
  },
  {
    title: "Bring your resume.",
    copy: "Upload an existing file or create a blank resume in CV Forge.",
    choices: [
      { label: "Upload resume", action: "upload-resume" },
      { label: "New resume", action: "new-resume" },
    ],
  },
  {
    title: "Capture jobs.",
    copy: "Use the Chrome extension on supported job sites, or open your saved job list.",
    choices: [
      { label: "Install for Chrome", action: "install-chrome" },
      { label: "Supported websites", action: "supported-sites" },
      { label: "Pick existing job", action: "jobs" },
    ],
  },
  {
    title: "Open the dashboard.",
    copy: "Use the dashboard for the next best action, or open the command palette for shortcuts.",
    choices: [
      { label: "Dashboard", action: "dashboard" },
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

  const navigateAndClose = (to: string, options?: OnboardingNavigateOptions) => {
    onClose();
    onNavigate(to, options);
  };

  const handleChoice = (choice: OnboardingChoice) => {
    switch (choice.action) {
      case "tone-settings":
        navigateAndClose("/settings");
        return;
      case "templates":
        navigateAndClose("/templates");
        return;
      case "style-settings":
        navigateAndClose("/settings?tab=docstyle");
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
      case "jobs":
        navigateAndClose("/jobs");
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

  return (
    <div className="onb-replay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onb-replay__bar">
        <div className="onb-replay__brand">twoweeks<span>.</span></div>
        <div className="onb-replay__steps" aria-label={`Step ${stepIndex + 1} of ${total}`}>
          {ONBOARDING_STEPS.map((item, index) => (
            <span
              key={item.title}
              className="onb-replay__dot"
              data-state={index <= stepIndex ? "active" : "pending"}
            />
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
          <div className="onb-replay__choices">
            {step.choices.map((choice) => (
              <button
                key={choice.label}
                type="button"
                className="onb-replay__choice"
                onClick={() => handleChoice(choice)}
              >
                {choice.label}
              </button>
            ))}
          </div>
          {supportedSitesOpen ? (
            <div className="onb-replay__supported-sites" aria-label="Supported job websites">
              <div className="onb-replay__supported-sites-head">
                <strong>Supported websites</strong>
                <span>Open a site, then capture the job with the extension.</span>
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
        <span>Step {stepIndex + 1} of {total}</span>
        <Button size="md" onClick={goNext}>
          {stepIndex === total - 1 ? "Go to dashboard" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
