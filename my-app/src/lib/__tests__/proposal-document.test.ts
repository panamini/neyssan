import { describe, expect, it } from "vitest";

import {
  normalizeEditableText,
  applyProposalDocumentInlineMark,
  getProposalRichTextPlainText,
  mergeProposalDocumentTargetBackward,
  mergeProposalDocumentTargetForward,
  normalizeProposalDocument,
  parseLegacyProposalDocument,
  resolveProposalDocument,
  serializeProposalDocumentToLegacyString,
  splitProposalDocumentTarget,
  type ProposalDocument,
} from "../proposal-document";

describe("proposal-document", () => {
  it("normalizes editable text to plain text", () => {
    expect(
      normalizeEditableText(
        "<p><strong>Hello&nbsp;team</strong></p><script>alert('x')</script><div>Next</div>",
      ),
    ).toBe("Hello team\nNext");
  });

  it("parses legacy cover-letter text into structured blocks", () => {
    const document = parseLegacyProposalDocument({
      content:
        "Dear Hiring Team,\n\n- Audit the current flow\n- Ship the document model\n\nKind regards,\nAlex",
      proposalType: "cover_letter",
    });

    expect(document.schemaVersion).toBe(1);
    expect(document.kind).toBe("letter");
    expect(document.blocks).toEqual([
      { id: "salutation-1", type: "salutation", text: "Dear Hiring Team," },
      {
        id: "list-2",
        type: "list",
        marker: { type: "dash" },
        items: [
          {
            id: "list-2-item-1",
            text: "Audit the current flow",
            marker: { type: "dash" },
          },
          {
            id: "list-2-item-2",
            text: "Ship the document model",
            marker: { type: "dash" },
          },
        ],
      },
      {
        id: "closing-3",
        type: "closing",
        signOff: "Kind regards,",
        signatureName: "Alex",
      },
    ]);
  });

  it("serializes structured blocks back to the legacy string format", () => {
    const document: ProposalDocument = {
      schemaVersion: 1,
      kind: "letter",
      source: "structured",
      blocks: [
        { id: "s", type: "salutation", text: "Dear Team," },
        { id: "p", type: "paragraph", text: "I can help." },
        {
          id: "l",
          type: "list",
          marker: { type: "dash" },
          items: [
            { id: "i1", text: "First", marker: { type: "dash" } },
            { id: "i2", text: "Second", marker: { type: "dash" } },
          ],
        },
        { id: "c", type: "closing", signOff: "Best,", signatureName: "Alex" },
      ],
    };

    expect(serializeProposalDocumentToLegacyString(document)).toBe(
      "Dear Team,\n\nI can help.\n\n- First\n- Second\n\nBest,\nAlex",
    );
  });

  it("keeps plain documents valid without rich text", () => {
    const document: ProposalDocument = {
      schemaVersion: 1,
      kind: "letter",
      source: "structured",
      blocks: [{ id: "p", type: "paragraph", text: "Plain paragraph." }],
    };

    expect(normalizeProposalDocument(document)).toEqual(document);
  });

  it("normalizes rich paragraph and list item fallbacks", () => {
    const document = normalizeProposalDocument({
      schemaVersion: 1,
      kind: "letter",
      source: "structured",
      blocks: [
        {
          id: "p",
          type: "paragraph",
          text: "stale fallback",
          richText: {
            runs: [
              { text: "Bold", bold: true },
              { text: " and clean\u200B text" },
            ],
          },
        },
        {
          id: "l",
          type: "list",
          items: [
            {
              id: "i",
              text: "stale item",
              richText: { runs: [{ text: "Underlined", underline: true }] },
            },
          ],
        },
      ],
    });

    expect(document?.blocks[0]).toMatchObject({
      text: "Bold and clean text",
      richText: { runs: [{ text: "Bold", bold: true }, { text: " and clean text" }] },
    });
    expect(document?.blocks[1]).toMatchObject({
      items: [
        {
          text: "Underlined",
          richText: { runs: [{ text: "Underlined", underline: true }] },
        },
      ],
    });
  });

  it("applies inline marks while keeping plain fallback clean", () => {
    const document: ProposalDocument = {
      schemaVersion: 1,
      kind: "letter",
      source: "structured",
      blocks: [{ id: "p", type: "paragraph", text: "Make this bold." }],
    };

    const next = applyProposalDocumentInlineMark({
      document,
      target: { type: "text-block", blockId: "p" },
      mark: "bold",
      start: 5,
      end: 9,
    });
    const block = next.blocks[0];

    expect(block).toMatchObject({
      text: "Make this bold.",
      richText: {
        runs: [
          { text: "Make " },
          { text: "this", bold: true },
          { text: " bold." },
        ],
      },
    });
    expect(
      block.type === "paragraph"
        ? getProposalRichTextPlainText(block.richText)
        : "",
    ).toBe("Make this bold.");
  });

  it("falls back to legacy content when structured data is invalid", () => {
    const document = resolveProposalDocument({
      document: { schemaVersion: 999, blocks: [] },
      content: "Hello team,\n\nA fallback paragraph.",
      proposalType: "application_message",
    });

    expect(document.kind).toBe("message");
    expect(document.blocks).toEqual([
      { id: "salutation-1", type: "salutation", text: "Hello team," },
      { id: "paragraph-2", type: "paragraph", text: "A fallback paragraph." },
    ]);
  });

  it("normalizes structured documents and preserves transient empty list items", () => {
    const document = normalizeProposalDocument({
      schemaVersion: 1,
      kind: "proposal",
      source: "structured",
      blocks: [
        {
          id: "list",
          type: "list",
          marker: { type: "icon", iconKey: "briefcase" },
          items: [
            { id: "one", text: "Useful", iconKey: "star", marker: null },
            { id: "empty", text: "   " },
          ],
        },
      ],
    });

    expect(document?.blocks).toEqual([
      {
        id: "list",
        type: "list",
        marker: { type: "icon", iconKey: "briefcase" },
        items: [
          {
            id: "one",
            text: "Useful",
            iconKey: "star",
            marker: { type: "icon", iconKey: "briefcase" },
          },
          {
            id: "empty",
            text: "",
            marker: { type: "icon", iconKey: "briefcase" },
          },
        ],
      },
    ]);
  });

  it("skips transient empty list items during legacy serialization", () => {
    const document: ProposalDocument = {
      schemaVersion: 1,
      kind: "letter",
      source: "structured",
      blocks: [
        {
          id: "l",
          type: "list",
          marker: { type: "dash" },
          items: [
            { id: "i1", text: "First", marker: { type: "dash" } },
            { id: "empty", text: "", marker: { type: "dash" } },
          ],
        },
      ],
    };

    expect(serializeProposalDocumentToLegacyString(document)).toBe("- First");
  });

  it("splits paragraphs and keeps existing block ids stable", () => {
    const document: ProposalDocument = {
      schemaVersion: 1,
      kind: "letter",
      source: "structured",
      blocks: [
        { id: "p1", type: "paragraph", text: "Before after" },
        { id: "p2", type: "paragraph", text: "Unchanged" },
      ],
    };

    const next = splitProposalDocumentTarget({
      document,
      target: { type: "text-block", blockId: "p1" },
      offset: "Before".length,
    });

    expect(next.blocks).toEqual([
      { id: "p1", type: "paragraph", text: "Before" },
      { id: "p1-paragraph", type: "paragraph", text: "after" },
      { id: "p2", type: "paragraph", text: "Unchanged" },
    ]);
  });

  it("splits list items and exits an empty item into a paragraph", () => {
    const document: ProposalDocument = {
      schemaVersion: 1,
      kind: "letter",
      source: "structured",
      blocks: [
        {
          id: "l",
          type: "list",
          marker: { type: "dash" },
          items: [
            { id: "i1", text: "First item", marker: { type: "dash" } },
            { id: "i2", text: "", marker: { type: "dash" } },
          ],
        },
      ],
    };

    const split = splitProposalDocumentTarget({
      document,
      target: { type: "list-item", blockId: "l", itemId: "i1" },
      offset: "First".length,
    });

    expect(split.blocks[0]).toMatchObject({
      id: "l",
      type: "list",
      items: [
        { id: "i1", text: "First" },
        { id: "i1-item", text: "item" },
        { id: "i2", text: "" },
      ],
    });

    const exited = splitProposalDocumentTarget({
      document,
      target: { type: "list-item", blockId: "l", itemId: "i2" },
      offset: 0,
    });

    expect(exited.blocks).toEqual([
      {
        id: "l",
        type: "list",
        marker: { type: "dash" },
        items: [{ id: "i1", text: "First item", marker: { type: "dash" } }],
      },
      { id: "l-paragraph", type: "paragraph", text: "" },
    ]);
  });

  it("merges paragraph and list-compatible blocks at boundaries", () => {
    const document: ProposalDocument = {
      schemaVersion: 1,
      kind: "letter",
      source: "structured",
      blocks: [
        { id: "p1", type: "paragraph", text: "First" },
        { id: "p2", type: "paragraph", text: "Second" },
        {
          id: "l",
          type: "list",
          items: [{ id: "i1", text: "Third" }],
        },
      ],
    };

    const backward = mergeProposalDocumentTargetBackward({
      document,
      target: { type: "text-block", blockId: "p2" },
    });
    expect(backward.blocks).toEqual([
      { id: "p1", type: "paragraph", text: "First Second" },
      {
        id: "l",
        type: "list",
        items: [{ id: "i1", text: "Third" }],
      },
    ]);

    const forward = mergeProposalDocumentTargetForward({
      document,
      target: { type: "text-block", blockId: "p2" },
    });
    expect(forward.blocks).toEqual([
      { id: "p1", type: "paragraph", text: "First" },
      { id: "p2", type: "paragraph", text: "Second Third" },
    ]);
  });

  it("strips editable HTML before legacy serialization", () => {
    const document: ProposalDocument = {
      schemaVersion: 1,
      kind: "letter",
      source: "structured",
      blocks: [
        { id: "p", type: "paragraph", text: "<b>Clean</b> paragraph" },
        {
          id: "l",
          type: "list",
          marker: { type: "icon", iconKey: "briefcase" },
          items: [{ id: "i", text: "<span>Clean item</span>", iconKey: "star" }],
        },
      ],
    };

    expect(serializeProposalDocumentToLegacyString(document)).toBe(
      "Clean paragraph\n\n* Clean item",
    );
  });
});
