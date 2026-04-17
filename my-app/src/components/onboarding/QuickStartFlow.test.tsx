import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuickStartFlow } from "./QuickStartFlow";

const {
  importCvMock,
  createNewCvMock,
  navigateMock,
  importFileMock,
  useStructuredMistralImportMock,
  cvLibraryState,
  markQuickStartCompletedMock,
  setProposalAttachedCvIdMock,
  clearActiveLocalCvIdMock,
  startFreshProposalWorkspaceMock,
  createProposalWorkspaceResetStateMock,
} = vi.hoisted(() => ({
  importCvMock: vi.fn(),
  createNewCvMock: vi.fn(),
  navigateMock: vi.fn(),
  importFileMock: vi.fn(),
  useStructuredMistralImportMock: vi.fn(),
  cvLibraryState: {
    currentCvId: null as string | null,
  },
  markQuickStartCompletedMock: vi.fn(),
  setProposalAttachedCvIdMock: vi.fn(),
  clearActiveLocalCvIdMock: vi.fn(),
  startFreshProposalWorkspaceMock: vi.fn(),
  createProposalWorkspaceResetStateMock: vi.fn(() => ({ reset: true })),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    importCv: importCvMock,
    createNewCv: createNewCvMock,
    currentCvId: cvLibraryState.currentCvId,
  }),
}));

vi.mock("../useStructuredMistralImport", () => ({
  useStructuredMistralImport: (options?: { probeOnMount?: boolean }) =>
    useStructuredMistralImportMock(options),
  beginStructuredImportTimingTrace: (_source: string, fileName?: string | null) => ({
    id: "trace-1",
    source: "quick_start",
    fileName: fileName ?? null,
    startedAt: 0,
  }),
  logStructuredImportTiming: vi.fn(),
  TRUSTED_MISTRAL_FILE_INPUT_ACCEPT:
    ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg",
}));

vi.mock("../../lib/onboarding-state", () => ({
  markQuickStartCompleted: () => markQuickStartCompletedMock(),
}));

vi.mock("../../lib/proposal-personalization", () => ({
  clearActiveLocalCvId: () => clearActiveLocalCvIdMock(),
  setProposalAttachedCvId: (id: string) => setProposalAttachedCvIdMock(id),
}));

vi.mock("../../lib/proposal-workspace-state", () => ({
  startFreshProposalWorkspace: () => startFreshProposalWorkspaceMock(),
  createProposalWorkspaceResetState: () =>
    createProposalWorkspaceResetStateMock(),
}));

describe("QuickStartFlow", () => {
  beforeEach(() => {
    importCvMock.mockReset();
    createNewCvMock.mockReset();
    navigateMock.mockReset();
    importFileMock.mockReset();
    useStructuredMistralImportMock.mockReset();
    useStructuredMistralImportMock.mockReturnValue({
      enableMistral: true,
      importFile: importFileMock,
    });
    cvLibraryState.currentCvId = null;
    markQuickStartCompletedMock.mockReset();
    setProposalAttachedCvIdMock.mockReset();
    clearActiveLocalCvIdMock.mockReset();
    startFreshProposalWorkspaceMock.mockReset();
    createProposalWorkspaceResetStateMock.mockClear();
  });

  it("imports trusted files through the shared Mistral hook routine", async () => {
    importFileMock.mockResolvedValue({
      status: "success",
      authoritativeResume: {
        source: "mistral_v3",
        trusted: true,
        fallbackToLegacy: false,
      },
      sections: [
        {
          id: "profile-1",
          type: "profile",
          title: "Profile",
          blocks: [],
          structuredContent: [
            {
              id: "profile-item-1",
              name: "Quick Candidate",
              desiredPosition: "Designer",
            },
          ],
        },
      ],
      emptyReason: null,
    });

    const onExit = vi.fn();
    const view = render(<QuickStartFlow onExit={onExit} />);

    await userEvent.click(screen.getByRole("button", { name: /^Resume\b/i }));
    await screen.findByRole("button", { name: /^Upload PDF or image\b/i });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["pdf"], "resume.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() =>
      expect(importFileMock).toHaveBeenCalledWith(
        file,
        expect.objectContaining({
          onRetrying: expect.any(Function),
          onRetrySucceeded: expect.any(Function),
        }),
      ),
    );
    expect(useStructuredMistralImportMock).toHaveBeenCalledWith({
      probeOnMount: false,
    });
    await waitFor(() => expect(importCvMock).toHaveBeenCalledTimes(1));
    expect(importCvMock.mock.calls[0][0]).toMatchObject({
      title: "Quick Candidate — Designer",
      metadata: expect.objectContaining({
        authoritativeResume: expect.objectContaining({
          source: "mistral_v3",
          trusted: true,
        }),
      }),
    });
    cvLibraryState.currentCvId = importCvMock.mock.calls[0][0].id;
    view.rerender(<QuickStartFlow onExit={onExit} />);
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/cv", { replace: true }),
    );
  });

  it("navigates once the imported CV becomes live instead of waiting for importCv to settle", async () => {
    let resolveImportCv: (() => void) | null = null;

    importFileMock.mockResolvedValue({
      status: "success",
      authoritativeResume: null,
      sections: [
        {
          id: "profile-1",
          type: "profile",
          title: "Profile",
          blocks: [],
          structuredContent: [{ id: "profile-item-1", name: "Quick Candidate" }],
        },
      ],
      emptyReason: null,
    });
    importCvMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveImportCv = resolve;
        }),
    );

    const onExit = vi.fn();
    const view = render(<QuickStartFlow onExit={onExit} />);

    await userEvent.click(screen.getByRole("button", { name: /^Resume\b/i }));
    await screen.findByRole("button", { name: /^Upload PDF or image\b/i });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["pdf"], "resume.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(importCvMock).toHaveBeenCalledTimes(1));
    expect(navigateMock).not.toHaveBeenCalled();

    cvLibraryState.currentCvId = importCvMock.mock.calls[0][0].id;
    view.rerender(<QuickStartFlow onExit={onExit} />);

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/cv", { replace: true }),
    );

    expect(
      screen.queryByTestId("quick-start-import-status"),
    ).not.toBeInTheDocument();

    resolveImportCv?.();
  });

  it("does not complete the handoff when a different CV becomes current", async () => {
    importFileMock.mockResolvedValue({
      status: "success",
      authoritativeResume: null,
      sections: [
        {
          id: "profile-1",
          type: "profile",
          title: "Profile",
          blocks: [],
          structuredContent: [{ id: "profile-item-1", name: "Quick Candidate" }],
        },
      ],
      emptyReason: null,
    });

    const onExit = vi.fn();
    const view = render(<QuickStartFlow onExit={onExit} />);

    await userEvent.click(screen.getByRole("button", { name: /^Resume\b/i }));
    await screen.findByRole("button", { name: /^Upload PDF or image\b/i });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["pdf"], "resume.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(importCvMock).toHaveBeenCalledTimes(1));

    cvLibraryState.currentCvId = "some-other-cv";
    view.rerender(<QuickStartFlow onExit={onExit} />);
    await waitFor(() => expect(navigateMock).not.toHaveBeenCalled());

    cvLibraryState.currentCvId = importCvMock.mock.calls[0][0].id;
    view.rerender(<QuickStartFlow onExit={onExit} />);

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/cv", { replace: true }),
    );
  });

  it("shows a busy import state immediately and disables duplicate actions", async () => {
    let resolveImport:
      | ((value: {
          status: "success";
          authoritativeResume: null;
          sections: Array<{
            id: string;
            type: string;
            title: string;
            blocks: never[];
            structuredContent: Array<{ id: string; name: string }>;
          }>;
          emptyReason: null;
        }) => void)
      | null = null;

    importFileMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveImport = resolve;
        }),
    );

    render(<QuickStartFlow onExit={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /^Resume\b/i }));
    await screen.findByRole("button", { name: /^Upload PDF or image\b/i });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["pdf"], "slow-import.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(
      await screen.findByTestId("quick-start-import-status"),
    ).toHaveTextContent(/Importing resume/i);
    expect(screen.getByText("slow-import.pdf")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Reading your file\b/i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Start fresh\b/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Not now" })).toBeDisabled();

    resolveImport?.({
      status: "success",
      authoritativeResume: null,
      sections: [
        {
          id: "profile-1",
          type: "profile",
          title: "Profile",
          blocks: [],
          structuredContent: [{ id: "profile-item-1", name: "Quick Candidate" }],
        },
      ],
      emptyReason: null,
    });

    await waitFor(() => expect(importCvMock).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByTestId("quick-start-import-status"),
    ).toHaveTextContent(/Opening resume/i);
    expect(screen.getByText(/Loading the imported resume into the editor/i)).toBeInTheDocument();
  });

  it("keeps Quick Start on the resume step when trusted import rejects", async () => {
    importFileMock.mockResolvedValue({
      status: "rejected",
      message:
        "OCR import rejected (fallback/untrusted). Local fallback output is debug-only.",
    });

    render(<QuickStartFlow onExit={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /^Resume\b/i }));
    await screen.findByRole("button", { name: /^Upload PDF or image\b/i });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["scan"], "resume.png", {
      type: "image/png",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() =>
      expect(
        screen.getByText(/OCR import rejected \(fallback\/untrusted\)/i),
      ).toBeInTheDocument(),
    );
    expect(importCvMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /^Upload PDF or image\b/i }),
    ).toBeInTheDocument();
  });

  it("surfaces importCv rejection without navigating away", async () => {
    importFileMock.mockResolvedValue({
      status: "success",
      authoritativeResume: null,
      sections: [
        {
          id: "profile-1",
          type: "profile",
          title: "Profile",
          blocks: [],
          structuredContent: [{ id: "profile-item-1", name: "Quick Candidate" }],
        },
      ],
      emptyReason: null,
    });
    importCvMock.mockRejectedValue(new Error("Save failed."));

    render(<QuickStartFlow onExit={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /^Resume\b/i }));
    await screen.findByRole("button", { name: /^Upload PDF or image\b/i });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["pdf"], "resume.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText("Save failed.")).toBeInTheDocument(),
    );
    expect(navigateMock).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId("quick-start-import-status"),
    ).not.toBeInTheDocument();
  });

  it("opens a blank resume directly from the resume branch", async () => {
    render(<QuickStartFlow onExit={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /^Resume\b/i }));
    await userEvent.click(screen.getByRole("button", { name: /^Start fresh\b/i }));

    await waitFor(() => expect(createNewCvMock).toHaveBeenCalledTimes(1));
    expect(importCvMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/cv", { replace: true });
  });

  it("opens the cover letter workspace as a fresh entry", async () => {
    render(<QuickStartFlow onExit={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /^Cover letter\b/i }));

    expect(clearActiveLocalCvIdMock).toHaveBeenCalledTimes(1);
    expect(startFreshProposalWorkspaceMock).toHaveBeenCalledTimes(1);
    expect(markQuickStartCompletedMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/proposal", {
      replace: true,
      state: { reset: true },
    });
  });

  it("supports the upload-only resume mode for the cover-letter return path", async () => {
    importFileMock.mockResolvedValue({
      status: "success",
      authoritativeResume: null,
      sections: [
        {
          id: "profile-1",
          type: "profile",
          title: "Profile",
          blocks: [],
          structuredContent: [{ id: "profile-item-1", name: "Quick Candidate" }],
        },
      ],
      emptyReason: null,
    });

    const onExit = vi.fn();
    const view = render(
      <QuickStartFlow
        onExit={onExit}
        initialCreateType="resume"
        resumeMode="upload-only"
        returnTarget="proposal"
      />,
    );

    expect(
      screen.getByRole("button", { name: /^Upload PDF or image\b/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Start fresh\b/i }),
    ).not.toBeInTheDocument();

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["scan"], "resume.jpg", {
      type: "image/jpeg",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(importCvMock).toHaveBeenCalledTimes(1));
    expect(navigateMock).not.toHaveBeenCalled();
    cvLibraryState.currentCvId = "wrong-cv";
    view.rerender(
      <QuickStartFlow
        onExit={onExit}
        initialCreateType="resume"
        resumeMode="upload-only"
        returnTarget="proposal"
      />,
    );
    expect(navigateMock).not.toHaveBeenCalled();
    cvLibraryState.currentCvId = importCvMock.mock.calls[0][0].id;
    view.rerender(
      <QuickStartFlow
        onExit={onExit}
        initialCreateType="resume"
        resumeMode="upload-only"
        returnTarget="proposal"
      />,
    );
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/proposal", { replace: true }),
    );
    expect(setProposalAttachedCvIdMock).toHaveBeenCalledTimes(1);
  });

  it("ignores late shared-hook completions after Quick Start unmounts", async () => {
    let resolveImport:
      | ((value: {
          status: "success";
          authoritativeResume: null;
          sections: Array<{
            id: string;
            type: string;
            title: string;
            blocks: never[];
            structuredContent: Array<{ id: string; name: string }>;
          }>;
          emptyReason: null;
        }) => void)
      | null = null;

    importFileMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveImport = resolve;
        }),
    );

    const { unmount } = render(<QuickStartFlow onExit={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /^Resume\b/i }));
    await screen.findByRole("button", { name: /^Upload PDF or image\b/i });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["pdf"], "late-resume.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });
    await screen.findByTestId("quick-start-import-status");

    unmount();

    resolveImport?.({
      status: "success",
      authoritativeResume: null,
      sections: [
        {
          id: "profile-1",
          type: "profile",
          title: "Profile",
          blocks: [],
          structuredContent: [{ id: "profile-item-1", name: "Quick Candidate" }],
        },
      ],
      emptyReason: null,
    });

    await waitFor(() => expect(importCvMock).not.toHaveBeenCalled());
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
