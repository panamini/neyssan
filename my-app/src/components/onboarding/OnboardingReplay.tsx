import React from "react";
import { Button } from "../ui/button";

type OnboardingReplayProps = {
  open: boolean;
  onClose: () => void;
  onNavigate: (to: string) => void;
};

const ONBOARDING_STEPS = [
  {
    title: "Two weeks. One offer.",
    copy: "Set up the CV, job capture, and proposal flow before drafting.",
    choices: ["No auto-send", "Edit everything", "Review before export"],
  },
  {
    title: "Bring your CV.",
    copy: "Import a PDF, paste text, or start from scratch in the CV forge.",
    choices: ["Upload PDF", "Paste text", "Start blank"],
  },
  {
    title: "Pick a starting style.",
    copy: "Use a template and document style that can carry both CVs and proposals.",
    choices: ["Editorial", "Minimal", "Bold"],
  },
  {
    title: "Choose your tone.",
    copy: "Set a default voice for generated proposals, then override per document.",
    choices: ["Warm", "Formal", "Natural"],
  },
  {
    title: "Capture jobs.",
    copy: "Install the extension or paste job URLs into Jobs so each proposal starts from evidence.",
    choices: ["Install for Chrome", "Paste URLs"],
  },
  {
    title: "Open the dashboard.",
    copy: "Use the dashboard for the next best action and Cmd/Ctrl+K for every shortcut.",
    choices: ["Dashboard", "Command palette"],
  },
] as const;

export function OnboardingReplay({
  open,
  onClose,
  onNavigate,
}: OnboardingReplayProps): JSX.Element | null {
  const [stepIndex, setStepIndex] = React.useState(0);
  const total = ONBOARDING_STEPS.length;
  const step = ONBOARDING_STEPS[stepIndex];

  React.useEffect(() => {
    if (open) {
      setStepIndex(0);
    }
  }, [open]);

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
            {step.choices.map((choice, index) => (
              <button
                key={choice}
                type="button"
                className="onb-replay__choice"
                data-selected={index === 0 ? "true" : undefined}
              >
                {choice}
              </button>
            ))}
          </div>
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
