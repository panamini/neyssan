/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, no-empty -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
/* eslint-disable @typescript-eslint/no-misused-promises -- Existing async UI handlers are preserved for this release-gate cleanup; convert to explicit void wrappers in a focused follow-up. */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as convexReact from "convex/react";
import { api } from "../../convex/_generated/api";
import * as browserParser from "../services/pdf/browser-cv-parser";
import { clientFormatCompleteCV } from "../utils/simpleClientParse";
import { parseRefinedMarkdown } from "../utils/parseRefinedMarkdown";
import { useAuth } from "@clerk/clerk-react";
import { getConvexUrl } from "../lib/convex-env";

/**
 * Minimal shape used by UI for suggestions (kept compatible with ProfileReviewModal)
 */
export interface RefinedContent {
  summary?: string;
  skills?: string;
  experience?: string;
  education?: string;
  achievements?: string;
}

/**
 * Section format expected by CVDocumentReviewer (kept compatible with ProfileReviewModal)
 */
export interface IReviewerSection {
  id: string;
  title: string;
  content: string;
  fieldKey: string;
  dismissed?: boolean;
}

/**
 * Hook state shape returned to callers
 */
export interface UseCvParserState {
  isParsing: boolean;
  isRefining: boolean;
  suggestions: RefinedContent | null;
  mappedSections: IReviewerSection[];
  error: string | null;
  parseFile: (file: File) => Promise<void>;
  // Expose job tracking so callers can show jobId/spinner/status
  jobId: string | null;
  isPolling: boolean;
  // Last normalized payload from server for callers that need typed sections
  lastNormalized?: unknown | null;
  // Source tag for lastNormalized (only "server" is forwarded to UI import)
  lastNormalizedSource?: "client" | "server" | null;
}

/**
 * useCvParser
 *
 * Extracted logic from ProfileReviewModal: client parsing, immediate suggestions display,
 * enqueueing server refine, polling job status and applying higher-quality server results.
 *
 * Notes:
 * - This hook uses Convex client mutations/actions when available and falls back to HTTP endpoints.
 * - It uses Clerk's useAuth to obtain an auth token for HTTP fallbacks. If Clerk is absent,
 *   authenticated HTTP fallbacks will fail gracefully and the hook will still provide client-side parsed suggestions.
 */
export function useCvParser(): UseCvParserState {
  const { getToken } = useAuth();
  // Convex mutations/actions (mirror usage in ProfileReviewModal)
  const startRefineMutation = (convexReact as any).useMutation((api as any)["llm"]?.startRefineByString);
  const formatCompleteAction = (convexReact as any).useAction ? (convexReact as any).useAction((api as any)["actions/formatCompleteCV"]?.formatCompleteCV) : undefined;
  // New: strict extractor with sections passthrough for 1:1 UI reconstruction
  const extractStrictAction = (convexReact as any).useAction
    ? (convexReact as any).useAction((api as any)["actions/extractProfileStrictWithSpans"]?.extractProfileStrictWithSpans)
    : undefined;

  const CONVEX_URL = (getConvexUrl() ?? "");
  const CONVEX_SITE_URL = CONVEX_URL.replace?.(".cloud", ".site") ?? CONVEX_URL;
  // Allow tests to override polling intervals/timeouts
  // Read TEST_POLL_* safely from globalThis or process when available; fall back to defaults.

  const _envPollInterval = (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.TEST_POLL_MS)
    ?? (typeof process !== 'undefined' ? (process as any).env?.TEST_POLL_MS : undefined)
    ?? '2000';
  const POLL_INTERVAL_MS = Number(_envPollInterval);

  const _envPollTimeout = (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.TEST_POLL_TIMEOUT_MS)
    ?? (typeof process !== 'undefined' ? (process as any).env?.TEST_POLL_TIMEOUT_MS : undefined)
    ?? '60000';
  const POLL_TIMEOUT_MS = Number(_envPollTimeout);

  const [isParsing, setIsParsing] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [suggestions, setSuggestions] = useState<RefinedContent | null>(null);
  const [mappedSections, setMappedSections] = useState<IReviewerSection[]>([]);
  const [error, setError] = useState<string | null>(null);
  // lastNormalized: store the most recent normalized payload (server only)
  const [lastNormalized, setLastNormalized] = useState<any | null>(null);
  const [lastNormalizedSource, setLastNormalizedSource] = useState<"client" | "server" | null>(null);

  // Internal refine/job tracking
  const pendingRefines = useRef<Record<string, Promise<string> | string>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Helper: authenticated fetch using Clerk token (mirrors ProfileReviewModal.authenticatedFetch)
  // NOTE: don't throw immediately if getToken is not yet available — attempt an unauthenticated
  // fetch as a best-effort fallback so parsing/refine can proceed in environments where Clerk
  // hasn't finished hydrating (this previously caused the first-upload race where the first
  // upload did not enqueue).
  const authenticatedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const baseHeaders = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    };
    // If getToken is available, try to obtain a token and include Authorization header.
    if (typeof getToken === "function") {
      try {
        const token = await getToken({ template: "convex" });
        if (token) {
          const headers = { ...baseHeaders, Authorization: `Bearer ${token}` };
          const res = await fetch(url, { ...options, headers });
          if (!res.ok) {
            let body = null;
            try { body = await res.json(); } catch (e) {}
            throw new Error((body && (body as any).message) || `Request failed with status ${res.status}`);
          }
          return res.json();
        }
        // if no token returned, fallthrough to unauthenticated fetch below
      } catch (e) {
        // Token retrieval failed (maybe Clerk not ready). Fall back to unauthenticated fetch.

        console.warn("[useCvParser] authenticatedFetch: could not get token, falling back to unauthenticated fetch:", String(e));
      }
    } else {
      // getToken not a function (Clerk not present); perform unauthenticated fetch.

      console.debug("[useCvParser] authenticatedFetch: getToken unavailable, performing unauthenticated fetch");
    }
    // Best-effort unauthenticated fetch fallback
    const res = await fetch(url, { ...options, headers: baseHeaders });
    if (!res.ok) {
      let body = null;
      try { body = await res.json(); } catch (e) {}
      throw new Error((body && (body as any).message) || `Request failed with status ${res.status}`);
    }
    return res.json();
  }, [getToken]);

  // callFormatCompleteCV: prefer convex action -> HTTP backend -> client fallback
  const callFormatCompleteCV = useCallback(async (rawText: string) => {
    let skipHttpFallback = false;
    try {
      if (typeof formatCompleteAction === "function") {
        try {
          const actionResult = await formatCompleteAction({ rawText });
          if (actionResult) {
            const normalized = (actionResult && typeof actionResult === "object" && "status" in actionResult && (actionResult as any).status === "ok" && "result" in actionResult)
              ? (actionResult as any).result
              : actionResult;
            return normalized;
          }
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          if (msg.includes("Could not find public function") || msg.includes("Did you forget to run `npx convex`")) {
            skipHttpFallback = true;
          }
        }
      }
    } catch {
      // continue to http fallback
    }

    if (!skipHttpFallback) {
      try {
        const res = await authenticatedFetch(`${CONVEX_SITE_URL}/formatCompleteCV`, {
          method: "POST",
          body: JSON.stringify({ rawText }),
        });
        if (res && res.status === "ok" && res.result) return res.result;
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        // swallow but continue to client fallback
        // If CORS or auth prevents HTTP fallback, fall back to client parser

        console.warn("callFormatCompleteCV.backendError:", msg);
      }
    }

    // client fallback
    try {
      const client = clientFormatCompleteCV(rawText);
      if (client && client.status === "ok" && client.result) return client.result;
    } catch (e) {
      // ignore
    }
    return null;
  }, [formatCompleteAction, authenticatedFetch, CONVEX_SITE_URL]);

  function shortHash(s: string) {
      let h = 5381;
      for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
      return Math.abs(h).toString(36).slice(0, 8);
    }

    /**
     * Build canonical reviewer sections from either a rawParsedSections array (preferred)
     * or from a normalized object that may contain summary/skills/experience/education fields.
     *
     * Ensures:
     * - deterministic ordering by canonicalOrder
     * - canonical titles mapped from fieldKey
     * - deterministic ids: prefer provided id, then fieldKey-based id, then shortHash of content
     */
    function buildSectionsFromNormalized(normalized: any): IReviewerSection[] {
      if (!normalized) return [];
      const canonicalOrder = ["summary", "skills", "experience", "education", "achievements"];
      const titleMap: Record<string, string> = {
        summary: "Summary",
        skills: "Skills",
        experience: "Experience",
        education: "Education",
        achievements: "Achievements",
      };

      // If explicit parsed sections exist, normalize and sort them into canonical order.
      const parsed = Array.isArray(normalized.rawParsedSections) ? normalized.rawParsedSections.map((s: any, idx: number) => {
        const fieldKey = (s.fieldKey && String(s.fieldKey)) || undefined;
        const content = s.content ?? s.text ?? s.body ?? "";
        const id = s.id ?? (fieldKey ? `${fieldKey}-${idx}` : `s-${shortHash(String(content).slice(0, 120) || (s.title ?? idx))}`);
        const title = s.title ?? (fieldKey ? (titleMap[fieldKey] ?? String(fieldKey)) : (s.title ?? `Section ${idx}`));
        return {
          id,
          title,
          content: String(content),
          fieldKey: fieldKey ?? "summary",
          dismissed: !!s.dismissed,
        } as IReviewerSection;
      }) : [];

      // If we have parsed sections, ensure deterministic ordering:
      if (parsed.length > 0) {
        // Group by fieldKey to pick canonical order, but keep original order for unknown keys.
        const byKey: Record<string, IReviewerSection[]> = {};
        parsed.forEach((p: IReviewerSection) => {
          const k = p.fieldKey ?? "other";
          byKey[k] = byKey[k] || [];
          byKey[k].push(p);
        });
        const ordered: IReviewerSection[] = [];
        for (const key of canonicalOrder) {
          if (byKey[key]) ordered.push(...byKey[key]);
        }
        // Append any others preserving their original relative order
        Object.keys(byKey).filter(k => !canonicalOrder.includes(k)).forEach(k => ordered.push(...byKey[k]));
        return ordered;
      }

      // Fallback: synthesize sections from normalized fields using canonical order.
      const synth: IReviewerSection[] = [];
      if (normalized.summary) synth.push({ id: "summary-0", title: titleMap.summary, content: String(normalized.summary), fieldKey: "summary", dismissed: false });
      if (normalized.skills || normalized.skillsText) synth.push({ id: "skills-0", title: titleMap.skills, content: Array.isArray(normalized.skills) ? normalized.skills.join(", ") : (normalized.skillsText ?? ""), fieldKey: "skills", dismissed: false });
      if (normalized.experienceText || normalized.experience) synth.push({ id: "experience-0", title: titleMap.experience, content: normalized.experienceText ?? (normalized.experience ? JSON.stringify(normalized.experience, null, 2) : ""), fieldKey: "experience", dismissed: false });
      if (normalized.educationText || normalized.education) synth.push({ id: "education-0", title: titleMap.education, content: normalized.educationText ?? (normalized.education ? JSON.stringify(normalized.education, null, 2) : ""), fieldKey: "education", dismissed: false });
      if (normalized.achievements) synth.push({ id: "achievements-0", title: titleMap.achievements, content: Array.isArray(normalized.achievements) ? normalized.achievements.join("\n") : String(normalized.achievements), fieldKey: "achievements", dismissed: false });
      return synth;
    }

  // Polling helper: perform a single poll operation for the provided job id.
  const doPoll = useCallback(async (jid: string) => {
    try {
      console.debug("[useCvParser] polling job status for jobId=", jid);
      const data = await authenticatedFetch(`${CONVEX_SITE_URL}/llm-refine`, {
        method: "POST",
        body: JSON.stringify({ jobId: jid }),
      });
      console.debug("[useCvParser] polling response", data);
      if (!data) return false;

      const status = data.status;
      if (status === "completed" || status === "finished") {
        // prefer server normalized payload
        const normalized = data?.result?.patch?.normalized ?? data?.result?.normalized ?? null;
        if (normalized) {
          try { setLastNormalized(normalized); setLastNormalizedSource("server"); } catch {}
          if ((normalized as any).warning === "repair_failed") {
            const snippet = (normalized as any).rawTextSnippet ?? String((data?.result?.full_response && JSON.stringify(data.result.full_response).slice(0,2000)) || "");
            setMappedSections([
              { id: "snippet-0", title: "Refine preview (partial)", content: snippet, fieldKey: "summary", dismissed: false },
            ]);
            setSuggestions({
              summary: snippet,
              skills: "",
              experience: "[]",
              education: "[]",
              achievements: undefined,
            });
            setError("Refinement completed but the result could not be fully repaired. Showing best-effort preview.");
            setIsPolling(false);
            setIsRefining(false);
            return true;
          }

          const sections = buildSectionsFromNormalized(normalized);
          setMappedSections(sections);

          setSuggestions({
            summary: normalized.summary ?? normalized.rawText ?? "",
            skills: Array.isArray(normalized.skills) ? normalized.skills.join(", ") : (normalized.skillsText ?? ""),
            experience: normalized.experienceText ?? (normalized.experience ? JSON.stringify(normalized.experience, null, 2) : undefined),
            education: normalized.educationText ?? (normalized.education ? JSON.stringify(normalized.education, null, 2) : undefined),
            achievements: normalized.achievements ?? undefined,
          });

          setIsPolling(false);
          setIsRefining(false);
          return true;
        }

        // If no normalized payload, try to extract provider text and attempt callFormatCompleteCV as a repair
        const fullResponse = data?.result?.full_response;
        const extractProviderText = (resp: any): string | null => {
          if (!resp) return null;
          try {
            const c = resp?.choices?.[0]?.message?.content;
            if (typeof c === "string" && c.trim().length > 0) return c;
          } catch {}
          try { if (typeof resp?.text === "string" && resp.text.trim().length > 0) return resp.text; } catch {}
          try { if (typeof resp?.output === "string" && resp.output.trim().length > 0) return resp.output; } catch {}
          try {
            const o0 = resp?.output?.[0];
            if (typeof o0?.content === "string" && o0.content.trim().length > 0) return o0.content;
            if (typeof o0?.text === "string" && o0.text.trim().length > 0) return o0.text;
            if (typeof o0?.content?.text === "string" && o0.content.text.trim().length > 0) return o0.content.text;
          } catch {}
          return null;
        };

        const providerText = extractProviderText(fullResponse);

        const callFormatWithTimeout = (text: string, ms = 8000) => {
          return Promise.race([
            callFormatCompleteCV(text),
            new Promise((_, reject) => setTimeout(() => reject(new Error("formatCompleteCV timeout")), ms))
          ]);
        };

        if (providerText) {
          try {
            const refinedFromAction = await callFormatWithTimeout(providerText, 8000);
            const meaningful = Boolean(
              refinedFromAction &&
              (
                (refinedFromAction.summary && String(refinedFromAction.summary).trim().length > 20) ||
                (Array.isArray(refinedFromAction?.rawParsedSections) && refinedFromAction.rawParsedSections.length > 0) ||
                (refinedFromAction.skills && ((Array.isArray(refinedFromAction.skills) && refinedFromAction.skills.length > 0) || (typeof refinedFromAction.skillsText === "string" && refinedFromAction.skillsText.trim().length > 0))) ||
                (refinedFromAction.experience && ((typeof refinedFromAction.experienceText === "string" && refinedFromAction.experienceText.trim().length > 0) || (Array.isArray(refinedFromAction.experience) && refinedFromAction.experience.length > 0))) ||
                (refinedFromAction.education && ((typeof refinedFromAction.educationText === "string" && refinedFromAction.educationText.trim().length > 0) || (Array.isArray(refinedFromAction.education) && refinedFromAction.education.length > 0)))
              )
            );

            if (meaningful) {
              const sections = buildSectionsFromNormalized(refinedFromAction);
              setMappedSections(sections);

              setSuggestions({
                summary: refinedFromAction.summary ?? providerText,
                skills: Array.isArray(refinedFromAction.skills) ? refinedFromAction.skills.join(", ") : (refinedFromAction.skillsText ?? ""),
                experience: refinedFromAction.experienceText ?? (refinedFromAction.experience ? JSON.stringify(refinedFromAction.experience, null, 2) : undefined),
                education: refinedFromAction.educationText ?? (refinedFromAction.education ? JSON.stringify(refinedFromAction.education, null, 2) : undefined),
                achievements: refinedFromAction.achievements ?? undefined,
              });

              setIsPolling(false);
              setIsRefining(false);
              return true;
            } else {
              const parsed = parseRefinedMarkdown(providerText);
              const parsedWithFallback = { ...parsed } as RefinedContent;
              if (!parsedWithFallback.summary || parsedWithFallback.summary.trim().length === 0) parsedWithFallback.summary = providerText;
              setSuggestions(parsedWithFallback);
              setIsPolling(false);
              setIsRefining(false);
              return true;
            }
          } catch (e) {
            // fall through to try full_response repair path
          }
        }

        try {
          const fallbackText = fullResponse ? JSON.stringify(fullResponse).slice(0, 2000) : "";
          const repaired = await callFormatWithTimeout(fallbackText, 8000);
          if (repaired) {
            const sections = buildSectionsFromNormalized(repaired);
            setMappedSections(sections);
            setSuggestions({
              summary: repaired.summary ?? fallbackText,
              skills: Array.isArray(repaired.skills) ? repaired.skills.join(", ") : (repaired.skillsText ?? ""),
              experience: repaired.experienceText ?? (repaired.experience ? JSON.stringify(repaired.experience, null, 2) : undefined),
              education: repaired.educationText ?? (repaired.education ? JSON.stringify(repaired.education, null, 2) : undefined),
              achievements: repaired.achievements ?? undefined,
            });
            setIsPolling(false);
            setIsRefining(false);
            return true;
          } else {
            const parsed = parseRefinedMarkdown(fallbackText);
            const parsedWithFallback = { ...parsed } as RefinedContent;
            if (!parsedWithFallback.summary || parsedWithFallback.summary.trim().length === 0) parsedWithFallback.summary = fallbackText;
            setSuggestions(parsedWithFallback);
            setIsPolling(false);
            setIsRefining(false);
            return true;
          }
        } catch (e) {
          // ignore final fallback errors
          setIsPolling(false);
          setIsRefining(false);
          return true;
        }
      } else if (status === "failed") {
        setError(data.message || "Refinement job failed");
        setIsPolling(false);
        setIsRefining(false);
        return true;
      } else {
        // status still running/enqueued; keep waiting
      }
    } catch (err) {
      setError(String(err));
      setIsPolling(false);
      setIsRefining(false);
      return true;
    }

    return false;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Pre-existing dependency contract is preserved for this release-gate cleanup.
  }, [authenticatedFetch, CONVEX_SITE_URL, callFormatCompleteCV, parseRefinedMarkdown]);

  // startRefine: enqueue refine job using Convex mutation or HTTP fallback
  const startRefine = useCallback(async (profileId: string, rawTextForRefine?: string) => {
    const raw = String(rawTextForRefine ?? "");
    const key = `${profileId}:${shortHash(raw.slice(0, 200))}`;

    const existing = pendingRefines.current[key];
    if (existing) {
      if (typeof existing === "string") {
        setJobId(existing);
        setIsRefining(true);
        setIsPolling(true);
        return existing;
      }
      try {
        const awaited = await (existing);
        pendingRefines.current[key] = awaited;
        setJobId(awaited);
        setIsRefining(true);
        setIsPolling(true);
        return awaited;
      } catch (e) {
        delete pendingRefines.current[key];
      }
    }

    const inflight = (async (): Promise<string> => {
      setIsRefining(true);
      console.debug("[useCvParser] startRefine: inflight started, profileId=", profileId, "rawPreview=", String(raw).slice(0,80));
      try {
        const payload = { profileId, rawText: raw };
        console.debug("[useCvParser] startRefine: payload prepared", { profileId });
        let skipHttpFallback = false;
        if (typeof startRefineMutation === "function") {
          try {
            console.debug("[useCvParser] startRefine: calling convex mutation startRefineMutation");
            const data = await startRefineMutation(payload);
            console.debug("[useCvParser] startRefine: mutation returned", data);
            if (data && typeof data === "object" && "status" in data && (data as any).status === "enqueued") {
              const jid = (data as any).jobId;
              setJobId(jid);
              // Perform a single immediate poll after enqueue.
              const handled = await doPoll(jid);
              if (!handled) setIsPolling(true);
              return jid;
            }
            if (typeof data === "string") {
              setJobId(data);
              const handled = await doPoll(data);
              if (!handled) setIsPolling(true);
              return data;
            }
            if (data && typeof data === "object" && ("_id" in data || "id" in data)) {
              const id = (data as any)._id ?? (data as any).id;
              if (id) {
                setJobId(id);
                const handled = await doPoll(id);
                if (!handled) setIsPolling(true);
                return id;
              }
            }
          } catch (e: any) {
            const msg = String(e?.message ?? e);
            console.debug("[useCvParser] startRefine: mutation threw", msg);
            if (msg.includes("Could not find public function") || msg.includes("Did you forget to run `npx convex`")) {
              skipHttpFallback = true;
              // fall through and let HTTP path handle or fail
            }
          }
        }

        if (!skipHttpFallback) {
          const data = await authenticatedFetch(`${CONVEX_SITE_URL}/llm-refine`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          if (data.status === "enqueued") {
            setJobId(data.jobId);
            const handled = await doPoll(data.jobId);
            if (!handled) setIsPolling(true);
            return data.jobId;
          }
          throw new Error("Failed to enqueue job");
        } else {
          setIsRefining(false);
          throw new Error("Convex actions unavailable");
        }
      } catch (err) {
        setIsRefining(false);
        throw err;
      }
    })();

    pendingRefines.current[key] = inflight;
    try {
      const job = await inflight;
      pendingRefines.current[key] = job;
      setTimeout(() => {
        try { delete pendingRefines.current[key]; } catch {}
      }, 30_000);
      return job;
    } catch (e) {
      try { delete pendingRefines.current[key]; } catch {}
      throw e;
    }
  }, [startRefineMutation, authenticatedFetch, CONVEX_SITE_URL, doPoll]);

  // handleCvParsed: set suggestions and mappedSections from a browser-parsed NormalizedProfile
  const handleCvParsed = useCallback(async (parsed: browserParser.NormalizedProfile) => {
    setIsParsing(false);
    setError(null);

    setSuggestions({
      summary: parsed.summary ?? parsed.rawText ?? "",
      skills: Array.isArray(parsed.skills) ? parsed.skills.join(", ") : "",
      experience: parsed.experience ? JSON.stringify(parsed.experience, null, 2) : "[]",
      education: parsed.rawText ? "[]" : "[]",
      achievements: undefined,
    });

    const sections: IReviewerSection[] = [
      { id: "summary-0", title: "Summary", content: parsed.summary ?? parsed.rawText ?? "", fieldKey: "summary", dismissed: false },
      { id: "skills-0", title: "Skills", content: Array.isArray(parsed.skills) ? parsed.skills.join(", ") : "", fieldKey: "skills", dismissed: false },
      { id: "experience-0", title: "Experience", content: parsed.experience ? JSON.stringify(parsed.experience, null, 2) : "[]", fieldKey: "experience", dismissed: false },
      { id: "education-0", title: "Education", content: parsed.rawText ? "[]" : "[]", fieldKey: "education", dismissed: false },
      { id: "achievements-0", title: "Achievements", content: "", fieldKey: "achievements", dismissed: false },
    ];
    setMappedSections(sections);
    // Do NOT set lastNormalized for client parse; we only expose server-normalized payloads.
  }, []);

  // Primary entrypoint: parse a File, show parsed suggestions and enqueue refine
  const parseFile = useCallback(async (file: File | ArrayBuffer | Uint8Array | Buffer) => {
    setIsParsing(true);
    setError(null);
    try {
      console.debug("[useCvParser] parseFile: starting parse", (file as any)?.name ?? typeof file);
      // Normalize input into ArrayBuffer
      let arrayBuffer: ArrayBuffer;
      // Prefer native File.arrayBuffer if available
      if (typeof (file as any)?.arrayBuffer === "function") {
        // Browser File with modern API

        arrayBuffer = await (file as any).arrayBuffer();
      } else if (typeof Blob !== "undefined" && file instanceof Blob && typeof Response !== "undefined") {
        // Some test runtimes expose Blob but not File.arrayBuffer; Response can convert a Blob to ArrayBuffer.
        // This covers jsdom/happy-dom cases where File.arrayBuffer may be missing.

        arrayBuffer = await (new Response(file as any)).arrayBuffer();
      } else if (file instanceof ArrayBuffer) {
        arrayBuffer = file;
      } else if (ArrayBuffer.isView(file)) {
        // TypedArray/ArrayBufferView may expose a SharedArrayBuffer; coerce to ArrayBuffer for our parser.
        arrayBuffer = (file as ArrayBufferView).buffer as unknown as ArrayBuffer;
      } else if (typeof Buffer !== "undefined" && (file as any) instanceof Buffer) {
        const buf = file as unknown as Buffer;
        arrayBuffer = (buf.buffer as unknown as ArrayBuffer).slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      } else {
        // Fallback attempt: if tests passed a plain object with .buffer

        const maybe = (file as any);
        if (maybe && maybe.buffer && (maybe.buffer instanceof ArrayBuffer || (typeof SharedArrayBuffer !== "undefined" && maybe.buffer instanceof SharedArrayBuffer))) {
          arrayBuffer = maybe.buffer as unknown as ArrayBuffer;
        } else {
          throw new Error("Unsupported file-like object: missing arrayBuffer or buffer");
        }
      }

      console.debug("[useCvParser] parseFile: obtained arrayBuffer length", arrayBuffer.byteLength);
      const parsed = await browserParser.parsePdfArrayBuffer(arrayBuffer);
      console.debug("[useCvParser] parseFile: browserParser returned parsed summary length", String(parsed?.summary ?? "").length);
      await handleCvParsed(parsed);
      // Kick off strict extractor immediately to obtain 1:1 sections + strict contact from Convex.
      try {
        if (typeof extractStrictAction === "function" && parsed?.rawText && String(parsed.rawText).trim().length > 0) {
          console.debug("[useCvParser] parseFile: calling extractProfileStrictWithSpans action");
          const strictResult = await extractStrictAction({ rawText: String(parsed.rawText) });
          if (strictResult && typeof strictResult === "object") {
            // Normalize into a shape consumed by buildSectionsFromNormalized in Sidebar:
            // - rawParsedSections: direct passthrough so UI can render original sections faithfully
            // - strict.profile: strict contact to overlay on Profile section (Sidebar already supports this)
            const normalizedFromStrict: any = {
              rawParsedSections: Array.isArray((strictResult as any).sections) ? (strictResult as any).sections : [],
              strict: { profile: (strictResult as any).profile ?? null },
              // keep for potential future use/diagnostics
              metadata: (strictResult as any).metadata ?? null,
              cv: (strictResult as any).cv ?? null,
            };
            try { setLastNormalized(normalizedFromStrict); setLastNormalizedSource("server"); } catch {}
          }
        }
      } catch (e) {

        console.warn("[useCvParser] extractProfileStrictWithSpans action failed (continuing refine path):", String((e as any)?.message ?? e));
      }
      // Use a temporary profileId for server refine since ensureSavedForRefine is not part of this hook.
      // Caller components that need persistence should save the profile separately and may call startRefine themselves.
      const tempProfileId = (crypto as any).randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      try {
        // Ensure the UI shows refining state immediately while enqueue happens.
        setIsRefining(true);
        // Fire-and-forget the refine enqueue but attach diagnostics so we can observe outcome in logs.
        console.debug("[useCvParser] parseFile: enqueue startRefine with tempProfileId", tempProfileId);
        const enqueueResult = startRefine(tempProfileId, parsed.rawText ?? "");
        if (enqueueResult && typeof (enqueueResult as any).then === "function") {
          // Log resolved job id or error when promise settles.
          (enqueueResult as any)
            .then((jid: string) => {
              console.debug("[useCvParser] parseFile: startRefine settled jobId=", jid);
            })
            .catch((err: any) => {
              console.warn("[useCvParser] parseFile: startRefine errored:", err);
              // If enqueue failed we should clear the refining state so UI doesn't show a spinner forever.
              setIsRefining(false);
            });
        } else {
          console.debug("[useCvParser] parseFile: startRefine returned synchronously:", enqueueResult);
        }
      } catch (e) {
        // enqueue failure should not block UI; surface minimal error and clear refining flag

        console.warn("startRefine failed:", e);
        setIsRefining(false);
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      console.debug("[useCvParser] parseFile: error", msg);
      setError(msg);
      setIsParsing(false);
      setIsRefining(false);

    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Pre-existing dependency contract is preserved for this release-gate cleanup.
  }, [handleCvParsed, startRefine]);

  // Polling effect: when a job is active poll until completed or failed.
  useEffect(() => {
    if (!isPolling || !jobId) return;

    let cancelled = false;

    const pollTimeout = setTimeout(() => {
      if (cancelled) return;
      setError("Refinement is taking longer than expected.");
      setIsPolling(false);
      setIsRefining(false);
    }, POLL_TIMEOUT_MS);

    const pollInterval = setInterval(async () => {
      if (cancelled) return;
      const handled = await doPoll(jobId);
      if (handled) {
        // The doPoll function already set the final state (completed/failed)
        // so we can stop the interval.
        if (!cancelled) {
          clearTimeout(pollTimeout);
          clearInterval(pollInterval);
        }
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(pollTimeout);
      clearInterval(pollInterval);
    };
  }, [isPolling, jobId, authenticatedFetch, CONVEX_SITE_URL, callFormatCompleteCV, doPoll, POLL_TIMEOUT_MS, POLL_INTERVAL_MS]);

  return {
    isParsing,
    isRefining,
    suggestions,
    mappedSections,
    error,
    parseFile,
    jobId,
    isPolling,
    lastNormalized,
    lastNormalizedSource,
  };
}
