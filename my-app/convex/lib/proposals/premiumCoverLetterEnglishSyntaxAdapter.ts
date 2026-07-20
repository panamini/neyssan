import createWinkPosTagger from "wink-pos-tagger";

const FINITE_PREDICATE_POS_TAGS = new Set(["MD", "VBD", "VBP", "VBZ"]);
const SUBJECT_POS_TAGS = new Set([
  "EX",
  "NN",
  "NNP",
  "NNPS",
  "NNS",
  "PRP",
  "WDT",
  "WP",
]);
const SUBJECT_TRAILING_MODIFIER_POS_TAGS = new Set(["RB", "RBR", "RBS"]);
const englishPosTagger = createWinkPosTagger();

function lexicalTokens(value: string) {
  return englishPosTagger
    .tagSentence(value)
    .filter((token) => /[\p{L}\p{N}]/u.test(token.value));
}

/**
 * Deterministic English syntax adapter for the quality gate.
 *
 * The gate passes normalized lexical tokens and keeps ownership of the
 * blocking policy. This adapter owns only part-of-speech interpretation.
 */
export function isFiniteEnglishPredicateAt(args: {
  tokens: readonly string[];
  index: number;
  clauseStartIndex: number;
}): boolean {
  const taggedTokens = lexicalTokens(args.tokens.join(" "));
  const candidate = taggedTokens[args.index];
  if (!candidate || !FINITE_PREDICATE_POS_TAGS.has(candidate.pos)) {
    return false;
  }

  const clauseStartIndex =
    args.clauseStartIndex < args.index ? args.clauseStartIndex : 1;
  return !taggedTokens
    .slice(clauseStartIndex, args.index)
    .some((token) => token.pos === "TO");
}

export function hasEnglishSubjectBeforePredicateAt(args: {
  tokens: readonly string[];
  index: number;
  clauseStartIndex: number;
}): boolean {
  const taggedTokens = lexicalTokens(args.tokens.join(" "));
  let subjectIndex = args.index - 1;
  while (
    subjectIndex >= args.clauseStartIndex &&
    SUBJECT_TRAILING_MODIFIER_POS_TAGS.has(
      taggedTokens[subjectIndex]?.pos ?? "",
    )
  ) {
    subjectIndex -= 1;
  }
  return (
    subjectIndex >= args.clauseStartIndex &&
    SUBJECT_POS_TAGS.has(taggedTokens[subjectIndex]?.pos ?? "")
  );
}
