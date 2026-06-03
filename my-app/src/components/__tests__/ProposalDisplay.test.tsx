import React from "react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import ProposalDisplay from "../ProposalDisplay";
import {
  setAiInteractionTelemetrySink,
  type AiInteractionTelemetryEvent,
} from "../../lib/ai/aiInteractionTelemetry";
import type { EditorAiJobContext } from "../../lib/ai/editorAiJobContext";

const { mockTransformEditorSelection } = vi.hoisted(() => ({
  mockTransformEditorSelection: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useAction: () => mockTransformEditorSelection,
}));

const TEST_JOB_CONTEXT: EditorAiJobContext = {
  jobId: "job_123",
  title: "Operations Associate",
  company: "Acme",
  visibleSummary: "Customer operations role.",
  visibleRequirements: ["Customer support", "Scheduling"],
  visibleKeywords: ["operations", "customers"],
};

function renderEditableProposal(
  initialContent = "This is rough proposal copy.",
  options: { editorAiJobContext?: EditorAiJobContext | null } = {},
) {
  function Harness() {
    const [content, setContent] = React.useState(initialContent);

    return (
      <ProposalDisplay
        proposalContent={content}
        loading={false}
        error={null}
        mode="edit"
        onContentChange={setContent}
        editorAiJobContext={options.editorAiJobContext}
      />
    );
  }

  render(<Harness />);
  return screen.getByPlaceholderText("Content appears here") as HTMLTextAreaElement;
}

function renderPreviewEditableProposal(
  initialContent = "Dear Hiring Team,\n\nOriginal paragraph.\n\nKind regards,\nAlex",
  options: {
    documentDecorationDesignMode?: boolean;
    documentTitle?: string;
    railTitle?: string;
    railMeta?: string;
    contactLine?: string;
    letterDate?: string;
    recipientDetails?: string;
    templateId?: any;
    headerVisibility?: any;
    documentIconSettings?: any;
  } = {},
) {
  const onContentCommit = vi.fn();

  function Harness() {
    const [content, setContent] = React.useState(initialContent);
    const [proposalDocument, setProposalDocument] = React.useState<any>(null);
    const handleContentChange = (nextContent: string) => {
      setContent(nextContent);
      setProposalDocument(null);
    };
    const [documentTitle, setDocumentTitle] = React.useState(
      options.documentTitle ?? "Application subject",
    );
    const [railTitle, setRailTitle] = React.useState(
      options.railTitle ?? "Alex Morgan",
    );
    const [railMeta, setRailMeta] = React.useState(
      options.railMeta ?? "Operations Specialist",
    );
    const [contactLine, setContactLine] = React.useState(
      options.contactLine ?? "alex@example.com",
    );
    const [letterDate, setLetterDate] = React.useState(
      options.letterDate ?? "Paris, June 2, 2026",
    );
    const [recipientDetails, setRecipientDetails] = React.useState(
      options.recipientDetails ?? "Hiring Manager\nNorthwind",
    );

    return (
      <>
        <ProposalDisplay
          proposalContent={content}
          proposalDocument={proposalDocument}
          loading={false}
          error={null}
          mode="preview"
          proposalType="cover_letter"
          templateId={options.templateId}
          documentIconSettings={options.documentIconSettings}
          documentDecorationDesignMode={
            options.documentDecorationDesignMode ?? false
          }
          railTitle={railTitle}
          railMeta={railMeta}
          contactLine={contactLine}
          letterDate={letterDate}
          recipientDetails={recipientDetails}
          documentTitle={documentTitle}
          headerVisibility={options.headerVisibility}
          onRailTitleChange={setRailTitle}
          onRailMetaChange={setRailMeta}
          onContactLineChange={setContactLine}
          onLetterDateChange={setLetterDate}
          onRecipientDetailsChange={setRecipientDetails}
          onDocumentTitleChange={setDocumentTitle}
          onContentChange={handleContentChange}
          onProposalDocumentChange={setProposalDocument}
          onContentCommit={onContentCommit}
        />
        <output data-testid="proposal-content">{content}</output>
        <output data-testid="proposal-document">
          {proposalDocument ? JSON.stringify(proposalDocument) : ""}
        </output>
        <output data-testid="proposal-title">{documentTitle}</output>
        <output data-testid="proposal-sender">{railTitle}</output>
        <output data-testid="proposal-sender-role">{railMeta}</output>
        <output data-testid="proposal-contact">{contactLine}</output>
        <output data-testid="proposal-date">{letterDate}</output>
        <output data-testid="proposal-recipient">{recipientDetails}</output>
      </>
    );
  }

  render(<Harness />);
  return { onContentCommit };
}

async function selectTextareaText(textarea: HTMLTextAreaElement, text: string) {
  const start = textarea.value.indexOf(text);
  expect(start).toBeGreaterThanOrEqual(0);
  textarea.focus();
  textarea.setSelectionRange(start, start + text.length);
  fireEvent.select(textarea);

  await waitFor(() => {
    expect(
      getToolbarButton("Rewrite"),
    ).toBeInTheDocument();
  });
}

function captureAiTelemetryEvents() {
  const events: AiInteractionTelemetryEvent[] = [];
  setAiInteractionTelemetrySink((event) => events.push(event));
  return events;
}

function getToolbarButton(label: string): HTMLButtonElement {
  const match = screen
    .getAllByText(label)
    .map((node) => node.closest("button"))
    .find((button): button is HTMLButtonElement =>
      Boolean(
        button?.classList.contains("dasti-inline-ai-toolbar__action") ||
          button?.classList.contains("ds-ai-toolbar__btn"),
      ),
    );

  if (!match) {
    throw new Error(`Missing toolbar button: ${label}`);
  }

  return match;
}

function expectNoProposalInlineReviewUi() {
  expect(
    document.querySelector("[data-inline-ai-suggestion-toolbar='true']"),
  ).toBeNull();
  expect(
    document.querySelector("[data-inline-ai-suggestion-card='true']"),
  ).toBeNull();
  expect(
    document.querySelector(".dasti-proposal-inline-proofing__old"),
  ).toBeNull();
  expect(
    document.querySelector(".dasti-proposal-inline-proofing__new"),
  ).toBeNull();
}

async function findProposalAiReviewDialog() {
  return screen.findByRole("dialog", {
    name: "AI review for Proposal · Selected text",
  });
}

function getProposalReplaceButton() {
  return screen.getByRole("button", {
    name: "Replace in Proposal · Selected text",
  });
}

describe("ProposalDisplay", () => {
  afterEach(() => {
    setAiInteractionTelemetrySink(null);
  });

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("edits proposal body text directly in preview mode", async () => {
    const { onContentCommit } = renderPreviewEditableProposal();

    const paragraph = screen.getByRole("textbox", {
      name: "Edit paragraph",
    });
    expect(paragraph).toHaveTextContent("Original paragraph.");

    paragraph.textContent = "Updated paragraph.";
    fireEvent.blur(paragraph);

    await waitFor(() => {
      expect(screen.getByTestId("proposal-content")).toHaveTextContent(
        "Updated paragraph.",
      );
    });
    expect(paragraph).toHaveTextContent("Updated paragraph.");
    expect(onContentCommit).toHaveBeenCalledTimes(1);
  });

  it("edits proposal list items directly in preview mode", async () => {
    const { onContentCommit } = renderPreviewEditableProposal(
      "Dear Hiring Team,\n\n- First item\n- Second item\n\nKind regards,\nAlex",
    );

    const firstItem = screen.getAllByRole("textbox", {
      name: "Edit list item",
    })[0];
    expect(firstItem).toHaveTextContent("First item");

    firstItem.textContent = "Updated first item";
    fireEvent.blur(firstItem);

    await waitFor(() => {
      expect(screen.getByTestId("proposal-content")).toHaveTextContent(
        "- Updated first item",
      );
    });
    expect(firstItem).toHaveTextContent("Updated first item");
    expect(onContentCommit).toHaveBeenCalledTimes(1);
  });

  it("selects an icon for only the targeted preview list item", async () => {
    renderPreviewEditableProposal(
      "Dear Hiring Team,\n\n- First item\n- Second item\n\nKind regards,\nAlex",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Choose icon for list item 1" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Icon picker for list item 1" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Use Star icon" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-document")).toHaveTextContent(
        '"iconKey":"star"',
      );
    });
    expect(screen.getByTestId("proposal-content")).toHaveTextContent(
      "- First item",
    );
    expect(screen.getByTestId("proposal-content")).not.toHaveTextContent(
      "[[icon:",
    );

    const listItems = document.querySelectorAll("[data-proposal-list-item]");
    expect(listItems[0]).toHaveAttribute("data-has-item-icon", "true");
    expect(listItems[1]).not.toHaveAttribute("data-has-item-icon");
    const firstItemIconTrigger = screen.getByRole("button", {
      name: "Choose icon for list item 1",
    });
    expect(
      firstItemIconTrigger
        .closest("[data-proposal-list-item]")
        ?.querySelector(
          ".dasti-proposal-document__list-marker > .dasti-proposal-document__list-icon-trigger",
        ),
    ).toBe(firstItemIconTrigger);
  });

  it("clears a targeted preview list item icon override", async () => {
    renderPreviewEditableProposal(
      "Dear Hiring Team,\n\n- First item\n- Second item\n\nKind regards,\nAlex",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Choose icon for list item 1" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Use Star icon" }));
    await waitFor(() => {
      expect(screen.getByTestId("proposal-document")).toHaveTextContent(
        '"iconKey":"star"',
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Choose icon for list item 1" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-document")).not.toHaveTextContent(
        '"iconKey"',
      );
    });
  });

  it("preserves a preview list item icon when editing that item text", async () => {
    renderPreviewEditableProposal(
      "Dear Hiring Team,\n\n- First item\n- Second item\n\nKind regards,\nAlex",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Choose icon for list item 1" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Use Star icon" }));

    const firstItem = screen.getAllByRole("textbox", {
      name: "Edit list item",
    })[0];
    firstItem.textContent = "Updated with icon";
    fireEvent.input(firstItem);

    await waitFor(() => {
      expect(screen.getByTestId("proposal-content")).toHaveTextContent(
        "- Updated with icon",
      );
      expect(screen.getByTestId("proposal-document")).toHaveTextContent(
        '"iconKey":"star"',
      );
    });
  });

  it("commits paragraph input without requiring blur", async () => {
    renderPreviewEditableProposal();

    const paragraph = screen.getByRole("textbox", {
      name: "Edit paragraph",
    });
    paragraph.textContent = "Saved before blur.";
    fireEvent.input(paragraph);

    await waitFor(() => {
      expect(screen.getByTestId("proposal-content")).toHaveTextContent(
        "Saved before blur.",
      );
    });
  });

  it("sanitizes rich HTML paste into plain proposal text", async () => {
    renderPreviewEditableProposal();

    const paragraph = screen.getByRole("textbox", {
      name: "Edit paragraph",
    });
    paragraph.textContent = "";
    fireEvent.paste(paragraph, {
      clipboardData: {
        getData: (type: string) =>
          type === "text/html"
            ? "<p><strong>Pasted&nbsp;text</strong></p><script>alert('x')</script><div>Next</div>"
            : "",
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("proposal-content")).toHaveTextContent(
        "Pasted text Next",
      );
    });
    expect(screen.getByTestId("proposal-content")).not.toHaveTextContent(
      "<strong>",
    );
    expect(screen.getByTestId("proposal-content")).not.toHaveTextContent(
      "script",
    );
  });

  it("keeps preview keyboard behavior plain and predictable", async () => {
    renderPreviewEditableProposal();

    const paragraph = screen.getByRole("textbox", {
      name: "Edit paragraph",
    });
    paragraph.focus();
    paragraph.textContent = "Keyboard text";
    fireEvent.input(paragraph);

    expect(fireEvent.keyDown(paragraph, { key: "Enter" })).toBe(false);
    await waitFor(() => {
      expect(screen.getByTestId("proposal-content")).toHaveTextContent(
        "Keyboard text",
      );
    });
    expect(paragraph.innerHTML).not.toContain("<div");
    expect(paragraph.innerHTML).not.toContain("<span");

    paragraph.focus();
    expect(fireEvent.keyDown(paragraph, { key: "Escape" })).toBe(false);
  });

  it("keeps an empty list item valid and preserves list marker metadata", async () => {
    renderPreviewEditableProposal(
      "Dear Hiring Team,\n\n- First item\n- Second item\n\nKind regards,\nAlex",
      {
        documentIconSettings: {
          listMarkerType: "icon",
          defaultListMarkerKey: "check",
          sectionHeadingIconMode: "none",
          sectionIconMap: {},
          color: "accent",
          sizePt: 10,
        },
      },
    );

    const listItems = screen.getAllByRole("textbox", {
      name: "Edit list item",
    });
    const firstItem = listItems[0];
    firstItem.textContent = "";
    fireEvent.input(firstItem);

    await waitFor(() => {
      expect(screen.getByTestId("proposal-content")).toHaveTextContent(
        "- Second item",
      );
    });
    expect(
      document.querySelector(".dasti-proposal-document__list--document-icons"),
    ).toBeTruthy();
  });

  it("edits proposal header details directly in preview mode", async () => {
    renderPreviewEditableProposal();

    const subject = screen.getByRole("textbox", { name: "Edit subject" });
    subject.textContent = "Updated subject";
    fireEvent.blur(subject);

    const sender = screen.getByRole("textbox", { name: "Edit sender name" });
    sender.textContent = "Jordan Lee";
    fireEvent.blur(sender);

    const recipient = screen.getByRole("textbox", {
      name: "Edit recipient details",
    });
    recipient.textContent = "Avery Stone\nNorthwind";
    fireEvent.blur(recipient);

    await waitFor(() => {
      expect(screen.getByTestId("proposal-title")).toHaveTextContent(
        "Updated subject",
      );
      expect(screen.getByTestId("proposal-sender")).toHaveTextContent(
        "Jordan Lee",
      );
      expect(screen.getByTestId("proposal-recipient")).toHaveTextContent(
        "Avery Stone Northwind",
      );
    });
  });

  it("keeps preview header details editable while decoration design mode is active", async () => {
    renderPreviewEditableProposal(undefined, {
      documentDecorationDesignMode: true,
    });

    const subject = screen.getByRole("textbox", { name: "Edit subject" });
    subject.textContent = "Design drawer subject";
    fireEvent.blur(subject);

    await waitFor(() => {
      expect(screen.getByTestId("proposal-title")).toHaveTextContent(
        "Design drawer subject",
      );
    });
  });

  it("edits letterhead heading details directly in preview mode", async () => {
    renderPreviewEditableProposal(undefined, {
      templateId: "twoweeks-letterhead",
    });

    const subject = screen.getByRole("textbox", { name: "Edit subject" });
    subject.textContent = "Letterhead subject";
    fireEvent.blur(subject);

    const recipient = screen.getByRole("textbox", {
      name: "Edit recipient details",
    });
    recipient.textContent = "Letterhead recipient\nCompany";
    fireEvent.blur(recipient);

    await waitFor(() => {
      expect(screen.getByTestId("proposal-title")).toHaveTextContent(
        "Letterhead subject",
      );
      expect(screen.getByTestId("proposal-recipient")).toHaveTextContent(
        "Letterhead recipient Company",
      );
    });
  });

  it("keeps Editorial Wide heading labels while editing grouped values", async () => {
    renderPreviewEditableProposal(undefined, {
      templateId: "editorial_wide",
      contactLine:
        "alex@example.com · +33 6 01 02 03 04 · Paris · linkedin.com/in/alex",
      recipientDetails:
        "Hiring Manager\nSecurity Lead\nNorthwind\nhr@northwind.test\n12 Rue de la Paix\nParis",
    });

    const recipient = Array.from(
      document.querySelectorAll(".proposal-cover-letter__editorial-recipient"),
    ).at(-1);
    const sender = Array.from(
      document.querySelectorAll(".proposal-cover-letter__editorial-sender"),
    ).at(-1);
    const recipientCopy = recipient?.querySelector(
      ".proposal-cover-letter__editorial-contact-copy",
    );
    const senderCopy = sender?.querySelector(
      ".proposal-cover-letter__editorial-contact-copy",
    );

    expect(
      recipient?.querySelector(".proposal-cover-letter__editorial-label")
        ?.textContent,
    ).toBe("To");
    expect(
      sender?.querySelector(".proposal-cover-letter__editorial-label")
        ?.textContent,
    ).toBe("From");
    expect(recipientCopy).toBeTruthy();
    expect(senderCopy).toBeTruthy();
    expect(
      Array.from(recipientCopy?.querySelectorAll("p") ?? []).map(
        (group) => group.querySelector("b")?.textContent,
      ),
    ).toEqual(["Name", "Role", "Company", "Email", "Address", "City"]);

    const recipientValues = Array.from(
      recipientCopy?.querySelectorAll<HTMLElement>(
        "[data-proposal-editable-contact-value='true']",
      ) ?? [],
    );
    expect(recipientValues.length).toBeGreaterThan(0);

    recipientValues[0].textContent = "Editorial recipient";
    fireEvent.blur(recipientValues[0]);

    await waitFor(() => {
      expect(screen.getByTestId("proposal-recipient")).toHaveTextContent(
        "Editorial recipient",
      );
      expect(screen.getByTestId("proposal-recipient")).not.toHaveTextContent(
        "Name",
      );
    });
  });

  it.each([
    {
      templateId: "director-letterhead",
      preservedValues: ["Head of Talent", "Northwind", "hr@northwind.test"],
    },
    {
      templateId: "volk-letterhead",
      preservedValues: ["Head of Talent", "Northwind", "hr@northwind.test"],
    },
    {
      templateId: "film-foto-letterhead",
      preservedValues: ["Hiring Manager", "Head of Talent", "hr@northwind.test"],
    },
  ])("edits the visible recipient line in $templateId preview mode", async ({
    templateId,
    preservedValues,
  }) => {
    renderPreviewEditableProposal(undefined, {
      templateId,
      recipientDetails:
        "Hiring Manager\nHead of Talent\nNorthwind\nhr@northwind.test\n12 Rue de la Paix\nParis",
      headerVisibility: {
        showSender: true,
        showDate: true,
        showSubject: true,
        showRecipient: true,
        showRecipientDetails: true,
      },
    });

    const recipientLine = screen.getAllByRole("textbox", {
      name: "Edit recipient details",
    })[0];
    recipientLine.textContent = "Updated Hiring Manager";
    fireEvent.blur(recipientLine);

    await waitFor(() => {
      expect(screen.getByTestId("proposal-recipient")).toHaveTextContent(
        "Updated Hiring Manager",
      );
      preservedValues.forEach((value) => {
        expect(screen.getByTestId("proposal-recipient")).toHaveTextContent(value);
      });
    });
  });

  it("opens the shared review overlay for rewrite without rendering proposal inline review UI", async () => {
    const telemetryEvents = captureAiTelemetryEvents();
    mockTransformEditorSelection.mockResolvedValue({
      kind: "text",
      actionId: "rewrite",
      text: "polished proposal copy",
      applyMode: "preview_required",
      outputMode: "single_text",
      variants: [],
    });
    const textarea = renderEditableProposal("This is rough proposal copy.");

    await selectTextareaText(textarea, "rough proposal copy");
    fireEvent.click(getToolbarButton("Rewrite"));

    const reviewDialog = await findProposalAiReviewDialog();
    expect(reviewDialog).toHaveAttribute("data-cv-ai-review-surface", "true");
    expect(reviewDialog).toHaveTextContent("polished proposal copy");
    expect(reviewDialog.closest(".dasti-doc-viewer-shell__surface")).toBeNull();
    expectNoProposalInlineReviewUi();
    expect(textarea).toHaveValue("This is rough proposal copy.");
    expect(telemetryEvents.map((event) => event.name)).toEqual([
      "ai_started",
      "ai_completed",
    ]);
    expect(telemetryEvents[0]).toMatchObject({
      surface: "proposal_editor",
      actionId: "rewrite",
      applyMode: "preview_required",
    });
    expect(new Set(telemetryEvents.map((event) => event.interactionId)).size).toBe(
      1,
    );
    expect(JSON.stringify(telemetryEvents)).not.toContain(
      "rough proposal copy",
    );
    expect(JSON.stringify(telemetryEvents)).not.toContain(
      "polished proposal copy",
    );

    fireEvent.click(getProposalReplaceButton());

    await waitFor(() => {
      expect(textarea).toHaveValue("This is polished proposal copy.");
    });
    expect(telemetryEvents.map((event) => event.name)).toEqual([
      "ai_started",
      "ai_completed",
      "ai_accepted",
    ]);

    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(textarea).toHaveValue("This is rough proposal copy.");
    });
    expect(telemetryEvents.map((event) => event.name)).toEqual([
      "ai_started",
      "ai_completed",
      "ai_accepted",
      "ai_undone",
    ]);
  });

  it("replaces only the exact selected text from the shared review overlay", async () => {
    mockTransformEditorSelection.mockResolvedValue({
      kind: "text",
      actionId: "rewrite",
      text: "polished proposal copy",
      applyMode: "preview_required",
      outputMode: "single_text",
      variants: [],
    });
    const textarea = renderEditableProposal(
      "rough proposal copy and rough proposal copy",
    );

    await selectTextareaText(textarea, "rough proposal copy");
    fireEvent.click(getToolbarButton("Rewrite"));

    await findProposalAiReviewDialog();
    expect(textarea).toHaveValue("rough proposal copy and rough proposal copy");

    fireEvent.click(getProposalReplaceButton());

    await waitFor(() => {
      expect(textarea).toHaveValue(
        "polished proposal copy and rough proposal copy",
      );
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(textarea);
    });
  });

  it("blocks Replace when the saved selected-text range has drifted", async () => {
    mockTransformEditorSelection.mockResolvedValue({
      kind: "text",
      actionId: "rewrite",
      text: "polished proposal copy",
      applyMode: "preview_required",
      outputMode: "single_text",
      variants: [],
    });

    function Harness() {
      const [content, setContent] = React.useState(
        "This is rough proposal copy.",
      );

      return (
        <>
          <button
            type="button"
            onClick={() => setContent("This is externally changed copy.")}
          >
            Mutate content externally
          </button>
          <ProposalDisplay
            proposalContent={content}
            loading={false}
            error={null}
            mode="edit"
            onContentChange={setContent}
          />
        </>
      );
    }

    render(<Harness />);
    const textarea = screen.getByPlaceholderText(
      "Content appears here",
    ) as HTMLTextAreaElement;

    await selectTextareaText(textarea, "rough proposal copy");
    fireEvent.click(getToolbarButton("Rewrite"));

    await findProposalAiReviewDialog();
    fireEvent.click(
      screen.getByRole("button", { name: "Mutate content externally" }),
    );

    await waitFor(() => {
      expect(textarea).toHaveValue("This is externally changed copy.");
    });

    fireEvent.click(getProposalReplaceButton());

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Selected text changed. Re-select the text and run AI again.");
    expect(textarea).toHaveValue("This is externally changed copy.");
  });

  it("does not recenter the editable proposal page on edit entry or typed change", async () => {
    const scrollIntoViewSpy = vi.mocked(HTMLElement.prototype.scrollIntoView);

    function Harness() {
      const [content, setContent] = React.useState("First proposal draft.");

      return (
        <ProposalDisplay
          proposalContent={content}
          loading={false}
          error={null}
          proposalType="cover_letter"
          mode="edit"
          onContentChange={setContent}
        />
      );
    }

    render(<Harness />);
    const textarea = screen.getByPlaceholderText(
      "Content appears here",
    ) as HTMLTextAreaElement;

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(scrollIntoViewSpy).not.toHaveBeenCalled();

    fireEvent.change(textarea, {
      target: { value: "First proposal draft with a typed update." },
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
  });

  it("uses the shared review overlay for custom selected-text Ask without auto-applying", async () => {
    const telemetryEvents = captureAiTelemetryEvents();
    mockTransformEditorSelection.mockResolvedValue({
      kind: "text",
      actionId: "custom",
      text: "custom proposal copy",
      applyMode: "preview_required",
      outputMode: "single_text",
      variants: [],
    });
    const textarea = renderEditableProposal("This is rough proposal copy.");

    await selectTextareaText(textarea, "rough proposal copy");
    fireEvent.click(getToolbarButton("Ask"));
    fireEvent.change(screen.getByLabelText("Ask AI"), {
      target: { value: "Make it warmer" },
    });
    expect(
      document.querySelector("[data-inline-ai-selection-overlay='true']"),
    ).toBeNull();
    expect(textarea).not.toHaveClass(
      "dasti-proposal-inline-proofing__textarea--active",
    );
    const sendButton = document.querySelector(
      'button[aria-label="Send"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).not.toBeNull();
    fireEvent.click(sendButton as HTMLButtonElement);

    const reviewDialog = await findProposalAiReviewDialog();
    expect(reviewDialog).toHaveTextContent("custom proposal copy");
    expectNoProposalInlineReviewUi();
    expect(textarea).toHaveValue("This is rough proposal copy.");
    expect(telemetryEvents).toEqual([
      expect.objectContaining({
        name: "ai_started",
        surface: "proposal_editor",
        actionId: "custom",
        applyMode: "preview_required",
      }),
      expect.objectContaining({
        name: "ai_completed",
        surface: "proposal_editor",
        actionId: "custom",
        applyMode: "preview_required",
      }),
    ]);
  });

  it("hides tailor to job without job context", async () => {
    const textarea = renderEditableProposal("This is rough proposal copy.");

    await selectTextareaText(textarea, "rough proposal copy");

    expect(screen.queryByText("Tailor")).not.toBeInTheDocument();
  });

  it("previews tailor to job suggestions with job context without auto-applying", async () => {
    const telemetryEvents = captureAiTelemetryEvents();
    mockTransformEditorSelection.mockResolvedValue({
      kind: "text",
      actionId: "tailor_to_job",
      text: "tailored proposal copy",
      applyMode: "preview_required",
      outputMode: "single_text",
      variants: [],
    });
    const textarea = renderEditableProposal("This is rough proposal copy.", {
      editorAiJobContext: TEST_JOB_CONTEXT,
    });

    await selectTextareaText(textarea, "rough proposal copy");
    fireEvent.click(getToolbarButton("Tailor"));

    const reviewDialog = await findProposalAiReviewDialog();
    expect(reviewDialog).toHaveTextContent("tailored proposal copy");
    expect(textarea).toHaveValue("This is rough proposal copy.");
    expect(mockTransformEditorSelection).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "tailor_to_job",
        selectedText: "rough proposal copy",
        jobContext: expect.objectContaining(TEST_JOB_CONTEXT),
      }),
    );
    expect(telemetryEvents).toEqual([
      expect.objectContaining({
        name: "ai_started",
        surface: "proposal_editor",
        actionId: "tailor_to_job",
        applyMode: "preview_required",
      }),
      expect.objectContaining({
        name: "ai_completed",
        surface: "proposal_editor",
        actionId: "tailor_to_job",
        applyMode: "preview_required",
      }),
    ]);
    expect(JSON.stringify(telemetryEvents)).not.toContain(
      "rough proposal copy",
    );
    expect(JSON.stringify(telemetryEvents)).not.toContain(
      "tailored proposal copy",
    );
    expect(JSON.stringify(telemetryEvents)).not.toContain(
      "Customer operations role",
    );

    fireEvent.click(getProposalReplaceButton());

    await waitFor(() => {
      expect(textarea).toHaveValue("This is tailored proposal copy.");
    });

    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(textarea).toHaveValue("This is rough proposal copy.");
    });
    expect(telemetryEvents.map((event) => event.name)).toEqual([
      "ai_started",
      "ai_completed",
      "ai_accepted",
      "ai_undone",
    ]);
  });

  it("discards tailor to job suggestions without applying", async () => {
    const telemetryEvents = captureAiTelemetryEvents();
    mockTransformEditorSelection.mockResolvedValue({
      kind: "text",
      actionId: "tailor_to_job",
      text: "discarded tailored copy",
      applyMode: "preview_required",
      outputMode: "single_text",
      variants: [],
    });
    const textarea = renderEditableProposal("This is rough proposal copy.", {
      editorAiJobContext: TEST_JOB_CONTEXT,
    });

    await selectTextareaText(textarea, "rough proposal copy");
    fireEvent.click(getToolbarButton("Tailor"));

    await findProposalAiReviewDialog();
    fireEvent.click(
      await screen.findByRole("button", { name: "Back from AI review" }),
    );

    expect(textarea).toHaveValue("This is rough proposal copy.");
    expect(
      screen.queryByRole("dialog", {
        name: "AI review for Proposal · Selected text",
      }),
    ).not.toBeInTheDocument();
    expect(telemetryEvents.map((event) => event.name)).toEqual([
      "ai_started",
      "ai_completed",
      "ai_discarded",
    ]);
  });

  it("discards preview-required suggestions without applying", async () => {
    const telemetryEvents = captureAiTelemetryEvents();
    mockTransformEditorSelection.mockResolvedValue({
      kind: "text",
      actionId: "rewrite",
      text: "discarded proposal copy",
      applyMode: "preview_required",
      outputMode: "single_text",
      variants: [],
    });
    const textarea = renderEditableProposal("This is rough proposal copy.");

    await selectTextareaText(textarea, "rough proposal copy");
    fireEvent.click(getToolbarButton("Rewrite"));

    await findProposalAiReviewDialog();
    fireEvent.click(
      await screen.findByRole("button", { name: "Back from AI review" }),
    );

    expect(textarea).toHaveValue("This is rough proposal copy.");
    expect(
      screen.queryByRole("dialog", {
        name: "AI review for Proposal · Selected text",
      }),
    ).not.toBeInTheDocument();
    expect(telemetryEvents.map((event) => event.name)).toEqual([
      "ai_started",
      "ai_completed",
      "ai_discarded",
    ]);
  });

  it("records failed editor AI telemetry when no suggestion text is returned", async () => {
    const telemetryEvents = captureAiTelemetryEvents();
    mockTransformEditorSelection.mockResolvedValue({
      kind: "text",
      actionId: "rewrite",
      text: "",
      applyMode: "preview_required",
      outputMode: "single_text",
      variants: [],
    });
    const textarea = renderEditableProposal("This is rough proposal copy.");

    await selectTextareaText(textarea, "rough proposal copy");
    fireEvent.click(getToolbarButton("Rewrite"));

    await waitFor(() => {
      expect(telemetryEvents.map((event) => event.name)).toEqual([
        "ai_started",
        "ai_failed",
      ]);
    });
    expect(telemetryEvents[1]).toMatchObject({
      surface: "proposal_editor",
      actionId: "rewrite",
      applyMode: "preview_required",
      errorKind: "empty_result",
    });
    expect(textarea).toHaveValue("This is rough proposal copy.");
    expect(
      screen.queryByRole("region", { name: "Rewrite suggestion" }),
    ).not.toBeInTheDocument();
  });

  it("opens fix grammar in the shared review overlay before replacement and exposes undo", async () => {
    const telemetryEvents = captureAiTelemetryEvents();
    mockTransformEditorSelection.mockResolvedValue({
      kind: "text",
      actionId: "fix_grammar",
      text: "clean proposal copy",
      applyMode: "inline_replace_with_undo",
      outputMode: "single_text",
      variants: [],
    });
    const textarea = renderEditableProposal("This is rough proposal copy.");

    await selectTextareaText(textarea, "rough proposal copy");
    fireEvent.click(getToolbarButton("Fix"));

    const reviewDialog = await findProposalAiReviewDialog();
    expect(reviewDialog).toHaveTextContent("clean proposal copy");
    expectNoProposalInlineReviewUi();
    expect(textarea).toHaveValue("This is rough proposal copy.");
    expect(telemetryEvents.map((event) => event.name)).toEqual([
      "ai_started",
      "ai_completed",
    ]);

    fireEvent.click(getProposalReplaceButton());

    await waitFor(() => {
      expect(textarea).toHaveValue("This is clean proposal copy.");
    });
    expect(telemetryEvents.map((event) => event.name)).toEqual([
      "ai_started",
      "ai_completed",
      "ai_accepted",
    ]);
    expect(telemetryEvents[2]).toMatchObject({
      actionId: "fix_grammar",
      applyMode: "inline_replace_with_undo",
    });

    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(textarea).toHaveValue("This is rough proposal copy.");
    });
    expect(telemetryEvents.map((event) => event.name)).toEqual([
      "ai_started",
      "ai_completed",
      "ai_accepted",
      "ai_undone",
    ]);

    await selectTextareaText(textarea, "rough proposal copy");
    fireEvent.click(getToolbarButton("Fix"));
    await findProposalAiReviewDialog();
    fireEvent.click(
      await screen.findByRole("button", { name: "Back from AI review" }),
    );
    expect(
      screen.queryByRole("dialog", {
        name: "AI review for Proposal · Selected text",
      }),
    ).not.toBeInTheDocument();
  });

  it("previews shorten suggestions before applying", async () => {
    mockTransformEditorSelection.mockResolvedValue({
      kind: "text",
      actionId: "shorten",
      text: "short copy",
      applyMode: "inline_replace_with_undo",
      outputMode: "single_text",
      variants: [],
    });
    const textarea = renderEditableProposal("This is rough proposal copy.");

    await selectTextareaText(textarea, "rough proposal copy");
    fireEvent.click(getToolbarButton("Shorten"));

    const reviewDialog = await findProposalAiReviewDialog();
    expect(reviewDialog).toHaveTextContent("short copy");
    expect(getProposalReplaceButton()).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back from AI review" }),
    ).toBeInTheDocument();
    expect(textarea).toHaveValue("This is rough proposal copy.");

    fireEvent.click(getProposalReplaceButton());

    await waitFor(() => {
      expect(textarea).toHaveValue("This is short copy.");
    });

    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(textarea).toHaveValue("This is rough proposal copy.");
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
    expect(screen.getByText(/No draft yet\./)).toBeInTheDocument();
    expect(
      screen.getByText((_content, element) =>
        Boolean(
          element?.tagName === "P" &&
            element.textContent?.includes("Add a job offer to generate."),
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Or start blank\./)).toBeInTheDocument();
    expect(
      (frame as HTMLElement).style.getPropertyValue("--font-body-family"),
    ).toContain("Geist");
    expect(
      (frame as HTMLElement).style.getPropertyValue("--color-canvas"),
    ).toBe("");
  });

  it("renders a blank editable document when edit mode has empty content", () => {
    const handleContentChange = vi.fn();

    render(
      <ProposalDisplay
        proposalContent=""
        loading={false}
        error={null}
        proposalType="cover_letter"
        mode="edit"
        onContentChange={handleContentChange}
      />,
    );

    expect(screen.queryByText(/No draft yet\./)).toBeNull();
    expect(screen.getByPlaceholderText("Content appears here")).toBeInTheDocument();
  });

  it("shows list authoring controls only in edit mode", () => {
    const { rerender } = render(
      <ProposalDisplay
        proposalContent="Line one"
        loading={false}
        error={null}
        mode="preview"
        onContentChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "List" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Icon" })).toBeNull();

    rerender(
      <ProposalDisplay
        proposalContent="Line one"
        loading={false}
        error={null}
        mode="edit"
        onContentChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "List" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Icon" })).toBeNull();
  });

  it("updates selected textarea lines when List is clicked", async () => {
    const textarea = renderEditableProposal("Line one\nLine two");
    textarea.focus();
    textarea.setSelectionRange(0, textarea.value.length);

    fireEvent.click(screen.getByRole("button", { name: "List" }));

    await waitFor(() => {
      expect(textarea).toHaveValue("- Line one\n- Line two");
    });
  });

  it("does not render a source-mode icon insertion tool", async () => {
    function Harness() {
      const [content, setContent] = React.useState("Line one\nLine two");

      return (
        <ProposalDisplay
          proposalContent={content}
          loading={false}
          error={null}
          mode="edit"
          onContentChange={setContent}
        />
      );
    }

    render(<Harness />);
    const textarea = screen.getByPlaceholderText(
      "Content appears here",
    ) as HTMLTextAreaElement;

    textarea.focus();
    textarea.setSelectionRange(0, textarea.value.length);
    fireEvent.click(screen.getByRole("button", { name: "List" }));

    textarea.setSelectionRange(0, textarea.value.length);
    expect(screen.queryByRole("button", { name: "Icon" })).toBeNull();
    expect(textarea).toHaveValue("- Line one\n- Line two");
  });

  it("inserts a starter list at the cursor when List is clicked with no selection", async () => {
    const textarea = renderEditableProposal("Intro\n");
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    fireEvent.click(screen.getByRole("button", { name: "List" }));

    await waitFor(() => {
      expect(textarea).toHaveValue("Intro\n- First item\n- Second item");
      expect(textarea.selectionStart).toBe("Intro\n- ".length);
      expect(textarea.selectionEnd).toBe("Intro\n- First item".length);
    });
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

  it("renders preview zoom in a footer when the document header is hidden", () => {
    render(
      <ProposalDisplay
        proposalContent={
          "Dear Hiring Manager,\n\nI built reliable editorial tooling across product and content workflows.\n\nSincerely,\nAlex Martin"
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        showZoomControls
        documentHeaderMode="hidden"
      />,
    );

    expect(
      document.querySelector(".dasti-proposal-preview-zoom-footer"),
    ).toBeTruthy();
    expect(
      document.querySelector(
        '.dasti-doc-viewer-shell__surface[data-preview-zoom-footer="true"]',
      ),
    ).toBeTruthy();
    expect(
      document.querySelector(
        '.dasti-proposal-sheet__preview-stage[data-document-stage="true"][data-zoom-footer="true"]',
      ),
    ).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Proposal zoom" })).toHaveValue(
      "1",
    );
    expect(
      screen.getByRole("button", { name: "Zoom level 100%" }),
    ).toHaveClass("dasti-proposal-preview-zoom-footer__status");
    expect(screen.getByText("100%")).toHaveClass(
      "dasti-proposal-preview-zoom-footer__status",
    );
    expect(
      screen.getByRole("button", { name: "Zoom level 100%" }),
    ).toHaveTextContent("100%");

    fireEvent.click(screen.getByRole("button", { name: "Zoom level 100%" }));

    expect(
      screen.getByRole("menuitemradio", { name: "30 %" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "50 %" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "Fit page" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemradio", { name: "30 %" }));

    expect(screen.getByRole("slider", { name: "Proposal zoom" })).toHaveValue(
      "0.3",
    );
    expect(
      screen.getByRole("button", { name: "Zoom level 30%" }),
    ).toHaveTextContent("30%");
  });

  it("updates proposal zoom continuously from the footer slider", () => {
    render(
      <ProposalDisplay
        proposalContent={
          "Dear Hiring Manager,\n\nI built reliable editorial tooling across product and content workflows.\n\nSincerely,\nAlex Martin"
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        showZoomControls
        documentHeaderMode="hidden"
      />,
    );

    fireEvent.change(screen.getByRole("slider", { name: "Proposal zoom" }), {
      target: { value: "1.17" },
    });

    expect(screen.getByRole("slider", { name: "Proposal zoom" })).toHaveValue(
      "1.17",
    );
    expect(
      screen.getByRole("button", { name: "Zoom level 117%" }),
    ).toHaveTextContent("117%");
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

  it("uses a single document or source toggle button", () => {
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

    const toggle = screen.getByRole("button", {
      name: "Switch to source mode",
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAttribute("data-toolbar-tooltip", "Source");

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

  it("does not render the legacy edit-mode character capsule under the page", () => {
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
    expect(badgeWrap).toBeNull();
  });

  it("toggles the editable proposal header drawer in edit mode and forwards changes", () => {
    const handleApplicantNameChange = vi.fn();
    const handleApplicantRoleChange = vi.fn();
    const handleContactLineChange = vi.fn();
    const handleLetterDateChange = vi.fn();
    const handleRecipientDetailsChange = vi.fn();
    const handleSubjectChange = vi.fn();
    const handleSalutationChange = vi.fn();
    const handleSignOffChange = vi.fn();
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
        signOffEditable
        signOffValue="Kind regards,"
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
        onSignOffChange={handleSignOffChange}
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
    expect(screen.getByLabelText("Signature / politeness formula")).toHaveValue(
      "Kind regards,",
    );
    expect(screen.getByLabelText("Closing options")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sincerely," }));
    expect(handleSignOffChange).toHaveBeenCalledWith("Sincerely,");
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
    fireEvent.change(screen.getByLabelText("Signature / politeness formula"), {
      target: { value: "With kind regards," },
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
          "Elena Marlowe\nHead of Design\nAcme Studio\nelena@acme.studio\n12 Rue de la Paix\nParis",
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
    expect(handleSignOffChange).toHaveBeenCalledWith("With kind regards,");
    expect(handleRecipientDetailsChange).toHaveBeenLastCalledWith(
      "Elena Marlowe\nHead of Design\nAcme Studio\nelena@acme.studio\n12 Rue de la Paix\nParis",
    );
    expect(handleSubjectChange).toHaveBeenCalledWith("Lead Product Designer");

    fireEvent.click(
      screen.getByRole("button", { name: "Close header details" }),
    );
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("preserves extra recipient block lines when editing structured recipient fields", () => {
    const handleRecipientDetailsChange = vi.fn();

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
        recipientDetails={
          "Hiring Manager\nHead of Talent\nNorthwind\nhiring@northwind.com\n12 Rue de la Paix\nParis\nAdditional address line"
        }
        documentTitle="Human Resources Administrator"
        recipientDetailsEditable
        onRecipientDetailsChange={handleRecipientDetailsChange}
        onContentChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Show applicant details" }),
    );
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "14 Rue de la Paix" },
    });

    expect(handleRecipientDetailsChange).toHaveBeenLastCalledWith(
      "Hiring Manager\nHead of Talent\nNorthwind\nhiring@northwind.com\n14 Rue de la Paix\nParis\nAdditional address line",
    );
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
