import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import ProposalDisplay from "../ProposalDisplay";

describe("ProposalDisplay", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    class ResizeObserverMock {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("renders a copy button when proposal text is present", () => {
    const handleCopy = vi.fn();

    render(
      <ProposalDisplay
        proposalContent={
          "Hello hiring team,\n\nI would love to discuss the role."
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        onCopy={handleCopy}
      />,
    );

    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("hides the copy button when there is no generated proposal", () => {
    render(
      <ProposalDisplay
        proposalContent={null}
        loading={false}
        error={null}
        proposalType="cover_letter"
        onCopy={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Copy" }),
    ).not.toBeInTheDocument();
  });

  it("renders a neutral status message when generation is stopped", () => {
    render(
      <ProposalDisplay
        proposalContent={null}
        loading={false}
        error={null}
        statusMessage="Generation stopped."
      />,
    );

    expect(screen.getByText("Generation stopped.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("invokes the provided copy handler", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <ProposalDisplay
        proposalContent={
          "Hello hiring team,\n\nI would love to discuss the role."
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        onCopy={async () => {
          await navigator.clipboard.writeText(
            "Hello hiring team,\n\nI would love to discuss the role.",
          );
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "Hello hiring team,\n\nI would love to discuss the role.",
      );
    });
  });

  it("renders the selected proposal template markup for preview mode", () => {
    render(
      <ProposalDisplay
        proposalContent={
          "Dear Hiring Manager,\n\nI built reliable editorial tooling across product and content workflows.\n\nSincerely,\nAlex Martin"
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        templateId="quire_margin"
      />,
    );

    expect(
      document.querySelector('[data-proposal-template="quire_margin"]'),
    ).toBeTruthy();
    expect(screen.getAllByText("alex martin").length).toBeGreaterThan(0);
  });

  it("applies the linked verbati style theme to the proposal document without recoloring the shell", () => {
    render(
      <ProposalDisplay
        proposalContent={
          "Dear team,\n\nA calm editorial proposal body.\n\nSincerely,\nAlex Martin"
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        templateId="editorial_wide"
        stylePreset={{
          layout: "editorial",
          typography: "expert",
          palette: "encre",
        }}
      />,
    );

    const frame = document.querySelector(".dasti-proposal-sheet-frame");
    expect(frame).toBeTruthy();
    expect(
      (frame as HTMLElement).style.getPropertyValue("--font-heading-family"),
    ).toContain("Archivo");
    expect(
      (frame as HTMLElement).style.getPropertyValue(
        "--proposal-document-paper",
      ),
    ).not.toBe("");
    expect(
      (frame as HTMLElement).style.getPropertyValue("--color-canvas"),
    ).toBe("");
  });

  it("keeps the themed frame during loading state", () => {
    render(
      <ProposalDisplay
        proposalContent={null}
        loading
        error={null}
        stylePreset={{
          layout: "editorial",
          typography: "expert",
          palette: "encre",
        }}
      />,
    );

    const frame = document.querySelector(".dasti-proposal-sheet-frame");
    const sheet = document.querySelector(".dasti-proposal-sheet");

    expect(frame).toBeTruthy();
    expect(sheet).toHaveAttribute("aria-busy", "true");
    expect(
      (frame as HTMLElement).style.getPropertyValue("--font-heading-family"),
    ).toContain("Archivo");
    expect(
      (frame as HTMLElement).style.getPropertyValue("--color-canvas"),
    ).toBe("");
  });

  it("keeps the themed frame for the empty proposal state", () => {
    render(
      <ProposalDisplay
        proposalContent={null}
        loading={false}
        error={null}
        stylePreset={{
          layout: "quire",
          typography: "engaging",
          palette: "bordeaux",
        }}
      />,
    );

    const frame = document.querySelector(".dasti-proposal-sheet-frame");

    expect(frame).toBeTruthy();
    expect(screen.getByText("No draft yet. Generate one.")).toBeInTheDocument();
    expect(
      (frame as HTMLElement).style.getPropertyValue("--font-body-family"),
    ).toContain("Geist");
    expect(
      (frame as HTMLElement).style.getPropertyValue("--color-canvas"),
    ).toBe("");
  });

  it("renders document previews inside a fixed page stage when zoom controls are enabled", () => {
    render(
      <ProposalDisplay
        proposalContent={
          "Dear Hiring Manager,\n\nI built reliable editorial tooling across product and content workflows.\n\nSincerely,\nAlex Martin"
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        showZoomControls
        onModeChange={vi.fn()}
      />,
    );

    expect(
      document.querySelector(".dasti-proposal-sheet__preview-stage"),
    ).toBeTruthy();
    expect(
      document.querySelector(".dasti-proposal-sheet__preview-page"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open zoom controls" }));
    expect(
      screen.getByRole("button", { name: "Fit page" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Zoom out" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(
      document.querySelector(
        ".dasti-proposal-rail-cluster .dasti-doc-zoom-menu",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fit page" })).toHaveClass(
      "dasti-doc-zoom-fit--active",
    );
  });

  it("keeps the uncontrolled zoom state after zooming in", async () => {
    render(
      <ProposalDisplay
        proposalContent={
          "Dear Hiring Manager,\n\nI built reliable editorial tooling across product and content workflows.\n\nSincerely,\nAlex Martin"
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        showZoomControls
        zoomStorageKey={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open zoom controls" }));

    const fitButton = screen.getByRole("button", { name: "Fit page" });
    const zoomTrigger = screen.getByRole("button", {
      name: "Open zoom controls",
    });

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));

    await waitFor(() => {
      expect(fitButton).not.toHaveClass("dasti-doc-zoom-fit--active");
      expect(zoomTrigger).toHaveClass("dasti-doc-zoom-trigger--active");
    });
  });

  it("shows preview paragraph helper copy as a temporary edit-mode overlay and dismisses it after 4 seconds", () => {
    vi.useFakeTimers();

    function Harness() {
      const [mode, setMode] = React.useState<"preview" | "edit">("preview");
      return (
        <ProposalDisplay
          proposalContent={
            "Dear Hiring Manager,\n\nI built reliable editorial tooling across product and content workflows.\n\nSincerely,\nAlex Martin"
          }
          loading={false}
          error={null}
          proposalType="cover_letter"
          mode={mode}
          onModeChange={setMode}
          onContentChange={vi.fn()}
        />
      );
    }

    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Rewrite" }));

    expect(
      screen.getByText(/Pick a paragraph, then tap rewrite\./i),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(
      screen.queryByText(
        /Select a paragraph, then tap rewrite in the toolbar\./i,
      ),
    ).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("renders preview paragraph actions in the output footer with rewrite, shorten, and ask only", () => {
    render(
      <ProposalDisplay
        proposalContent={
          "Dear Hiring Manager,\n\nI built reliable editorial tooling across product and content workflows.\n\nSincerely,\nAlex Martin"
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        mode="preview"
      />,
    );

    expect(screen.getByText("Paragraph actions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rewrite" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Shorten" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Polish" }),
    ).not.toBeInTheDocument();
  });

  it("hides zoom controls while the proposal is in edit mode", () => {
    render(
      <ProposalDisplay
        proposalContent={
          "Dear Hiring Manager,\n\nI built reliable editorial tooling across product and content workflows.\n\nSincerely,\nAlex Martin"
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        showZoomControls
        mode="edit"
        onContentChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Open zoom controls" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Zoom out" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Zoom in" }),
    ).not.toBeInTheDocument();
  });

  it("uses a single preview or edit toggle button", () => {
    const handleModeChange = vi.fn();

    render(
      <ProposalDisplay
        proposalContent={
          "Hello hiring team,\n\nI build calm, reliable proposal copy."
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        mode="preview"
        onModeChange={handleModeChange}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Switch to edit mode" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAttribute("data-toolbar-tooltip", "Edit");

    fireEvent.click(toggle);

    expect(handleModeChange).toHaveBeenCalledWith("edit");
  });

  it("places the actions-only document header inside the sheet under the toolbar rail", () => {
    render(
      <ProposalDisplay
        proposalContent={
          "Hello hiring team,\n\nI build calm, reliable proposal copy."
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        documentHeaderMode="actions-only"
        documentTitle="Generated proposal"
        documentMeta="Compose output"
        showModeToggle
        onModeChange={vi.fn()}
      />,
    );

    const rail = document.querySelector(".dasti-document-rail");
    const inlineHeading = document.querySelector(
      ".dasti-proposal-sheet__heading--inline",
    );
    const externalHeading = document.querySelector(
      ".dasti-proposal-sheet__heading--external",
    );

    expect(rail).toBeTruthy();
    expect(inlineHeading).toBeTruthy();
    expect(externalHeading).toBeNull();
    expect(
      (rail as HTMLElement).compareDocumentPosition(
        inlineHeading as HTMLElement,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("can detach the actions-only document header above the shell for saved proposals", () => {
    render(
      <ProposalDisplay
        proposalContent={
          "Hello hiring team,\n\nI build calm, reliable proposal copy."
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        documentHeaderMode="actions-only"
        detachedActionHeader
        documentTitle="Saved proposal"
        documentMeta="Letter · Natural"
        showModeToggle
        onModeChange={vi.fn()}
        actions={<button type="button">Refine</button>}
        railStartAddon={<button type="button">Style inspector</button>}
        detachedActionHeaderSupplement={
          <button type="button">Forge preview</button>
        }
      />,
    );

    const detachedHeader = document.querySelector(
      ".dasti-proposal-sheet__header--detached",
    );
    const detachedLayout = document.querySelector(
      ".dasti-proposal-display__detached-layout",
    );
    const detachedRail = document.querySelector(
      ".dasti-proposal-sheet__header-rail",
    );
    const detachedRails = document.querySelectorAll(
      ".dasti-proposal-sheet__header-rail",
    );
    const detachedToolbar = document.querySelector(
      ".dasti-proposal-sheet__header-rail .dasti-document-rail.dasti-proposal-saved-view-toolbar",
    );
    const detachedAside = document.querySelector(
      ".dasti-proposal-sheet__heading--sidecar",
    );
    const inlineHeading = document.querySelector(
      ".dasti-proposal-sheet__heading--inline",
    );
    const shell = document.querySelector(".dasti-doc-viewer-shell");

    expect(detachedHeader).toBeTruthy();
    expect(detachedLayout).toBeTruthy();
    expect(detachedRail).toBeTruthy();
    expect(detachedRails).toHaveLength(2);
    expect(detachedToolbar).toBeTruthy();
    expect(detachedAside).toBeTruthy();
    expect(inlineHeading).toBeNull();
    expect(screen.getByRole("button", { name: "Refine" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Style inspector" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Forge preview" }),
    ).toBeInTheDocument();
    expect(
      (detachedHeader as HTMLElement).compareDocumentPosition(
        detachedRail as HTMLElement,
      ) & Node.DOCUMENT_POSITION_CONTAINED_BY,
    ).toBeTruthy();
    expect(
      (detachedLayout as HTMLElement).compareDocumentPosition(
        detachedAside as HTMLElement,
      ) & Node.DOCUMENT_POSITION_CONTAINED_BY,
    ).toBeTruthy();
    expect(
      (detachedLayout as HTMLElement).compareDocumentPosition(
        detachedHeader as HTMLElement,
      ) & Node.DOCUMENT_POSITION_CONTAINED_BY,
    ).toBeTruthy();
    expect(
      (detachedHeader as HTMLElement).compareDocumentPosition(
        shell as HTMLElement,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps the edit-mode character capsule visible at the shell level", () => {
    const { container } = render(
      <ProposalDisplay
        proposalContent={
          "Dear Hiring Manager,\n\nA precise product proposal body."
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        mode="edit"
        onContentChange={vi.fn()}
      />,
    );

    const editablePage = container.querySelector(
      ".dasti-proposal-sheet__preview-page--editable",
    ) as HTMLElement | null;
    const badgeWrap = container.querySelector(
      ".dasti-proposal-character-badge-wrap",
    ) as HTMLElement | null;

    expect(editablePage).toBeTruthy();
    expect(badgeWrap).toBeTruthy();
    expect(badgeWrap).toHaveAttribute("data-overlap-hidden", "false");
    expect(editablePage?.contains(badgeWrap)).toBe(false);
  });

  it("toggles the editable proposal header drawer in edit mode and forwards changes", () => {
    const handleApplicantNameChange = vi.fn();
    const handleApplicantRoleChange = vi.fn();
    const handleContactLineChange = vi.fn();
    const handleLetterDateChange = vi.fn();
    const handleRecipientDetailsChange = vi.fn();
    const handleSubjectChange = vi.fn();
    const handleSalutationChange = vi.fn();
    const handleHeaderVisibilityChange = vi.fn();

    render(
      <ProposalDisplay
        proposalContent={
          "Dear Hiring Manager,\n\nProposal body.\n\nBest,\nJane"
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        mode="edit"
        railTitle="Jane Doe"
        railMeta="Human Resources Administrator"
        contactLine="+33 6 00 00 00 00 · jane@example.com · janedoe.dev"
        letterDate="April 5, 2026"
        recipientDetails={"Hiring Manager\nPeople Operations\nModine"}
        salutationValue="Dear Hiring Manager,"
        documentTitle="Human Resources Administrator"
        documentTitleEditable
        onDocumentTitleChange={handleSubjectChange}
        onRailTitleChange={handleApplicantNameChange}
        onRailMetaChange={handleApplicantRoleChange}
        contactLineEditable
        onContactLineChange={handleContactLineChange}
        letterDateEditable
        onLetterDateChange={handleLetterDateChange}
        recipientDetailsEditable
        onRecipientDetailsChange={handleRecipientDetailsChange}
        salutationEditable
        onSalutationChange={handleSalutationChange}
        headerVisibility={{
          showSender: true,
          showRecipient: true,
          showRecipientDetails: false,
          showSubject: true,
          showDate: true,
        }}
        onHeaderVisibilityChange={handleHeaderVisibilityChange}
        onContentChange={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Show applicant details" }),
    );

    expect(
      document.querySelector(".dasti-proposal-character-badge-wrap"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Pick what appears on the letter." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Your sender line." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Who the letter is addressed to.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Date, subject, and opening line.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Applicant" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Recipient details" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Name")).toHaveValue("Jane Doe");
    expect(screen.getByLabelText("Role")).toHaveValue(
      "Human Resources Administrator",
    );
    expect(screen.getByLabelText("Contact")).toHaveValue(
      "+33 6 00 00 00 00 · jane@example.com · janedoe.dev",
    );
    expect(screen.getByLabelText("Recipient block")).toHaveValue(
      "Hiring Manager\nPeople Operations\nModine",
    );
    expect(screen.getByLabelText("Date / location")).toHaveValue(
      "April 5, 2026",
    );
    expect(screen.getByLabelText("Salutation")).toHaveValue(
      "Dear Hiring Manager,",
    );
    expect(screen.getByLabelText("Subject")).toHaveValue(
      "Human Resources Administrator",
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Elena Marlowe" },
    });
    fireEvent.change(screen.getByLabelText("Role"), {
      target: { value: "Senior Product Designer" },
    });
    fireEvent.change(screen.getByLabelText("Contact"), {
      target: {
        value: "+31 6 5555 2381, elena@sample.design, elenamarlowe.design",
      },
    });
    fireEvent.change(screen.getByLabelText("Date / location"), {
      target: {
        value: "Paris, April 6, 2026",
      },
    });
    fireEvent.change(screen.getByLabelText("Salutation"), {
      target: { value: "Dear Elena Marlowe," },
    });
    fireEvent.change(screen.getByLabelText("Recipient"), {
      target: {
        value: "Elena Marlowe",
      },
    });
    fireEvent.change(screen.getByLabelText("Company"), {
      target: {
        value: "Acme Studio",
      },
    });
    fireEvent.change(screen.getByLabelText("Recipient block"), {
      target: {
        value:
          "Elena Marlowe\nHead of Design\nAcme Studio\n12 Rue de la Paix\nelena@acme.studio\nParis",
      },
    });
    fireEvent.change(screen.getByLabelText("Subject"), {
      target: { value: "Lead Product Designer" },
    });

    expect(handleApplicantNameChange).toHaveBeenCalledWith("Elena Marlowe");
    expect(handleApplicantRoleChange).toHaveBeenCalledWith(
      "Senior Product Designer",
    );
    expect(handleContactLineChange).toHaveBeenCalledWith(
      "+31 6 5555 2381, elena@sample.design, elenamarlowe.design",
    );
    expect(handleLetterDateChange).toHaveBeenCalledWith("Paris, April 6, 2026");
    expect(handleSalutationChange).toHaveBeenCalledWith("Dear Elena Marlowe,");
    expect(handleRecipientDetailsChange).toHaveBeenLastCalledWith(
      "Elena Marlowe\nHead of Design\nAcme Studio\n12 Rue de la Paix\nelena@acme.studio\nParis",
    );
    expect(handleSubjectChange).toHaveBeenCalledWith("Lead Product Designer");

    fireEvent.click(
      screen.getByRole("button", { name: "Close header details" }),
    );
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("activates editable proposal header visibility pills with one click", () => {
    function Harness({
      initialHeaderVisibility = {
        showSender: true,
        showRecipient: true,
        showRecipientDetails: false,
        showSubject: true,
        showDate: true,
      },
    }: {
      initialHeaderVisibility?: {
        showSender: boolean;
        showRecipient: boolean;
        showRecipientDetails: boolean;
        showSubject: boolean;
        showDate: boolean;
      };
    }): JSX.Element {
      const [headerVisibility, setHeaderVisibility] = React.useState({
        ...initialHeaderVisibility,
      });

      return (
        <ProposalDisplay
          proposalContent={
            "Dear Hiring Manager,\n\nProposal body.\n\nBest,\nJane"
          }
          loading={false}
          error={null}
          proposalType="cover_letter"
          mode="edit"
          railTitle="Jane Doe"
          railMeta="Human Resources Administrator"
          recipientDetails={"Hiring Manager\nPeople Operations\nModine"}
          documentTitle="Human Resources Administrator"
          documentTitleEditable
          onDocumentTitleChange={vi.fn()}
          onRailTitleChange={vi.fn()}
          onRailMetaChange={vi.fn()}
          contactLineEditable
          onContactLineChange={vi.fn()}
          letterDateEditable
          onLetterDateChange={vi.fn()}
          recipientDetailsEditable
          onRecipientDetailsChange={vi.fn()}
          salutationEditable
          onSalutationChange={vi.fn()}
          headerVisibility={headerVisibility}
          onHeaderVisibilityChange={(value) => {
            setHeaderVisibility((current) => ({
              ...current,
              ...(typeof value === "function" ? value(current) : value),
            }));
          }}
          onContentChange={vi.fn()}
        />
      );
    }

    render(<Harness />);

    fireEvent.click(
      screen.getByRole("button", { name: "Show applicant details" }),
    );

    const recipientDetailsToggle = screen.getByRole("button", {
      name: "Recipient details",
    });

    expect(recipientDetailsToggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(recipientDetailsToggle);

    expect(recipientDetailsToggle).toHaveAttribute("aria-pressed", "true");
  });

  it("activates recipient details with one click even when recipient is hidden", () => {
    function Harness(): JSX.Element {
      const [headerVisibility, setHeaderVisibility] = React.useState({
        showSender: true,
        showRecipient: false,
        showRecipientDetails: false,
        showSubject: true,
        showDate: true,
      });

      return (
        <ProposalDisplay
          proposalContent={
            "Dear Hiring Manager,\n\nProposal body.\n\nBest,\nJane"
          }
          loading={false}
          error={null}
          proposalType="cover_letter"
          mode="edit"
          railTitle="Jane Doe"
          railMeta="Human Resources Administrator"
          recipientDetails={"Hiring Manager\nPeople Operations\nModine"}
          documentTitle="Human Resources Administrator"
          documentTitleEditable
          onDocumentTitleChange={vi.fn()}
          onRailTitleChange={vi.fn()}
          onRailMetaChange={vi.fn()}
          contactLineEditable
          onContactLineChange={vi.fn()}
          letterDateEditable
          onLetterDateChange={vi.fn()}
          recipientDetailsEditable
          onRecipientDetailsChange={vi.fn()}
          salutationEditable
          onSalutationChange={vi.fn()}
          headerVisibility={headerVisibility}
          onHeaderVisibilityChange={(value) => {
            setHeaderVisibility((current) => ({
              ...current,
              ...(typeof value === "function" ? value(current) : value),
            }));
          }}
          onContentChange={vi.fn()}
        />
      );
    }

    render(<Harness />);

    fireEvent.click(
      screen.getByRole("button", { name: "Show applicant details" }),
    );

    const recipientToggle = screen.getByRole("button", { name: "Recipient" });
    const recipientDetailsToggle = screen.getByRole("button", {
      name: "Recipient details",
    });

    expect(recipientToggle).toHaveAttribute("aria-pressed", "false");
    expect(recipientDetailsToggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(recipientDetailsToggle);

    expect(recipientToggle).toHaveAttribute("aria-pressed", "true");
    expect(recipientDetailsToggle).toHaveAttribute("aria-pressed", "true");
  });
});
