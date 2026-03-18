import type { NEREntity } from "../parsing_shared/nerClient";
import { embedText, cosineSimilarity, type EmbeddingVector } from "../embeddings/embedClient";
import { canonicalSkills, skillAliases, skillStoplist } from "./skillsCanonical";

export interface MinimalSection {
  title: string;
  content: string;
  fieldKey: string;
  confidence: number;
}

const HARD_LABELS = new Set([
  "hard_skills",
  "hard_skill",
  "skill",
  "skill_hard",
  "HARD_SKILL",
  "HARD_SKILLS",
  "SKILL_HARD",
  "SKILL",
]);

const SOFT_LABELS = new Set([
  "soft_skills",
  "soft_skill",
  "softskill",
  "SOFT_SKILL",
  "SOFT_SKILLS",
  "SKILL_SOFT",
]);

const EMBEDDING_THRESHOLD = 0.75;
const SKILL_STOPLIST = skillStoplist ?? new Set<string>();
const SKILL_ANCHORS = Array.from(canonicalSkills.values()).filter(
  (skill) => !SKILL_STOPLIST.has(skill)
);
let skillAnchorEmbeddingsPromise: Promise<EmbeddingVector[]> | null = null;

async function ensureSkillAnchorEmbeddings(): Promise<EmbeddingVector[]> {
  if (SKILL_ANCHORS.length === 0) return [];
  if (!skillAnchorEmbeddingsPromise) {
    skillAnchorEmbeddingsPromise = embedText(SKILL_ANCHORS).catch((err) => {
      skillAnchorEmbeddingsPromise = null;
      throw err;
    });
  }
  return skillAnchorEmbeddingsPromise;
}

async function rerankSkillsWithEmbeddings(skills: string[]): Promise<string[]> {
  if (!skills.length || SKILL_ANCHORS.length === 0) return skills;
  try {
    const [candidateVectors, anchorVectors] = await Promise.all([
      embedText(skills),
      ensureSkillAnchorEmbeddings(),
    ]);
    const anchorCount = Math.min(anchorVectors.length, SKILL_ANCHORS.length);
    if (!anchorCount) return skills;

    return skills.filter((_skill, idx) => {
      const candidateVec = candidateVectors[idx];
      if (!candidateVec) return true;
      let best = -1;
      for (let i = 0; i < anchorCount; i++) {
        const anchorVec = anchorVectors[i];
        if (!anchorVec) continue;
        const score = cosineSimilarity(candidateVec, anchorVec);
        if (score > best) {
          best = score;
          if (best >= EMBEDDING_THRESHOLD) break;
        }
      }
      return best >= EMBEDDING_THRESHOLD;
    });
  } catch {
    return skills;
  }
}

function normalizeToken(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractExisting(content: string): string[] {
  return content
    .split(/[\n,;•\u2022]+/)
    .map((token) => normalizeToken(token))
    .filter(Boolean);
}

export async function injectSkillEntities<T extends MinimalSection>(
  sections: T[],
  entities?: NEREntity[] | null
): Promise<T[]> {
  if (!entities || entities.length === 0) return sections;

  const hardSet = new Set<string>();
  const softSet = new Set<string>();

  for (const ent of entities) {
    if (!ent || typeof ent.text !== "string") continue;
    const label = String(ent.label ?? "").toLowerCase();
    const normalized = normalizeToken(ent.text);
    if (!normalized) continue;
    if (SOFT_LABELS.has(label)) {
      softSet.add(normalized);
    } else if (HARD_LABELS.has(label)) {
      hardSet.add(normalized);
    }
  }

  if (hardSet.size === 0 && softSet.size === 0) return sections;

  const updated: T[] = sections.slice();
  const idx = updated.findIndex((sec) => String(sec.fieldKey ?? "").toLowerCase() === "skills");
  if (idx >= 0) {
    const existing = updated[idx];
    const existingTokens = extractExisting(existing.content ?? "");
    existingTokens.forEach((token) => hardSet.add(token));
    const curatedHard = curate(Array.from(hardSet));
    const curatedSoft = curate(Array.from(softSet), /*soft*/ true);
    const rerankedHard = await rerankSkillsWithEmbeddings(curatedHard); // NEW: embedding reranker.
    const rerankedSoft = await rerankSkillsWithEmbeddings(curatedSoft); // NEW: embedding reranker.
    const content = formatContent(rerankedHard, rerankedSoft);
    updated[idx] = {
      ...existing,
      content,
      confidence: Math.max(existing.confidence ?? 0, 0.9),
    };
    return updated;
  }

  const curatedHard = curate(Array.from(hardSet));
  const curatedSoft = curate(Array.from(softSet), /*soft*/ true);
  const rerankedHard = await rerankSkillsWithEmbeddings(curatedHard); // NEW: embedding reranker.
  const rerankedSoft = await rerankSkillsWithEmbeddings(curatedSoft); // NEW: embedding reranker.
  const content = formatContent(rerankedHard, rerankedSoft);
  const section: T = {
    title: "Skills",
    fieldKey: "skills",
    content,
    confidence: 0.9,
  } as T;
  updated.push(section);
  return updated;
}

function formatContent(hard: string[], soft: string[]): string {
  const lines: string[] = [];
  const hardUnique = Array.from(new Set(hard)).filter(Boolean).sort();
  const softUnique = Array.from(new Set(soft)).filter(Boolean).sort();
  if (hardUnique.length > 0) {
    lines.push(`Hard Skills: ${hardUnique.join(", ")}`);
  }
  if (softUnique.length > 0) {
    lines.push(`Soft Skills: ${softUnique.join(", ")}`);
  }
  return lines.join("\n\n");
}

// Curate skills against canonical vocabulary when available.
function curate(list: string[], soft = false): string[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const seen = new Set<string>();
  const filtered: string[] = [];
  const hasCanon = canonicalSkills && canonicalSkills.size > 0;
  for (const item of list) {
    const raw = norm(item);
    const aliased = skillAliases[raw] ?? raw;
    const key = aliased;
    if (!key || seen.has(key)) continue;
    if (SKILL_STOPLIST.has(key) || SKILL_STOPLIST.has(raw)) continue;
    // If we have a canonical vocab, only keep items that match it (intersection)
    if (hasCanon) {
      if (!canonicalSkills.has(key)) continue;
    }
    seen.add(key);
    // Preserve original surface if it already matches canonical; otherwise emit canonical token
    const outToken = canonicalSkills.has(raw) ? item : key;
    filtered.push(outToken);
  }
  // Heuristic: cap soft list length to avoid bloating with generic traits
  if (soft && filtered.length > 50) return filtered.slice(0, 50);
  return filtered;
}
