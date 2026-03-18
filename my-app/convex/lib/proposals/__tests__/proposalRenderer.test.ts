import { describe, expect, it } from "vitest";

import {
  ENGLISH_APPLICATION_MESSAGE_FINAL_SENTENCE,
  ENGLISH_SAFE_FINAL_SENTENCES,
  FRENCH_APPLICATION_MESSAGE_FINAL_SENTENCE,
  FRENCH_SAFE_FINAL_SENTENCES,
  applyDeterministicProposalBoundaries,
  getDeterministicProposalRenderPolicy,
  parseStructuredApplicationMessageParts,
  renderStructuredApplicationMessage,
  renderStructuredCoverLetter,
} from "../proposalRenderer";

describe("proposal renderer", () => {
  it("uses multiple safe cover-letter closing variants across presets and modes", () => {
    const englishStandardClosings = new Set(
      (["signature", "expert", "direct", "engaging", "storyteller"] as const).map(
        (voicePreset) =>
          getDeterministicProposalRenderPolicy({
            format: "cover_letter",
            outputLanguage: "English",
            voicePreset,
            noContextMode: false,
          }).finalSentence,
      ),
    );
    const englishInterestClosings = new Set(
      (["signature", "expert", "direct", "engaging", "storyteller"] as const).map(
        (voicePreset) =>
          getDeterministicProposalRenderPolicy({
            format: "cover_letter",
            outputLanguage: "English",
            voicePreset,
            noContextMode: true,
          }).finalSentence,
      ),
    );

    expect(englishStandardClosings.size).toBe(5);
    expect(englishInterestClosings.size).toBe(5);
  });

  it("keeps every deterministic closing variant within the safe discussion-only class", () => {
    const unsafePattern =
      /\b(?:contribute|support|help|bring|apply|ready|readiness|value|perform|deliver|ensure|improve|assist)\b/i;

    for (const variant of [
      ...ENGLISH_SAFE_FINAL_SENTENCES.standard,
      ...ENGLISH_SAFE_FINAL_SENTENCES.interestOnly,
      ...FRENCH_SAFE_FINAL_SENTENCES.standard,
      ...FRENCH_SAFE_FINAL_SENTENCES.interestOnly,
    ]) {
      expect(variant).not.toMatch(unsafePattern);
      expect(variant).toMatch(
        /(?:discuss|chance|opportunity|speak|échanger|discuter|poursuivre)/i,
      );
    }
  });

  it("selects the same closing deterministically for the same inputs", () => {
    const first = getDeterministicProposalRenderPolicy({
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "direct",
      noContextMode: false,
    }).finalSentence;
    const second = getDeterministicProposalRenderPolicy({
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "direct",
      noContextMode: false,
    }).finalSentence;

    expect(first).toBe(second);
  });

  it("can produce different safe closings when eligible cover-letter inputs differ", () => {
    const signatureClosing = getDeterministicProposalRenderPolicy({
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: false,
    }).finalSentence;
    const directClosing = getDeterministicProposalRenderPolicy({
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "direct",
      noContextMode: false,
    }).finalSentence;

    expect(signatureClosing).not.toBe(directClosing);
  });

  it("uses a lighter recruiter-facing follow-up line for application messages", () => {
    expect(
      getDeterministicProposalRenderPolicy({
        format: "application_message",
        outputLanguage: "English",
        voicePreset: "signature",
        noContextMode: false,
      }),
    ).toMatchObject({
      finalSentence: ENGLISH_APPLICATION_MESSAGE_FINAL_SENTENCE,
      includeCandidateNameLine: false,
    });

    expect(
      getDeterministicProposalRenderPolicy({
        format: "application_message",
        outputLanguage: "French",
        voicePreset: "direct",
        noContextMode: true,
      }),
    ).toMatchObject({
      finalSentence: FRENCH_APPLICATION_MESSAGE_FINAL_SENTENCE,
      includeCandidateNameLine: false,
    });
  });

  it("renders application messages as one paragraph with the follow-up inline", () => {
    const rendered = applyDeterministicProposalBoundaries({
      body: [
        "I handled daily chat support for SaaS customers.",
        "",
        "I also documented recurring issues into internal help content.",
      ].join("\n"),
      format: "application_message",
      outputLanguage: "English",
      candidateName: "Alex Martin",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(rendered).toBe(
      "I handled daily chat support for SaaS customers. I also documented recurring issues into internal help content. If useful, I can share a bit more detail.",
    );
  });

  it("parses a structured application-message parts block", () => {
    expect(
      parseStructuredApplicationMessageParts([
        "opener: I’m reaching out about the Customer Support Specialist role because the day-to-day email work is familiar ground for me.",
        "proof_line: At CloudLane, I handled daily chat and email queues and documented recurring issues into internal help content.",
        "follow_up_line: Happy to share the CloudLane example that maps most closely if helpful.",
      ].join("\n")),
    ).toEqual({
      opener:
        "I’m reaching out about the Customer Support Specialist role because the day-to-day email work is familiar ground for me.",
      proofLine:
        "At CloudLane, I handled daily chat and email queues and documented recurring issues into internal help content.",
      followUpLine:
        "Happy to share the CloudLane example that maps most closely if helpful.",
    });
  });

  it("renders structured application-message parts into one paragraph", () => {
    expect(
      renderStructuredApplicationMessage({
        parts: {
          opener:
            "I’m reaching out about the Customer Support Specialist role because the day-to-day email work is familiar ground for me",
          proofLine:
            "At CloudLane, I handled daily chat and email queues and documented recurring issues into internal help content.",
          followUpLine:
            "Happy to share the CloudLane example that maps most closely if helpful",
        },
      }).content,
    ).toBe(
      "I’m reaching out about the Customer Support Specialist role because the day-to-day email work is familiar ground for me. At CloudLane, I handled daily chat and email queues and documented recurring issues into internal help content. Happy to share the CloudLane example that maps most closely if helpful.",
    );
  });

  it("renders a deterministic cover letter around body-only paragraphs", () => {
    const rendered = renderStructuredCoverLetter({
      bodyParagraphs: [
        "I led a design system migration used across 4 product squads.",
        "I improved signup conversion by 11 percent through iterative UI experiments.",
      ],
      outputLanguage: "English",
      candidateName: "Alex Martin",
      voicePreset: "direct",
      noContextMode: false,
    });

    expect(rendered.content).toBe(
      [
        "Dear Hiring Manager,",
        "",
        "I led a design system migration used across 4 product squads.",
        "",
        "I improved signup conversion by 11 percent through iterative UI experiments.",
        "",
        "I would welcome the opportunity to speak further about the position.",
        "",
        "Best regards,",
        "Alex Martin",
      ].join("\n"),
    );
    expect(rendered.sections).toEqual([
      {
        type: "text",
        content: rendered.content,
      },
    ]);
  });

  it("keeps body prose intact instead of doing lexical cleanup", () => {
    const rendered = applyDeterministicProposalBoundaries({
      body: [
        "My background aligns with complex product environments.",
        "",
        "I improved signup conversion by 11 percent through iterative UI experiments.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Alex Martin",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(rendered).toContain(
      "My background aligns with complex product environments.",
    );
    expect(rendered).toContain(
      "I would welcome the opportunity to discuss the position further.",
    );
  });

  it("reapplies deterministic boundaries after a repaired body", () => {
    const rendered = applyDeterministicProposalBoundaries({
      body: [
        "I built customer-facing React features for product teams.",
        "",
        "My work involved performance optimization and experimentation support.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "French",
      candidateName: "Camille Bernard",
      voicePreset: "expert",
      noContextMode: false,
    });

    expect(rendered).toBe(
      [
        "Madame, Monsieur,",
        "",
        "I built customer-facing React features for product teams.",
        "",
        "My work involved performance optimization and experimentation support.",
        "",
        "Je serais disponible pour discuter davantage du poste.",
        "",
        "Bien cordialement,",
        "Camille Bernard",
      ].join("\n"),
    );
  });
});
