import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AppTopbar } from "../components/AppTopbar";
import {
  ProposalForgeTopbarProvider,
  type ProposalForgeTopbarDocumentState,
  type ProposalForgeTopbarRegistration,
  useRegisterProposalForgeTopbar,
} from "../contexts/ProposalForgeTopbarContext";

vi.mock("convex/react", () => ({
  useConvexAuth: vi.fn(() => ({ isAuthenticated: false, isLoading: false })),
  useQuery: vi.fn(() => undefined),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: vi.fn(() => ({ isLoaded: true, isSignedIn: false })),
  useUser: vi.fn(() => ({ user: null })),
  UserButton: () => null,
}));

vi.mock("../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: null,
    currentCvId: null,
    cvs: [],
  }),
}));

function RegisterProposalTopbar({
  registration,
}: {
  registration: ProposalForgeTopbarRegistration;
}): null {
  useRegisterProposalForgeTopbar(registration);
  return null;
}

function renderProposalTopbar(
  registration: Partial<ProposalForgeTopbarRegistration> = {},
) {
  return render(
    <MemoryRouter initialEntries={["/proposal"]}>
      <ProposalForgeTopbarProvider>
        <RegisterProposalTopbar
          registration={{
            documentTitle: "Porphyre cover letter",
            titlePlaceholder: "Untitled proposal",
            onTitleCommit: vi.fn(),
            documentState: "draft",
            lengthLabel: null,
            hasProposalContent: true,
            exporting: false,
            onCopyText: vi.fn(),
            onExportPdf: vi.fn(),
            onExportDocx: vi.fn(),
            ...registration,
          }}
        />
        <AppTopbar
          commandPaletteOpen={false}
          onOpenCommandPalette={vi.fn()}
        />
      </ProposalForgeTopbarProvider>
    </MemoryRouter>,
  );
}

describe("AppTopbar Proposal document identity", () => {
  it("uses the shared document identity grammar instead of legacy forge chrome", () => {
    const { container } = renderProposalTopbar({
      lengthLabel: "Standard",
    });

    expect(screen.queryByText("Working on:")).not.toBeInTheDocument();
    expect(screen.queryByText("Ready")).not.toBeInTheDocument();
    expect(screen.queryByText("Needs review")).not.toBeInTheDocument();
    expect(container.querySelector(".app-topbar__doc-identity")).toHaveAttribute(
      "title",
      "Porphyre cover letter",
    );
    expect(
      container.querySelector(".document-title-editor__text"),
    ).toHaveTextContent("Porphyre cover letter");
    expect(
      container.querySelector(".app-topbar__doc-title-suffix"),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".app-topbar__actions")).toBeTruthy();
  });

  it("commits proposal title edits from the topbar", () => {
    const onTitleCommit = vi.fn();
    renderProposalTopbar({ onTitleCommit });

    fireEvent.click(screen.getByRole("button", { name: "Edit Proposal title" }));
    const input = screen.getByRole("textbox", { name: "Proposal title" });
    fireEvent.change(input, { target: { value: " Renamed proposal " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onTitleCommit).toHaveBeenCalledWith("Renamed proposal");
  });

  it.each([
    ["Concise" as const],
    ["Standard" as const],
    ["Detailed" as const],
  ])("renders %s as document metadata", (lengthLabel) => {
    const { container } = renderProposalTopbar({ lengthLabel });

    const meta = container.querySelector(".app-topbar__doc-meta");
    expect(meta).toHaveTextContent(lengthLabel);
    expect(meta).not.toHaveClass("app-topbar__doc-health");
  });

  it.each([
    ["draft" as const, "Draft"],
    ["saving" as const, "Saving"],
    ["saved" as const, "Saved"],
    ["generating" as const, "Generating"],
    ["exporting" as const, "Exporting"],
    ["error" as const, "Save error"],
  ])(
    "exposes %s as %s on the document state dot",
    (documentState: ProposalForgeTopbarDocumentState, label: string) => {
      renderProposalTopbar({ documentState });

      expect(screen.getByLabelText(label)).toHaveClass(
        "app-topbar__doc-state",
      );
    },
  );

  it("falls back to the registered placeholder when the document title is empty", () => {
    renderProposalTopbar({ documentTitle: null });

    expect(
      screen.getByLabelText("Untitled proposal"),
    ).toHaveClass(
      "app-topbar__doc-identity",
    );
  });

  it("renders Proposal share actions in the global topbar", async () => {
    const onCopyText = vi.fn();
    const onExportPdf = vi.fn();
    const onExportDocx = vi.fn();
    renderProposalTopbar({ onCopyText, onExportPdf, onExportDocx });

    fireEvent.click(screen.getByRole("button", { name: "Share proposal" }));
    const menu = await screen.findByRole("menu", { name: "Share proposal" });

    fireEvent.click(within(menu).getByRole("menuitem", { name: "Copy text" }));
    expect(onCopyText).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Share proposal" }));
    const pdfMenu = await screen.findByRole("menu", { name: "Share proposal" });
    fireEvent.click(within(pdfMenu).getByRole("menuitem", { name: "Download PDF" }));
    expect(onExportPdf).toHaveBeenCalledWith("styled");

    fireEvent.click(screen.getByRole("button", { name: "Share proposal" }));
    const docxMenu = await screen.findByRole("menu", { name: "Share proposal" });
    fireEvent.click(within(docxMenu).getByRole("menuitem", { name: "Download DOCX" }));
    expect(onExportDocx).toHaveBeenCalledTimes(1);
  });

  it("includes saved proposal sharing only when registered", async () => {
    const onShareSavedProposal = vi.fn();
    renderProposalTopbar({
      savedShareAvailable: true,
      onShareSavedProposal,
    });

    fireEvent.click(screen.getByRole("button", { name: "Share proposal" }));
    const menu = await screen.findByRole("menu", { name: "Share proposal" });
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: "Share saved proposal" }),
    );

    expect(onShareSavedProposal).toHaveBeenCalledTimes(1);
  });
});
