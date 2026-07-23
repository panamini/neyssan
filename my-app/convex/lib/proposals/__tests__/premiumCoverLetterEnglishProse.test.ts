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
  it("keeps an infinitive bounded before the main finite predicate", () => {
    expect(
      analyze(
        "Managed services to help teams scale are central to reliable delivery.",
      ),
    ).toEqual([
      expect.objectContaining({
        section: "proofBlock",
        sentenceSpan: { start: 0, end: 70 },
        classification: "VALID",
        confidence: "high",
        reasonCodes: expect.arrayContaining([
          "bounded_infinitive",
          "main_finite_predicate_after_infinitive",
        ]),
        subjectSpan: { start: 0, end: 16 },
        finitePredicateSpan: { start: 37, end: 40 },
        infinitiveSpans: [{ start: 17, end: 36 }],
      }),
    ]);
  });

  it.each([
    "Managed client reporting to make teams grow.",
    "Managed client reporting to help teams grow.",
    "Managed reporting.",
  ])("keeps the verb-led fragment category invalid: %s", (text) => {
    const [result] = analyze(text);

    expect(result).toEqual(
      expect.objectContaining({
        classification: "INVALID",
        confidence: "high",
        reasonCodes: expect.arrayContaining([
          "verb_led_fragment",
          "missing_finite_predicate",
        ]),
        subjectSpan: null,
        finitePredicateSpan: null,
      }),
    );
  });

  it("reports exact spans for the known infinitive fragment category", () => {
    expect(analyze("Managed client reporting to make teams grow.")).toEqual([
      expect.objectContaining({
        sentenceSpan: { start: 0, end: 44 },
        infinitiveSpans: [{ start: 25, end: 43 }],
      }),
    ]);
  });

  it("segments Co., Corp., and U.S. without treating them as sentence ends", () => {
    expect(
      analyze("Example Corp. shipped results. U.S. teams coordinated work."),
    ).toEqual([
      expect.objectContaining({
        sentenceSpan: { start: 0, end: 30 },
      }),
      expect.objectContaining({
        sentenceSpan: { start: 31, end: 59 },
      }),
    ]);
    expect(analyze("Acme Co. delivered reports.")).toEqual([
      expect.objectContaining({
        sentenceSpan: { start: 0, end: 27 },
      }),
    ]);
  });

  it.each([
    {
      text: "Teams deliver results.",
      subjectSpan: { start: 0, end: 5 },
      finitePredicateSpan: { start: 6, end: 13 },
      reasonCode: "simple_subject",
    },
    {
      text: "The experienced teams deliver results.",
      subjectSpan: { start: 0, end: 21 },
      finitePredicateSpan: { start: 22, end: 29 },
      reasonCode: "modified_subject",
    },
    {
      text: "I and my colleague managed reporting.",
      subjectSpan: { start: 0, end: 18 },
      finitePredicateSpan: { start: 19, end: 26 },
      reasonCode: "coordinated_subject",
    },
  ])(
    "recognizes the $reasonCode category",
    ({ text, subjectSpan, finitePredicateSpan, reasonCode }) => {
      const [result] = analyze(text);

      expect(result).toEqual(
        expect.objectContaining({
          classification: "VALID",
          confidence: "high",
          subjectSpan,
          finitePredicateSpan,
          reasonCodes: expect.arrayContaining([reasonCode]),
        }),
      );
    },
  );

  it("does not confuse a relative predicate with the main predicate", () => {
    const [result] = analyze(
      "The teams that managed reporting improved delivery.",
    );

    expect(result).toEqual(
      expect.objectContaining({
        classification: "VALID",
        confidence: "high",
        subjectSpan: { start: 0, end: 9 },
        finitePredicateSpan: { start: 33, end: 41 },
        relativePredicateSpans: [{ start: 15, end: 22 }],
        reasonCodes: expect.arrayContaining(["relative_clause"]),
      }),
    );
  });

  it("stops an unknown relative predicate at a punctuation boundary", () => {
    expect(
      analyze(
        "Supported by tools that customers use, the workflow improves delivery.",
      ),
    ).toEqual([
      expect.objectContaining({
        classification: "VALID",
        confidence: "high",
        subjectSpan: { start: 39, end: 51 },
        finitePredicateSpan: { start: 52, end: 60 },
        relativePredicateSpans: [],
      }),
    ]);
  });

  it.each(["The work.", "The support."])(
    "keeps nominal homographs conservative: %s",
    (text) => {
      const [result] = analyze(text);

      expect(result).toEqual(
        expect.objectContaining({
          classification: "UNKNOWN",
          confidence: "low",
          subjectSpan: null,
          finitePredicateSpan: null,
          reasonCodes: ["ambiguous_clause_structure"],
        }),
      );
    },
  );

  it("rejects a fronted participial fragment with a nominal homograph", () => {
    const [result] = analyze("Built on user research, my work.");

    expect(result).toEqual(
      expect.objectContaining({
        classification: "INVALID",
        confidence: "high",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: expect.arrayContaining([
          "verb_led_fragment",
          "missing_finite_predicate",
        ]),
      }),
    );
  });

  it("selects the finite predicate after a nominal homograph", () => {
    expect(analyze("Work improves delivery.")).toEqual([
      expect.objectContaining({
        classification: "VALID",
        confidence: "high",
        subjectSpan: { start: 0, end: 4 },
        finitePredicateSpan: { start: 5, end: 13 },
      }),
    ]);
  });

  it("selects the main predicate after a relative clause with a nominal homograph", () => {
    expect(
      analyze("The work that teams review improves outcomes."),
    ).toEqual([
      expect.objectContaining({
        classification: "VALID",
        confidence: "high",
        subjectSpan: { start: 0, end: 8 },
        finitePredicateSpan: { start: 27, end: 35 },
        relativePredicateSpans: [{ start: 20, end: 26 }],
        reasonCodes: expect.arrayContaining(["relative_clause"]),
      }),
    ]);
  });

  it.each([
    {
      text: "Supported by product data, teams improved workflows.",
      subjectSpan: { start: 27, end: 32 },
      finitePredicateSpan: { start: 33, end: 41 },
    },
    {
      text: "Built on user research, my work emphasizes reliable delivery.",
      subjectSpan: { start: 24, end: 31 },
      finitePredicateSpan: { start: 32, end: 42 },
    },
  ])(
    "bounds the main subject after a fronted clause: $text",
    ({ text, subjectSpan, finitePredicateSpan }) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "VALID",
          confidence: "high",
          subjectSpan,
          finitePredicateSpan,
        }),
      ]);
    },
  );

  it.each([
    {
      text: "Built on research, I collaborated with teams.",
      finitePredicateSpan: { start: 21, end: 33 },
    },
    {
      text: "Built on research, I partnered with teams.",
      finitePredicateSpan: { start: 21, end: 30 },
    },
  ])(
    "accepts an unlisted past predicate before a prepositional complement: $text",
    ({ text, finitePredicateSpan }) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "VALID",
          confidence: "high",
          subjectSpan: { start: 19, end: 20 },
          finitePredicateSpan,
        }),
      ]);
    },
  );

  it("keeps a reduced-participle verb-led fragment invalid", () => {
    expect(
      analyze(
        "Led a design-system migration used across four product squads.",
      ),
    ).toEqual([
      expect.objectContaining({
        classification: "INVALID",
        confidence: "high",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: expect.arrayContaining([
          "verb_led_fragment",
          "missing_finite_predicate",
        ]),
      }),
    ]);
  });

  it.each([
    {
      text: "Managed client support.",
      classification: "INVALID",
      confidence: "high",
      subjectSpan: null,
      finitePredicateSpan: null,
    },
    {
      text: "Managed process support.",
      classification: "INVALID",
      confidence: "high",
      subjectSpan: null,
      finitePredicateSpan: null,
    },
    {
      text: "Managed clients support teams.",
      classification: "VALID",
      confidence: "high",
      subjectSpan: { start: 0, end: 15 },
      finitePredicateSpan: { start: 16, end: 23 },
    },
    {
      text: "Managed processes support teams.",
      classification: "VALID",
      confidence: "high",
      subjectSpan: { start: 0, end: 17 },
      finitePredicateSpan: { start: 18, end: 25 },
    },
  ])(
    "uses subject agreement to disambiguate a base-form predicate: $text",
    ({
      text,
      classification,
      confidence,
      subjectSpan,
      finitePredicateSpan,
    }) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification,
          confidence,
          subjectSpan,
          finitePredicateSpan,
        }),
      ]);
    },
  );

  it("does not let an infinitive capture a finite verb from another clause", () => {
    const [result] = analyze(
      "Teams work to improve delivery while managers review results.",
    );

    expect(result).toEqual(
      expect.objectContaining({
        classification: "VALID",
        finitePredicateSpan: { start: 6, end: 10 },
        infinitiveSpans: [{ start: 11, end: 30 }],
        reasonCodes: expect.arrayContaining(["bounded_infinitive"]),
      }),
    );
  });

  it("bounds a coordinated clause after an infinitive", () => {
    expect(
      analyze(
        "Teams work to improve delivery, and managers review results.",
      ),
    ).toEqual([
      expect.objectContaining({
        classification: "VALID",
        subjectSpan: { start: 0, end: 5 },
        finitePredicateSpan: { start: 6, end: 10 },
        infinitiveSpans: [{ start: 11, end: 30 }],
      }),
    ]);
  });

  it("bounds a clause after an infinitive without requiring a coordinator", () => {
    expect(
      analyze(
        "Built to improve delivery, the workflow supports teams.",
      ),
    ).toEqual([
      expect.objectContaining({
        classification: "VALID",
        confidence: "high",
        subjectSpan: { start: 27, end: 39 },
        finitePredicateSpan: { start: 40, end: 48 },
        infinitiveSpans: [{ start: 6, end: 25 }],
      }),
    ]);
  });

  it("preserves coordinated verbs inside an infinitive", () => {
    expect(
      analyze("Teams work to build and deliver reliable systems."),
    ).toEqual([
      expect.objectContaining({
        classification: "VALID",
        subjectSpan: { start: 0, end: 5 },
        finitePredicateSpan: { start: 6, end: 10 },
        infinitiveSpans: [{ start: 11, end: 48 }],
      }),
    ]);
  });

  it("identifies a grammatical imperative without declaring it invalid", () => {
    const [result] = analyze("Submit reports promptly.");

    expect(result).toEqual(
      expect.objectContaining({
        classification: "VALID",
        confidence: "high",
        sentenceForm: "imperative",
        subjectSpan: null,
        finitePredicateSpan: { start: 0, end: 6 },
        reasonCodes: expect.arrayContaining(["imperative_form"]),
      }),
    );
  });

  it.each([
    "Work improves delivery.",
    "The work that teams review improves outcomes.",
    "Supported by product data, teams improved workflows.",
    "Built on user research, my work emphasizes reliable delivery.",
    "Teams work to improve delivery, and managers review results.",
    "Submit reports promptly.",
  ])(
    "requires a plausible subject and predicate for VALID/high: %s",
    (text) => {
      const [result] = analyze(text);

      expect(result).toEqual(
        expect.objectContaining({
          classification: "VALID",
          confidence: "high",
          finitePredicateSpan: expect.any(Object),
        }),
      );
      if (result.sentenceForm !== "imperative") {
        expect(result.subjectSpan).not.toBeNull();
      }
    },
  );

  it("exposes an ambiguous clause as UNKNOWN", () => {
    expect(analyze("Aligned for delivery.")).toEqual([
      expect.objectContaining({
        classification: "UNKNOWN",
        confidence: "low",
        sentenceForm: "unknown",
        subjectSpan: null,
        finitePredicateSpan: null,
        infinitiveSpans: [],
        reasonCodes: ["ambiguous_clause_structure"],
      }),
    ]);
  });

  it("classifies grammar categories without literal sentence exceptions", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "convex/lib/proposals/premiumCoverLetterEnglishProse.ts",
      ),
      "utf8",
    );

    expect(source).not.toMatch(
      /(?:text|sentence)\s*={2,3}\s*["'`]|\.includes\(\s*["'`][A-Za-z]/u,
    );
    expect(source).not.toContain(
      "Managed client reporting to make teams grow.",
    );
    expect(source).not.toContain(
      "Managed services to help teams scale are central to reliable delivery.",
    );
    expect(source).not.toContain('"collaborated"');
    expect(source).not.toContain('"partnered"');
  });
});
