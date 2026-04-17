import React from "react";
import { useNavigate } from "react-router-dom";
import { useAction } from "convex/react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "../ui/button";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import { mapProfileToCvDocument } from "../../adapters/profile-mapper";
import { clientFormatCompleteCV } from "../../utils/simpleClientParse";
import { api } from "../../../convex/_generated/api";
import { deriveCvTitleFromSections } from "../../lib/normalize-cv";
import {
  TONE_OPTIONS,
  markQuickStartCompleted,
  writeTonePreference,
  type TonePreference,
} from "../../lib/onboarding-state";

type CreateType = "resume" | "cover-letter";
type ImportChoice = "pdf" | "text" | "fresh";
type ImportMode = "choice" | "text";

type Step = 1 | 2 | 3;

interface Props {
  onExit: () => void;
}

// Scope note: the product plan pairs tone calibration with a "Generate first
// draft" action. No CV-draft generation pipeline is wired at this surface yet,
// so tone is persisted as a preference only and the CTA stays honest ("Finish it.").
// When a generation path exists, wire it in handleFinish before markQuickStartCompleted.
export function QuickStartFlow({ onExit }: Props): JSX.Element {
  const navigate = useNavigate();
  const { importCv, createNewCv } = useCvLibrary();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Use the same OCR extraction actions as StrictUploadButton
  const withSpansRef =
    (api as any).actions?.extractProfileStrictWithSpans ??
    (api as any)["actions/extractProfileStrictWithSpans"]
      ?.extractProfileStrictWithSpans ??
    null;
  const strictOnlyRef =
    (api as any).actions?.extractProfileStrict ??
    (api as any)["actions/extractProfileStrict"]?.extractProfileStrict ??
    null;
  const extractWithSpans = useAction(withSpansRef || (() => Promise.reject("No action")));
  const extractStrictOnly = useAction(strictOnlyRef || (() => Promise.reject("No action")));

  const [step, setStep] = React.useState<Step>(1);
  const [createType, setCreateType] = React.useState<CreateType>("resume");
  const [importChoice, setImportChoice] = React.useState<ImportChoice | null>(
    null,
  );
  const [importMode, setImportMode] = React.useState<ImportMode>("choice");
  const [pastedText, setPastedText] = React.useState("");
  const [tone, setTone] = React.useState<TonePreference>("auto");
  const [parsing, setParsing] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [finishing, setFinishing] = React.useState(false);

  const handleSkip = React.useCallback(() => {
    markQuickStartCompleted();
    onExit();
  }, [onExit]);

  const handleFileChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setParseError(null);
      setParsing(true);
      try {
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        if (ext === "pdf") {
          const { importStructuredMistralFileViaClient } = await import(
            "../useStructuredMistralImport"
          );
          const outcome = await importStructuredMistralFileViaClient(file);
          if (outcome.status === "rejected") {
            setParseError(outcome.message);
            return;
          }
          if (!Array.isArray(outcome.sections) || outcome.sections.length === 0) {
            setParseError(
              outcome.emptyReason
                ? `Parser returned empty result: ${outcome.emptyReason}`
                : "No importable sections were found.",
            );
            return;
          }

          const now = new Date().toISOString();
          await importCv({
            id: uuidv4(),
            title: deriveCvTitleFromSections(outcome.sections as any, "Imported CV"),
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
          setImportChoice("pdf");
          setStep(3);
          return;
        }

        // Extract raw text from file
        let rawText: string;
        if (ext === "txt") {
          rawText = await file.text();
        } else {
          throw new Error("Unsupported file type. Please upload a PDF or paste text.");
        }

        // Call the OCR extraction action (prefer with-spans)
        let profile: unknown = null;
        if (typeof extractWithSpans === "function") {
          try {
            profile = await extractWithSpans({ rawText });
          } catch (e) {
            if (typeof extractStrictOnly === "function") {
              profile = await extractStrictOnly({ rawText });
            } else {
              throw e;
            }
          }
        } else if (typeof extractStrictOnly === "function") {
          profile = await extractStrictOnly({ rawText });
        } else {
          throw new Error("OCR service unavailable. Please try again or paste text manually.");
        }

        const doc = mapProfileToCvDocument(profile);
        if (!doc) {
          throw new Error("We couldn't structure that file. Try pasting text instead.");
        }
        await importCv(doc);
        setImportChoice("pdf");
        setStep(3);
      } catch (err) {
        setParseError(
          err instanceof Error ? err.message : "Couldn't read that file.",
        );
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
        setParsing(false);
      }
    },
    [importCv, extractWithSpans, extractStrictOnly],
  );

  const handleStartFresh = React.useCallback(() => {
    setImportChoice("fresh");
    setParseError(null);
    setStep(3);
  }, []);

  const handleImportText = React.useCallback(async () => {
    const raw = pastedText.trim();
    if (raw.length < 20) {
      setParseError("Paste a bit more text so we can read it.");
      return;
    }
    setParseError(null);
    setParsing(true);
    try {
      // Try OCR extraction first (with-spans preferred)
      let profile: unknown = null;
      if (typeof extractWithSpans === "function") {
        try {
          profile = await extractWithSpans({ rawText: raw });
        } catch (e) {
          if (typeof extractStrictOnly === "function") {
            profile = await extractStrictOnly({ rawText: raw });
          }
        }
      } else if (typeof extractStrictOnly === "function") {
        profile = await extractStrictOnly({ rawText: raw });
      }

      // Fallback to client-side parsing if server extraction fails
      if (!profile) {
        const parsed = clientFormatCompleteCV(raw);
        profile =
          (parsed as { result?: Record<string, unknown> })?.result ?? {};
      }

      const result = (profile as Record<string, unknown>) ?? {};
      const identity =
        (result.identity as Record<string, unknown> | undefined) ?? {};
      const flatProfile = {
        ...identity,
        summary: result.summary,
        skills: result.skills,
        experience: result.experience,
        education: result.education,
        achievements: result.achievements,
        rawText: raw,
      };
      const doc = mapProfileToCvDocument(flatProfile);
      if (!doc) {
        throw new Error("We couldn't structure that text. Try again or start fresh.");
      }
      await importCv(doc);
      setImportChoice("text");
      setStep(3);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Couldn't read that text.",
      );
    } finally {
      setParsing(false);
    }
  }, [importCv, pastedText, extractWithSpans, extractStrictOnly]);

  const handleFinish = React.useCallback(async () => {
    setFinishing(true);
    try {
      writeTonePreference(tone);
      if (importChoice === "fresh") {
        await createNewCv();
      }
      markQuickStartCompleted();
      onExit();
    } finally {
      setFinishing(false);
    }
  }, [createNewCv, importChoice, onExit, tone]);

  const handleCoverLetter = React.useCallback(() => {
    markQuickStartCompleted();
    navigate("/proposal");
  }, [navigate]);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="quick-start-heading"
      style={{
        height: "100%",
        overflowY: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(var(--space-4), 4vw, var(--space-7))",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
        }}
      >
        <StepIndicator current={step} />

        {step === 1 ? (
          <StepOne
            createType={createType}
            onPick={setCreateType}
            onNext={() => {
              if (createType === "cover-letter") {
                handleCoverLetter();
                return;
              }
              setStep(2);
            }}
          />
        ) : null}

        {step === 2 ? (
          <StepTwo
            parsing={parsing}
            parseError={parseError}
            mode={importMode}
            pastedText={pastedText}
            onPastedTextChange={setPastedText}
            onPickFile={() => fileInputRef.current?.click()}
            onOpenTextMode={() => {
              setParseError(null);
              setImportMode("text");
            }}
            onCancelTextMode={() => {
              setParseError(null);
              setImportMode("choice");
            }}
            onImportText={handleImportText}
            onStartFresh={handleStartFresh}
            onBack={() => {
              if (importMode === "text") {
                setImportMode("choice");
                return;
              }
              setStep(1);
            }}
          />
        ) : null}

        {step === 3 ? (
          <StepThree
            tone={tone}
            onPick={setTone}
            onFinish={handleFinish}
            finishing={finishing}
            onBack={() => setStep(2)}
          />
        ) : null}

        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            onClick={handleSkip}
            className="dasti-button dasti-button--ghost dasti-button--sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            Go straight to editor →
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          style={{ display: "none" }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: Step }): JSX.Element {
  return (
    <div
      aria-label={`Step ${current} of 3`}
      style={{
        display: "flex",
        gap: "var(--space-2)",
        justifyContent: "center",
      }}
    >
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          style={{
            height: 4,
            width: 32,
            borderRadius: 2,
            background:
              n <= current
                ? "var(--color-accent, var(--ti))"
                : "var(--color-border)",
          }}
        />
      ))}
    </div>
  );
}

function StepOne({
  createType,
  onPick,
  onNext,
}: {
  createType: CreateType;
  onPick: (t: CreateType) => void;
  onNext: () => void;
}): JSX.Element {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <header>
        <h1
          id="quick-start-heading"
          style={{
            fontFamily: "var(--font-heading-family)",
            fontSize: "var(--tl)",
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          What are you building today?
        </h1>
        <p
          style={{
            marginTop: "var(--space-2)",
            color: "var(--color-text-muted)",
            fontSize: "var(--tm)",
          }}
        >
          Pick one. You can always switch later.
        </p>
      </header>

      <div
        role="radiogroup"
        aria-label="Document type"
        style={{ display: "grid", gap: "var(--space-3)" }}
      >
        <ChoiceCard
          selected={createType === "resume"}
          label="Resume"
          hint="A sharp, printable CV."
          onClick={() => onPick("resume")}
        />
        <ChoiceCard
          selected={createType === "cover-letter"}
          label="Cover letter"
          hint="Targeted to one role."
          onClick={() => onPick("cover-letter")}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </section>
  );
}

function StepTwo({
  parsing,
  parseError,
  mode,
  pastedText,
  onPastedTextChange,
  onPickFile,
  onOpenTextMode,
  onCancelTextMode,
  onImportText,
  onStartFresh,
  onBack,
}: {
  parsing: boolean;
  parseError: string | null;
  mode: ImportMode;
  pastedText: string;
  onPastedTextChange: (value: string) => void;
  onPickFile: () => void;
  onOpenTextMode: () => void;
  onCancelTextMode: () => void;
  onImportText: () => void;
  onStartFresh: () => void;
  onBack: () => void;
}): JSX.Element {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <header>
        <h1
          style={{
            fontFamily: "var(--font-heading-family)",
            fontSize: "var(--tl)",
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          {mode === "text"
            ? "Paste it in."
            : "Drop your CV. We'll handle the rest."}
        </h1>
        <p
          style={{
            marginTop: "var(--space-2)",
            color: "var(--color-text-muted)",
            fontSize: "var(--tm)",
          }}
        >
          {mode === "text"
            ? "Anything goes — a Google Doc, an old resume, rough notes."
            : "Bring what you have. Or start from scratch."}
        </p>
      </header>

      {mode === "choice" ? (
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <ChoiceCard
            label={parsing ? "Reading your CV…" : "Upload a PDF"}
            hint="We'll parse it and fill the editor for you."
            onClick={onPickFile}
            disabled={parsing}
          />
          <ChoiceCard
            label="Paste text"
            hint="Drop a Google Doc or old resume straight in."
            onClick={onOpenTextMode}
            disabled={parsing}
          />
          <ChoiceCard
            label="Import from LinkedIn"
            hint="Coming soon."
            onClick={() => {}}
            disabled
          />
          <ChoiceCard
            label="Start fresh"
            hint="A clean template, nothing to unlearn."
            onClick={onStartFresh}
            disabled={parsing}
          />
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          <textarea
            aria-label="Paste your CV text"
            value={pastedText}
            onChange={(e) => onPastedTextChange(e.target.value)}
            disabled={parsing}
            placeholder="Paste your CV here — we'll structure it."
            style={{
              minHeight: 200,
              padding: "var(--space-3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-surface, 12px)",
              background: "var(--sfr, #fff)",
              fontFamily: "inherit",
              fontSize: "var(--ts)",
              resize: "vertical",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--space-2)",
            }}
          >
            <Button
              variant="ghost"
              onClick={onCancelTextMode}
              disabled={parsing}
            >
              Cancel
            </Button>
            <Button
              onClick={onImportText}
              disabled={parsing || pastedText.trim().length < 20}
            >
              {parsing ? "Reading…" : "Use this text"}
            </Button>
          </div>
        </div>
      )}

      {parseError ? (
        <p
          role="alert"
          style={{
            margin: 0,
            color: "var(--color-danger, #b42318)",
            fontSize: "var(--ts)",
          }}
        >
          {parseError}
        </p>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button variant="ghost" onClick={onBack} disabled={parsing}>
          Back
        </Button>
      </div>
    </section>
  );
}

function StepThree({
  tone,
  onPick,
  onFinish,
  finishing,
  onBack,
}: {
  tone: TonePreference;
  onPick: (t: TonePreference) => void;
  onFinish: () => void;
  finishing: boolean;
  onBack: () => void;
}): JSX.Element {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <header>
        <h1
          style={{
            fontFamily: "var(--font-heading-family)",
            fontSize: "var(--tl)",
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          How should it sound?
        </h1>
        <p
          style={{
            marginTop: "var(--space-2)",
            color: "var(--color-text-muted)",
            fontSize: "var(--tm)",
          }}
        >
          We'll keep this tone in mind as you edit.
        </p>
      </header>

      <div
        role="radiogroup"
        aria-label="Tone"
        style={{ display: "grid", gap: "var(--space-3)" }}
      >
        {TONE_OPTIONS.map((option) => (
          <ChoiceCard
            key={option.id}
            selected={tone === option.id}
            label={option.label}
            hint={option.hint}
            onClick={() => onPick(option.id)}
          />
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button variant="ghost" onClick={onBack} disabled={finishing}>
          Back
        </Button>
        <Button onClick={onFinish} disabled={finishing}>
          {finishing ? "Opening editor…" : "Finish it."}
        </Button>
      </div>
    </section>
  );
}

function ChoiceCard({
  label,
  hint,
  onClick,
  selected,
  disabled,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  selected?: boolean;
  disabled?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected ? true : undefined}
      style={{
        textAlign: "left",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-surface, 12px)",
        border: `1px solid ${
          selected ? "var(--color-accent, var(--ti))" : "var(--color-border)"
        }`,
        background: selected
          ? "var(--color-accent-soft, var(--sfr, #fff))"
          : "var(--sfr, #fff)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        boxShadow: selected ? "var(--shadow-sm)" : "none",
        transition: "border-color 120ms ease, box-shadow 120ms ease",
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
        }}
      >
        {hint}
      </div>
    </button>
  );
}
