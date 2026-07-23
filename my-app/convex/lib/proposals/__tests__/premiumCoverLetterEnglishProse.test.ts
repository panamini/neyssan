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

  it.each(["U.S.", "U.K."])(
    "splits after %s before a lowercase-styled proper-name sentence",
    (abbreviation) => {
      const text = `I worked in the ${abbreviation} npm supports reliable delivery.`;

      expect(analyze(text)).toEqual([
        expect.objectContaining({
          text: `I worked in the ${abbreviation}`,
          sentenceSpan: { start: 0, end: 20 },
          classification: "VALID",
          subjectSpan: { start: 0, end: 1 },
          finitePredicateSpan: { start: 2, end: 8 },
        }),
        expect.objectContaining({
          text: "npm supports reliable delivery.",
          sentenceSpan: { start: 21, end: 52 },
          classification: "VALID",
          subjectSpan: { start: 21, end: 24 },
          finitePredicateSpan: { start: 25, end: 33 },
        }),
      ]);
    },
  );

  it.each([
    "Teams deliver results; The work.",
    "Teams deliver results; Aligned for delivery.",
    "Teams deliver results; Because managers review outcomes.",
    "Teams deliver results; With a manager supports delivery.",
  ])("rejects an incomplete semicolon-delimited clause: %s", (text) => {
    expect(analyze(text)).toEqual([
      expect.objectContaining({
        text,
        sentenceSpan: { start: 0, end: text.length },
        classification: "INVALID",
        confidence: "high",
        sentenceForm: "fragment",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: [
          "semicolon_clause_fragment",
          "missing_finite_predicate",
        ],
      }),
    ]);
  });

  it.each([
    "Teams deliver results; Managers review outcomes.",
    "Teams deliver results; Submit reports.",
  ])("accepts complete semicolon-delimited independent clauses: %s", (text) => {
    expect(analyze(text)).toEqual([
      expect.objectContaining({
        text,
        sentenceSpan: { start: 0, end: text.length },
        classification: "VALID",
        confidence: "high",
        subjectSpan: { start: 0, end: 5 },
        finitePredicateSpan: { start: 6, end: 13 },
        reasonCodes: expect.arrayContaining(["finite_predicate"]),
      }),
    ]);
  });

  it("keeps an unsupported semicolon clause conservative", () => {
    const text = "Teams deliver results; Managers create outcomes.";
    expect(analyze(text)).toEqual([
      expect.objectContaining({
        text,
        sentenceSpan: { start: 0, end: text.length },
        classification: "UNKNOWN",
        confidence: "low",
        sentenceForm: "unknown",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: ["ambiguous_clause_structure"],
      }),
    ]);
  });

  it("keeps a comma-bounded participial modifier conservative inside a semicolon clause", () => {
    const text =
      "Teams deliver results; aligned with clear goals, people excel.";
    expect(analyze(text)).toEqual([
      expect.objectContaining({
        text,
        sentenceSpan: { start: 0, end: text.length },
        classification: "UNKNOWN",
        confidence: "low",
        sentenceForm: "unknown",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: ["ambiguous_clause_structure"],
      }),
    ]);
  });

  it("accepts a comma-bounded participial modifier with a recognized semicolon-clause predicate", () => {
    const text =
      "Teams deliver results; aligned with clear goals, teams support delivery.";
    expect(analyze(text)).toEqual([
      expect.objectContaining({
        text,
        sentenceSpan: { start: 0, end: text.length },
        classification: "VALID",
        confidence: "high",
        subjectSpan: { start: 0, end: 5 },
        finitePredicateSpan: { start: 6, end: 13 },
        reasonCodes: expect.arrayContaining(["finite_predicate"]),
      }),
    ]);
  });

  it.each([
    "Review the data; update the records.",
    "Submit the report; archive the evidence.",
  ])("keeps an unlisted semicolon imperative conservative: %s", (text) => {
    expect(analyze(text)).toEqual([
      expect.objectContaining({
        text,
        sentenceSpan: { start: 0, end: text.length },
        classification: "UNKNOWN",
        confidence: "low",
        sentenceForm: "unknown",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: ["ambiguous_clause_structure"],
      }),
    ]);
  });

  it("keeps a determiner-led nominal semicolon fragment invalid", () => {
    expect(analyze("Review the data; The records.")).toEqual([
      expect.objectContaining({
        classification: "INVALID",
        confidence: "high",
        sentenceForm: "fragment",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: [
          "semicolon_clause_fragment",
          "missing_finite_predicate",
        ],
      }),
    ]);
  });

  it.each([
    "Managed teams create reliable workflows.",
    "Built systems transform operations.",
  ])(
    "keeps an unsupported base predicate after a participial-homograph subject conservative: %s",
    (text) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "UNKNOWN",
          confidence: "low",
          subjectSpan: null,
          finitePredicateSpan: null,
          reasonCodes: ["ambiguous_clause_structure"],
        }),
      ]);
    },
  );

  it.each([
    "Managed teams create efficiently.",
    "Built system transforms reliably.",
  ])(
    "keeps an unsupported present predicate followed by an adverb conservative: %s",
    (text) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "UNKNOWN",
          confidence: "low",
          subjectSpan: null,
          finitePredicateSpan: null,
          reasonCodes: ["ambiguous_clause_structure"],
        }),
      ]);
    },
  );

  it.each([
    "Managed services rarely fail under pressure.",
    "Built systems often falter under pressure.",
  ])(
    "keeps an adverb-separated unlisted predicate conservative: %s",
    (text) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "UNKNOWN",
          confidence: "low",
          sentenceForm: "unknown",
          subjectSpan: null,
          finitePredicateSpan: null,
          reasonCodes: ["ambiguous_clause_structure"],
        }),
      ]);
    },
  );

  it.each([
    "Built on research, my career took off.",
    "Supported by evidence, the plan went forward.",
  ])(
    "keeps an unlisted irregular past predicate after a fronted clause conservative: %s",
    (text) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "UNKNOWN",
          confidence: "low",
          sentenceForm: "unknown",
          subjectSpan: null,
          finitePredicateSpan: null,
          reasonCodes: ["ambiguous_clause_structure"],
        }),
      ]);
    },
  );

  it.each([
    "I supported U.S. teams across regions.",
    "I supported U.K. operations across regions.",
  ])("preserves a genuine abbreviation continuation: %s", (text) => {
    expect(analyze(text)).toEqual([
      expect.objectContaining({
        text,
        sentenceSpan: { start: 0, end: text.length },
        classification: "VALID",
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

  it("treats post-comma that as the start of the main subject", () => {
    expect(analyze("Built on research, that approach works.")).toEqual([
      expect.objectContaining({
        classification: "VALID",
        confidence: "high",
        subjectSpan: { start: 19, end: 32 },
        finitePredicateSpan: { start: 33, end: 38 },
        relativePredicateSpans: [],
        reasonCodes: expect.not.arrayContaining(["relative_clause"]),
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
    "Built on user research, my work demonstrates customer focus.",
    "Supported by product data, our process clarifies decisions.",
    "Managed services experience transforms operations.",
  ])(
    "keeps an unsupported present predicate after a fronted clause conservative: %s",
    (text) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "UNKNOWN",
          confidence: "low",
          subjectSpan: null,
          finitePredicateSpan: null,
          reasonCodes: ["ambiguous_clause_structure"],
        }),
      ]);
    },
  );

  it.each([
    "Built on research, performance excels.",
    "Supported by evidence, delivery thrives.",
  ])(
    "keeps a two-token post-comma clause with an unlisted predicate conservative: %s",
    (text) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "UNKNOWN",
          confidence: "low",
          sentenceForm: "unknown",
          subjectSpan: null,
          finitePredicateSpan: null,
          reasonCodes: ["ambiguous_clause_structure"],
        }),
      ]);
    },
  );

  it.each([
    {
      text: "When I managed reporting, delivery improves.",
      subjectSpan: { start: 26, end: 34 },
      finitePredicateSpan: { start: 35, end: 43 },
    },
    {
      text: "While teams reviewed results, managers improve delivery.",
      subjectSpan: { start: 30, end: 38 },
      finitePredicateSpan: { start: 39, end: 46 },
    },
  ])(
    "selects the post-comma main clause after a fronted finite subordinate: $text",
    ({ text, subjectSpan, finitePredicateSpan }) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "VALID",
          confidence: "high",
          subjectSpan,
          finitePredicateSpan,
          reasonCodes: expect.arrayContaining(["finite_predicate"]),
        }),
      ]);
    },
  );

  it("rejects an incomplete main clause after a fronted finite subordinate", () => {
    expect(analyze("When I managed reporting, delivery.")).toEqual([
      expect.objectContaining({
        classification: "INVALID",
        confidence: "high",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: [
          "fronted_subordinate_fragment",
          "missing_finite_predicate",
        ],
      }),
    ]);
  });

  it("rejects a multiword noun phrase without a main predicate after a fronted subordinate", () => {
    expect(
      analyze("When I managed reporting, delivery outcomes."),
    ).toEqual([
      expect.objectContaining({
        classification: "INVALID",
        confidence: "high",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: [
          "fronted_subordinate_fragment",
          "missing_finite_predicate",
        ],
      }),
    ]);
  });

  it.each([
    {
      text: "When you are ready, submit reports.",
      finitePredicateSpan: { start: 20, end: 26 },
    },
    {
      text: "If teams are ready, deliver results promptly.",
      finitePredicateSpan: { start: 20, end: 27 },
    },
  ])(
    "identifies a post-subordinate imperative at the main-clause boundary: $text",
    ({ text, finitePredicateSpan }) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "VALID",
          confidence: "high",
          sentenceForm: "imperative",
          subjectSpan: null,
          finitePredicateSpan,
          reasonCodes: expect.arrayContaining(["imperative_form"]),
        }),
      ]);
    },
  );

  it("preserves the noun-use guard after a fronted subordinate", () => {
    expect(analyze("When you are ready, support for delivery.")).toEqual([
      expect.objectContaining({
        classification: "INVALID",
        confidence: "high",
        sentenceForm: "fragment",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: [
          "fronted_subordinate_fragment",
          "missing_finite_predicate",
        ],
      }),
    ]);
  });

  it.each([
    "Because teams deliver results.",
    "When teams deliver results.",
    "If systems work reliably.",
    "If needed.",
  ])("rejects a standalone leading finite subordinate: %s", (text) => {
    expect(analyze(text)).toEqual([
      expect.objectContaining({
        classification: "INVALID",
        confidence: "high",
        sentenceForm: "fragment",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: [
          "standalone_subordinate_fragment",
          "missing_finite_predicate",
        ],
      }),
    ]);
  });

  it.each([
    {
      text: "If needed I can support teams.",
      subjectSpan: { start: 10, end: 11 },
      finitePredicateSpan: { start: 12, end: 15 },
    },
    {
      text: "Because of this I can contribute to delivery.",
      subjectSpan: { start: 16, end: 17 },
      finitePredicateSpan: { start: 18, end: 21 },
    },
  ])(
    "finds an explicit main clause after an unpunctuated subordinate opener: $text",
    ({ text, subjectSpan, finitePredicateSpan }) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "VALID",
          confidence: "high",
          sentenceForm: "declarative",
          subjectSpan,
          finitePredicateSpan,
          reasonCodes: expect.arrayContaining([
            "finite_predicate",
            "simple_subject",
          ]),
        }),
      ]);
    },
  );

  it("keeps an unpunctuated subordinate opener conservative when the later predicate is unlisted", () => {
    expect(analyze("If needed this excels.")).toEqual([
      expect.objectContaining({
        classification: "UNKNOWN",
        confidence: "low",
        sentenceForm: "unknown",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: ["ambiguous_clause_structure"],
      }),
    ]);
  });

  it.each([
    {
      text: "Because of that they can contribute.",
      subjectSpan: { start: 16, end: 20 },
      finitePredicateSpan: { start: 21, end: 24 },
    },
    {
      text: "Because of them they can contribute.",
      subjectSpan: { start: 16, end: 20 },
      finitePredicateSpan: { start: 21, end: 24 },
    },
    {
      text: "Because of that he can contribute.",
      subjectSpan: { start: 16, end: 18 },
      finitePredicateSpan: { start: 19, end: 22 },
    },
    {
      text: "Because of them we can contribute.",
      subjectSpan: { start: 16, end: 18 },
      finitePredicateSpan: { start: 19, end: 22 },
    },
  ])(
    "does not attach an opener token to the explicit main predicate: $text",
    ({ text, subjectSpan, finitePredicateSpan }) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "VALID",
          confidence: "high",
          sentenceForm: "declarative",
          subjectSpan,
          finitePredicateSpan,
          relativePredicateSpans: [],
          reasonCodes: expect.arrayContaining([
            "finite_predicate",
            "simple_subject",
          ]),
        }),
      ]);
    },
  );

  it.each([
    "When I spoke with clients, I improved delivery.",
    "When I met with clients, I improved delivery.",
  ])(
    "keeps an unrecognized fronted subordinate predicate conservative: %s",
    (text) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "UNKNOWN",
          confidence: "low",
          sentenceForm: "unknown",
          subjectSpan: null,
          finitePredicateSpan: null,
          reasonCodes: ["ambiguous_clause_structure"],
        }),
      ]);
    },
  );

  it("keeps the same unrecognized subordinate invalid without a main-clause boundary", () => {
    expect(analyze("When I spoke with clients.")).toEqual([
      expect.objectContaining({
        classification: "INVALID",
        confidence: "high",
        sentenceForm: "fragment",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: [
          "standalone_subordinate_fragment",
          "missing_finite_predicate",
        ],
      }),
    ]);
  });

  it("keeps a fronted participial clause distinct from a finite subordinate", () => {
    expect(analyze("Built on research, delivery improved.")).toEqual([
      expect.objectContaining({
        classification: "VALID",
        confidence: "high",
        subjectSpan: { start: 19, end: 27 },
        finitePredicateSpan: { start: 28, end: 36 },
      }),
    ]);
  });

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

  it.each([
    {
      text: "Managed teams consistently deliver outcomes.",
      subjectSpan: { start: 0, end: 26 },
      finitePredicateSpan: { start: 27, end: 34 },
    },
    {
      text: "Built systems effectively reduce costs.",
      subjectSpan: { start: 0, end: 25 },
      finitePredicateSpan: { start: 26, end: 32 },
    },
  ])(
    "keeps an intervening adverb out of agreement while retaining the subject span: $text",
    ({ text, subjectSpan, finitePredicateSpan }) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "VALID",
          confidence: "high",
          subjectSpan,
          finitePredicateSpan,
          reasonCodes: expect.arrayContaining([
            "finite_predicate",
            "modified_subject",
          ]),
        }),
      ]);
    },
  );

  it("keeps certain agreement mismatches invalid across an adverb", () => {
    expect(
      analyze("Managed service consistently support delivery."),
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
      text: "Managed service supports delivery.",
      subjectKind: "singular",
      predicateKind: "3sg",
      classification: "VALID",
      subjectSpan: { start: 0, end: 15 },
      finitePredicateSpan: { start: 16, end: 24 },
    },
    {
      text: "Managed service support delivery.",
      subjectKind: "singular",
      predicateKind: "base",
      classification: "INVALID",
      subjectSpan: null,
      finitePredicateSpan: null,
    },
    {
      text: "Managed service transforms operations.",
      subjectKind: "singular",
      predicateKind: "unlisted",
      classification: "UNKNOWN",
      subjectSpan: null,
      finitePredicateSpan: null,
    },
    {
      text: "Managed services supports delivery.",
      subjectKind: "plural",
      predicateKind: "3sg",
      classification: "INVALID",
      subjectSpan: null,
      finitePredicateSpan: null,
    },
    {
      text: "Managed services support delivery.",
      subjectKind: "plural",
      predicateKind: "base",
      classification: "VALID",
      subjectSpan: { start: 0, end: 16 },
      finitePredicateSpan: { start: 17, end: 24 },
    },
    {
      text: "Managed services transforms operations.",
      subjectKind: "plural",
      predicateKind: "unlisted",
      classification: "UNKNOWN",
      subjectSpan: null,
      finitePredicateSpan: null,
    },
    {
      text: "Managed clients' supports delivery.",
      subjectKind: "possessive",
      predicateKind: "3sg",
      classification: "INVALID",
      subjectSpan: null,
      finitePredicateSpan: null,
    },
    {
      text: "Managed clients' support delivery.",
      subjectKind: "possessive",
      predicateKind: "base",
      classification: "INVALID",
      subjectSpan: null,
      finitePredicateSpan: null,
    },
    {
      text: "Managed clients' transforms operations.",
      subjectKind: "possessive",
      predicateKind: "unlisted",
      classification: "INVALID",
      subjectSpan: null,
      finitePredicateSpan: null,
    },
    {
      text: "Built system delivers results.",
      subjectKind: "singular",
      predicateKind: "3sg",
      classification: "VALID",
      subjectSpan: { start: 0, end: 12 },
      finitePredicateSpan: { start: 13, end: 21 },
    },
    {
      text: "Built systems deliver results.",
      subjectKind: "plural",
      predicateKind: "base",
      classification: "VALID",
      subjectSpan: { start: 0, end: 13 },
      finitePredicateSpan: { start: 14, end: 21 },
    },
    {
      text: "Built systems delivers results.",
      subjectKind: "plural",
      predicateKind: "3sg",
      classification: "INVALID",
      subjectSpan: null,
      finitePredicateSpan: null,
    },
  ])(
    "crosses a $subjectKind participial-homograph subject with a $predicateKind predicate: $text",
    ({
      text,
      classification,
      subjectSpan,
      finitePredicateSpan,
    }) => {
      const [result] = analyze(text);

      expect(result).toEqual(
        expect.objectContaining({
          classification,
          confidence: classification === "UNKNOWN" ? "low" : "high",
          subjectSpan,
          finitePredicateSpan,
          reasonCodes:
            classification === "VALID"
              ? expect.arrayContaining(["finite_predicate"])
              : classification === "INVALID"
                ? expect.arrayContaining([
                    "verb_led_fragment",
                    "missing_finite_predicate",
                  ])
                : ["ambiguous_clause_structure"],
        }),
      );
    },
  );

  it.each([
    "Managed clients' support.",
    "Managed clients’ support.",
  ])("preserves a trailing possessive marker: %s", (text) => {
    expect(analyze(text)).toEqual([
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
    "The clients' support improves delivery.",
    "The clients’ support improves delivery.",
  ])("preserves a complete noun phrase containing a possessive: %s", (text) => {
    expect(analyze(text)).toEqual([
      expect.objectContaining({
        classification: "VALID",
        confidence: "high",
        subjectSpan: { start: 0, end: 20 },
        finitePredicateSpan: { start: 21, end: 29 },
      }),
    ]);
  });

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
    "Built proven systems.",
    "Managed established processes.",
  ])("keeps a stacked-participle fragment invalid: %s", (text) => {
    expect(analyze(text)).toEqual([
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

  it.each([
    "Led migrations across teams efficiently.",
    "Managed programs for clients consistently.",
  ])(
    "keeps a prepositional object from becoming an unsupported predicate: %s",
    (text) => {
      expect(analyze(text)).toEqual([
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
    },
  );

  it.each([
    {
      text: "Managed analytics supports delivery.",
      subjectKind: "mass 3sg",
    },
    {
      text: "Managed analytics support delivery.",
      subjectKind: "mass base",
    },
    {
      text: "Built economics supports planning.",
      subjectKind: "discipline 3sg",
    },
    {
      text: "Built economics support planning.",
      subjectKind: "discipline base",
    },
  ])(
    "keeps an -ics subject number ambiguous for a $subjectKind predicate: $text",
    ({ text }) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "UNKNOWN",
          confidence: "low",
          subjectSpan: null,
          finitePredicateSpan: null,
          reasonCodes: ["ambiguous_clause_structure"],
        }),
      ]);
    },
  );

  it.each([
    "Built on research, people support delivery.",
    "Built on research, personnel support delivery.",
  ])(
    "keeps an irregular-number subject before a base predicate conservative: %s",
    (text) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "UNKNOWN",
          confidence: "low",
          subjectSpan: null,
          finitePredicateSpan: null,
          reasonCodes: ["ambiguous_clause_structure"],
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

  it("ends an infinitive before a coordinator introducing a finite clause", () => {
    expect(
      analyze(
        "Teams work to improve delivery and managers review results.",
      ),
    ).toEqual([
      expect.objectContaining({
        classification: "VALID",
        confidence: "high",
        subjectSpan: { start: 0, end: 5 },
        finitePredicateSpan: { start: 6, end: 10 },
        infinitiveSpans: [{ start: 11, end: 30 }],
        reasonCodes: expect.arrayContaining([
          "finite_predicate",
          "bounded_infinitive",
        ]),
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

  it.each([
    {
      text: "Managed work to help teams scale improves delivery.",
      predicateSpan: { start: 33, end: 41 },
      infinitiveSpan: { start: 13, end: 32 },
    },
    {
      text: "Managed work to build and deliver reliable systems improves outcomes.",
      predicateSpan: { start: 51, end: 59 },
      infinitiveSpan: { start: 13, end: 50 },
    },
  ])(
    "ends an infinitive before a supported main lexical predicate: $text",
    ({ text, predicateSpan, infinitiveSpan }) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "VALID",
          confidence: "high",
          subjectSpan: { start: 0, end: 12 },
          finitePredicateSpan: predicateSpan,
          infinitiveSpans: [infinitiveSpan],
          reasonCodes: expect.arrayContaining([
            "bounded_infinitive",
            "main_finite_predicate_after_infinitive",
          ]),
        }),
      ]);
    },
  );

  it.each([
    {
      text: "Built to have supported teams.",
      infinitiveSpan: { start: 6, end: 29 },
    },
    {
      text: "Managed to do reliable reporting.",
      infinitiveSpan: { start: 8, end: 32 },
    },
  ])(
    "keeps an infinitival auxiliary out of the main predicate: $text",
    ({ text, infinitiveSpan }) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "INVALID",
          confidence: "high",
          subjectSpan: null,
          finitePredicateSpan: null,
          infinitiveSpans: [infinitiveSpan],
          reasonCodes: expect.arrayContaining([
            "verb_led_fragment",
            "missing_finite_predicate",
          ]),
        }),
      ]);
    },
  );

  it.each([
    "Review of delivery outcomes.",
    "Share of regional revenue.",
    "Support for product teams.",
  ])("does not treat a noun use as an imperative: %s", (text) => {
    expect(analyze(text)).toEqual([
      expect.objectContaining({
        classification: "UNKNOWN",
        confidence: "low",
        sentenceForm: "unknown",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: ["ambiguous_clause_structure"],
      }),
    ]);
  });

  it.each([
    "With a manager supports delivery.",
    "For the team delivers results.",
  ])("rejects a whole subject span beginning with a preposition: %s", (text) => {
    expect(analyze(text)).toEqual([
      expect.objectContaining({
        classification: "INVALID",
        confidence: "high",
        sentenceForm: "fragment",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: [
          "prepositional_subject_fragment",
          "missing_finite_predicate",
        ],
      }),
    ]);
  });

  it.each([
    {
      text: "In my role I managed client reporting.",
      subjectSpan: { start: 11, end: 12 },
      finitePredicateSpan: { start: 13, end: 20 },
    },
    {
      text: "With clear goals I delivered results.",
      subjectSpan: { start: 17, end: 18 },
      finitePredicateSpan: { start: 19, end: 28 },
    },
    {
      text: "At Acme this matters.",
      subjectSpan: { start: 8, end: 12 },
      finitePredicateSpan: { start: 13, end: 20 },
    },
    {
      text: "In practice this works.",
      subjectSpan: { start: 12, end: 16 },
      finitePredicateSpan: { start: 17, end: 22 },
    },
  ])(
    "finds an explicit subject after an unpunctuated introductory prepositional phrase: $text",
    ({ text, subjectSpan, finitePredicateSpan }) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "VALID",
          confidence: "high",
          sentenceForm: "declarative",
          subjectSpan,
          finitePredicateSpan,
          reasonCodes: expect.arrayContaining([
            "finite_predicate",
            "simple_subject",
          ]),
        }),
      ]);
    },
  );

  it("keeps an unpunctuated introductory prepositional phrase conservative without a clear subject boundary", () => {
    expect(analyze("In my role teams delivered results.")).toEqual([
      expect.objectContaining({
        classification: "UNKNOWN",
        confidence: "low",
        sentenceForm: "unknown",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: ["ambiguous_clause_structure"],
      }),
    ]);
  });

  it("preserves a bounded fronted prepositional modifier", () => {
    expect(
      analyze("With clear goals, a manager supports delivery."),
    ).toEqual([
      expect.objectContaining({
        classification: "VALID",
        confidence: "high",
        sentenceForm: "declarative",
        subjectSpan: { start: 18, end: 27 },
        finitePredicateSpan: { start: 28, end: 36 },
        reasonCodes: expect.arrayContaining([
          "finite_predicate",
          "modified_subject",
        ]),
      }),
    ]);
  });

  it.each([
    "Improved client reporting driven by data.",
    "Managed service quality supported by evidence.",
    "Led large-scale migrations across teams.",
  ])("rejects a reduced participle after a multiword object: %s", (text) => {
    expect(analyze(text)).toEqual([
      expect.objectContaining({
        classification: "INVALID",
        confidence: "high",
        sentenceForm: "fragment",
        subjectSpan: null,
        finitePredicateSpan: null,
        reasonCodes: ["verb_led_fragment", "missing_finite_predicate"],
      }),
    ]);
  });

  it.each([
    {
      text: "Improved client reporting supported delivery.",
      subjectSpan: { start: 0, end: 25 },
      finitePredicateSpan: { start: 26, end: 35 },
    },
    {
      text: "Managed service quality improved outcomes.",
      subjectSpan: { start: 0, end: 23 },
      finitePredicateSpan: { start: 24, end: 32 },
    },
  ])(
    "preserves a genuine past predicate after a participial-homograph subject: $text",
    ({ text, subjectSpan, finitePredicateSpan }) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "VALID",
          confidence: "high",
          sentenceForm: "declarative",
          subjectSpan,
          finitePredicateSpan,
          reasonCodes: expect.arrayContaining(["finite_predicate"]),
        }),
      ]);
    },
  );

  it.each([
    {
      text: "Managed service quality improved with feedback.",
      subjectSpan: { start: 0, end: 23 },
      finitePredicateSpan: { start: 24, end: 32 },
    },
    {
      text: "Improved systems collaborated with teams.",
      subjectSpan: { start: 0, end: 16 },
      finitePredicateSpan: { start: 17, end: 29 },
    },
    {
      text: "Built systems partnered with clients.",
      subjectSpan: { start: 0, end: 13 },
      finitePredicateSpan: { start: 14, end: 23 },
    },
  ])(
    "preserves a genuine past predicate before a prepositional complement: $text",
    ({ text, subjectSpan, finitePredicateSpan }) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "VALID",
          confidence: "high",
          sentenceForm: "declarative",
          subjectSpan,
          finitePredicateSpan,
          reasonCodes: expect.arrayContaining([
            "finite_predicate",
            "modified_subject",
          ]),
        }),
      ]);
    },
  );

  it.each([
    { text: "Review reports promptly.", predicateEnd: 6 },
    { text: "Share results broadly.", predicateEnd: 5 },
    { text: "Support teams consistently.", predicateEnd: 7 },
  ])(
    "preserves a genuine imperative with an object or adverb: $text",
    ({ text, predicateEnd }) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "VALID",
          confidence: "high",
          sentenceForm: "imperative",
          subjectSpan: null,
          finitePredicateSpan: { start: 0, end: predicateEnd },
          reasonCodes: expect.arrayContaining(["imperative_form"]),
        }),
      ]);
    },
  );

  it.each([
    {
      text: "Teams have supported delivery.",
      finitePredicateSpan: { start: 6, end: 10 },
    },
    {
      text: "Teams do support delivery.",
      finitePredicateSpan: { start: 6, end: 8 },
    },
  ])(
    "preserves a genuinely finite auxiliary: $text",
    ({ text, finitePredicateSpan }) => {
      expect(analyze(text)).toEqual([
        expect.objectContaining({
          classification: "VALID",
          confidence: "high",
          subjectSpan: { start: 0, end: 5 },
          finitePredicateSpan,
        }),
      ]);
    },
  );

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
    for (const fixture of [
      "Built on user research, my work demonstrates customer focus.",
      "Built on research, that approach works.",
      "Built to have supported teams.",
      "I worked in the U.S. npm supports reliable delivery.",
      "Built proven systems.",
      "Managed established processes.",
      "Built on research, people support delivery.",
      "Built on research, personnel support delivery.",
      "Managed services experience transforms operations.",
      "When I managed reporting, delivery.",
      "Managed clients' support.",
      "Managed clients’ support.",
      "Managed services supports delivery.",
      "Built systems delivers results.",
      "Managed teams create reliable workflows.",
      "Built systems transform operations.",
      "Managed teams create efficiently.",
      "Built system transforms reliably.",
      "Managed services rarely fail under pressure.",
      "Built systems often falter under pressure.",
      "Built on research, my career took off.",
      "Supported by evidence, the plan went forward.",
      "Managed teams consistently deliver outcomes.",
      "When I managed reporting, delivery outcomes.",
      "Review of delivery outcomes.",
      "Led migrations across teams efficiently.",
      "Managed work to help teams scale improves delivery.",
      "Teams deliver results; The work.",
      "Teams deliver results; Aligned for delivery.",
      "Teams deliver results; Because managers review outcomes.",
      "Teams deliver results; With a manager supports delivery.",
      "Teams deliver results; Managers create outcomes.",
      "Teams deliver results; aligned with clear goals, people excel.",
      "Teams deliver results; aligned with clear goals, teams support delivery.",
      "Review the data; update the records.",
      "Submit the report; archive the evidence.",
      "Review the data; The records.",
      "When you are ready, submit reports.",
      "When you are ready, support for delivery.",
      "Because teams deliver results.",
      "If needed.",
      "If needed I can support teams.",
      "Because of this I can contribute to delivery.",
      "If needed this excels.",
      "Because of that they can contribute.",
      "Because of them they can contribute.",
      "Because of that he can contribute.",
      "Because of them we can contribute.",
      "Teams work to improve delivery and managers review results.",
      "With a manager supports delivery.",
      "In my role I managed client reporting.",
      "With clear goals I delivered results.",
      "In my role teams delivered results.",
      "At Acme this matters.",
      "In practice this works.",
      "Managed analytics supports delivery.",
      "Built economics support planning.",
      "When I spoke with clients, I improved delivery.",
      "When I met with clients, I improved delivery.",
      "When I spoke with clients.",
      "Improved client reporting driven by data.",
      "Managed service quality supported by evidence.",
      "Led large-scale migrations across teams.",
      "Improved client reporting supported delivery.",
      "Managed service quality improved outcomes.",
      "Managed service quality improved with feedback.",
      "Improved systems collaborated with teams.",
      "Built systems partnered with clients.",
      "Built on research, performance excels.",
      "Supported by evidence, delivery thrives.",
    ]) {
      expect(source).not.toContain(fixture);
    }
    for (const fixtureLexeme of [
      '"demonstrates"',
      '"clarifies"',
      '"proven"',
      '"established"',
      '"people"',
      '"personnel"',
      '"transforms"',
      '"clients"',
      '"create"',
      '"transform"',
      '"transforms"',
      '"analytics"',
      '"economics"',
      '"spoke"',
      '"met"',
      '"fail"',
      '"falter"',
      '"took"',
      '"went"',
      '"update"',
      '"archive"',
      '"driven"',
      '"excels"',
      '"thrives"',
    ]) {
      expect(source).not.toContain(fixtureLexeme);
    }
  });
});
