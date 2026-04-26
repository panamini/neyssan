import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { CvForge } from "../CvForge";
import type { ResumeExportRequest } from "../../components/ResumeExportControl";

const {
  mutationMock,
  showToastMock,
  downloadAuthoritativeResumeExportMock,
  downloadStandardResumeExportMock,
  exportDocumentFileMock,
  importCvMock,
  useBoundVerbatiCvStyleMock,
  useCvLibraryMock,
} = vi.hoisted(() => ({
  mutationMock: vi.fn(async () => undefined),
  showToastMock: vi.fn(),
  downloadAuthoritativeResumeExportMock: vi.fn(),
  downloadStandardResumeExportMock: vi.fn(),
  exportDocumentFileMock: vi.fn(),
  importCvMock: vi.fn(),
  useBoundVerbatiCvStyleMock: vi.fn(),
  useCvLibraryMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
  })),
  useMutation: vi.fn(() => mutationMock),
  useQuery: vi.fn((reference: string, args?: unknown) => {
    if (args === "skip") {
      return undefined;
    }

    return {
      preset1: null,
      preset2: null,
      preset3: null,
      activeSlot: null,
    };
  }),
  useAction: vi.fn(() => undefined),
}));

vi.mock("../../components/ProfileReviewCard", () => ({
  ProfileReviewCard: ({
    cvId,
    exportingFormat,
    exportStatusDescription,
    exportStatusLabel,
    toolbarLeadControl,
    toolbarPrimaryControl,
    onRequestExport,
    hiddenSectionIds,
    onHiddenSectionIdsChange,
  }: {
    cvId?: string;
    exportingFormat?: string | null;
    exportStatusDescription?: string;
    exportStatusLabel?: string;
    toolbarLeadControl?: React.ReactNode;
    toolbarPrimaryControl?: React.ReactNode;
    onRequestExport?: (request: ResumeExportRequest) => void;
    hiddenSectionIds?: string[];
    onHiddenSectionIdsChange?: (hiddenSectionIds: string[]) => void;
  }) => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const languagesHidden = hiddenSectionIds?.includes("languages-section");
    const summaryHidden = hiddenSectionIds?.includes("summary-section");

    return (
      <div>
        <div className="dasti-workbench-top-left-slot--cv">
          <div className="dasti-cv-workbench-toggle">{toolbarLeadControl}</div>
        </div>
        <div>Mock profile editor {cvId ?? "none"}</div>
        <button
          type="button"
          onClick={() =>
            onHiddenSectionIdsChange?.(
              languagesHidden ? [] : ["languages-section"],
            )
          }
        >
          {languagesHidden ? "Show Languages" : "Hide Languages"}
        </button>
        <button
          type="button"
          onClick={() =>
            onHiddenSectionIdsChange?.(
              summaryHidden ? [] : ["summary-section"],
            )
          }
        >
          {summaryHidden ? "Show Summary" : "Hide Summary"}
        </button>
        {toolbarPrimaryControl}
        {onRequestExport ? (
          <div>
            <button
              type="button"
              aria-label="Export Styled PDF"
              disabled={exportingFormat !== null}
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
              disabled={exportingFormat !== null}
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
                  disabled={exportingFormat !== null}
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
    cvDocumentOverride,
  }: {
    hostMode?: "panel" | "workspace";
    railTrailingControl?: React.ReactNode;
    cvDocumentOverride?: {
      sections?: Array<{ title?: string }>;
    } | null;
  }) => (
    <div>
      Preview host: {hostMode ?? "panel"}
      <div data-testid={`preview-sections-${hostMode ?? "panel"}`}>
        {(cvDocumentOverride?.sections ?? [])
          .map((section) => section.title ?? "Untitled")
          .join(" > ")}
      </div>
      {railTrailingControl}
    </div>
  ),
}));

vi.mock("../../features/verbati/useBoundVerbatiCvStyle", () => ({
  useBoundVerbatiCvStyle: () => useBoundVerbatiCvStyleMock(),
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
    useBoundVerbatiCvStyleMock.mockReset();
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
    useBoundVerbatiCvStyleMock.mockReturnValue({
      stylePreset: {
        layout: "swiss",
        typography: "quiet-editorial",
        palette: "pierre",
        accentHex: null,
      },
      setStylePreset: vi.fn(),
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
      screen.queryByRole("button", { name: "Export ATS PDF" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export Styled PDF" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "More export formats" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More export formats" }));
    expect(screen.getAllByText("Trusted Mistral v3").length).toBeGreaterThan(0);
    expect(screen.getByRole("menuitem", { name: /Export ATS PDF/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Export DOCX/i })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Export Markdown/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Export JSON/i })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /Export ATS PDF/i }));

    expect(exportDocumentFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "resume",
        format: "pdf",
        mode: "ats",
        fileNameBase: "Resume - ATS",
        stylePreset: expect.objectContaining({
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "pierre",
        }),
        data: expect.objectContaining({
          kind: "resume",
          exportSource: "authoritative",
        }),
      }),
    );
    expect(downloadAuthoritativeResumeExportMock).not.toHaveBeenCalled();
    expect(downloadStandardResumeExportMock).not.toHaveBeenCalled();
  });

  it("filters hidden sections out of the live preview feed and styled export source", async () => {
    const user = userEvent.setup();
    useCvLibraryMock.mockReturnValue({
      currentCv: {
        id: "cv-organize-export",
        title: "Organize export CV",
        metadata: {
          createdAt: "2026-04-22T09:00:00.000Z",
          updatedAt: "2026-04-22T09:00:00.000Z",
          version: 1,
        },
        sections: [
          {
            id: "profile-section",
            title: "Profile",
            type: "profile",
            blocks: [],
            structuredContent: [
              {
                id: "profile-item",
                name: "Jane Doe",
              },
            ],
          },
          {
            id: "languages-section",
            title: "Languages",
            type: "languages",
            blocks: [],
            structuredContent: [
              {
                id: "language-item",
                name: "French",
                level: "Fluent",
              },
            ],
          },
        ],
      },
      importCv: importCvMock,
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv-organize-export"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("preview-sections-panel")).toHaveTextContent(
      "Profile > Languages",
    );

    await user.click(screen.getByRole("button", { name: "Hide Languages" }));

    expect(screen.getByTestId("preview-sections-panel")).toHaveTextContent(
      "Profile",
    );
    expect(screen.getByTestId("preview-sections-panel")).not.toHaveTextContent(
      "Languages",
    );

    await user.click(screen.getByRole("button", { name: "Export Styled PDF" }));

    expect(exportDocumentFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          renderSource: "preview",
          resumeData: expect.objectContaining({
            languages: [],
          }),
        }),
      }),
    );
  });

  it("removes summary from the live preview feed when summary is hidden", async () => {
    const user = userEvent.setup();
    useCvLibraryMock.mockReturnValue({
      currentCv: {
        id: "cv-summary-preview",
        title: "Summary preview CV",
        metadata: {
          createdAt: "2026-04-22T09:00:00.000Z",
          updatedAt: "2026-04-22T09:00:00.000Z",
          version: 1,
        },
        sections: [
          {
            id: "profile-section",
            title: "Profile",
            type: "profile",
            blocks: [],
            structuredContent: [
              {
                id: "profile-item",
                name: "Jane Doe",
              },
            ],
          },
          {
            id: "summary-section",
            title: "Summary",
            type: "summary",
            blocks: [],
            structuredContent: [
              {
                id: "summary-item",
                summary: {
                  type: "doc",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Full summary text" }],
                    },
                  ],
                },
              },
            ],
          },
          {
            id: "languages-section",
            title: "Languages",
            type: "languages",
            blocks: [],
            structuredContent: [
              {
                id: "language-item",
                name: "French",
                level: "Fluent",
              },
            ],
          },
        ],
      },
      importCv: importCvMock,
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv-summary-preview"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("preview-sections-panel")).toHaveTextContent(
      "Profile > Summary > Languages",
    );

    await user.click(screen.getByRole("button", { name: "Hide Summary" }));

    expect(screen.getByTestId("preview-sections-panel")).toHaveTextContent(
      "Profile > Languages",
    );
    expect(screen.getByTestId("preview-sections-panel")).not.toHaveTextContent(
      "Summary",
    );
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
      screen.queryByRole("button", { name: "Export ATS PDF" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export Styled PDF" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "More export formats" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More export formats" }));
    expect(screen.getAllByText("Not ATS-verified").length).toBeGreaterThan(0);
    expect(screen.getByRole("menuitem", { name: /Export ATS PDF/i })).toBeInTheDocument();
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
        stylePreset: expect.objectContaining({
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "pierre",
        }),
        data: expect.objectContaining({
          kind: "resume",
          renderSource: "preview",
          stylePreset: expect.objectContaining({
            layout: "swiss",
            typography: "quiet-editorial",
            palette: "pierre",
          }),
          rendererVariantId: "swissminima",
        }),
      }),
    );
    expect(downloadAuthoritativeResumeExportMock).not.toHaveBeenCalled();
    expect(showToastMock).not.toHaveBeenCalledWith(
      expect.stringContaining("Trusted Mistral v3 export is unavailable"),
      expect.anything(),
    );
  });

  it("allows repeated resume PDF exports in one session without changing pages", async () => {
    const user = userEvent.setup();
    useCvLibraryMock.mockReturnValue({
      currentCv: {
        id: "cv-repeat",
        title: "Repeat export CV",
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
      <MemoryRouter initialEntries={["/cv?id=cv-repeat"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "More export formats" }));
    await user.click(screen.getByRole("menuitem", { name: /Export ATS PDF/i }));
    await user.click(screen.getByRole("button", { name: "Export Styled PDF" }));

    expect(exportDocumentFileMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        kind: "resume",
        format: "pdf",
        mode: "ats",
        stylePreset: expect.objectContaining({
          layout: "swiss",
        }),
      }),
    );
    expect(exportDocumentFileMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        kind: "resume",
        format: "pdf",
        mode: "styled",
        stylePreset: expect.objectContaining({
          layout: "swiss",
        }),
        data: expect.objectContaining({
          renderSource: "preview",
          rendererVariantId: "swissminima",
        }),
      }),
    );
  });

  it("routes resume DOCX through the active export pipeline with the selected style preset", async () => {
    const user = userEvent.setup();
    exportDocumentFileMock.mockResolvedValueOnce({
      filename: "Resume - Editable.docx",
    });
    useCvLibraryMock.mockReturnValue({
      currentCv: {
        id: "cv-docx",
        title: "Docx export CV",
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
      <MemoryRouter initialEntries={["/cv?id=cv-docx"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "More export formats" }));
    await user.click(screen.getByRole("menuitem", { name: /Export DOCX/i }));

    expect(exportDocumentFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "resume",
        format: "docx",
        fileNameBase: "Resume - Editable",
        stylePreset: expect.objectContaining({
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "pierre",
        }),
        data: expect.objectContaining({
          kind: "resume",
          exportSource: "authoritative",
        }),
      }),
    );
    expect(downloadAuthoritativeResumeExportMock).not.toHaveBeenCalled();
    expect(downloadStandardResumeExportMock).not.toHaveBeenCalled();
  });

  it("disables the editor export surface while a resume export is in flight and does the same in preview mode", async () => {
    const user = userEvent.setup();
    let resolveExport: ((value: { filename: string }) => void) | null = null;

    exportDocumentFileMock.mockImplementation(
      () =>
        new Promise<{ filename: string }>((resolve) => {
          resolveExport = resolve;
        }),
    );

    useCvLibraryMock.mockReturnValue({
      currentCv: {
        id: "cv-pending",
        title: "Pending export CV",
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
      <MemoryRouter initialEntries={["/cv?id=cv-pending"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "More export formats" }));
    await user.click(screen.getByRole("menuitem", { name: /Export ATS PDF/i }));

    expect(
      screen.queryByRole("button", { name: "Export ATS PDF" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export Styled PDF" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "More export formats" }),
    ).toBeDisabled();

    expect(exportDocumentFileMock).toHaveBeenCalledTimes(1);

    resolveExport?.({ filename: "Resume - ATS.pdf" });

    expect(
      screen.queryByRole("button", { name: "Export ATS PDF" }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Export Styled PDF" }),
      ).not.toBeDisabled();
      expect(
        screen.getByRole("button", { name: "More export formats" }),
      ).not.toBeDisabled();
    });

    await user.click(screen.getByRole("button", { name: "Open resume preview" }));

    expect(
      screen.getByText("Preview host: workspace"),
    ).toBeInTheDocument();

    resolveExport = null;
    exportDocumentFileMock.mockImplementation(
      () =>
        new Promise<{ filename: string }>((resolve) => {
          resolveExport = resolve;
        }),
    );

    await user.click(screen.getByRole("button", { name: "Export Styled PDF" }));

    expect(
      screen.queryByRole("button", { name: "Export ATS PDF" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export Styled PDF" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "More export formats" }),
    ).toBeDisabled();

    expect(exportDocumentFileMock).toHaveBeenCalledTimes(2);

    resolveExport?.({ filename: "Resume - Styled.pdf" });

    expect(
      screen.queryByRole("button", { name: "Export ATS PDF" }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Export Styled PDF" }),
      ).not.toBeDisabled();
      expect(
        screen.getByRole("button", { name: "More export formats" }),
      ).not.toBeDisabled();
    });
  });

  it("routes workshop styled PDF export through the preview print-route path", async () => {
    const user = userEvent.setup();
    useBoundVerbatiCvStyleMock.mockReturnValue({
      stylePreset: {
        familyId: "workshop",
        layout: "workshop",
        typography: "quiet-editorial",
        palette: "sauge",
        accentHex: null,
      },
      setStylePreset: vi.fn(),
    });
    useCvLibraryMock.mockReturnValue({
      currentCv: {
        id: "cv-workshop-export",
        title: "Workshop export CV",
        metadata: {
          authoritativeResume: null,
          verbatiStyle: {
            familyId: "workshop",
            layout: "workshop",
            typography: "quiet-editorial",
            palette: "sauge",
          },
        },
        sections: [],
      },
      importCv: importCvMock,
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv-workshop-export"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Export Styled PDF" }));

    expect(exportDocumentFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "resume",
        format: "pdf",
        mode: "styled",
        data: expect.objectContaining({
          kind: "resume",
          renderSource: "preview",
          resumeTemplateId: "workshop_resume_onecol_ats",
          committedPages: expect.any(Array),
        }),
      }),
    );
  });
});
