import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { CvForge } from "../CvForge";

const {
  showToastMock,
  downloadAuthoritativeResumeExportMock,
  downloadStandardResumeExportMock,
  importCvMock,
  useCvLibraryMock,
} = vi.hoisted(() => ({
  showToastMock: vi.fn(),
  downloadAuthoritativeResumeExportMock: vi.fn(),
  downloadStandardResumeExportMock: vi.fn(),
  importCvMock: vi.fn(),
  useCvLibraryMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => ({
    preset1: null,
    preset2: null,
    preset3: null,
    activeSlot: null,
  })),
}));

vi.mock("../../components/ProfileReviewCard", () => ({
  ProfileReviewCard: ({
    cvId,
    exportStatusDescription,
    exportStatusLabel,
    exportStatusTone,
    onRequestExport,
    toolbarLeadControl,
    toolbarPrimaryControl,
  }: {
    cvId?: string;
    exportStatusDescription?: string;
    exportStatusLabel?: string;
    exportStatusTone?: "standard" | "trusted";
    onRequestExport?: (format: "pdf" | "docx" | "markdown" | "json") => void;
    toolbarLeadControl?: React.ReactNode;
    toolbarPrimaryControl?: React.ReactNode;
  }) => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

    return (
      <div>
        <div className="dasti-workbench-top-left-slot--cv">
          <div className="dasti-cv-workbench-toggle">{toolbarLeadControl}</div>
        </div>
        <div>Mock profile editor {cvId ?? "none"}</div>
        {toolbarPrimaryControl}
        {onRequestExport ? (
          <div>
            <button type="button" aria-label="Export PDF" onClick={() => onRequestExport("pdf")}>
              Export PDF
            </button>
            <button
              type="button"
              aria-label="More export formats"
              onClick={() => setIsMenuOpen((current) => !current)}
            >
              More export formats
            </button>
            <span>{exportStatusLabel ?? "Standard Export"}</span>
            {isMenuOpen ? (
              <div role="menu" aria-label="Export resume formats">
                <button type="button" role="menuitem" onClick={() => onRequestExport("docx")}>
                  Export DOCX
                </button>
                <button type="button" role="menuitem" onClick={() => onRequestExport("markdown")}>
                  Export Markdown
                </button>
                <button type="button" role="menuitem" onClick={() => onRequestExport("json")}>
                  Export JSON
                </button>
                <span>{exportStatusDescription ?? "Not ATS-verified"}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  },
}));

vi.mock("../../features/verbati/VerbatiCvPreviewPanel", () => ({
  VerbatiCvPreviewPanel: ({
    hostMode,
    railTrailingControl,
  }: {
    hostMode?: "panel" | "workspace";
    railTrailingControl?: React.ReactNode;
  }) => (
    <div>
      Preview host: {hostMode ?? "panel"}
      {railTrailingControl}
    </div>
  ),
}));

vi.mock("../../features/verbati/useBoundVerbatiCvStyle", () => ({
  useBoundVerbatiCvStyle: () => ({
    stylePreset: {
      layout: "stacked",
      typography: "quiet-editorial",
      palette: "pierre",
      accentHex: null,
    },
    setStylePreset: vi.fn(),
  }),
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: showToastMock,
  }),
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => useCvLibraryMock(),
}));

vi.mock("../../lib/cv-export", () => ({
  downloadAuthoritativeResumeExport: downloadAuthoritativeResumeExportMock,
  downloadStandardResumeExport: downloadStandardResumeExportMock,
}));

describe("CvForge export status", () => {
  beforeEach(() => {
    showToastMock.mockReset();
    downloadAuthoritativeResumeExportMock.mockReset();
    downloadStandardResumeExportMock.mockReset();
    importCvMock.mockReset();
    useCvLibraryMock.mockReset();
    downloadAuthoritativeResumeExportMock.mockResolvedValue({
      filename: "jane-doe.pdf",
      model: {},
    });
    downloadStandardResumeExportMock.mockResolvedValue({
      filename: "resume.pdf",
      data: {},
    });
  });

  it("shows the trusted badge and uses the authoritative export path for trusted CVs", async () => {
    const user = userEvent.setup();
    useCvLibraryMock.mockReturnValue({
      currentCv: {
        id: "cv-trusted",
        title: "Wrong UI title",
        metadata: {
          authoritativeResume: {
            source: "mistral_v3",
            trusted: true,
            fallbackToLegacy: false,
            normalized: {
              profile: {
                name: "Jane Doe",
                desiredPosition: "Product Manager",
              },
              summary: {
                text: "Summary text",
              },
              experience: [],
              education: [],
              skills: [],
              languages: [],
              projects: [],
              certifications: [],
              achievements: [],
            },
          },
        },
        sections: [],
      },
      importCv: importCvMock,
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv-trusted"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(screen.getByText("ATS Ready")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Export PDF" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "More export formats" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More export formats" }));
    expect(screen.getAllByText("Trusted Mistral v3").length).toBeGreaterThan(0);
    expect(screen.getByRole("menuitem", { name: /Export DOCX/i })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Export Markdown/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Export JSON/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Export PDF" }));

    expect(downloadAuthoritativeResumeExportMock).toHaveBeenCalledWith({
      authoritativeResume: expect.objectContaining({
        source: "mistral_v3",
        trusted: true,
      }),
      format: "pdf",
    });
    expect(downloadStandardResumeExportMock).not.toHaveBeenCalled();
  });

  it("keeps export enabled as standard export for untrusted CVs", async () => {
    const user = userEvent.setup();
    useCvLibraryMock.mockReturnValue({
      currentCv: {
        id: "cv-standard",
        title: "Stale UI title",
        metadata: {
          authoritativeResume: {
            source: "mistral_v3",
            trusted: false,
            fallbackToLegacy: true,
            normalized: null,
          },
        },
        sections: [],
      },
      importCv: importCvMock,
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv-standard"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(screen.getByText("Standard Export")).toBeInTheDocument();
    expect(screen.queryByText("ATS Ready")).toBeNull();

    expect(screen.getByRole("button", { name: "Export PDF" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "More export formats" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More export formats" }));
    expect(screen.getAllByText("Not ATS-verified").length).toBeGreaterThan(0);
    expect(screen.getByRole("menuitem", { name: /Export DOCX/i })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Export Markdown/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Export JSON/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Export PDF" }));

    expect(downloadStandardResumeExportMock).toHaveBeenCalledWith({
      document: expect.objectContaining({
        id: "cv-standard",
        title: "Stale UI title",
      }),
      format: "pdf",
    });
    expect(downloadAuthoritativeResumeExportMock).not.toHaveBeenCalled();
    expect(showToastMock).not.toHaveBeenCalledWith(
      expect.stringContaining("Trusted Mistral v3 export is unavailable"),
      expect.anything(),
    );
  });
});
