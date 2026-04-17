import React from "react";
import { ArrowSquareOut } from "@/lib/icons";
import {
  getProposalExtensionSourceLinks,
  PROPOSAL_EXTENSION_INSTALL_LINK,
} from "../lib/proposal-source-platforms";

type Props = {
  hasResumes: boolean;
  showExtensionHelper: boolean;
  onUseResume: () => void;
  onImportResume: () => void;
  onOpenEditor: () => void;
  onUseChromeExtension: () => void;
};

export function CoverLetterStartSurface({
  hasResumes,
  showExtensionHelper,
  onUseResume,
  onImportResume,
  onOpenEditor,
  onUseChromeExtension,
}: Props): JSX.Element {
  const extensionSourceLinks = React.useMemo(
    () => getProposalExtensionSourceLinks(),
    [],
  );
  const primarySources = React.useMemo(
    () => extensionSourceLinks.filter((source) => source.tier === "primary"),
    [extensionSourceLinks],
  );
  const secondarySources = React.useMemo(
    () =>
      extensionSourceLinks.filter((source) => source.tier === "secondary"),
    [extensionSourceLinks],
  );

  return (
    <section
      aria-label="Cover letter start"
      className="dasti-proposal-sheet"
      data-testid="cover-letter-start-surface"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        padding: "clamp(var(--space-4), 3vw, var(--space-5))",
        borderRadius: "calc(var(--radius-surface, 12px) + 4px)",
        border: "1px solid var(--color-border)",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--color-canvas) 92%, white 8%) 0%, var(--color-canvas) 100%)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <header style={{ display: "grid", gap: "var(--space-2)" }}>
        <div
          style={{
            fontSize: "var(--txs, 11px)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-text-subtle)",
            fontWeight: 700,
          }}
        >
          Cover letter
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-heading-family)",
            fontSize: "clamp(1.6rem, 2vw, 2rem)",
            lineHeight: 1.05,
          }}
        >
          Take the clean route.
        </h1>
        <p
          style={{
            margin: 0,
            color: "var(--color-text-muted)",
            fontSize: "var(--tm)",
            maxWidth: 560,
          }}
        >
          Use a resume, import one, open the editor, or pull the job in through
          the extension.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        {hasResumes ? (
          <ChoiceCard
            label="Use a resume"
            hint="Pick from your existing resume library."
            onClick={onUseResume}
          />
        ) : null}
        <ChoiceCard
          label="Import a resume"
          hint="Upload a PDF or image and attach it here."
          onClick={onImportResume}
        />
        <ChoiceCard
          label="Use Chrome extension"
          hint="Open supported job-source pages and capture the offer there."
          onClick={onUseChromeExtension}
          selected={showExtensionHelper}
        />
        <ChoiceCard
          label="Open editor"
          hint="Skip the helper and write directly."
          onClick={onOpenEditor}
        />
      </div>

      {showExtensionHelper ? (
        <div
          style={{
            display: "grid",
            gap: "var(--space-3)",
            padding: "var(--space-3)",
            borderRadius: "var(--radius-surface, 12px)",
            border: "1px solid var(--color-border)",
            background: "color-mix(in srgb, var(--color-canvas) 96%, white 4%)",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: "var(--tm)",
              }}
            >
              Use the extension where it already works.
            </div>
            <p
              style={{
                margin: 0,
                color: "var(--color-text-muted)",
                fontSize: "var(--ts)",
              }}
            >
              Open a supported source. Install the extension first if you need
              it.
            </p>
          </div>

          <div>
            <a
              href={PROPOSAL_EXTENSION_INSTALL_LINK.href}
              target="_blank"
              rel="noreferrer"
              className="dasti-button dasti-button--secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-2)",
              }}
            >
              <span>{PROPOSAL_EXTENSION_INSTALL_LINK.label}</span>
              <ArrowSquareOut size={12} strokeWidth={1.7} aria-hidden="true" />
            </a>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "var(--space-2)",
            }}
          >
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
              <summary
                style={{
                  cursor: "pointer",
                  color: "var(--color-text-muted)",
                  fontSize: "var(--ts)",
                }}
              >
                More supported sites
              </summary>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "var(--space-2)",
                  marginTop: "var(--space-2)",
                }}
              >
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
      ) : null}
    </section>
  );
}

function ChoiceCard({
  label,
  hint,
  onClick,
  selected,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  selected?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        textAlign: "left",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-surface, 12px)",
        border: selected
          ? "1px solid color-mix(in srgb, var(--color-accent, var(--ti)) 40%, var(--color-border))"
          : "1px solid var(--color-border)",
        background: selected
          ? "linear-gradient(180deg, color-mix(in srgb, var(--color-canvas) 94%, white 6%) 0%, color-mix(in srgb, var(--color-canvas) 98%, var(--color-accent, var(--ti)) 2%) 100%)"
          : "var(--sfr, #fff)",
        cursor: "pointer",
        boxShadow: selected
          ? "0 0 0 1px color-mix(in srgb, var(--color-accent, var(--ti)) 12%, transparent)"
          : "none",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-heading-family)",
          fontSize: "var(--tm)",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          color: "var(--color-text-muted)",
          fontSize: "var(--ts)",
          lineHeight: 1.4,
        }}
      >
        {hint}
      </div>
    </button>
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
      className="dasti-button dasti-button--secondary"
      style={{
        display: "inline-flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "var(--space-2)",
        width: "100%",
      }}
    >
      <span>{label}</span>
      <ArrowSquareOut size={12} strokeWidth={1.7} aria-hidden="true" />
    </a>
  );
}
