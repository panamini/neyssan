import { describe, expect, it } from "vitest";

import { applyDeterministicProposalBoundaries } from "../../../convex/lib/proposals/proposalRenderer";
import { parseProposalDocumentContent } from "../../components/proposal-render/ProposalDocumentRenderer";
import {
  buildProposalExportSource,
  type ProposalPrintBlock,
} from "../document-export-models";
import {
  FRENCH_COVER_LETTER_DEFAULT_SIGNOFF,
  ensureProposalSignatureName,
  extractProposalClosingBlockFromParagraphs,
  formatProposalSignatureName,
  parseProposalClosingBlock,
  resolveDefaultProposalSignOff,
  resolveProposalClosingOptionGroups,
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
    expect(
      parseProposalClosingBlock(`${FRENCH_COVER_LETTER_DEFAULT_SIGNOFF}\nAlex Mercer`),
    ).toEqual({
      signOff: FRENCH_COVER_LETTER_DEFAULT_SIGNOFF,
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

  it("resolves language and document-type aware default signoffs", () => {
    expect(
      resolveDefaultProposalSignOff({
        locale: "en",
        proposalType: "cover_letter",
      }),
    ).toEqual({ signOff: "Sincerely,", closingNeedsUserChoice: false });
    expect(
      resolveDefaultProposalSignOff({
        locale: "fr",
        proposalType: "cover_letter",
      }),
    ).toEqual({
      signOff: FRENCH_COVER_LETTER_DEFAULT_SIGNOFF,
      closingNeedsUserChoice: false,
    });
    expect(
      resolveDefaultProposalSignOff({
        locale: "es",
        proposalType: "cover_letter",
      }),
    ).toEqual({ signOff: "Atentamente,", closingNeedsUserChoice: false });
    expect(
      resolveDefaultProposalSignOff({
        locale: "fr",
        proposalType: "application_message",
      }),
    ).toEqual({ signOff: "Cordialement,", closingNeedsUserChoice: false });
    expect(
      resolveDefaultProposalSignOff({
        locale: "fr",
        proposalType: "freelance_proposal",
      }),
    ).toEqual({ signOff: "Bien cordialement,", closingNeedsUserChoice: false });
  });

  it("builds French cover-letter picker groups for the closing drawer", () => {
    expect(
      resolveProposalClosingOptionGroups({
        content: "Madame, Monsieur,\n\nJe construis des exports fiables.",
        proposalType: "cover_letter",
      }),
    ).toEqual([
      {
        id: "recommended",
        label: "Recommended",
        options: [FRENCH_COVER_LETTER_DEFAULT_SIGNOFF],
      },
      {
        id: "concise",
        label: "Concise",
        options: ["Cordialement,", "Bien cordialement,"],
      },
      {
        id: "classic",
        label: "Classic",
        options: [
          "Veuillez agréer, Madame, Monsieur, mes salutations distinguées.",
          "Je vous prie de recevoir, Madame, Monsieur, mes sincères salutations.",
        ],
      },
      {
        id: "custom",
        label: "Custom",
        options: [],
      },
    ]);
  });

  it("keeps cover-letter signoff independent from tone", () => {
    expect(
      resolveProposalClosingRef({
        content: "Dear Hiring Manager,\n\nI build reliable exports.",
        proposalType: "cover_letter",
        applicantName: "Alex Mercer",
        locale: "en",
        voicePreset: "engaging",
      }),
    ).toMatchObject({
      signOff: "Sincerely,",
      signatureName: "Alex Mercer",
      source: "language_default",
    });
  });

  it("lets document and settings closings win over language defaults", () => {
    expect(
      resolveProposalClosingRef({
        closing: {
          enabled: true,
          signOff: "Kind regards,",
          signatureName: "Document Name",
          source: "document",
        },
        content: "Madame, Monsieur,\n\nJe construis des exports fiables.",
        proposalType: "cover_letter",
        applicantName: "Alex Mercer",
        locale: "fr",
      }),
    ).toMatchObject({
      signOff: "Kind regards,",
      signatureName: "Document Name",
      source: "document",
    });

    expect(
      resolveProposalClosingRef({
        closing: {
          enabled: true,
          signOff: "Best regards,",
          signatureName: "",
          source: "settings",
        },
        content: "Madame, Monsieur,\n\nJe construis des exports fiables.",
        proposalType: "cover_letter",
        applicantName: "Alex Mercer",
        locale: "fr",
      }),
    ).toMatchObject({
      signOff: "Best regards,",
      signatureName: "Alex Mercer",
      source: "settings",
    });
  });

  it("does not fallback to English for explicitly unsupported languages", () => {
    expect(
      resolveProposalClosingRef({
        content: "Здравствуйте,\n\nЯ строю надежные документы.",
        proposalType: "cover_letter",
        applicantName: "Alex Mercer",
        locale: "ru",
      }),
    ).toMatchObject({
      enabled: true,
      signOff: "",
      signatureName: "Alex Mercer",
      source: "language_default",
      closingNeedsUserChoice: true,
    });

    expect(
      resolveProposalClosingRef({
        content: "Dear Hiring Manager,\n\nThis body was pasted manually.",
        proposalType: "cover_letter",
        applicantName: "Alex Mercer",
        locale: "ru",
      }),
    ).toMatchObject({
      signOff: "",
      closingNeedsUserChoice: true,
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
      signOff: FRENCH_COVER_LETTER_DEFAULT_SIGNOFF,
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
