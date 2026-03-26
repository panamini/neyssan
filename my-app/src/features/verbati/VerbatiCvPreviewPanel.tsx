import React from "react";
import { useNavigate } from "react-router-dom";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import { resumeMock } from "./resume/resume.mock";
import { getVerbatiStyleFromCv } from "./style";
import { VerbatiResumePreview } from "./VerbatiResumePreview";
import {
  hasRenderableResumeData,
  mapCvDocumentToResumeData,
} from "./cvDocumentToResumeData";
import { Palette } from "@/lib/icons";

export function VerbatiCvPreviewPanel(): JSX.Element {
  const navigate = useNavigate();
  const { currentCv } = useCvLibrary();

  const stylePreset = React.useMemo(
    () => getVerbatiStyleFromCv(currentCv),
    [currentCv],
  );
  const activeData = React.useMemo(
    () => (currentCv ? mapCvDocumentToResumeData(currentCv) : null),
    [currentCv],
  );
  const hasActiveResume = hasRenderableResumeData(activeData);
  const previewData = hasActiveResume ? (activeData ?? resumeMock) : resumeMock;

  return (
    <section
      className="dasti-panel dasti-panel--spacious dasti-flow"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--sfr) 84%, white 16%), var(--sf1))",
      }}
    >
      <div className="dasti-page-header">
        <div className="dasti-stack">
          <div className="dasti-stack__eyebrow">Live render</div>
        </div>

        <button
          type="button"
          onClick={() => void navigate("/style")}
          className="dasti-button dasti-button--primary dasti-button--pill"
        >
          <span>Your canvas is waiting.</span>
          <Palette size={16} strokeWidth={1.7} aria-hidden />
        </button>
      </div>

      {!hasActiveResume ? (
        <div
          style={{
            borderRadius: "var(--radius-card)",
            border: "1px solid color-mix(in srgb, var(--wa) 22%, transparent)",
            background: "var(--wab)",
            color: "var(--wat)",
            padding: "var(--s3) var(--s4)",
            fontSize: "var(--ts)",
            lineHeight: 1.55,
          }}
        >
          The active CV is still too sparse for a faithful render, so this panel
          is showing the Verbati sample document until profile, summary, or
          experience content is filled in.
        </div>
      ) : null}

      <div className="dasti-stage-card dasti-stage-card--document">
        <VerbatiResumePreview data={previewData} stylePreset={stylePreset} />
      </div>
    </section>
  );
}
