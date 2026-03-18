  "use node";

  import { action } from "../_generated/server";
  import { v } from "convex/values";
  import { parseCV } from "../lib/parsing/hybridParser";
  import { mapParsedToStrict } from "../lib/parsing/strictProfileAdapter";
  import { buildSectionsFromLayout } from "../lib/parsing/cvMapper";
  import { requestNER, isNEREnabled } from "../lib/parsing_shared/nerClient";
  import { injectSkillEntities } from "../lib/parsing/skillUtils";
  interface ParsedSection {
    title: string;
    content: string;
    fieldKey: string;
    confidence: number;
  }

  interface ParsedMetadata {
    name: string | null;
    email: string | null;
    phone: string | null;
    linkedinUrl: string | null;
    spans?: unknown;
    confidences?: Record<string, number | null> | null;
  }

  interface ParsedCV {
    sections: ParsedSection[];
    metadata: ParsedMetadata | null;
    cv: unknown | null;
    method: "llm" | "heuristic" | string | null;
    warnings: string[];
  }

  function coerceParsedCV(input: unknown): ParsedCV {
    if (!input || typeof input !== "object") {
      return { sections: [], metadata: null, cv: null, method: null, warnings: [] };
    }
    const obj = input as Record<string, unknown>;

    const sectionsRaw = Array.isArray(obj.sections) ? (obj.sections as unknown[]) : [];
    const sections: ParsedSection[] = sectionsRaw
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const x = s as Record<string, unknown>;
        const title = typeof x.title === "string" ? x.title : "";
        const content = typeof x.content === "string" ? x.content : "";
        const fieldKey = typeof x.fieldKey === "string" ? x.fieldKey : "";
        const confidence = Number.isFinite(x.confidence) ? Number(x.confidence) : 0;
        if (!title && !content && !fieldKey) return null;
        return { title, content, fieldKey, confidence };
      })
      .filter((x): x is ParsedSection => !!x);

    let metadata: ParsedMetadata | null = null;
    if (obj.metadata && typeof obj.metadata === "object") {
      const m = obj.metadata as Record<string, unknown>;
      metadata = {
        name: m.name == null ? null : String(m.name),
        email: m.email == null ? null : String(m.email),
        phone: m.phone == null ? null : String(m.phone),
        linkedinUrl: m.linkedinUrl == null ? null : String(m.linkedinUrl),
        spans: (m as any)?.spans, // tolerated unknown
        confidences: (m as any)?.confidences as Record<string, number | null> | null | undefined,
      };
    }

    const method = typeof obj.method === "string" ? obj.method : null;
    const cv = Object.prototype.hasOwnProperty.call(obj, "cv") ? (obj.cv as unknown) : null;
    const warnings =
      Array.isArray(obj.warnings) && (obj.warnings as unknown[]).every((w) => typeof w === "string")
        ? (obj.warnings as string[])
        : [];

    return { sections, metadata, cv, method, warnings };
  }

  type StrictOut = ReturnType<typeof mapParsedToStrict>;
  type ExpItem = StrictOut["experience"][number];

  /**
   * Convex public action: extractProfileStrictWithSpans
   *
   * Returns:
   * - profile: StrictProfile (validated via Zod)
   * - spans: optional per-slot spans from LLM metadata if present
   * - confidences: optional LLM-reported per-slot confidences if present
   * - sections, metadata, cv: passthrough of original parser outputs for faithful UI reconstruction
   * - method, warnings: passthrough from parser for observability
   *
   * This action preserves the existing extractProfileStrict behavior for callers that
   * only need the strict profile, and additionally provides full parser artifacts so
   * the UI can reproduce the original section structure 1:1 when desired.
   */
  export const extractProfileStrictWithSpans = action({
    args: { rawText: v.string() },
    returns: v.any(),
    handler: async (_ctx, { rawText }) => {
      const parsed0 = await parseCV(rawText, { returnMappedCV: true, mapperStrip: true });
      const parsed = coerceParsedCV(parsed0);

      // Option C: Call spaCy-layout service (when enabled) and attach results under _ner for the adapter.
      let ner: unknown = null;
      try {
        if (isNEREnabled()) {
          ner = await requestNER(rawText, { timeoutMs: 2500, layout: true });
        }
      } catch {
        // best-effort, optional
      }
      let mappedCvCombined: unknown | null = parsed.cv;
      if (ner) {
        mappedCvCombined =
          parsed.cv && typeof parsed.cv === "object"
            ? { ...(parsed.cv as Record<string, unknown>), _ner: ner }
            : { _ner: ner };
      }

      try {
        const nerLayoutBlocks = (ner as any)?.layout?.blocks ?? (mappedCvCombined as any)?._ner?.layout?.blocks;
        if (Array.isArray(nerLayoutBlocks) && nerLayoutBlocks.length > 0) {
          const rebuilt = buildSectionsFromLayout(rawText, nerLayoutBlocks as any).map((s) => ({
            title: s.title,
            content: s.content,
            fieldKey: s.fieldKey,
            confidence: typeof s.confidence === "number" ? s.confidence : 0.85,
          }));
          if (rebuilt.length > 0) parsed.sections = rebuilt;
        }
      } catch { /* best effort */ }

      const nerEntities = Array.isArray((ner as any)?.entities) ? ((ner as any).entities as any[]) : undefined;
      if (nerEntities) {
        parsed.sections = await injectSkillEntities(parsed.sections, nerEntities);
      }

      let strict = mapParsedToStrict({
        rawText,
        parsedSections: parsed.sections,
        metadata: parsed.metadata,
        mappedCv: mappedCvCombined,
      });

      // If LLM parsing failed (heuristics path), cap confidences to ≤ 0.6 as per acceptance.
      if (parsed.method === "heuristic") {
        const cap = (n: number | null | undefined) => (typeof n === "number" ? Math.min(n, 0.6) : n ?? null);
        strict = {
          ...strict,
          confidences: {
            name: cap(strict.confidences.name),
            email: cap(strict.confidences.email),
            phone: cap(strict.confidences.phone),
            location: cap(strict.confidences.location),
          },
          experience: (strict.experience || []).map((e: ExpItem) => ({
            ...e,
            confidences: e.confidences
              ? {
                  company: cap(e.confidences.company),
                  position: cap(e.confidences.position),
                  startDate: cap(e.confidences.startDate),
                  endDate: cap(e.confidences.endDate),
                  isCurrent: cap(e.confidences.isCurrent),
                  achievements: cap(e.confidences.achievements),
                }
              : e.confidences,
          })),
        };
      }

      const profile = strict;

      // Pass through spans/confidences if the parser provided AI-first metadata extensions
      const spans = parsed.metadata?.spans ?? null;
      const metaConfidences = parsed.metadata?.confidences ?? null;

      return {
        profile,
        spans,
        confidences: metaConfidences,
        sections: parsed.sections,
        metadata: parsed.metadata,
        cv: (parsed as any)?.cv ?? null,
        // Convenience for UI: display-ready contacts from strict profile
        contacts: {
          email: (profile as any)?.email ?? null,
          phone: (profile as any)?.phone ?? null,
          location: (profile as any)?.location ?? null,
        },
        method: parsed.method ?? null,
        warnings: (parsed as any)?.warnings ?? [],
      };
    },
  });
