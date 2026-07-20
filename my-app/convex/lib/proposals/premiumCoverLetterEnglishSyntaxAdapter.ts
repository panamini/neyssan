import createWinkPosTagger from "wink-pos-tagger";

const FINITE_PREDICATE_POS_TAGS = new Set(["MD", "VBD", "VBP", "VBZ"]);
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
}): boolean {
  const taggedTokens = lexicalTokens(args.tokens.join(" "));
  const candidate = taggedTokens[args.index];
  if (!candidate || !FINITE_PREDICATE_POS_TAGS.has(candidate.pos)) {
    return false;
  }

  return !taggedTokens.slice(1, args.index).some((token) => token.pos === "TO");
}
