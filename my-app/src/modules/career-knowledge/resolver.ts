import { CAREER_KNOWLEDGE_RULES_V1 } from "./rules";
import type {
  CareerKnowledgeMarketV1,
  CareerKnowledgeResolveInputV1,
  CareerKnowledgeResolveResultV1,
  CareerKnowledgeRuleIdV1,
  CareerKnowledgeRuleV1,
} from "./schema";

const KNOWN_MARKETS: readonly CareerKnowledgeMarketV1[] = [
  "global",
  "us",
  "uk",
  "eu",
  "france",
  "canada",
  "australia",
  "other",
] as const;

const CAREER_KNOWLEDGE_RULES: readonly CareerKnowledgeRuleV1[] =
  CAREER_KNOWLEDGE_RULES_V1;

export function resolveCareerKnowledgeRules(
  input: CareerKnowledgeResolveInputV1,
): CareerKnowledgeResolveResultV1 {
  const market = normalizeCareerKnowledgeMarket(input.market);
  const rules = filterCareerKnowledgeRules(input);

  return {
    rules,
    blockedRuleIds: rules
      .filter((rule) => rule.severity === "blocker")
      .map((rule) => rule.id),
    warningRuleIds: rules
      .filter((rule) => rule.severity === "warning")
      .map((rule) => rule.id),
    market,
    version: 1,
  };
}

export function getCareerKnowledgeRuleById(
  id: CareerKnowledgeRuleIdV1,
): CareerKnowledgeRuleV1 | undefined {
  return CAREER_KNOWLEDGE_RULES.find((rule) => rule.id === id);
}

export function listCareerKnowledgeRules(): readonly CareerKnowledgeRuleV1[] {
  assertUniqueCareerKnowledgeRuleIds();
  return CAREER_KNOWLEDGE_RULES;
}

export function filterCareerKnowledgeRules(
  input: CareerKnowledgeResolveInputV1,
): readonly CareerKnowledgeRuleV1[] {
  assertUniqueCareerKnowledgeRuleIds();

  const market = normalizeCareerKnowledgeMarket(input.market);

  return CAREER_KNOWLEDGE_RULES.filter((rule) => {
    if (!matchesDocumentKind(rule, input.documentKind)) {
      return false;
    }

    if (!matchesMarket(rule.market, market)) {
      return false;
    }

    if (!matchesOptionalString(rule.appliesTo.languages, input.language)) {
      return false;
    }

    if (!matchesOptionalString(rule.appliesTo.targetRoles, input.targetRole)) {
      return false;
    }

    if (!matchesOptionalString(rule.appliesTo.seniorities, input.seniority)) {
      return false;
    }

    if (!matchesOptionalArray(rule.appliesTo.sourceTypes, input.sourceTypes)) {
      return false;
    }

    if (!matchesOptionalArray(rule.appliesTo.candidateFactTypes, input.candidateFactTypes)) {
      return false;
    }

    if (!matchesOptionalString(rule.appliesTo.artifactTypes, input.artifactType)) {
      return false;
    }

    return true;
  });
}

export function assertUniqueCareerKnowledgeRuleIds(): void {
  const seen = new Set<CareerKnowledgeRuleIdV1>();

  for (const rule of CAREER_KNOWLEDGE_RULES) {
    if (seen.has(rule.id)) {
      throw new Error(`Duplicate CareerKnowledge rule id: ${rule.id}`);
    }
    seen.add(rule.id);
  }
}

function normalizeCareerKnowledgeMarket(
  market: CareerKnowledgeResolveInputV1["market"],
): CareerKnowledgeMarketV1 {
  if (!market) {
    return "global";
  }

  const normalized = market.trim().toLowerCase();

  if ((KNOWN_MARKETS as readonly string[]).includes(normalized)) {
    return normalized as CareerKnowledgeMarketV1;
  }

  return "other";
}

function matchesDocumentKind(
  rule: CareerKnowledgeRuleV1,
  documentKind: CareerKnowledgeResolveInputV1["documentKind"],
): boolean {
  return rule.appliesTo.documentKinds.includes(documentKind);
}

function matchesMarket(
  ruleMarket: CareerKnowledgeMarketV1,
  requestedMarket: CareerKnowledgeMarketV1,
): boolean {
  if (ruleMarket === "global") {
    return true;
  }

  return ruleMarket === requestedMarket;
}

function matchesOptionalString(values: readonly string[] | undefined, value: string | undefined): boolean {
  if (!values || values.length === 0) {
    return true;
  }

  if (!value) {
    return true;
  }

  return values.includes(value);
}

function matchesOptionalArray(
  acceptedValues: readonly string[] | undefined,
  requestedValues: readonly string[] | undefined,
): boolean {
  if (!acceptedValues || acceptedValues.length === 0) {
    return true;
  }

  if (!requestedValues || requestedValues.length === 0) {
    return true;
  }

  return requestedValues.some((requestedValue) => acceptedValues.includes(requestedValue));
}
