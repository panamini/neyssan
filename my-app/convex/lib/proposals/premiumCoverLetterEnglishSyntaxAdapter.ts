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

export function isNumericOnlyEnglishEntityMentionAt(args: {
  value: string;
  start: number;
  length: number;
}): boolean {
  const prefix = args.value.slice(0, args.start);
  const suffix = args.value.slice(args.start + args.length);
  if (/^['’]s(?![\p{L}\p{N}&'.-])/u.test(suffix)) return true;
  if (!/(?:^|[.!?;:]\s*)$/u.test(prefix)) return false;

  const followingToken = /^\s+([\p{L}][\p{L}'-]*)/u.exec(suffix)?.[1];
  if (!followingToken) return false;
  return isFiniteEnglishPredicateAt({
    tokens: [args.value.slice(args.start, args.start + args.length), followingToken],
    index: 1,
    clauseStartIndex: 0,
  });
}
