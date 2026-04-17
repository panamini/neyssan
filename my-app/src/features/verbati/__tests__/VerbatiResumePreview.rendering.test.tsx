import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VerbatiResumePreview } from "../VerbatiResumePreview";
import { resumeMock } from "../resume/resume.mock";
import { DEFAULT_VERBATI_STYLE } from "../style";

vi.mock("../../../hooks/use-document-pan", () => ({
  useDocumentPan: () => ({
    attachViewport: () => undefined,
    viewportPanProps: {},
  }),
}));

vi.mock("../../../hooks/use-document-stage-layout", () => ({
  useDocumentStageLayout: () => ({
    availableWidth: 794,
    availableHeight: 1123,
    stageWidth: 794,
    stageHeight: 1123,
    pageWidth: 794,
    pageHeight: 1123,
    overflowX: false,
    overflowY: false,
    isFit: true,
  }),
}));

vi.mock("../../../hooks/use-document-viewport-centering", () => ({
  useDocumentViewportCentering: () => ({
    attachViewport: () => undefined,
  }),
}));

vi.mock("../../../lib/document-export-debug", () => ({
  readDocumentExportDebugConfig: () => false,
  setResumePreviewDebugCapture: vi.fn(),
}));

vi.mock("../../../lib/resume-font-debug", () => ({
  collectResumeFontDebugSnapshot: vi.fn(() => ({})),
}));

const ROBIAL_STYLE_PRESET = {
  ...DEFAULT_VERBATI_STYLE,
  layout: "two-column",
} as const;

const RESUME_WITHOUT_PROJECTS = {
  ...resumeMock,
  projects: [],
};

describe("VerbatiResumePreview rendering", () => {
  it.each(["panel", "workspace"] as const)(
    "does not render a ghost projects heading in %s mode when projects are empty",
    (hostMode) => {
      const { container } = render(
        <VerbatiResumePreview
          data={RESUME_WITHOUT_PROJECTS}
          stylePreset={ROBIAL_STYLE_PRESET}
          hostMode={hostMode}
        />,
      );

      expect(
        screen.queryByText(/^Selected projects$/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Delete Selected projects" }),
      ).not.toBeInTheDocument();
      expect(
        container.querySelectorAll('[data-live-resume-preview="true"]'),
      ).toHaveLength(1);
    },
  );
});
