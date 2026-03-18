import { describe, it, expect, vi } from "vitest";

const vectorMap: Record<string, number[]> = {
  english: [1, 0],
  french: [0, 1],
};

describe("languageNormalizer embedding reranker", () => {
  it("prunes low-similarity language candidates", async () => {
    const embedModule = await import("../../embeddings/embedClient");
    vi.spyOn(embedModule, "embedText").mockImplementation(async (texts: string[]) => {
      return texts.map((text) => {
        const key = text.trim().toLowerCase();
        return vectorMap[key] ?? [0, 0];
      });
    });
    vi.spyOn(embedModule, "cosineSimilarity").mockImplementation((a: number[], b: number[]) => {
      const length = Math.min(a.length, b.length);
      if (!length) return 0;
      let dot = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      const denom = Math.sqrt(normA) * Math.sqrt(normB);
      if (!denom) return 0;
      return dot / denom;
    });
    const { normalizeLanguagesFromTextDetailed } = await import("../languageNormalizer");
    const detailed = await normalizeLanguagesFromTextDetailed("English, Klingon, French");
    expect(detailed.normalized).toEqual(["English", "French"]);
    expect(detailed.raw).toEqual(["English", "French"]);
  });
});
