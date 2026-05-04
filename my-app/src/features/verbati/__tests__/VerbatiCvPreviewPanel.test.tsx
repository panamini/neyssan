import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VerbatiCvPreviewPanel } from "../VerbatiCvPreviewPanel";

const mockImportCv = vi.fn().mockResolvedValue(undefined);
const mockSaveCurrentCvStyleOnly = vi.fn().mockResolvedValue(undefined);
const mockHasRenderableResumeData = vi.fn(() => true);
let mockIsLibraryHydrated = true;
const mockMapCvDocumentToResumeData = vi.fn(() => ({
  name: "Robert Cooper",
  title: "Protection Guard",
  summary: "Experienced security profile.",
  experience: [],
  education: [],
  skills: [],
  languages: [],
  projects: [
    {
      id: "project-1",
      name: "Live project",
      meta: "",
      description: "Live project description",
      sectionId: "projects-1",
      sectionType: "projects",
    },
  ],
  achievements: [],
}));
const resumePreviewPropsSpy = vi.fn();
let mockCurrentCv = {
  id: "cv-1",
  metadata: {},
  sections: [
    {
      id: "projects-1",
      type: "projects",
      title: "Projects",
      blocks: [],
      structuredContent: [],
    },
    {
      id: "additional-information-1",
      type: "text",
      title: "Additional Information",
      blocks: [],
      structuredContent: [],
    },
  ],
};

vi.mock("../../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: mockCurrentCv,
    importCv: mockImportCv,
    saveCurrentCvStyleOnly: mockSaveCurrentCvStyleOnly,
    isLibraryHydrated: mockIsLibraryHydrated,
  }),
}));

vi.mock("../cvDocumentToResumeData", () => ({
  hasRenderableResumeData: (...args: unknown[]) =>
    mockHasRenderableResumeData(...args),
  mapCvDocumentToResumeData: (...args: unknown[]) =>
    mockMapCvDocumentToResumeData(...args),
}));

vi.mock("../VerbatiResumePreview", () => ({
  VerbatiResumePreview: ({
    data,
    stylePreset,
    railLeadControl,
    railStartAddon,
    onLinkIntent,
    activeTarget,
    onRemoveSection,
  }: {
    data: { title: string; projects?: Array<unknown> };
    stylePreset: { layout: string; typography?: string; palette?: string };
    railLeadControl?: React.ReactNode;
    railStartAddon?: React.ReactNode;
    onLinkIntent?: unknown;
    activeTarget?: unknown;
    onRemoveSection?: (section: {
      sectionId: string;
      sectionType: "additional_information";
      sectionTitle: string;
      previewSectionType: "additional_information";
    }) => void;
  }) => (
    (() => {
      resumePreviewPropsSpy({
        data,
        stylePreset,
        onLinkIntent,
        activeTarget,
        onRemoveSection,
      });
      return (
        <div>
          <div>Preview layout: {stylePreset.layout}</div>
          <div>Preview typography: {stylePreset.typography ?? "none"}</div>
          <div>Preview palette: {stylePreset.palette ?? "none"}</div>
          <div>Preview title: {data.title}</div>
          <div>Preview projects: {data.projects?.length ?? 0}</div>
          {railLeadControl}
          {railStartAddon}
          {onRemoveSection ? (
            <button
              type="button"
              onClick={() =>
                onRemoveSection({
                  sectionId: "additional-information-1",
                  sectionType: "additional_information",
                  sectionTitle: "Additional Information",
                  previewSectionType: "additional_information",
                })
              }
            >
              Remove Additional Information
            </button>
          ) : null}
          {onRemoveSection ? (
            <button
              type="button"
              onClick={() =>
                onRemoveSection({
                  sectionId: "projects-1",
                  sectionType: "projects" as never,
                  sectionTitle: "Projects",
                  previewSectionType: "selected_projects" as never,
                })
              }
            >
              Remove Projects
            </button>
          ) : null}
        </div>
      );
    })()
  ),
}));

describe("VerbatiCvPreviewPanel", () => {
  beforeEach(() => {
    mockImportCv.mockClear();
    mockSaveCurrentCvStyleOnly.mockClear();
    mockHasRenderableResumeData.mockReset();
    mockHasRenderableResumeData.mockReturnValue(true);
    mockMapCvDocumentToResumeData.mockReset();
    mockMapCvDocumentToResumeData.mockReturnValue({
      name: "Robert Cooper",
      title: "Protection Guard",
      summary: "Experienced security profile.",
      experience: [],
      education: [],
      skills: [],
      languages: [],
      projects: [
        {
          id: "project-1",
          name: "Live project",
          meta: "",
          description: "Live project description",
          sectionId: "projects-1",
          sectionType: "projects",
        },
      ],
      achievements: [],
    });
    mockCurrentCv = {
      id: "cv-1",
      metadata: {},
      sections: [
        {
          id: "projects-1",
          type: "projects",
          title: "Projects",
          blocks: [],
          structuredContent: [],
        },
        {
          id: "additional-information-1",
          type: "text",
          title: "Additional Information",
          blocks: [],
          structuredContent: [],
        },
      ],
    };
    mockIsLibraryHydrated = true;
    resumePreviewPropsSpy.mockClear();
  });

  it("keeps the small live render on the selected style without layout slideshow arrows", () => {
    render(<VerbatiCvPreviewPanel />);

    expect(screen.getByText("Preview layout: workshop")).toBeInTheDocument();
    expect(screen.getByText("Preview title: Protection Guard")).toBeInTheDocument();
    expect(screen.getByText("Preview projects: 1")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Show next resume layout:/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Show previous resume layout:/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps the proposal-like appearance toolbar in workspace mode", () => {
    resumePreviewPropsSpy.mockClear();
    const { container } = render(<VerbatiCvPreviewPanel hostMode="workspace" />);

    expect(
      container.querySelector(".dasti-resume-preview-panel--workspace"),
    ).toBeTruthy();
    expect(
      container.querySelector(".dasti-resume-preview-panel--workspace"),
    ).not.toHaveClass("dasti-panel--spacious");

    expect(
      screen.queryByRole("group", { name: "Resume layout slideshow" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Resume appearance controls" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open text styles" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open layout controls" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open palette controls" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show sample resume" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Preview title: Protection Guard")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Open layout and typography controls",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open style presets" }),
    ).not.toBeInTheDocument();
  });

  it("uses direct text, layout, and color drawers in cv workspace preview mode", () => {
    resumePreviewPropsSpy.mockClear();
    render(<VerbatiCvPreviewPanel hostMode="workspace" />);

    fireEvent.click(screen.getByRole("button", { name: "Open text styles" }));

    expect(
      screen.getByRole("menuitemradio", { name: "Civic Correspondence" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Quiet Editorial" })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Open layout controls" }),
    );

    expect(screen.getByRole("menuitemradio", { name: "Workshop" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitemradio", { name: "Volk Register" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitemradio", { name: "Swiss Minima" })).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open palette controls",
      }),
    );

    expect(
      screen.getByRole("button", { name: "Use Sage" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Use Ochre" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Robial split layout with the accent rail sidebar."),
    ).not.toBeInTheDocument();
  });

  it("applies direct workspace text, layout, and color changes to the live preview state", () => {
    resumePreviewPropsSpy.mockClear();
    render(<VerbatiCvPreviewPanel hostMode="workspace" />);

    fireEvent.click(screen.getByRole("button", { name: "Open text styles" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Soft Serif" }));

    fireEvent.click(
      screen.getByRole("button", { name: "Open layout controls" }),
    );
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Workshop" }));

    fireEvent.click(
      screen.getByRole("button", { name: "Open palette controls" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Use Ink" }));

    expect(screen.getByText("Preview layout: workshop")).toBeInTheDocument();
    expect(screen.getByText("Preview typography: soft-serif")).toBeInTheDocument();
    expect(screen.getByText("Preview palette: encre")).toBeInTheDocument();

    const lastCall =
      resumePreviewPropsSpy.mock.calls[resumePreviewPropsSpy.mock.calls.length - 1]?.[0];
    expect(lastCall?.stylePreset.layout).toBe("workshop");
    expect(lastCall?.stylePreset.typography).toBe("soft-serif");
    expect(lastCall?.stylePreset.palette).toBe("encre");
  });

  it("lets the workspace toolbar switch between the active CV and the sample preview", () => {
    resumePreviewPropsSpy.mockClear();
    render(<VerbatiCvPreviewPanel hostMode="workspace" />);

    expect(screen.getByText("Preview title: Protection Guard")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Show sample resume" }),
    );

    expect(
      screen.getByRole("button", { name: "Show your resume" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Preview title: Senior Product Designer"),
    ).toBeInTheDocument();
    expect(screen.getByText("Preview projects: 2")).toBeInTheDocument();
  });

  it("does not flash the sparse render warning before an active CV is loaded", () => {
    mockCurrentCv = null as never;
    mockIsLibraryHydrated = false;
    mockHasRenderableResumeData.mockReturnValue(false);

    render(<VerbatiCvPreviewPanel hostMode="workspace" />);

    expect(
      screen.queryByText(/Resume too sparse/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Preview title: Senior Product Designer"),
    ).not.toBeInTheDocument();
  });

  it("disables preview linking when the panel is showing the sample resume", () => {
    resumePreviewPropsSpy.mockClear();
    const onLinkIntent = vi.fn();

    render(
      <VerbatiCvPreviewPanel hostMode="workspace" onLinkIntent={onLinkIntent} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Show sample resume" }),
    );

    const lastCall =
      resumePreviewPropsSpy.mock.calls[resumePreviewPropsSpy.mock.calls.length - 1]?.[0];
    expect(lastCall?.data.title).toBe("Senior Product Designer");
    expect(lastCall?.onLinkIntent).toBeUndefined();
    expect(lastCall?.activeTarget).toBeNull();
  });

  it("routes preview-side optional section deletion through the current CV section reorder flow", () => {
    render(<VerbatiCvPreviewPanel hostMode="workspace" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Additional Information" }),
    );

    expect(mockImportCv).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "cv-1",
        sections: [expect.objectContaining({ id: "projects-1" })],
      }),
    );
  });

  it("keeps showing the active CV preview when the current document becomes non-renderable", async () => {
    mockHasRenderableResumeData.mockReturnValueOnce(true).mockReturnValue(false);
    mockMapCvDocumentToResumeData.mockReturnValue({
      name: "Robert Cooper",
      title: "Draft CV",
      summary: "",
      experience: [],
      education: [],
      skills: [],
      languages: [],
      projects: [],
      achievements: [],
    });

    render(<VerbatiCvPreviewPanel hostMode="workspace" />);

    await waitFor(() => {
      expect(screen.getByText("Preview title: Draft CV")).toBeInTheDocument();
    });
    expect(screen.getByText("Preview projects: 0")).toBeInTheDocument();
  });

  it.each(["panel", "workspace"] as const)(
    "removes Projects from the active %s preview immediately after deletion",
    async (hostMode) => {
      mockImportCv.mockImplementation(async (nextDoc) => {
        mockCurrentCv = nextDoc as typeof mockCurrentCv;
        mockHasRenderableResumeData.mockReturnValue(false);
        mockMapCvDocumentToResumeData.mockReturnValue({
          name: "Robert Cooper",
          title: "Draft CV",
          summary: "",
          experience: [],
          education: [],
          skills: [],
          languages: [],
          projects: [],
          achievements: [],
        });
      });

      const { rerender } = render(<VerbatiCvPreviewPanel hostMode={hostMode} />);

      expect(screen.getByText("Preview title: Protection Guard")).toBeInTheDocument();
      expect(screen.getByText("Preview projects: 1")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Remove Projects" }));

      await waitFor(() => {
        expect(mockImportCv).toHaveBeenCalled();
      });

      rerender(<VerbatiCvPreviewPanel hostMode={hostMode} />);

      await waitFor(() => {
        expect(screen.getByText("Preview title: Draft CV")).toBeInTheDocument();
      });
      expect(screen.getByText("Preview projects: 0")).toBeInTheDocument();
      expect(
        screen.queryByText("Preview title: Senior Product Designer"),
      ).not.toBeInTheDocument();
    },
  );

  it.each(["panel", "workspace"] as const)(
    "recomputes preview data for %s mode when the active CV changes in place",
    async (hostMode) => {
      mockMapCvDocumentToResumeData.mockImplementation((doc) => {
        const typedDoc = doc as typeof mockCurrentCv;
        const projectsSection = typedDoc.sections.find(
          (section) => String(section.type) === "projects",
        );

        return {
          name: "Robert Cooper",
          title:
            Array.isArray(projectsSection?.structuredContent) &&
            projectsSection.structuredContent.length > 1
              ? "Expanded CV"
              : "Protection Guard",
          summary: "Experienced security profile.",
          experience: [],
          education: [],
          skills: [],
          languages: [],
          projects:
            Array.isArray(projectsSection?.structuredContent) &&
            projectsSection.structuredContent.length > 1
              ? [
                  { id: "project-1" },
                  { id: "project-2" },
                ]
              : [{ id: "project-1" }],
          achievements: [],
        };
      });

      const { rerender } = render(<VerbatiCvPreviewPanel hostMode={hostMode} />);

      expect(screen.getByText("Preview title: Protection Guard")).toBeInTheDocument();
      expect(screen.getByText("Preview projects: 1")).toBeInTheDocument();

      const projectsSection = mockCurrentCv.sections.find(
        (section) => String(section.type) === "projects",
      );
      expect(projectsSection).toBeTruthy();

      if (projectsSection) {
        projectsSection.structuredContent = [{ id: "project-1" }, { id: "project-2" }];
      }

      rerender(<VerbatiCvPreviewPanel hostMode={hostMode} />);

      await waitFor(() => {
        expect(screen.getByText("Preview title: Expanded CV")).toBeInTheDocument();
      });
      expect(screen.getByText("Preview projects: 2")).toBeInTheDocument();
    },
  );

  it.each(["panel", "workspace"] as const)(
    "uses the active %s preview on first render even when the CV is non-renderable",
    (hostMode) => {
      mockHasRenderableResumeData.mockReturnValue(false);
      mockMapCvDocumentToResumeData.mockReturnValue({
        name: "Robert Cooper",
        title: "Draft CV",
        summary: "",
        experience: [],
        education: [],
        skills: [],
        languages: [],
        projects: [],
        achievements: [],
      });

      render(<VerbatiCvPreviewPanel hostMode={hostMode} />);

      expect(screen.getByText("Preview title: Draft CV")).toBeInTheDocument();
      expect(screen.getByText("Preview projects: 0")).toBeInTheDocument();
      expect(
        screen.queryByText("Preview title: Senior Product Designer"),
      ).not.toBeInTheDocument();
    },
  );
});
