import { describe, expect, it } from "vitest";

import {
  normalizeEditableText,
  normalizeProposalDocument,
  parseLegacyProposalDocument,
  resolveProposalDocument,
  serializeProposalDocumentToLegacyString,
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

  it("normalizes structured documents and drops empty list items", () => {
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
        ],
      },
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
