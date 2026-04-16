import { describe, expect, it } from "vitest";

import { applyDeterministicProposalBoundaries } from "../../../convex/lib/proposals/proposalRenderer";
import { parseProposalDocumentContent } from "../../components/proposal-render/ProposalDocumentRenderer";
import {
  buildProposalExportSource,
  type ProposalPrintBlock,
} from "../document-export-models";
import { parseProposalClosingBlock } from "../proposal-closing";

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

  it("rejects a non-signoff tail paragraph", () => {
    expect(
      parseProposalClosingBlock(
        "I would welcome the opportunity to discuss the role further.\nAlex Mercer",
      ),
    ).toBeNull();
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
