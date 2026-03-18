import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the NER client to return layout blocks + entities without real HTTP
vi.mock("../../parsing_shared/nerClient", () => {
  return {
    requestNER: vi.fn().mockResolvedValue({
      entities: [
        { label: "HARD_SKILL", text: "React", start: 120, end: 125 },
        { label: "SOFT_SKILL", text: "Leadership", start: 130, end: 140 },
        // noisy token that should be pruned by filterNEREntities
        { label: "HARD_SKILL", text: "Email", start: 10, end: 15 },
      ],
      layout: {
        blocks: [
          { text: "Summary\nSeasoned engineer with 7+ years", start: 0, end: 40, order: 0 },
          { text: "Experience\nAcme Corp — Senior Engineer (2020-2023)", start: 41, end: 96, order: 1 },
          { text: "Education\nB.S. Computer Science, University X", start: 97, end: 140, order: 2 },
          { text: "Skills\nReact, Node", start: 141, end: 160, order: 3 },
        ],
      },
    }),
    isNEREnabled: () => true,
  } as any;
});

import { parseCV } from "../hybridParser";

describe("hybridParser + NER layout integration", () => {
  beforeEach(() => {
    process.env.ENABLE_NER = "1";
    // No need to set URL because requestNER is mocked
  });

  it("rebuilds sections from layout and injects filtered skills", async () => {
    const raw = [
      "John Doe",
      "Senior Software Engineer",
      "Email: john@example.com | Phone: +1 415 555 1234",
      "",
      "Summary",
      "Seasoned engineer with 7+ years",
      "",
      "Experience",
      "Acme Corp — Senior Engineer (2020-2023)",
      "",
      "Education",
      "B.S. Computer Science, University X",
      "",
      "Skills",
      "React, Node",
    ].join("\n");

    const res = await parseCV(raw, { returnMappedCV: true, mapperStrip: true });

    // Expect sections rebuilt via buildSectionsFromLayout (layout-first): check fieldKeys
    const keys = res.sections.map((s) => s.fieldKey);
    expect(keys).toContain("summary");
    expect(keys).toContain("experience");
    expect(keys).toContain("education");
    expect(keys).toContain("skills");

    // Expect a Skills section with HARD/SOFT skills injected and noisy token pruned
    const skills = res.sections.find((s) => s.fieldKey === "skills");
    expect(skills).toBeTruthy();
    const content = skills?.content ?? "";
    expect(content).toMatch(/Hard Skills:/i);
    expect(content).toMatch(/React/i);
    expect(content).toMatch(/Soft Skills:/i);
    expect(content).toMatch(/Leadership/i);
    // Ensure noise like 'Email' is pruned from HARD_SKILL list
    expect(content).not.toMatch(/Email\b/i);

    // When returnMappedCV is true, _ner payload should be attached for downstream consumers
    expect(res.cv && typeof res.cv === "object").toBe(true);
    const ner = (res.cv as any)._ner;
    expect(ner && Array.isArray(ner.entities)).toBe(true);
  });
});

