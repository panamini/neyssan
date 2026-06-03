import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AppTopbar } from "../components/AppTopbar";
import {
  ProposalForgeTopbarProvider,
  type ProposalForgeTopbarDocumentState,
  type ProposalForgeTopbarRegistration,
  useProposalForgeTopbarRegistration,
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

const productCss = readFileSync(
  resolve(process.cwd(), "src/styles/product.css"),
  "utf8",
);

function RegisterProposalTopbar({
  registration,
}: {
  registration: ProposalForgeTopbarRegistration;
}): null {
  useRegisterProposalForgeTopbar(registration);
  return null;
}

function ProposalTopbarRegistrationProbe({
  onRegistration,
}: {
  onRegistration: (registration: ProposalForgeTopbarRegistration | null) => void;
}): null {
  const registration = useProposalForgeTopbarRegistration();

  React.useEffect(() => {
    onRegistration(registration);
  }, [onRegistration, registration]);

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
            onNewProposal: vi.fn(),
            onDuplicateProposal: vi.fn(),
            onDeleteProposal: vi.fn(),
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

function buildProposalTopbarRegistration(
  registration: Partial<ProposalForgeTopbarRegistration> = {},
): ProposalForgeTopbarRegistration {
  return {
    documentTitle: "Porphyre cover letter",
    titlePlaceholder: "Untitled proposal",
    onTitleCommit: vi.fn(),
    documentState: "draft",
    lengthLabel: null,
    hasProposalContent: true,
    exporting: false,
    onNewProposal: vi.fn(),
    onDuplicateProposal: vi.fn(),
    onDeleteProposal: vi.fn(),
    onCopyText: vi.fn(),
    onExportPdf: vi.fn(),
    onExportDocx: vi.fn(),
    ...registration,
  };
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
    expect(container.querySelectorAll(".app-topbar__doc-divider")).toHaveLength(1);
    expect(container.querySelectorAll(".app-topbar__toolbar-divider")).toHaveLength(2);
    expect(
      container.querySelector(".app-topbar__doc-title-suffix"),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".app-topbar__actions")).toBeTruthy();
    expect(container.querySelector(".app-topbar")).toHaveAttribute(
      "data-document-route",
      "proposal",
    );
    expect(
      container.querySelector(".app-topbar__doc-identity-group"),
    ).toHaveClass("app-topbar__doc-identity-group--proposal");
  });

  it("keeps the Proposal title slot layout-stable across compact and full title states", () => {
    expect(productCss).toContain(
      '.app-topbar[data-document-route="proposal"]',
    );
    expect(productCss).toContain(
      ".app-topbar__doc-identity-group--proposal",
    );
    expect(productCss).toContain("flex: 0 0 auto;");
    expect(productCss).toContain(
      "var(--app-topbar-doc-identity-inline-size) + (var(--control-sm) * 2)",
    );
    expect(productCss).toContain("text-overflow: ellipsis;");
    expect(productCss).toMatch(
      /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*\.app-topbar\[data-document-route="proposal"\]\s*\{[\s\S]*--app-topbar-doc-identity-inline-size:\s*var\([\s\S]*--app-topbar-doc-identity-inline-size-compact[\s\S]*\.app-topbar\[data-document-route="proposal"\]\s+\.app-topbar__doc-title\s*\{[\s\S]*position:\s*static;[\s\S]*opacity:\s*1;/,
    );
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

  it("does not clear the Proposal topbar registration during registration updates", async () => {
    const observed: Array<string | null> = [];
    const onRegistration = vi.fn(
      (registration: ProposalForgeTopbarRegistration | null) => {
        observed.push(registration?.documentTitle ?? null);
      },
    );
    const { rerender } = render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForgeTopbarProvider>
          <RegisterProposalTopbar
            registration={buildProposalTopbarRegistration({
              documentTitle: "Initial proposal",
            })}
          />
          <ProposalTopbarRegistrationProbe onRegistration={onRegistration} />
        </ProposalForgeTopbarProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(observed).toContain("Initial proposal");
    });
    observed.length = 0;

    rerender(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForgeTopbarProvider>
          <RegisterProposalTopbar
            registration={buildProposalTopbarRegistration({
              documentTitle: "Updated proposal",
            })}
          />
          <ProposalTopbarRegistrationProbe onRegistration={onRegistration} />
        </ProposalForgeTopbarProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(observed).toContain("Updated proposal");
    });
    expect(observed).not.toContain(null);
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
    ["draft" as const, "Autosaved"],
    ["saving" as const, "Saving…"],
    ["saved" as const, "Saved"],
    ["generating" as const, "Saved"],
    ["exporting" as const, "Saved"],
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

  it("separates Proposal create from secondary document actions", async () => {
    const onNewProposal = vi.fn();
    const onDuplicateProposal = vi.fn();
    const onDeleteProposal = vi.fn();
    renderProposalTopbar({
      onNewProposal,
      onDuplicateProposal,
      onDeleteProposal,
    });

    fireEvent.click(screen.getByRole("button", { name: "New proposal" }));
    expect(onNewProposal).toHaveBeenCalledTimes(1);
    const newProposalButton = screen.getByRole("button", { name: "New proposal" });
    expect(newProposalButton).toHaveTextContent("New");
    expect(newProposalButton).toHaveAttribute("data-has-content", "true");

    fireEvent.click(screen.getByRole("button", { name: "Proposal actions" }));
    const menu = await screen.findByRole("menu", { name: "Proposal actions" });
    expect(
      within(menu).queryByRole("menuitem", { name: "New proposal" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(menu).getByRole("menuitem", {
        name: "Duplicate proposal",
      }),
    );
    expect(onDuplicateProposal).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Proposal actions" }));
    const deleteMenu = await screen.findByRole("menu", {
      name: "Proposal actions",
    });
    fireEvent.click(
      within(deleteMenu).getByRole("menuitem", { name: "Delete proposal" }),
    );
    expect(onDeleteProposal).toHaveBeenCalledTimes(1);
  });

  it("marks Proposal create as neutral once job context is loaded", () => {
    renderProposalTopbar({
      hasProposalContent: false,
      hasJobContext: true,
    });

    const newProposalButton = screen.getByRole("button", { name: "New proposal" });
    expect(newProposalButton).not.toHaveAttribute("data-has-content");
    expect(newProposalButton).toHaveAttribute("data-has-job-context", "true");
  });

  it("keeps Proposal create neutral even for a blank proposal", () => {
    renderProposalTopbar({
      hasProposalContent: false,
      hasJobContext: false,
    });

    const newProposalButton = screen.getByRole("button", { name: "New proposal" });
    expect(newProposalButton).not.toHaveAttribute("data-has-content");
    expect(newProposalButton).not.toHaveAttribute("data-has-job-context");
    expect(newProposalButton).toHaveClass("app-topbar__doc-action--proposal-new");
  });

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

  it("lets the user choose proposal page size from the share menu", async () => {
    const onPageSizePreferenceChange = vi.fn();
    renderProposalTopbar({
      pageSizePreference: "auto",
      onPageSizePreferenceChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "Share proposal" }));
    const menu = await screen.findByRole("menu", { name: "Share proposal" });

    expect(within(menu).getByText("Page size")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemradio", { name: /Auto/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    fireEvent.click(within(menu).getByRole("menuitemradio", { name: /US Letter/i }));

    expect(onPageSizePreferenceChange).toHaveBeenCalledWith("letter");
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
      within(menu).getByRole("menuitem", { name: "Share link" }),
    );

    expect(onShareSavedProposal).toHaveBeenCalledTimes(1);
  });
});
