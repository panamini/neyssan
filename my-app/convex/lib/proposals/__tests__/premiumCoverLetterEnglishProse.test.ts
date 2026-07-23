import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  analyzePremiumCoverLetterEnglishProseSection,
  type PremiumCoverLetterEnglishProseAnalysis,
} from "../premiumCoverLetterEnglishProse";

function analyze(
  text: string,
): readonly PremiumCoverLetterEnglishProseAnalysis[] {
  return analyzePremiumCoverLetterEnglishProseSection({
    section: "proofBlock",
    text,
  });
}

describe("premium cover-letter English prose module", () => {
  it("accepts the required bounded-infinitive sentence", () => {
    expect(
      analyze(
        "Managed services to help teams scale are central to reliable delivery.",
      ),
    ).toEqual([
      expect.objectContaining({
        classification: "VALID",
        confidence: "high",
        sentenceSpan: { start: 0, end: 70 },
        subjectSpan: { start: 0, end: 16 },
        finitePredicateSpan: { start: 37, end: 40 },
        infinitiveSpans: [{ start: 17, end: 36 }],
        reasonCodes: expect.arrayContaining([
          "bounded_infinitive",
          "main_finite_predicate_after_infinitive",
        ]),
      }),
    ]);
  });

  it.each([
    "Managed client reporting to make teams grow.",
    "Managed client reporting to help teams grow.",
    "Managed reporting.",
    "Built the handoff plan.",
  ])("rejects the proven verb-led fragment: %s", (text) => {
    expect(analyze(text)[0]).toEqual(
      expect.objectContaining({
        classification: "INVALID",
        confidence: "high",
        sentenceForm: "fragment",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: [
          "verb_led_fragment",
          "missing_finite_predicate",
        ],
      }),
    );
  });

  it.each([
    "When teams deliver, performance excels.",
    "At the core are reliable processes.",
    "If needed our team can help.",
    "Across teams collaboration flourishes.",
    "Aligned with clear goals, people excel.",
    "Did the project succeed?",
    "Was the rollout effective?",
  ])("observes an uncertain structure instead of blocking it: %s", (text) => {
    expect(analyze(text)[0]).toEqual(
      expect.objectContaining({
        classification: "UNKNOWN",
        confidence: "low",
        sentenceForm: "unknown",
        reasonCodes: ["ambiguous_clause_structure"],
      }),
    );
  });

  it.each([
    "Teams coordinate delivery.",
    "The capable team delivers results.",
    "Operations and finance are aligned.",
    "The team that is stable delivers results.",
    "Submit the report.",
  ])("accepts a POS-supported complete form: %s", (text) => {
    expect(analyze(text)[0]).toEqual(
      expect.objectContaining({
        classification: "VALID",
        confidence: "high",
      }),
    );
  });

  it("keeps relative and infinitive predicates out of the main predicate", () => {
    const [relative] = analyze(
      "The team that is stable delivers results.",
    );
    const [infinitive] = analyze(
      "Services to help teams grow are useful.",
    );

    expect(relative).toEqual(
      expect.objectContaining({
        finitePredicateSpan: { start: 24, end: 32 },
        relativePredicateSpans: [{ start: 14, end: 16 }],
        reasonCodes: expect.arrayContaining(["relative_clause"]),
      }),
    );
    expect(infinitive).toEqual(
      expect.objectContaining({
        finitePredicateSpan: { start: 28, end: 31 },
        infinitiveSpans: [{ start: 9, end: 27 }],
      }),
    );
  });

  it.each([
    "Built on user research, that approach delivers.",
    "Aligned with clear goals, that team supports delivery.",
  ])("does not treat a post-comma demonstrative as relative: %s", (text) => {
    expect(analyze(text)[0]).toEqual(
      expect.objectContaining({
        classification: "UNKNOWN",
        relativePredicateSpans: [],
      }),
    );
  });

  it("keeps a demonstrative determiner out of relative-clause evidence", () => {
    expect(analyze("The skills from that role are useful.")[0]).toEqual(
      expect.objectContaining({
        classification: "VALID",
        relativePredicateSpans: [],
      }),
    );
  });

  it("bounds an infinitive before a structurally tagged subordinate clause", () => {
    expect(
      analyze(
        "Teams work to improve delivery while managers review results.",
      )[0],
    ).toEqual(
      expect.objectContaining({
        classification: "VALID",
        infinitiveSpans: [{ start: 11, end: 30 }],
      }),
    );
  });

  it("keeps coordinated verbs inside the same infinitive span", () => {
    expect(
      analyze("The team plans to build and deliver reliable systems.")[0],
    ).toEqual(
      expect.objectContaining({
        infinitiveSpans: [{ start: 15, end: 52 }],
      }),
    );
  });

  it("segments common organization abbreviations without splitting them", () => {
    expect(
      analyze("Example Corp. shipped results. U.S. teams coordinate work."),
    ).toEqual([
      expect.objectContaining({
        text: "Example Corp. shipped results.",
        sentenceSpan: { start: 0, end: 30 },
      }),
      expect.objectContaining({
        text: "U.S. teams coordinate work.",
        sentenceSpan: { start: 31, end: 58 },
      }),
    ]);
    expect(analyze("Acme Co. delivered reports.")).toHaveLength(1);
  });

  it("splits a terminal initialism before a lowercase-styled proper name", () => {
    expect(
      analyze("I worked in the U.S. npm supports reliable delivery."),
    ).toEqual([
      expect.objectContaining({
        text: "I worked in the U.S.",
        sentenceSpan: { start: 0, end: 20 },
      }),
      expect.objectContaining({
        text: "npm supports reliable delivery.",
        sentenceSpan: { start: 21, end: 52 },
      }),
    ]);
  });

  it("splits after a terminal organization abbreviation", () => {
    expect(analyze("I joined Acme Corp. I improved reporting.").map(
      ({ text }) => text,
    )).toEqual([
      "I joined Acme Corp.",
      "I improved reporting.",
    ]);
  });

  it("preserves a dotted initialism inside a proper company name", () => {
    expect(analyze("U.S. Bank supports delivery.")).toEqual([
      expect.objectContaining({
        text: "U.S. Bank supports delivery.",
      }),
    ]);
  });

  it("uses clause structure to disambiguate a dotted initialism boundary", () => {
    expect(
      analyze("I served in the U.S. Army and improved reporting."),
    ).toEqual([
      expect.objectContaining({
        text: "I served in the U.S. Army and improved reporting.",
        sentenceSpan: { start: 0, end: 49 },
      }),
    ]);
    expect(
      analyze("I served in the U.S. Tomorrow I improved reporting."),
    ).toEqual([
      expect.objectContaining({
        text: "I served in the U.S.",
        sentenceSpan: { start: 0, end: 20 },
      }),
      expect.objectContaining({
        text: "Tomorrow I improved reporting.",
        sentenceSpan: { start: 21, end: 51 },
      }),
    ]);
  });

  it("keeps a multi-token proper name attached across an initialism", () => {
    expect(
      analyze(
        "I worked for U.S. Department of Defense and improved reporting.",
      ),
    ).toEqual([
      expect.objectContaining({
        text: "I worked for U.S. Department of Defense and improved reporting.",
        sentenceSpan: { start: 0, end: 63 },
      }),
    ]);
  });

  it("splits before a coordinated nominal subject with a finite predicate", () => {
    expect(
      analyze(
        "I worked in the U.S. Salesforce and improved reporting were priorities.",
      ),
    ).toEqual([
      expect.objectContaining({
        text: "I worked in the U.S.",
        sentenceSpan: { start: 0, end: 20 },
      }),
      expect.objectContaining({
        text: "Salesforce and improved reporting were priorities.",
        sentenceSpan: { start: 21, end: 71 },
      }),
    ]);
  });

  it("looks through an organization abbreviation for the next predicate", () => {
    expect(
      analyze("I worked in the U.S. Acme Inc. filed the report."),
    ).toEqual([
      expect.objectContaining({
        text: "I worked in the U.S.",
        sentenceSpan: { start: 0, end: 20 },
      }),
      expect.objectContaining({
        text: "Acme Inc. filed the report.",
        sentenceSpan: { start: 21, end: 48 },
      }),
    ]);
  });

  it("preserves Unicode offsets in subject and predicate spans", () => {
    expect(analyze("Élodie delivers results.")[0]).toEqual(
      expect.objectContaining({
        classification: "VALID",
        subjectSpan: { start: 0, end: 6 },
        finitePredicateSpan: { start: 7, end: 15 },
      }),
    );
  });

  it("returns one bounded analysis per sentence and preserves section", () => {
    expect(analyze("Teams coordinate. Managed reporting.")).toEqual([
      expect.objectContaining({
        section: "proofBlock",
        text: "Teams coordinate.",
        sentenceSpan: { start: 0, end: 17 },
      }),
      expect.objectContaining({
        section: "proofBlock",
        text: "Managed reporting.",
        sentenceSpan: { start: 18, end: 36 },
      }),
    ]);
  });

  it("uses one POS adapter without general-parser lexical fallbacks", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "convex/lib/proposals/premiumCoverLetterEnglishProse.ts",
      ),
      "utf8",
    );

    expect(source).toContain("wink-pos-tagger");
    expect(source).not.toMatch(
      /\b(?:FINITE_LEXICAL_FORMS|BASE_INFINITIVE_VERBS|ADDITIONAL_FINITE_BASE_FORMS|IMPERATIVE_VERBS|VERB_LED_PARTICIPLES)\b/u,
    );
    expect(source).not.toContain(
      "Managed client reporting to make teams grow.",
    );
    expect(source).not.toContain(
      "Managed services to help teams scale are central",
    );
    expect(source).not.toContain("Army");
    expect(source).not.toContain("Tomorrow");
    expect(source).not.toContain("Department of Defense");
    expect(source).not.toContain("Salesforce");
    expect(source).not.toContain("Acme Inc.");
  });
});
