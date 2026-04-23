import React from "react";
import { ArrowSquareOut, Plug, Rewind, Stop } from "@/lib/icons";
import {
  getProposalExtensionSourceLinks,
  PROPOSAL_EXTENSION_INSTALL_LINK,
} from "../lib/proposal-source-platforms";
import { QuickStartChoiceCard } from "./onboarding/QuickStartChoiceCard";

export type CoverLetterStartSurfaceImportState = {
  isBusy: boolean;
  label: string;
  hint: string;
  fileName: string | null;
  error: string | null;
};

type CoverLetterStartRoute = "root" | "job" | "resume";

type Props = {
  hasResumes: boolean;
  showExtensionHelper: boolean;
  initialRoute?: CoverLetterStartRoute;
  importResumeState: CoverLetterStartSurfaceImportState;
  onBackToQuickStart?: (() => void) | null;
  onClose: () => void;
  onUseResume: () => void;
  onImportResume: () => void;
  onPasteJobOffer: () => void;
  onUseChromeExtension: () => void;
};

export function CoverLetterStartSurface({
  hasResumes,
  showExtensionHelper,
  initialRoute = "root",
  importResumeState,
  onBackToQuickStart = null,
  onClose,
  onUseResume,
  onImportResume,
  onPasteJobOffer,
  onUseChromeExtension,
}: Props): JSX.Element {
  const [route, setRoute] = React.useState<CoverLetterStartRoute>(initialRoute);
  React.useEffect(() => {
    setRoute(initialRoute);
  }, [initialRoute]);
  const extensionSourceLinks = React.useMemo(
    () => getProposalExtensionSourceLinks(),
    [],
  );
  const primarySources = React.useMemo(
    () => extensionSourceLinks.filter((source) => source.tier === "primary"),
    [extensionSourceLinks],
  );
  const secondarySources = React.useMemo(
    () => extensionSourceLinks.filter((source) => source.tier === "secondary"),
    [extensionSourceLinks],
  );
  const hasPreviousStep = route !== "root";
  const canRewind = hasPreviousStep || Boolean(onBackToQuickStart);

  return (
    <div
      aria-label="Cover letter start"
      className="dasti-quick-start-pane dasti-cover-letter-start-pane"
      data-testid="cover-letter-start-surface"
    >
      <section
        aria-labelledby="cover-letter-start-heading"
        aria-describedby="cover-letter-start-description"
        className="dasti-quick-start-pane__frame"
      >
        <header className="dasti-quick-start-pane__controls">
          <div
            className="dasti-quick-start-pane__control-slot"
            data-testid="cover-letter-start-header-back-slot"
            data-has-action={canRewind ? "true" : "false"}
          >
            {canRewind ? (
              <button
                type="button"
                aria-label="Back"
                className="dasti-modal-close"
                onClick={() => {
                  if (hasPreviousStep) {
                    setRoute("root");
                    return;
                  }
                  onBackToQuickStart?.();
                }}
              >
                <Rewind className="w-5 h-5" aria-hidden="true" />
              </button>
            ) : (
              <div aria-hidden="true" style={{ width: "100%", height: "var(--hs)" }} />
            )}
          </div>

          <div className="dasti-quick-start-pane__progress">
            <CoverLetterStartIndicator currentStep={hasPreviousStep ? 2 : 1} />
          </div>

          <div className="dasti-quick-start-pane__control-slot dasti-quick-start-pane__control-slot--end">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="dasti-modal-close"
            >
              <Stop className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="dasti-quick-start-sheet">
          <section className="dasti-quick-start-sheet__section">
            <header className="dasti-quick-start-sheet__header">
              <h1
                id="cover-letter-start-heading"
                className="dasti-quick-start-sheet__title"
              >
                {route === "root"
                  ? "Start your cover letter."
                  : route === "job"
                    ? "Bring in the job."
                    : "Bring in your resume."}
              </h1>
              <p
                id="cover-letter-start-description"
                className="dasti-quick-start-sheet__subtitle"
              >
                {route === "root"
                  ? "Pick one path and keep moving."
                  : route === "job"
                    ? "Choose one way to capture the role."
                    : "Attach it before you write."}
              </p>
            </header>

            {route === "root" ? (
              <div className="dasti-quick-start-sheet__choice-grid">
                <QuickStartChoiceCard
                  label="Bring in the job"
                  hint="Use the extension or paste the job offer."
                  onClick={() => setRoute("job")}
                  className="dasti-quick-start-sheet__choice-card"
                  primaryAction
                />
                <QuickStartChoiceCard
                  label="Bring in your resume"
                  hint="Use an existing resume or import a new one."
                  onClick={() => setRoute("resume")}
                  className="dasti-quick-start-sheet__choice-card"
                />
              </div>
            ) : null}

            {route === "job" ? (
              <div className="dasti-quick-start-sheet__choice-grid">
                <QuickStartChoiceCard
                  label="Capture the role"
                  hint={
                    showExtensionHelper
                      ? "Use the TwoWeeks extension on a supported site."
                      : "Pull it in from a supported site."
                  }
                  onClick={onUseChromeExtension}
                  selected={showExtensionHelper}
                  expandedContent={
                    <div className="dasti-cover-letter-start__extension-helper">
                      <div className="dasti-cover-letter-start__extension-actions">
                        <a
                          href={PROPOSAL_EXTENSION_INSTALL_LINK.href}
                          target="_blank"
                          rel="noreferrer"
                          className="dasti-button dasti-button--accent dasti-button--md dasti-cover-letter-start__install-row"
                        >
                          <Plug
                            size={12}
                            strokeWidth={1.7}
                            aria-hidden="true"
                          />
                          <span className="dasti-text-label">
                            {PROPOSAL_EXTENSION_INSTALL_LINK.label}
                          </span>
                        </a>
                      </div>
                      <div className="dasti-cover-letter-start__source-grid">
                        {primarySources.map((source) => (
                          <SourceLinkCard
                            key={source.key}
                            href={source.href}
                            label={source.label}
                          />
                        ))}
                      </div>
                      {secondarySources.length > 0 ? (
                        <details>
                          <summary className="dasti-cover-letter-start__summary">
                            More supported sites
                          </summary>
                          <div className="dasti-cover-letter-start__source-grid">
                            {secondarySources.map((source) => (
                              <SourceLinkCard
                                key={source.key}
                                href={source.href}
                                label={source.label}
                              />
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  }
                  className="dasti-quick-start-sheet__choice-card"
                  primaryAction
                />
                <QuickStartChoiceCard
                  label="Paste job offer"
                  hint="Open the editor and focus the brief."
                  onClick={onPasteJobOffer}
                  className="dasti-quick-start-sheet__choice-card"
                />
              </div>
            ) : null}

            {route === "resume" ? (
              <div className="dasti-quick-start-sheet__choice-grid">
                {hasResumes ? (
                  <QuickStartChoiceCard
                    label="Use a resume"
                    hint="Pick from your existing resume library."
                    onClick={onUseResume}
                    className="dasti-quick-start-sheet__choice-card"
                    primaryAction
                  />
                ) : null}
                <QuickStartChoiceCard
                  label={importResumeState.label}
                  hint={importResumeState.hint}
                  onClick={onImportResume}
                  loading={importResumeState.isBusy}
                  meta={importResumeState.fileName}
                  className="dasti-quick-start-sheet__choice-card"
                  primaryAction={!hasResumes}
                />
              </div>
            ) : null}

            {importResumeState.error ? (
              <p
                role="alert"
                style={{
                  margin: 0,
                  color: "var(--color-danger, #b42318)",
                  fontSize: "var(--ts)",
                }}
              >
                {importResumeState.error}
              </p>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  );
}

function CoverLetterStartIndicator({
  currentStep,
}: {
  currentStep: 1 | 2;
}): JSX.Element {
  return (
    <div
      aria-label={`Step ${currentStep} of 2`}
      style={{
        display: "flex",
        gap: "var(--space-2)",
        justifyContent: "center",
      }}
    >
      {[1, 2].map((step) => (
        <span
          key={step}
          style={{
            height: 4,
            width: 32,
            borderRadius: 2,
            background:
              step <= currentStep
                ? "var(--color-accent, var(--ti))"
                : "var(--color-border)",
          }}
        />
      ))}
    </div>
  );
}

function SourceLinkCard({
  href,
  label,
}: {
  href: string;
  label: string;
}): JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="dasti-button dasti-button--secondary dasti-button--pill dasti-button--md dasti-cover-letter-start__site-button"
      style={{
        display: "inline-flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "var(--space-2)",
        width: "100%",
      }}
    >
      <span className="dasti-text-label">{label}</span>
      <ArrowSquareOut size={12} strokeWidth={1.7} aria-hidden="true" />
    </a>
  );
}
