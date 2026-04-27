import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";
import { writeStoredProposalOutputDraft } from "../../lib/proposal-output-draft";
import { PROPOSAL_EXTENSION_INSTALL_LINK } from "../../lib/proposal-source-platforms";

const mockLoadCv = vi.fn();
const mockImportCv = vi.fn();
const mockImportFile = vi.fn();
const mockUpdateProposal = vi.fn().mockResolvedValue(undefined);

let mockActiveCvId: string | null = null;
let mockCurrentCvId: string | null = null;
let mockHasLocalResumes = true;
const mockCvSnapshots: Record<string, string> = {
  cv_alpha: "Operations Associate — Alex Martin",
};
const mockAttachedCv = {
  id: "cv_alpha",
  title: "Alex Martin Resume",
  metadata: {
    updatedAt: "2026-03-31T00:00:00.000Z",
  },
  sections: [
    {
      id: "profile",
      type: "profile",
      title: "Profile",
      blocks: [],
      structuredContent: [
        {
          id: "profile_1",
          name: "Alex Martin",
          desiredPosition: "Operations Associate",
        },
      ],
    },
  ],
} as any;

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: () => null,
  useMutation: (reference: string) => {
    if (reference === "updateProposalPublic.default") {
      return mockUpdateProposal;
    }
    return vi.fn().mockResolvedValue(undefined);
  },
  useAction: () => vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    functions: {
      generateProposal: "functions.generateProposal",
    },
    proposalHandoffs: { get: "proposalHandoffs.get" },
    proposalSettings: { getCurrent: "proposalSettings.getCurrent" },
    proposalsPublic: { default: "proposalsPublic.default" },
    updateProposalPublic: { default: "updateProposalPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
  },
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("../../lib/proposal-personalization", () => ({
  buildAppProposalPersonalizationPayload: () => ({}),
  clearProposalAttachedCvId: () => {
    mockActiveCvId = null;
  },
  clearActiveLocalCvId: () => {
    mockActiveCvId = null;
  },
  getProposalApplicantIdentity: () => ({
    name: "Alex Martin",
    role: "Operations Associate",
  }),
  getProposalAttachedCvId: () => mockActiveCvId,
  getLocalActiveCvSnapshotById: (id: string) =>
    mockCvSnapshots[id] ? { title: mockCvSnapshots[id] } : null,
  getLocalCvDocumentById: (id: string | null) =>
    id && mockCvSnapshots[id]
      ? { ...mockAttachedCv, id, title: mockCvSnapshots[id] }
      : null,
  getProposalAttachedCvLocalDocument: () =>
    mockActiveCvId === "cv_alpha" ? mockAttachedCv : null,
  getActiveLocalPersonalizationSource: () => ({
    title:
      mockActiveCvId === "cv_alpha"
        ? "Operations Associate — Alex Martin"
        : null,
    personalizationContext:
      mockActiveCvId === "cv_alpha"
        ? {
            name: "Alex Martin",
            desiredPosition: "Operations Associate",
          }
        : null,
  }),
  getLocalPersonalizationSourceByCvId: (id: string | null) => ({
    title: id === "cv_alpha" ? "Operations Associate — Alex Martin" : null,
    personalizationContext:
      id === "cv_alpha"
        ? {
            name: "Alex Martin",
            desiredPosition: "Operations Associate",
          }
        : null,
  }),
  getProposalApplicantHeaderData: () => ({
    name: "Alex Martin",
    role: "Operations Associate",
    email: "alex@example.com",
    phone: null,
    location: null,
    website: null,
    linkedIn: null,
  }),
  listLocalCvPickerOptions: () =>
    mockHasLocalResumes || mockActiveCvId === "cv_alpha"
      ? [
          {
            id: "cv_alpha",
            title: "Operations Associate — Alex Martin",
            isActive: true,
          },
        ]
      : [],
  PROPOSAL_ATTACHED_CV_UPDATED_EVENT: "dasti:proposal-attached-cv-updated",
  setProposalAttachedCvId: (id: string | null) => {
    mockActiveCvId = id;
    if (id && !mockCvSnapshots[id]) {
      mockCvSnapshots[id] = "Imported CV";
    }
  },
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: null,
    currentCvId: mockCurrentCvId,
    loadCv: mockLoadCv,
    importCv: mockImportCv,
  }),
}));

vi.mock("../../components/useStructuredMistralImport", () => ({
  useStructuredMistralImport: () => ({
    enableMistral: true,
    importFile: mockImportFile,
  }),
  beginStructuredImportTimingTrace: (
    _source: string,
    fileName?: string | null,
  ) => ({
    id: "trace-1",
    source: "proposal_inline",
    fileName: fileName ?? null,
    startedAt: 0,
  }),
  logStructuredImportTiming: vi.fn(),
  TRUSTED_MISTRAL_FILE_INPUT_ACCEPT:
    ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg",
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: ({
    onActiveCvChange,
    cvPickerOpen,
  }: {
    onActiveCvChange?: (cvId: string | null) => void;
    cvPickerOpen?: boolean;
  }) => (
    <div>
      <div>{cvPickerOpen ? "CV picker open" : "CV picker closed"}</div>
      <input
        id="jobTitle"
        name="jobTitle"
        defaultValue="Operations Associate"
      />
      <textarea
        id="jobDescription"
        name="jobDescription"
        defaultValue="Support recurring processes and coordinate communication."
      />
      <button
        type="button"
        onClick={() => {
          mockActiveCvId = "cv_alpha";
          onActiveCvChange?.("cv_alpha");
        }}
      >
        Attach CV from form
      </button>
      <button
        type="button"
        onClick={() => {
          mockActiveCvId = null;
          onActiveCvChange?.(null);
        }}
      >
        Remove CV from form
      </button>
    </div>
  ),
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: ({
    railStartAddon,
    railEndAddon,
    actions,
  }: {
    railStartAddon?: React.ReactNode;
    railEndAddon?: React.ReactNode;
    actions?: React.ReactNode;
  }) => (
    <div>
      <div>Proposal output</div>
      {railStartAddon}
      {railEndAddon}
      {actions}
    </div>
  ),
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/EmbeddedStyleInspector", () => ({
  default: ({
    onSelectPalette,
  }: {
    onSelectPalette?: (palette: "bordeaux") => void;
  }) => (
    <button type="button" onClick={() => onSelectPalette?.("bordeaux")}>
      Direct style edit
    </button>
  ),
}));

vi.mock("../../components/ProposalComposeToolbar", () => ({
  ProposalComposeToolbar: ({
    onClearCv,
    cvTitle,
    styleStatusLabel,
  }: {
    onClearCv?: () => void;
    cvTitle?: string | null;
    styleStatusLabel?: string | null;
  }) => (
    <div>
      <button type="button" aria-label={cvTitle ? `CV: ${cvTitle}` : "Pick CV"}>
        {cvTitle ?? "Pick CV"}
      </button>
      <div data-testid="proposal-style-status">
        {styleStatusLabel ?? "Default"}
      </div>
      <button type="button" onClick={() => onClearCv?.()}>
        Remove CV from toolbar
      </button>
    </div>
  ),
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return (
    <div data-testid="location">{`${location.pathname}${location.search}`}</div>
  );
}

function buildCoverLetterStartEntry(options?: {
  jobImportFocus?: "supported-sites";
  resetToken?: string;
}) {
  return {
    pathname: "/proposal",
    state: {
      proposalEntryIntent: "cover-letter-start",
      ...(options?.resetToken
        ? { proposalWorkspaceResetToken: options.resetToken }
        : {}),
      ...(options?.jobImportFocus
        ? { jobImportFocus: options.jobImportFocus }
        : {}),
    },
  };
}

describe("ProposalForge attached CV sync", () => {
  beforeEach(() => {
    mockActiveCvId = null;
    mockCurrentCvId = null;
    mockHasLocalResumes = true;
    mockLoadCv.mockReset();
    mockImportCv.mockReset();
    mockImportFile.mockReset();
    mockUpdateProposal.mockClear();
    window.localStorage.clear();
    Object.keys(mockCvSnapshots).forEach((key) => {
      if (key !== "cv_alpha") {
        delete mockCvSnapshots[key];
      }
    });
    mockCvSnapshots.cv_alpha = "Operations Associate — Alex Martin";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the cover-letter start surface on a blank compose entry", () => {
    const { container } = render(
      <MemoryRouter initialEntries={[buildCoverLetterStartEntry()]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(
      screen.getByTestId("cover-letter-start-surface"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("cover-letter-start-surface")).toHaveClass(
      "dasti-quick-start-pane",
    );
    const pageShell = container.querySelector(
      ".dasti-page-shell",
    ) as HTMLElement;
    expect(pageShell?.style.getPropertyValue("--page-shell-pad-top")).toBe(
      "0px",
    );
    expect(
      pageShell?.style.getPropertyValue("--page-shell-pad-top-mobile"),
    ).toBe("0px");
    expect(
      pageShell?.style.getPropertyValue("--page-shell-pad-bottom-mobile"),
    ).toBe("0px");
    expect(pageShell?.style.getPropertyValue("--page-shell-pad-inline")).toBe(
      "0px",
    );
    expect(
      pageShell?.style.getPropertyValue("--page-shell-pad-inline-mobile"),
    ).toBe("0px");
    expect(
      screen.getByRole("heading", { name: "Start your cover letter." }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Close")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Bring in the job\b/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Bring in your resume\b/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Capture the role\b/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Paste job offer\b/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Pick a resume\b/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Import a resume\b/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Proposal output")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pick CV" }),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".dasti-proposal-output-shell")).toBeNull();
    expect(
      container.querySelector(".dasti-workbench-top-left-slot--proposal"),
    ).toBeNull();
    expect(container.querySelector(".dasti-grid-split")).toBeNull();
  });

  it("opens the supported-sites helper when job import focus is requested", () => {
    render(
      <MemoryRouter
        initialEntries={[
          buildCoverLetterStartEntry({
            jobImportFocus: "supported-sites",
            resetToken: "jobs-empty-state-import",
          }),
        ]}
      >
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(
      screen.getByTestId("cover-letter-start-surface"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Bring in the job." }),
    ).toBeInTheDocument();
    const captureRole = screen.getByRole("button", {
      name: /^Capture the role\b/i,
    });
    expect(captureRole).toHaveAttribute("aria-pressed", "true");
    const captureRoleDialog = screen.getByRole("dialog", {
      name: "Capture the role",
    });
    expect(
      within(captureRoleDialog).getByRole("link", {
        name: /Install extension/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Install extension/i }),
    ).toHaveAttribute("href", PROPOSAL_EXTENSION_INSTALL_LINK.href);
    expect(screen.getByRole("link", { name: /LinkedIn/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Paste job offer\b/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Bring in the job\b/i }),
    ).not.toBeInTheDocument();
  });

  it("shows one decision level at a time and navigates between parent and child states", () => {
    render(
      <MemoryRouter initialEntries={[buildCoverLetterStartEntry()]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    const backSlot = screen.getByTestId("cover-letter-start-header-back-slot");

    expect(backSlot).toHaveAttribute("data-has-action", "true");
    expect(screen.getByLabelText("Back")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /^Bring in the job\b/i }),
    );

    expect(
      screen.getByRole("heading", { name: "Bring in the job." }),
    ).toBeInTheDocument();
    expect(backSlot).toHaveAttribute("data-has-action", "true");
    expect(screen.getByLabelText("Back")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Capture the role\b/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Paste job offer\b/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Pick a resume\b/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Import a resume\b/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Back"));

    expect(
      screen.getByRole("heading", { name: "Start your cover letter." }),
    ).toBeInTheDocument();
    expect(backSlot).toHaveAttribute("data-has-action", "true");

    fireEvent.click(
      screen.getByRole("button", { name: /^Bring in your resume\b/i }),
    );

    expect(
      screen.getByRole("heading", { name: "Bring in your resume." }),
    ).toBeInTheDocument();
    expect(backSlot).toHaveAttribute("data-has-action", "true");
    expect(
      screen.getByRole("button", { name: /^Pick a resume\b/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Import a resume\b/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Capture the role\b/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Paste job offer\b/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the resume-picker shortcut when no resumes exist yet", () => {
    mockHasLocalResumes = false;

    render(
      <MemoryRouter initialEntries={[buildCoverLetterStartEntry()]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /^Bring in your resume\b/i }),
    );

    expect(
      screen.getByTestId("cover-letter-start-surface"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Pick a resume\b/i }),
    ).not.toBeInTheDocument();
  });

  it("opens the existing CV picker when the start surface uses a resume", async () => {
    render(
      <MemoryRouter initialEntries={[buildCoverLetterStartEntry()]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /^Bring in your resume\b/i }),
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /^Pick a resume\b/i }),
      );
    });

    expect(
      screen.queryByTestId("cover-letter-start-surface"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("CV picker open")).toBeInTheDocument();
  });

  it("opens the inline file picker directly from the start surface without navigating to Quick Start", async () => {
    const fileInputClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    render(
      <MemoryRouter initialEntries={[buildCoverLetterStartEntry()]}>
        <ProposalForge />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /^Bring in your resume\b/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^Import a resume\b/i }),
    );

    expect(fileInputClickSpy).toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/proposal");

    fileInputClickSpy.mockRestore();
  });

  it("reveals actionable extension links from the verified supported list", async () => {
    render(
      <MemoryRouter initialEntries={[buildCoverLetterStartEntry()]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /^Bring in the job\b/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^Capture the role\b/i }),
    );

    expect(screen.getByRole("link", { name: /LinkedIn/i })).toHaveAttribute(
      "href",
      "https://www.linkedin.com/jobs/",
    );
    expect(screen.getByRole("link", { name: /Indeed/i })).toHaveAttribute(
      "href",
      "https://www.indeed.com/jobs",
    );
    expect(screen.getByRole("link", { name: /Upwork/i })).toHaveAttribute(
      "href",
      "https://www.upwork.com/nx/jobs/search/",
    );
    expect(
      screen.queryByRole("link", { name: /Fiverr/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("More supported sites"));

    expect(screen.getByRole("link", { name: /ZipRecruiter/i })).toHaveAttribute(
      "href",
      "https://www.ziprecruiter.com",
    );
    expect(screen.getByRole("link", { name: /HelloWork/i })).toHaveAttribute(
      "href",
      "https://www.hellowork.com/fr-fr/",
    );
    expect(
      screen.getByRole("link", { name: /Install extension/i }),
    ).toHaveAttribute("href", PROPOSAL_EXTENSION_INSTALL_LINK.href);
  });

  it("toggles the extension helper open and closed on repeated clicks", async () => {
    render(
      <MemoryRouter initialEntries={[buildCoverLetterStartEntry()]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /^Bring in the job\b/i }),
    );
    const toggle = screen.getByRole("button", {
      name: /^Capture the role\b/i,
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("link", { name: /Install extension/i }),
    ).toBeInTheDocument();
    expect(toggle.closest(".dasti-quick-start-choice")?.querySelector("a")).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("link", { name: /Install extension/i }),
    ).not.toBeInTheDocument();
  });

  it("closes the start sheet back to the normal proposal workspace", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={[buildCoverLetterStartEntry()]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText("Close"));

    await waitFor(() => {
      expect(
        screen.queryByTestId("cover-letter-start-surface"),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText("CV picker closed")).toBeInTheDocument();
    expect(screen.getByText("Proposal output")).toBeInTheDocument();
    expect(
      container.querySelector(".dasti-proposal-output-shell"),
    ).not.toBeNull();
  });

  it("opens the editor and focuses the job-description field when pasting a job offer", async () => {
    render(
      <MemoryRouter initialEntries={[buildCoverLetterStartEntry()]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /^Bring in the job\b/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^Paste job offer\b/i }),
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId("cover-letter-start-surface"),
      ).not.toBeInTheDocument();
      expect(document.getElementById("jobDescription")).toHaveFocus();
    });
  });

  it("imports a resume inline, attaches it to the proposal, and keeps the compose editor visible", async () => {
    mockImportFile.mockResolvedValue({
      status: "success",
      authoritativeResume: null,
      sections: [
        {
          id: "profile-1",
          type: "profile",
          title: "Profile",
          blocks: [],
          structuredContent: [{ id: "profile-item-1", name: "Taylor Case" }],
        },
      ],
      emptyReason: null,
    });
    mockImportCv.mockImplementation(
      async (nextCv: { id: string; title: string }) => {
        mockCvSnapshots[nextCv.id] = nextCv.title;
      },
    );

    const view = render(
      <MemoryRouter initialEntries={[buildCoverLetterStartEntry()]}>
        <ProposalForge />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /^Bring in your resume\b/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^Import a resume\b/i }),
    );

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["pdf"], "inline-import.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(mockImportCv).toHaveBeenCalledTimes(1));

    mockCurrentCvId = mockImportCv.mock.calls[0][0].id;
    view.rerender(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId("cover-letter-start-surface"),
      ).not.toBeInTheDocument();
      expect(document.getElementById("jobDescription")).toHaveFocus();
    });
    expect(
      screen.getByRole("button", { name: /^CV: Taylor Case\b/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/proposal");
  });

  it("keeps the cold-start surface visible and shows inline status when the inline import is rejected", async () => {
    mockImportFile.mockResolvedValue({
      status: "rejected",
      message:
        "OCR import rejected (fallback/untrusted). Local fallback output is debug-only.",
    });

    render(
      <MemoryRouter initialEntries={[buildCoverLetterStartEntry()]}>
        <ProposalForge />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /^Bring in your resume\b/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^Import a resume\b/i }),
    );

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["scan"], "inline-import.png", {
      type: "image/png",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(/OCR import rejected \(fallback\/untrusted\)/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId("cover-letter-start-surface"),
    ).toBeInTheDocument();
    expect(mockImportCv).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/proposal");
  });

  it("keeps the proposal-level CV source control in sync with attach and remove actions", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Pick CV" })).toBeInTheDocument();
    expect(screen.getByTestId("proposal-style-status")).toHaveTextContent(
      "Default",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Attach CV from form" }),
    );

    expect(
      screen.getByRole("button", {
        name: /CV: Operations Associate — Alex Martin/i,
      }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("proposal-style-status")).toHaveTextContent(
        "CV",
      );
    });
    expect(mockLoadCv).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove CV from form" }),
    );

    expect(screen.getByRole("button", { name: "Pick CV" })).toBeInTheDocument();
    expect(screen.getByTestId("proposal-style-status")).toHaveTextContent(
      "Default",
    );
  });

  it("clears the attached CV when the workspace toolbar remove action is used", () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Attach CV from form" }),
    );

    expect(
      screen.getByText("Operations Associate — Alex Martin"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove CV from toolbar" }),
    );

    expect(screen.getByRole("button", { name: "Pick CV" })).toBeInTheDocument();
  });

  it("detaches the runtime proposal style after the first direct style edit", async () => {
    writeStoredProposalOutputDraft({
      proposalContent:
        "Dear Hiring Manager,\n\nGenerated proposal body.\n\nKind regards,\nAlex Martin",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "inherit_cv",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalContactLine: "alex@example.com",
      proposalLetterDate: "Paris, April 16, 2026",
      proposalRecipientDetails: "Hiring Manager\nStudio North",
      proposalDocumentTitle: "Generated proposal",
      proposalDocumentMeta: "Compose output",
      generatedProposalId: "proposal_live",
      proposalOutputMode: "preview",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      characterLimitMode: "none",
      characterLimitValue: null,
    });

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Attach CV from form" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("proposal-style-status")).toHaveTextContent(
        "CV",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Direct style edit" }));

    expect(screen.getByTestId("proposal-style-status")).toHaveTextContent(
      "Custom",
    );
  });

  it("keeps detached proposal styling and does not expose reset in forge", async () => {
    writeStoredProposalOutputDraft({
      proposalContent:
        "Dear Hiring Manager,\n\nGenerated proposal body.\n\nKind regards,\nAlex Martin",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: null,
      proposalVerbatiStyle: {
        layout: "swiss",
        typography: "signature",
        palette: "pierre",
      },
      proposalStyleLinkMode: "proposal_local",
      proposalStyleChoice: "auto",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalContactLine: "alex@example.com",
      proposalLetterDate: "Paris, April 16, 2026",
      proposalRecipientDetails: "Hiring Manager\nStudio North",
      proposalDocumentTitle: "Generated proposal",
      proposalDocumentMeta: "Compose output",
      generatedProposalId: "proposal_live",
      proposalOutputMode: "edit",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      characterLimitMode: "none",
      characterLimitValue: null,
    });

    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Attach CV from form" }),
    );
    await waitFor(() => {
      expect(screen.getByTestId("proposal-style-status")).toHaveTextContent(
        "Custom",
      );
    });

    expect(
      screen.queryByRole("button", { name: "Reset to CV style" }),
    ).not.toBeInTheDocument();
    expect(mockUpdateProposal).not.toHaveBeenCalledWith(
      expect.objectContaining({
        id: "proposal_live",
        metadata: expect.objectContaining({
          sourceCvId: "cv_alpha",
          styleLinkMode: "inherit_cv",
        }),
      }),
    );
  });
});
