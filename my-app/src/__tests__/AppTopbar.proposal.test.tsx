import React from "react";
import { render, screen } from "@testing-library/react";
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
            title: "Porphyre cover letter",
            documentState: "draft",
            lengthLabel: null,
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
    expect(
      screen.getByTitle("Porphyre cover letter application package"),
    ).toHaveClass("app-topbar__doc-identity");
    expect(
      container.querySelector(".app-topbar__doc-title-main"),
    ).toHaveTextContent("Porphyre cover letter");
    expect(
      container.querySelector(".app-topbar__doc-title-suffix"),
    ).toHaveTextContent("application package");
    expect(container.querySelector(".app-topbar__actions")).toBeTruthy();
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

  it("falls back to Proposal draft when the registered title is empty", () => {
    renderProposalTopbar({ title: null });

    expect(screen.getByTitle("Proposal draft application package")).toHaveClass(
      "app-topbar__doc-identity",
    );
  });
});
