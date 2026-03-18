/**
 * This file previously contained only a skipped placeholder, so Vitest reported
 * zero executed tests. We now load the real hook via renderHook with deterministic
 * mocks to keep the suite running.
 */

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockParsePdfArrayBuffer = vi.fn();
const mockUseMutation = vi.fn();
const mockUseAction = vi.fn();
const mockClientFormat = vi.fn();
const mockParseRefinedMarkdown = vi.fn();

vi.mock(new URL("../../services/pdf/browser-cv-parser.ts", import.meta.url).pathname, () => ({
  parsePdfArrayBuffer: (...args: unknown[]) => mockParsePdfArrayBuffer(...args),
}));

vi.mock(new URL("../../utils/simpleClientParse.ts", import.meta.url).pathname, () => ({
  clientFormatCompleteCV: (...args: unknown[]) => mockClientFormat(...args),
}));

vi.mock(new URL("../../utils/parseRefinedMarkdown.ts", import.meta.url).pathname, () => ({
  parseRefinedMarkdown: (...args: unknown[]) => mockParseRefinedMarkdown(...args),
}));

vi.mock(new URL("../../lib/convex-env.ts", import.meta.url).pathname, () => ({
  getConvexUrl: () => "https://example.convex.cloud",
}));

vi.mock("convex/react", () => ({
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useAction: (...args: unknown[]) => mockUseAction(...args),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue(null) }),
}));

vi.mock(new URL("../../../convex/_generated/api.js", import.meta.url).pathname, () => ({
  api: {
    llm: { startRefineByString: "startRefineByString" },
    "actions/formatCompleteCV": { formatCompleteCV: "formatCompleteCV" },
    "actions/extractProfileStrictWithSpans": { extractProfileStrictWithSpans: "extractProfileStrictWithSpans" },
  },
}));

let useCvParserHook: typeof import("../useCvParser").useCvParser;

function ensureCryptoRandomUUID() {
  if (!globalThis.crypto || typeof globalThis.crypto.randomUUID !== "function") {
    vi.stubGlobal("crypto", {
      randomUUID: () => "test-uuid",
      getRandomValues: (array: ArrayBufferView) => array,
    });
  }
}

beforeEach(async () => {
  mockParsePdfArrayBuffer.mockReset();
  mockClientFormat.mockReset();
  mockParseRefinedMarkdown.mockReset();
  mockUseMutation.mockReset();
  mockUseAction.mockReset();

  mockClientFormat.mockImplementation((rawText: string) => ({
    status: "ok",
    result: {
      summary: rawText,
      skills: ["client"],
      rawParsedSections: [],
    },
  }));

  mockParseRefinedMarkdown.mockImplementation((text: string) => ({
    summary: text,
    skills: text,
  }));

  mockUseMutation.mockImplementation(() => vi.fn().mockResolvedValue({ status: "enqueued", jobId: "job-default" }));
  mockUseAction.mockImplementation((identifier: unknown) => {
    if (identifier === "formatCompleteCV") {
      return vi.fn().mockResolvedValue({ status: "ok", result: { summary: "formatted", rawParsedSections: [] } });
    }
    if (identifier === "extractProfileStrictWithSpans") {
      return vi.fn().mockResolvedValue({ sections: [], profile: null });
    }
    return vi.fn();
  });

  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ status: "completed", result: null }),
  });
  (globalThis as any).fetch = fetchMock;

  process.env.TEST_POLL_MS = "5";
  process.env.TEST_POLL_TIMEOUT_MS = "50";

  ensureCryptoRandomUUID();

  ({ useCvParser: useCvParserHook } = await import("../useCvParser"));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  cleanup();
  delete (globalThis as any).fetch;
});

const encode = (value: string) => new TextEncoder().encode(value);

describe("useCvParser hook", () => {
  it("returns initial state correctly", () => {
    const { result } = renderHook(() => useCvParserHook());
    expect(result.current.isParsing).toBe(false);
    expect(result.current.isRefining).toBe(false);
    expect(result.current.suggestions).toBeNull();
    expect(result.current.mappedSections).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("handles successful CV parse and updates state", async () => {
    const normalisedServer = {
      summary: "Server summary",
      skills: ["TypeScript", "Gestion"],
      experienceText: "[{'role':'Lead'}]",
      educationText: "[{'school':'ENS'}]",
      achievements: ["Prix"],
      rawParsedSections: [
        { id: "exp-1", title: "Expérience Professionnelle", content: "Did things", fieldKey: "experience" },
        { id: "edu-1", title: "Educación", content: "Studied", fieldKey: "education" },
        { id: "ski-1", title: "Kompetenzen", content: "TypeScript, Gestion", fieldKey: "skills" },
        { id: "lan-1", title: "Idiomas", content: "Français, Español", fieldKey: "languages" },
        { id: "ach-1", title: "Erfolge", content: "Won", fieldKey: "achievements" },
      ],
    };

    mockUseMutation.mockImplementation(() => vi.fn().mockResolvedValue({ status: "enqueued", jobId: "job-42" }));
    mockUseAction.mockImplementation((identifier: unknown) => {
      if (identifier === "formatCompleteCV") {
        return vi.fn().mockResolvedValue({ status: "ok", result: normalisedServer });
      }
      if (identifier === "extractProfileStrictWithSpans") {
        return vi.fn().mockResolvedValue({
          sections: [
            { id: "strict-1", title: "Summary", content: "Strict", fieldKey: "summary" },
          ],
          profile: { name: "Paris Martin" },
        });
      }
      return vi.fn();
    });

    (globalThis.fetch as vi.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "completed", result: { normalized: normalisedServer } }),
    });

    mockParsePdfArrayBuffer.mockResolvedValue({
      summary: "Résumé initial",
      skills: ["TypeScript"],
      experience: [{ role: "Lead" }],
      rawText: "Expérience professionnelle détaillée",
    });

    const { result } = renderHook(() => useCvParserHook());
    const file = new File([encode("dummy")], "resume.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.parseFile(file);
    });

    await waitFor(() => {
      expect(result.current.isParsing).toBe(false);
      expect(result.current.isRefining).toBe(false);
      expect(result.current.error).toBeNull();
    });

    expect(result.current.jobId).toBe("job-42");
    expect(result.current.lastNormalizedSource).toBe("server");
    expect(result.current.lastNormalized?.rawParsedSections?.length).toBeGreaterThan(0);
    expect(result.current.suggestions?.summary).toContain("Server summary");
    const sectionKeys = result.current.mappedSections.map((s) => s.fieldKey);
    expect(sectionKeys).toEqual(expect.arrayContaining([
      "experience",
      "education",
      "skills",
      "languages",
      "achievements",
    ]));
  });

  it("handles errors gracefully and sets error state", async () => {
    mockParsePdfArrayBuffer.mockRejectedValue(new Error("parse failed"));

    const { result } = renderHook(() => useCvParserHook());
    const file = new File([encode("broken")], "resume.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.parseFile(file);
    });

    await waitFor(() => {
      expect(result.current.error).toBe("parse failed");
    });

    expect(result.current.isParsing).toBe(false);
    expect(result.current.isRefining).toBe(false);
    expect(result.current.suggestions).toBeNull();
    expect(result.current.mappedSections).toEqual([]);
  });
});

describe("multilingual + phone acceptance", () => {
  it("maps FR/ES/DE headings into canonical buckets", async () => {
    const { parseLLMSections } = await import("../../../convex/lib/parsing/llmPostProcessor.ts");
    const { FIELD_KEY_MAP } = await import("../../../convex/lib/parsing/enhancedParser.ts");

    expect(FIELD_KEY_MAP.experience).toContain("expérience professionnelle");
    expect(FIELD_KEY_MAP.experience).toContain("experiencia laboral");
    expect(FIELD_KEY_MAP.experience).toContain("berufserfahrung");

    const document = [
      "## Expérience Professionnelle",
      "Ingénieure Logicielle chez Exemple",
      "## Educación",
      "Máster en Informática",
      "## Kompetenzen",
      "TypeScript, Gestion",
      "## Idiomas",
      "Francés (C1), Español (B2)",
      "## Erfolge",
      "Prix de l'innovation",
    ].join("\n");

    const sections = parseLLMSections(document).sections;
    const keys = sections.map((section) => section.fieldKey);

    expect(keys).toEqual(expect.arrayContaining([
      "experience",
      "education",
      "skills",
      "languages",
      "achievements",
    ]));
  });

  it("normalizes FR and ES phone formats to E.164", async () => {
    const { extractContactFromText } = await import("../../../convex/lib/parsing/contactExtractor.ts");

    const fr = extractContactFromText("Téléphone : 06 12 34 56 78", "FR");
    const es = extractContactFromText("Teléfono: 612 34 56 78", "ES");

    expect(fr.phones?.[0]).toBe("+33612345678");
    expect(es.phones?.[0]).toBe("+34612345678");
  });
});
