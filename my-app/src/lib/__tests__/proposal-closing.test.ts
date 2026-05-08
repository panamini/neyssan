import { describe, expect, it } from "vitest";

import { applyDeterministicProposalBoundaries } from "../../../convex/lib/proposals/proposalRenderer";
import { parseProposalDocumentContent } from "../../components/proposal-render/ProposalDocumentRenderer";
import {
  buildProposalExportSource,
  type ProposalPrintBlock,
} from "../document-export-models";
import {
  ensureProposalSignatureName,
  extractProposalClosingBlockFromParagraphs,
  formatProposalSignatureName,
  parseProposalClosingBlock,
  resolveProposalClosingRef,
} from "../proposal-closing";

function buildProposalSource(content: string) {
  return buildProposalExportSource({
    content,
    proposalType: "cover_letter",
    documentTitle: "Application",
    documentMeta: "",
    contactLine: "",
    letterDate: "",
    recipientDetails: "",
    applicantHeader: {
      name: "Alex Mercer",
      role: "Designer",
    },
    headerVisibility: {
      showSender: true,
      showDate: true,
      showRecipient: true,
      showRecipientDetails: true,
      showSubject: true,
    },
    templateId: "swiss_margin",
  });
}

function getClosingBlock(blocks: ProposalPrintBlock[]) {
  const block = blocks.at(-1);
  return block?.type === "closing" ? block : null;
}

describe("proposal closing parser", () => {
  it("parses French signature closings conservatively", () => {
    expect(parseProposalClosingBlock("Cordialement,\nAlex Mercer")).toEqual({
      signOff: "Cordialement,",
      signatureName: "Alex Mercer",
    });
    expect(parseProposalClosingBlock("Bien cordialement,\nAlex Mercer")).toEqual({
      signOff: "Bien cordialement,",
      signatureName: "Alex Mercer",
    });
  });

  it("parses English signature closings conservatively", () => {
    expect(parseProposalClosingBlock("Sincerely,\nAlex Mercer")).toEqual({
      signOff: "Sincerely,",
      signatureName: "Alex Mercer",
    });
  });

  it("restores a missing candidate signature after an existing sign-off", () => {
    expect(
      ensureProposalSignatureName(
        "Dear Hiring Manager,\n\nI would welcome the conversation.\n\nKind regards,",
        "Alex Mercer",
      ),
    ).toBe(
      "Dear Hiring Manager,\n\nI would welcome the conversation.\n\nKind regards,\n\nalex mercer",
    );
  });

  it("normalizes an existing compact signature into a lowercase separated signature", () => {
    expect(
      ensureProposalSignatureName(
        "Dear Hiring Manager,\n\nI would welcome the conversation.\n\nKind regards,\nAlex Mercer",
        "Alex Mercer",
      ),
    ).toBe(
      "Dear Hiring Manager,\n\nI would welcome the conversation.\n\nKind regards,\n\nalex mercer",
    );
  });

  it("parses a closing when the signature sits after a blank line", () => {
    expect(
      extractProposalClosingBlockFromParagraphs([
        "Dear Hiring Manager,",
        "I would welcome the conversation.",
        "Kind regards,",
        "alex mercer",
      ]),
    ).toEqual({
      block: {
        signOff: "Kind regards,",
        signatureName: "alex mercer",
      },
      startIndex: 2,
    });
  });

  it("formats applicant signatures as lowercase", () => {
    expect(formatProposalSignatureName("Alex Mercer")).toBe("alex mercer");
  });

  it("updates legacy structured signatures from the latest applicant name once structured closing is active", () => {
    expect(
      resolveProposalClosingRef({
        closing: {
          enabled: true,
          signOff: "Sincerely,",
          signatureName: "jo",
          source: "legacy",
        },
        content: "Generated proposal body.\n\nSincerely,\njo",
        proposalType: "cover_letter",
        applicantName: "john",
        voicePreset: "signature",
      }),
    ).toMatchObject({
      signOff: "Sincerely,",
      signatureName: "john",
      source: "legacy",
    });
  });

  it("updates settings-owned structured signatures from the latest applicant name", () => {
    expect(
      resolveProposalClosingRef({
        closing: {
          enabled: true,
          signOff: "Sincerely,",
          signatureName: "A",
          source: "settings",
        },
        content: "Generated proposal body.",
        proposalType: "cover_letter",
        applicantName: "Alex Martin",
        voicePreset: "signature",
      }),
    ).toMatchObject({
      signOff: "Sincerely,",
      signatureName: "Alex Martin",
      source: "settings",
    });
  });

  it("resolves stale settings-owned structured signatures from the latest applicant name", () => {
    expect(
      resolveProposalClosingRef({
        closing: {
          enabled: true,
          signOff: "Sincerely,",
          signatureName: "b",
          source: "settings",
        },
        content: "Generated proposal body.",
        proposalType: "cover_letter",
        applicantName: "john",
        voicePreset: "signature",
      }),
    ).toMatchObject({
      enabled: true,
      signOff: "Sincerely,",
      signatureName: "john",
      source: "settings",
    });
  });

  it("preserves document-owned structured signatures over applicant name changes", () => {
    expect(
      resolveProposalClosingRef({
        closing: {
          enabled: true,
          signOff: "Sincerely,",
          signatureName: "Jordan Lee",
          source: "document",
        },
        content: "Generated proposal body.",
        proposalType: "cover_letter",
        applicantName: "Alex Martin",
        voicePreset: "signature",
      }),
    ).toMatchObject({
      signatureName: "Jordan Lee",
      source: "document",
    });
  });

  it("does not invent a signature block when the content has no closing sign-off", () => {
    expect(
      ensureProposalSignatureName(
        "Dear Hiring Manager,\n\nI would welcome the conversation.",
        "Alex Mercer",
      ),
    ).toBe("Dear Hiring Manager,\n\nI would welcome the conversation.");
  });

  it("rejects a non-signoff tail paragraph", () => {
    expect(
      parseProposalClosingBlock(
        "I would welcome the opportunity to discuss the role further.\nAlex Mercer",
      ),
    ).toBeNull();
  });

  it("builds export closing from structured metadata when body has no sign-off", () => {
    const source = buildProposalExportSource({
      content: "I build reliable exports.",
      proposalType: "cover_letter",
      documentTitle: "Application",
      documentMeta: "",
      contactLine: "",
      letterDate: "",
      recipientDetails: "",
      applicantHeader: {
        name: "Alex Mercer",
        role: "Designer",
      },
      headerVisibility: {
        showSender: true,
        showDate: true,
        showRecipient: true,
        showRecipientDetails: true,
        showSubject: true,
      },
      templateId: "swiss_margin",
      closing: {
        enabled: true,
        signOff: "Sincerely,",
        signatureName: "Alex Mercer",
        source: "settings",
      },
    });

    expect(getClosingBlock(source.body)).toEqual({
      type: "closing",
      signOff: "Sincerely,",
      signatureName: "Alex Mercer",
    });
  });

  it("removes legacy typed signature from export when structured closing is disabled", () => {
    const source = buildProposalExportSource({
      content: "I build reliable exports.\n\nSincerely,\nAlex Mercer",
      proposalType: "cover_letter",
      documentTitle: "Application",
      documentMeta: "",
      contactLine: "",
      letterDate: "",
      recipientDetails: "",
      applicantHeader: {
        name: "Alex Mercer",
        role: "Designer",
      },
      headerVisibility: {
        showSender: true,
        showDate: true,
        showRecipient: true,
        showRecipientDetails: true,
        showSubject: true,
      },
      templateId: "swiss_margin",
      closing: {
        enabled: false,
        signOff: "Sincerely,",
        signatureName: "Alex Mercer",
        source: "document",
      },
    });

    expect(source.body).toEqual([
      { type: "paragraph", text: "I build reliable exports." },
      {
        type: "closing",
        signOff: "Sincerely,",
        signatureName: "",
      },
    ]);
  });

  it("keeps structured sign-off in export when structured signature is disabled", () => {
    const source = buildProposalExportSource({
      content: "I build reliable exports.\n\nSincerely,\nAlex Mercer",
      proposalType: "cover_letter",
      documentTitle: "Application",
      documentMeta: "",
      contactLine: "",
      letterDate: "",
      recipientDetails: "",
      applicantHeader: {
        name: "Alex Mercer",
        role: "Designer",
      },
      headerVisibility: {
        showSender: true,
        showDate: true,
        showRecipient: true,
        showRecipientDetails: true,
        showSubject: true,
      },
      templateId: "swiss_margin",
      closing: {
        enabled: false,
        signOff: "Sincerely,",
        signatureName: "Alex Mercer",
        source: "settings",
      },
    });

    expect(source.body).toEqual([
      { type: "paragraph", text: "I build reliable exports." },
      {
        type: "closing",
        signOff: "Sincerely,",
        signatureName: "",
      },
    ]);
  });

  it("keeps preview and export in parity for French closing blocks", () => {
    const content =
      "Madame, Monsieur,\n\nJe construis des systemes fiables.\n\nBien cordialement,\nAlex Mercer";

    const exportClosing = getClosingBlock(buildProposalSource(content).body);
    const previewParsed = parseProposalDocumentContent(content, "cover_letter");

    expect(exportClosing).toEqual({
      type: "closing",
      signOff: "Bien cordialement,",
      signatureName: "Alex Mercer",
    });
    expect(previewParsed.signOff).toBe(exportClosing?.signOff ?? null);
    expect(previewParsed.signatureName).toBe(exportClosing?.signatureName ?? null);
  });

  it("keeps preview and export in parity for English closing blocks", () => {
    const content =
      "Dear Hiring Manager,\n\nI build reliable exports.\n\nSincerely,\nAlex Mercer";

    const exportClosing = getClosingBlock(buildProposalSource(content).body);
    const previewParsed = parseProposalDocumentContent(content, "cover_letter");

    expect(exportClosing).toEqual({
      type: "closing",
      signOff: "Sincerely,",
      signatureName: "Alex Mercer",
    });
    expect(previewParsed.signOff).toBe(exportClosing?.signOff ?? null);
    expect(previewParsed.signatureName).toBe(exportClosing?.signatureName ?? null);
  });

  it("preserves deterministic French cover-letter boundaries through export parsing", () => {
    const content = applyDeterministicProposalBoundaries({
      body: "Je construis des systemes fiables.",
      format: "cover_letter",
      outputLanguage: "French",
      candidateName: "Alex Mercer",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(getClosingBlock(buildProposalSource(content).body)).toEqual({
      type: "closing",
      signOff: "Cordialement,",
      signatureName: "Alex Mercer",
    });
  });

  it("preserves deterministic English cover-letter boundaries through export parsing", () => {
    const content = applyDeterministicProposalBoundaries({
      body: "I build reliable exports.",
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Alex Mercer",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(getClosingBlock(buildProposalSource(content).body)).toEqual({
      type: "closing",
      signOff: "Sincerely,",
      signatureName: "Alex Mercer",
    });
  });
});
