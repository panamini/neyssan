import { describe, it, expect } from "vitest";
import { repairJSON } from "../../parsing_shared/repair";
import { detectLanguageIsFrench } from "../../parsing_shared/utils";
 
describe("hybridParser repairJSON", () => {
  it("extracts fenced JSON with backticks", async () => {
    const input = "Some wrapper\n```json\n{ \"sections\": [{ \"title\": \"Profile\", \"content\": \"x\", \"fieldKey\": \"identity\", \"confidence\": 0.9 }] }\n```";
    const res = await repairJSON(input, 2000, async (p) => {
      // echo back the fenced JSON to simulate repair LLM returning the inner JSON
      return "{ \"sections\": [{ \"title\": \"Profile\", \"content\": \"x\", \"fieldKey\": \"identity\", \"confidence\": 0.9 }] }";
    });
    expect(res).toBeDefined();
    const parsed = JSON.parse(res as string);
    expect(parsed.sections).toBeTruthy();
    expect(parsed.sections[0].title).toBe("Profile");
  });

  it("parses alt fenced JSON markers", async () => {
    const input = 'Prefix <FENCED_JSON>{ "sections": [ { "title":"A" } ] }</FENCED_JSON> suffix';
    const res = await repairJSON(input, 2000, async () => '{ "sections": [ { "title":"A" } ] }');
    expect(res).toBeDefined();
    const parsed = JSON.parse(res as string);
    expect(parsed.sections[0].title).toBe("A");
  });

  it("returns null quickly for non-json-like input", async () => {
    const input = "Totally unrelated plain text with no JSON";
    const res = await repairJSON(input, 500, async () => "{ \"not\": \"used\" }");
    expect(res).toBeNull();
  });
});

describe("hybridParser detectLanguageIsFrench", () => {
  it("detects French by diacritics", () => {
    expect(detectLanguageIsFrench("expérience, français")).toBe(true);
  });

  it("detects French by parseHelpers (explicit languages)", () => {
    const block = "Langues:\nFrançais, Anglais\n";
    expect(detectLanguageIsFrench(block)).toBe(true);
  });

  it("does not false-positive English", () => {
    expect(detectLanguageIsFrench("Experience: Senior Engineer")).toBe(false);
  });
});