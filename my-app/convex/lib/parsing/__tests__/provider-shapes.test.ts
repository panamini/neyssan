import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { parseLLMSections } from "../llmPostProcessor";

function readFixture(relPathCandidates: string[]) {
  for (const p of relPathCandidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
    } catch {}
  }
  throw new Error("Fixture tmp-mistral-full-response.json not found in any candidate locations: " + JSON.stringify(relPathCandidates));
}

describe("Provider-shaped LLM outputs (real captured fixtures)", () => {
  it("parses a Mistral-style full response (fenced JSON inside choices[0].message.content)", () => {
    const candidates = [
      path.join(__dirname, "..", "..", "..", "..", "..", "tmp-mistral-full-response.json"), // repo root (5 up)
      path.join(__dirname, "..", "..", "..", "..", "tmp-mistral-full-response.json"), // my-app (4 up)
      path.resolve(process.cwd(), "tmp-mistral-full-response.json"), // cwd fallback
      path.join(__dirname, "..", "..", "..", "..", "..", "..", "tmp-mistral-full-response.json") // extra fallback
    ];
    const raw = readFixture(candidates);
    const j = JSON.parse(raw);
    // The captured fixture contains the full provider response object; the useful payload is inside choices[0].message.content
    const messageContent = j?.choices?.[0]?.message?.content;
    expect(typeof messageContent).toBe("string");
    const parsed = parseLLMSections(String(messageContent));
    const titles = parsed.sections.map((s) => s.title.toLowerCase());
    // Expect canonical mapped titles (some implementations return "Introduction" etc.)
    expect(titles).toEqual(expect.arrayContaining(["introduction", "experience", "skills", "contact"]));
  });

  it("parses when given the entire provider JSON string (stringified provider object)", () => {
    const candidates = [
      path.join(__dirname, "..", "..", "..", "..", "..", "tmp-mistral-full-response.json"),
      path.join(__dirname, "..", "..", "..", "..", "tmp-mistral-full-response.json"),
      path.resolve(process.cwd(), "tmp-mistral-full-response.json")
    ];
    const raw = readFixture(candidates);
    // pass the full provider JSON as a string, which mirrors the fallback path used by the parser/repair flow
    const parsed = parseLLMSections(raw);
    const titles = parsed.sections.map((s) => s.title.toLowerCase());
    expect(titles).toEqual(expect.arrayContaining(["introduction", "experience", "skills", "contact"]));
  });
});