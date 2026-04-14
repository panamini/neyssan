import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { CvForge } from "../CvForge";
import type { ResumeExportRequest } from "../../components/ResumeExportControl";

const {
  showToastMock,
  downloadAuthoritativeResumeExportMock,
  downloadStandardResumeExportMock,
  exportDocumentFileMock,
  importCvMock,
  useCvLibraryMock,
} = vi.hoisted(() => ({
  showToastMock: vi.fn(),
  downloadAuthoritativeResumeExportMock: vi.fn(),
  downloadStandardResumeExportMock: vi.fn(),
  exportDocumentFileMock: vi.fn(),
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
    toolbarLeadControl,
    toolbarPrimaryControl,
    onRequestExport,
  }: {
    cvId?: string;
    exportStatusDescription?: string;
    exportStatusLabel?: string;
    toolbarLeadControl?: React.ReactNode;
    toolbarPrimaryControl?: React.ReactNode;
    onRequestExport?: (request: ResumeExportRequest) => void;
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
            <button
              type="button"
              aria-label="Export ATS PDF"
              onClick={() =>
                onRequestExport({
                  format: "pdf",
                  mode: "ats",
                })
              }
            >
              Export ATS PDF
            </button>
            <button
              type="button"
              aria-label="Export Styled PDF"
              onClick={() =>
                onRequestExport({
                  format: "pdf",
                  mode: "styled",
                })
              }
            >
              Export Styled PDF
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
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => onRequestExport({ format: "docx" })}
                >
                  Export DOCX
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => onRequestExport({ format: "markdown" })}
                >
                  Export Markdown
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => onRequestExport({ format: "json" })}
                >
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

vi.mock("../../lib/exportDocumentFile", () => ({
  exportDocumentFile: exportDocumentFileMock,
}));

describe("CvForge export status", () => {
  beforeEach(() => {
    showToastMock.mockReset();
    downloadAuthoritativeResumeExportMock.mockReset();
    downloadStandardResumeExportMock.mockReset();
    exportDocumentFileMock.mockReset();
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
    exportDocumentFileMock.mockResolvedValue({
      filename: "Resume - ATS.pdf",
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

    expect(
      screen.getByRole("button", { name: "Export ATS PDF" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export Styled PDF" }),
    ).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Export ATS PDF" }));

    expect(exportDocumentFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "resume",
        format: "pdf",
        mode: "ats",
        fileNameBase: "Resume - ATS",
        data: expect.objectContaining({
          kind: "resume",
          exportSource: "authoritative",
        }),
      }),
    );
    expect(downloadAuthoritativeResumeExportMock).not.toHaveBeenCalled();
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

    expect(
      screen.getByRole("button", { name: "Export ATS PDF" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export Styled PDF" }),
    ).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Export Styled PDF" }));

    expect(exportDocumentFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "resume",
        format: "pdf",
        mode: "styled",
        fileNameBase: "Resume - Styled",
        data: expect.objectContaining({
          kind: "resume",
          exportSource: "standard",
        }),
      }),
    );
    expect(downloadAuthoritativeResumeExportMock).not.toHaveBeenCalled();
    expect(showToastMock).not.toHaveBeenCalledWith(
      expect.stringContaining("Trusted Mistral v3 export is unavailable"),
      expect.anything(),
    );
  });
});
