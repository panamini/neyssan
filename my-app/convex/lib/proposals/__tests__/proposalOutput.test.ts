import { describe, expect, it } from "vitest";

import {
  buildProposalOutputLanguageInstruction,
  getCoverLetterClosingInstruction,
  getCoverLetterSalutationInstruction,
  getProposalTitleFallback,
  resolveRegeneratedProposalTitle,
  resolveProposalOutputLanguage,
  resolveStoredProposalTitle,
} from "../proposalOutput";

describe("resolveStoredProposalTitle", () => {
  it("prefers the provided job title when it is usable", () => {
    expect(
      resolveStoredProposalTitle({
        jobTitle: "Senior Product Designer",
        parsedTitle: "Custom letter title",
        format: "cover_letter",
      }),
    ).toBe("Senior Product Designer");
  });

  it("ignores placeholder job titles and falls back to a parsed title", () => {
    expect(
      resolveStoredProposalTitle({
        jobTitle: "No Title Found",
        parsedTitle: "Senior Product Designer",
        format: "cover_letter",
      }),
    ).toBe("Senior Product Designer");
  });

  it("uses a meaningful format fallback when no usable title exists", () => {
    expect(
      resolveStoredProposalTitle({
        jobTitle: "Untitled",
        parsedTitle: "  ",
        format: "application_message",
      }),
    ).toBe(getProposalTitleFallback("application_message"));
  });
});

describe("resolveProposalOutputLanguage", () => {
  it("defaults French output for French job descriptions", () => {
    expect(
      resolveProposalOutputLanguage(
        "Bonjour, nous recherchons un développeur frontend pour rejoindre notre équipe à Paris.",
      ),
    ).toBe("French");
  });

  it("defaults English output for non-French job descriptions", () => {
    expect(
      resolveProposalOutputLanguage(
        "We are looking for a frontend engineer to join our remote product team.",
      ),
    ).toBe("English");
  });

  it("keeps English when an English JD contains one isolated French token", () => {
    expect(
      resolveProposalOutputLanguage(
        "FTS Protection is hiring an Armed Security Officer. Direct message or send your résumé to www.example.com.",
      ),
    ).toBe("English");
  });

  it("stays deterministic for mixed-language job descriptions", () => {
    expect(
      resolveProposalOutputLanguage(
        "We are looking for a security officer to join our team in New York. Poste base a Paris pour coordination occasionnelle.",
      ),
    ).toBe("English");
  });
});

describe("resolveRegeneratedProposalTitle", () => {
  it("adds a regenerated suffix to a usable title", () => {
    expect(
      resolveRegeneratedProposalTitle({
        currentTitle: "Senior Product Designer",
        format: "cover_letter",
      }),
    ).toBe("Senior Product Designer — Regenerated");
  });

  it("increments an existing regenerated suffix", () => {
    expect(
      resolveRegeneratedProposalTitle({
        currentTitle: "Senior Product Designer — Regenerated",
        format: "cover_letter",
      }),
    ).toBe("Senior Product Designer — Regenerated 2");
  });

  it("falls back safely when the current title is unusable", () => {
    expect(
      resolveRegeneratedProposalTitle({
        currentTitle: "No Title Found",
        format: "application_message",
      }),
    ).toBe("Untitled application message — Regenerated");
  });
});

describe("buildProposalOutputLanguageInstruction", () => {
  it("explicitly prevents CV language from overriding French output", () => {
    expect(buildProposalOutputLanguageInstruction("French")).toContain(
      "candidate background or CV is in English",
    );
  });

  it("enforces language consistency for greetings and closings", () => {
    expect(buildProposalOutputLanguageInstruction("French")).toContain(
      "Dear Hiring Manager",
    );
    expect(buildProposalOutputLanguageInstruction("English")).toContain(
      "Madame, Monsieur",
    );
  });
});

describe("cover letter boundary instructions", () => {
  it("uses a French salutation and closing when the job post is French", () => {
    expect(getCoverLetterSalutationInstruction("French")).toContain(
      "Madame, Monsieur",
    );
    expect(getCoverLetterClosingInstruction("French")).toContain(
      "Cordialement",
    );
  });

  it("uses an English salutation and closing when the job post is English", () => {
    expect(getCoverLetterSalutationInstruction("English")).toContain(
      "Dear Hiring Manager",
    );
    expect(getCoverLetterClosingInstruction("English")).toContain(
      "Sincerely",
    );
  });
});
