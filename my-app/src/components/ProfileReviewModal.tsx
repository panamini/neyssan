"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import LoadingSpinner from "./LoadingSpinner";
import CVLoader from "./CVLoader";
import { useAuth } from "@clerk/clerk-react";
import * as convexReact from "convex/react";
import { api } from "../../convex/_generated/api";
import { parseRefinedMarkdown, RefinedContent } from "../utils/parseRefinedMarkdown";
import { clientFormatCompleteCV } from "../utils/simpleClientParse";
import { RefinementField } from "./RefinementField";
import { Button } from "./ui/button";
import { useToast } from "./ui/toast";
import { CVDocumentReviewer } from "./CVDocumentReviewer";
import { INormalizedProfile, IReviewerSection, IProfileReviewProps, IExperienceItem, IEducationItem } from "../types/profile";

interface IDraftForm extends Partial<INormalizedProfile> {
  skillsText?: string;
  experienceText?: string;
  educationText?: string;
  achievementsText?: string;
  metadata?: Record<string, unknown>;
  confidence?: number;
}


// --- Constants and Helpers ---
const CONVEX_URL = import.meta.env?.VITE_CONVEX_URL ?? "";
const CONVEX_SITE_URL = CONVEX_URL.replace('.cloud', '.site');

export default function ProfileReviewModal({ visible, parsedProfile, onClose, onSaved }: IProfileReviewProps) {
  const [form, setForm] = useState<IDraftForm>({});
  const [rawTextLocal, setRawTextLocal] = useState('');
  const [savedProfileId, setSavedProfileId] = useState<string | null>(null);
  const [profileVersion, setProfileVersion] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // State for the refinement process
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading_cv' | 'refining' | 'saving' | 'completed' | 'failed' | 'enqueued' | 'running' | null>('idle');
  const [, setResult] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(false);
  const { showToast } = useToast();

  // Phase 1: explicit state separation
  // canonicalProfile: authoritative data loaded from DB (source of truth)
  // form (draft) remains the user's editable state
  // suggestions: non-destructive suggestions from CV parsing or AI refine
  const [canonicalProfile, setCanonicalProfile] = useState<Partial<INormalizedProfile> | null>(null);
  const [suggestions, setSuggestions] = useState<RefinedContent | null>(null);
  // Confirmation + undo snapshot for accepting suggestions
  const [confirmAccept, setConfirmAccept] = useState<{ field: keyof RefinedContent; value: string } | null>(null);
  // lastAppliedSnapshot supports both per-field accepts and bulk 'Use remaining' accepts.
  // Use a string for `field` so we can store 'bulk' for multi-field applies.
  // Also snapshot previousSuggestions so Undo can fully restore the suggestions panel.
  const [lastAppliedSnapshot, setLastAppliedSnapshot] = useState<{ field: string; previousForm: IDraftForm; acceptedValue: string; previousSuggestions?: RefinedContent | null } | null>(null);
  
  /* CV Document Reviewer state (Flow B) */
  const [reviewerVisible, setReviewerVisible] = useState<boolean>(false);
  const [reviewerSections, setReviewerSections] = useState<IReviewerSection[]>([]);
  // Inline CV load error (shown inside modal instead of global toast)
  const [cvLoaderError, setCvLoaderError] = useState<string | null>(null);
  // When a parsedProfile originates from an in-modal CV parse, we set this flag so the
  // parsedProfile prop (if received) does not auto-initialize/overwrite the draft form.
  // handleCvParsed sets this flag before invoking any parent/prop updates; the parsedProfile
  // useEffect will then consume-and-clear it.
  const [skipParsedProfileInit, setSkipParsedProfileInit] = useState<boolean>(false);

  // Suppress immediate re-opening of the reviewer after a manual close or bulk-apply.
  // This prevents a late-arriving background refine from instantly re-showing the reviewer.
  const reviewerCloseSuppressedRef = useRef<number | null>(null);

  useEffect(() => {
    addDebug({ event: 'reviewer.visible.change', visible: reviewerVisible, suppressedSince: reviewerCloseSuppressedRef.current });
    if (reviewerVisible) {
      // If the reviewer was closed recently by user action or bulk apply, automatically re-hide it.
      const suppressedAt = reviewerCloseSuppressedRef.current;
      if (suppressedAt && (Date.now() - suppressedAt) < 5000) {
        addDebug({ event: 'reviewer.openSuppressedByRecentClose', ageMs: Date.now() - suppressedAt });
        // Re-hide to honor user's recent close action.
        setReviewerVisible(false);
      }
    }
  }, [reviewerVisible]);

  const { isSignedIn, isLoaded: clerkLoaded, getToken } = useAuth();
  // Use convexReact.* hooks so test mocks that only provide some hooks (e.g. useMutation)
  // continue to work. We cast to any when invoking to avoid tight typing with generated api.
  const saveProfileMutation = (convexReact as any).useMutation((api as any)["mutations/upsertProfile"]?.upsertProfile);
  const startRefineMutation = (convexReact as any).useMutation((api as any)["llm"]?.startRefineByString);
  // useAction may not be provided by test mocks; guard its presence.
  const formatCompleteAction = (convexReact as any).useAction ? (convexReact as any).useAction((api as any)["actions/formatCompleteCV"]?.formatCompleteCV) : undefined;
  
  // In-modal debug output (visible to users during repro)
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  function addDebug(value: any) {
    try {
      const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
      setDebugLines(prev => {
        const next = [...prev, `${new Date().toISOString()} ${text}`];
        return next.length > 100 ? next.slice(-100) : next;
      });
    } catch (e) {
      // ignore
    }
    try { console.debug(value); } catch (e) {}
  }

  const updateForm = useCallback((updates: Partial<IDraftForm>) => {
    addDebug({ event: 'updateForm', updates });
    setForm((prev: IDraftForm) => {
      const next = { ...prev, ...updates };
      addDebug({ event: 'updateForm.next', prev, next });
      return next;
    });
  }, []);
  
  // Trace form and visibility changes to help diagnose unexpected resets
  useEffect(() => {
    addDebug({ event: 'form.snapshot', form });
  }, [form]);
  
  useEffect(() => {
    addDebug({ event: 'visible.change', visible });
  }, [visible]);


  const handleExperienceChange = useCallback((val: string) => updateForm({ experienceText: val }), [updateForm]);
  const handleEducationChange = useCallback((val: string) => updateForm({ educationText: val }), [updateForm]);

  // Helper: determine whether the form currently contains any user-entered data.
  // The Save / Refine buttons should be enabled when the form has content (not empty).
  function isFormEmpty() {
    const primitives = [
      form.name,
      form.email,
      form.summary,
      form.skillsText,
      form.achievementsText,
      rawTextLocal
    ];
    for (const p of primitives) {
      if (typeof p === "string" && p.trim().length > 0) return false;
    }
    // Check JSON editors for non-empty arrays
    try {
      const exp = JSON.parse(form.experienceText ?? "[]");
      if (Array.isArray(exp) && exp.length > 0) return false;
    } catch {
      // If JSON is invalid, we treat it as non-empty to allow the user to attempt save
      return false;
    }
    try {
      const edu = JSON.parse(form.educationText ?? "[]");
      if (Array.isArray(edu) && edu.length > 0) return false;
    } catch {
      return false;
    }
    // suggestions presence also counts as content
    if (suggestions) return false;
    return true;
  }
  

  // Initialize canonical + draft states when a parsedProfile prop arrives.
  // Do not overwrite user's existing draft edits if they already exist.
  useEffect(() => {
    addDebug({ event: 'parsedProfile.effect.run', present: !!parsedProfile });
    if (parsedProfile) {
        // If this parsedProfile was produced by the in-modal CV parser, skip initializing the draft form.
        if (skipParsedProfileInit) {
          addDebug({ event: 'parsedProfile.init.skippedDueToInlineParse' });
          // Clear the flag so future parsedProfile updates behave normally.
          setSkipParsedProfileInit(false);
          // Still update IDs/raw text but avoid touching the user's draft.
          setRawTextLocal(parsedProfile.rawText ?? "");
          setSavedProfileId((parsedProfile as any).convexId ?? null);
          setProfileVersion(parsedProfile.version ?? null);
          setCanonicalProfile(parsedProfile);
          setMessage(null);
          // Do NOT populate the form here — parsed content should live in suggestions/reviewerSections only.
          return;
        }
        addDebug({ event: 'parsedProfile.init', id: (parsedProfile as any).id, convexId: (parsedProfile as any).convexId });
        setCanonicalProfile(parsedProfile);
    
        // Initialize draft form only when the draft is empty to avoid overwriting manual edits
        setForm((prev: IDraftForm) => {
          const isEmpty = !prev || Object.keys(prev).length === 0 || Object.values(prev).every(v => v === undefined || v === "");
          addDebug({ event: 'parsedProfile.init.checkEmpty', isEmpty, prev });
          if (isEmpty) {
            const initial: IDraftForm = {
              name: parsedProfile.name ?? "",
              email: parsedProfile.email ?? "",
              summary: parsedProfile.summary ?? "",
              skillsText: (parsedProfile.skills || []).join(", "),
              experienceText: JSON.stringify(parsedProfile.experience || [], null, 2),
              educationText: JSON.stringify(parsedProfile.education || parsedProfile.metadata?.education || [], null, 2),
              achievementsText: Array.isArray(parsedProfile.achievements) ? parsedProfile.achievements.join("\n") : String(parsedProfile.achievements ?? ""),
            };
            addDebug({ event: 'parsedProfile.init.initializing', initial });
            return initial;
          }
          return prev;
        });
    
        // Always update metadata/raw text and IDs without touching draft
        setRawTextLocal(parsedProfile.rawText ?? "");
        addDebug({ event: 'parsedProfile.init.convexId', convexId: (parsedProfile as any).convexId });
        setSavedProfileId((parsedProfile as any).convexId ?? null);
        setProfileVersion(parsedProfile.version ?? null);
        setMessage(null);
    
        // Reset suggestions when a new profile arrives; CV parsing will populate suggestions via handleCvParsed
        setSuggestions(null);
      }
  }, [parsedProfile]);
  
  // Ensure modal initializes from canonicalProfile when it becomes visible,
  // and do not rely on unmount to reset internal state. This keeps the draft
  // stable across open/close and ensures users' edits are preserved.
  useEffect(() => {
    addDebug({ event: 'visible.effect', visible });
    if (!visible) return;
    if (!canonicalProfile) return;
    setForm((prev: IDraftForm) => {
      const isEmpty = !prev || Object.keys(prev).length === 0 || Object.values(prev).every(v => v === undefined || v === "");
      addDebug({ event: 'visible.effect.init', isEmpty, canonicalPreview: { name: canonicalProfile.name, summaryLength: String(canonicalProfile.summary ?? "").length } });
      if (isEmpty) {
        const initial: IDraftForm = {
          name: canonicalProfile.name ?? "",
          email: canonicalProfile.email ?? "",
          summary: canonicalProfile.summary ?? "",
          skillsText: (canonicalProfile.skills || []).join(", "),
          experienceText: JSON.stringify(canonicalProfile.experience || [], null, 2),
          educationText: JSON.stringify(canonicalProfile.education || canonicalProfile.metadata?.education || [], null, 2),
          achievementsText: Array.isArray(canonicalProfile.achievements) ? canonicalProfile.achievements.join("\n") : String(canonicalProfile.achievements ?? ""),
        };
        addDebug({ event: 'visible.effect.initializingForm', initial });
        return initial;
      }
      return prev;
    });
    setRawTextLocal(canonicalProfile.rawText ?? "");
    setSavedProfileId((canonicalProfile as any).id ?? null);
    setProfileVersion(canonicalProfile.version ?? null);
    // Do not clobber suggestions here.
  }, [visible, canonicalProfile]);

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    if (!getToken) throw new Error('useAuth.getToken not available');
    const token = await getToken({ template: 'convex' });
    if (!token) throw new Error('Authentication token not available');
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
      Authorization: `Bearer ${token}`,
    };
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let body = null;
      try { body = await res.json(); } catch (e) {}
      throw new Error((body && (body).message) || `Request failed with status ${res.status}`);
    }
    return res.json();
  };

  // Helper: prefer Convex client action hardened parse, then HTTP fallback, then client parser.
  const callFormatCompleteCV = async (rawText: string) => {
    let skipHttpFallback = false;
    // Prefer Convex client action when available (avoids CORS and prefers websocket RPC)
    try {
      if (typeof formatCompleteAction === "function") {
        try {
          const actionResult = await formatCompleteAction({ rawText });
          if (actionResult) {
            // Normalize possible envelopes:
            // - actionResult may be the direct refined object
            // - or { status: 'ok', result: <refined> }
            const normalized = (actionResult && typeof actionResult === "object" && "status" in actionResult && (actionResult).status === "ok" && "result" in actionResult)
              ? (actionResult).result
              : actionResult;
            addDebug({ event: 'callFormatCompleteCV.convexAction', preview: String((normalized).summary ?? "").slice(0,200) });
            return normalized;
          }
          addDebug({ event: 'callFormatCompleteCV.convexActionNoResult', actionResult });
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          addDebug({ event: 'callFormatCompleteCV.convexActionError', error: msg });
          // If the Convex runtime reports the action is unavailable, avoid HTTP fallback
          if (msg.includes('Could not find public function') || msg.includes('Did you forget to run `npx convex')) {
            skipHttpFallback = true;
            try { showToast('Convex action not available: run `npx convex dev` or deploy the functions (npx convex deploy)', { variant: 'warning' }); } catch (e) {}
          }
        }
      }
    } catch (e) {
      // continue to http fallback
    }
  
    // HTTP fallback to backend hardened parse (keeps existing behavior for environments without Convex client)
    if (!skipHttpFallback) {
      try {
        const res = await authenticatedFetch(`${CONVEX_SITE_URL}/formatCompleteCV`, {
          method: 'POST',
          body: JSON.stringify({ rawText }),
        });
        if (res && res.status === 'ok' && res.result) {
          addDebug({ event: 'callFormatCompleteCV.backend', preview: String(res.result.summary ?? "").slice(0,200) });
          return res.result;
        }
        addDebug({ event: 'callFormatCompleteCV.backendNoResult', res });
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        addDebug({ event: 'callFormatCompleteCV.backendError', error: msg });
        // If the HTTP path is blocked by CORS, inform the developer and avoid repeated noisy attempts
        if (msg.includes('Failed to fetch') || msg.includes('403') || msg.includes('CORS') || msg.includes('preflight')) {
          try { showToast('Backend HTTP parse blocked by CORS. Prefer running Convex dev or use the client parser.', { variant: 'warning' }); } catch (e) {}
        }
      }
    } else {
      addDebug({ event: 'callFormatCompleteCV.skipHttpFallback', reason: 'convex action unavailable' });
    }
  
    // Fallback to lightweight client-side parse so reviewer still gets populated when backend is unreachable.
    try {
      const client = clientFormatCompleteCV(rawText);
      if (client && client.status === 'ok' && client.result) {
        addDebug({ event: 'callFormatCompleteCV.clientFallback', preview: String(client.result.summary ?? "").slice(0,200) });
        return client.result;
      }
      addDebug({ event: 'callFormatCompleteCV.clientNoResult', client });
    } catch (e) {
      addDebug({ event: 'callFormatCompleteCV.clientError', error: String(e) });
    }
    return null;
  };

  // Deduping/coalescing of startRefine calls to avoid double-enqueue from
  // parallel client flows (file-load + manual click). We key pendingRefines
  // by `${profileId}:${shortHash(rawTextPreview)}` and store either a promise
  // while inflight or the final jobId string once settled.
  const pendingRefines = useRef<Record<string, Promise<string> | string>>({});
  function shortHash(s: string) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
    // Return a short base36 string slice to keep keys readable
    return Math.abs(h).toString(36).slice(0, 8);
  }
  
  const startRefine = async (profileId: string, rawTextForRefine?: string) => {
    const raw = String(rawTextForRefine ?? rawTextLocal ?? "");
    const key = `${profileId}:${shortHash(raw.slice(0, 200))}`;
  
    // If there's an existing settled jobId, reuse it immediately
    const existing = pendingRefines.current[key];
    if (existing) {
      if (typeof existing === "string") {
        try { addDebug({ event: 'startRefine.reuse.settled', key, jobId: existing }); } catch (e) {}
        setJobId(existing);
        setStatus('enqueued');
        setIsPolling(true);
        return existing;
      }
      // existing is a promise -> await it and reuse result
      try {
        addDebug({ event: 'startRefine.reuse.inflight', key });
        const awaited = await (existing);
        pendingRefines.current[key] = awaited;
        setJobId(awaited);
        setStatus('enqueued');
        setIsPolling(true);
        return awaited;
      } catch (e) {
        // If the inflight promise failed, clear the entry and fall through to enqueue anew
        addDebug({ event: 'startRefine.reuse.inflightFailed', key, error: String(e) });
        delete pendingRefines.current[key];
      }
    }
  
    // Otherwise create a new inflight promise and store it immediately
    const inflight = (async (): Promise<string> => {
      // Debug: snapshot before starting refine
      try {
        console.debug('[ProfileReviewModal] startRefine called', {
          profileId,
          savedProfileId,
          profileVersion,
          status,
          rawTextLocalPreview: String(rawTextLocal).slice(0, 200),
          rawTextForRefinePreview: String(rawTextForRefine).slice(0, 200),
        });
      } catch (e) {
        // avoid breaking in restricted consoles
      }
  
      // Indicate local UI is starting refine for user feedback (do not override
      // this if another caller reuses the final job above).
      setStatus('refining');
  
      try {
        const payload = { profileId, rawText: raw };
        addDebug({ event: 'startRefine.payload', payload });
        try { console.debug('[ProfileReviewModal] enqueue refine payload', payload); } catch (e) {}
  
        // Prefer calling the Convex mutation via client SDK when available
        let skipHttpFallback = false;
        if (typeof startRefineMutation === "function") {
          try {
            const data = await startRefineMutation(payload);
            addDebug({ event: 'startRefine.mutationResponse', data });
  
            // Handle multiple possible shapes returned by Convex mutation:
            if (data && typeof data === "object" && "status" in data && (data).status === 'enqueued') {
              const jid = (data).jobId;
              setJobId(jid);
              setStatus('enqueued');
              setIsPolling(true);
              return jid;
            }
  
            if (typeof data === "string") {
              setJobId(data);
              setStatus('enqueued');
              setIsPolling(true);
              return data;
            }
            if (data && typeof data === "object" && ("_id" in data || "id" in data)) {
              const id = (data)._id ?? (data).id;
              if (id) {
                setJobId(id);
                setStatus('enqueued');
                setIsPolling(true);
                return id;
              }
            }
  
            addDebug({ event: 'startRefine.mutationEnqueueFailed', data });
            // fall through to HTTP fallback
          } catch (e: any) {
            const msg = String(e?.message ?? e);
            addDebug({ event: 'startRefine.mutationError', error: msg });
            if (msg.includes('Could not find public function') || msg.includes('Did you forget to run `npx convex')) {
              skipHttpFallback = true;
              try { showToast('Convex refine action not available: run `npx convex dev` or deploy the functions (npx convex deploy)', { variant: 'warning' }); } catch (e) {}
            }
            // fall through if not skipHttpFallback
          }
        }
  
        if (!skipHttpFallback) {
          // HTTP fallback: POST to the /llm-refine endpoint (keeps existing behavior)
          const data = await authenticatedFetch(`${CONVEX_SITE_URL}/llm-refine`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
  
          addDebug({ event: 'startRefine.response', data });
          try { console.debug('[ProfileReviewModal] /llm-refine response', data); } catch (e) {}
          if (data.status === 'enqueued') {
            setJobId(data.jobId);
            setStatus('enqueued');
            setIsPolling(true);
            return data.jobId;
          } else {
            addDebug({ event: 'startRefine.enqueueFailed', data });
            throw new Error('Failed to enqueue job');
          }
        } else {
          addDebug({ event: 'startRefine.skipHttpFallback', reason: 'convex mutation unavailable' });
          setMessage({ type: 'error', text: 'Refine cannot be started: Convex actions are not available in this environment.' });
          setStatus('failed');
          throw new Error('Convex actions unavailable');
        }
      } catch (err) {
        console.error('Start refine error:', err);
        setMessage({ type: 'error', text: String(err) });
        setStatus('failed');
        throw err;
      }
    })();
  
    pendingRefines.current[key] = inflight;
    try {
      const resultJobId = await inflight;
      // Replace promise with settled jobId for quick reuse
      pendingRefines.current[key] = resultJobId;
      // Cleanup the cache entry after a short window to avoid memory leaks
      setTimeout(() => {
        try { delete pendingRefines.current[key]; } catch (e) {}
      }, 30_000);
      return resultJobId;
    } catch (e) {
      // Clear failed inflight entry so retries can attempt again
      try { delete pendingRefines.current[key]; } catch (er) {}
      throw e;
    }
  };

  useEffect(() => {
    if (!isPolling || !jobId) return;

    const pollTimeout = setTimeout(() => {
      setMessage({ type: 'error', text: 'Refinement is taking longer than expected. Please check back in a few minutes.' });
      setIsPolling(false);
      setStatus('failed');
    }, 60000);

    const pollInterval = setInterval(async () => {
      if (!isPolling) return;
      try {
        const data = await authenticatedFetch(`${CONVEX_SITE_URL}/llm-refine`, {
          method: 'POST',
          body: JSON.stringify({ jobId }),
        });
        addDebug({ event: 'poll.response', data });
        setStatus(data.status);

        if (data.status === 'completed' || data.status === 'finished') {
          // Normalize server status into a client-side 'completed' for consistent handling
          addDebug({ event: 'poll.completed-or-finished.result', result: data.result, originalStatus: data.status });
          try { setStatus('completed'); } catch (e) {}
          setResult(data.result);

          // Prefer server-side repaired normalized parse (defensive - faster and more reliable).
          const normalized = data?.result?.patch?.normalized ?? data?.result?.normalized ?? null;
          if (normalized) {
            try {
              // If the server persisted a minimal "repair_failed" sentinel, treat this as a terminal
              // job with a best-effort preview rather than an in-progress refine. This prevents the UI
              // from spinning indefinitely when repair couldn't produce a full normalized parse.
              if ((normalized).warning === "repair_failed") {
                addDebug({ event: 'poll.serverNormalized.repairFailed', diagnostics: (normalized).diagnostics ?? null });
    
                // Use the rawTextSnippet (if present) to populate a minimal reviewer so the user can see
                // what the backend had and decide to retry or manually edit.
                const snippet = (normalized).rawTextSnippet ?? String((data?.result?.full_response && JSON.stringify(data.result.full_response).slice(0,2000)) || "");
                const fallbackSections: IReviewerSection[] = [
                  { id: 'snippet-0', title: 'Refine preview (partial)', content: snippet, fieldKey: 'summary', dismissed: false }
                ];
                setReviewerSections(fallbackSections);
    
                setReviewerVisible(true);
                setSuggestions({
                  summary: snippet,
                  skills: "",
                  experience: "[]",
                  education: "[]",
                  achievements: undefined,
                });
    
                setSkipParsedProfileInit(true);
                setMessage({ type: 'error', text: 'Refinement completed but the result could not be fully repaired. Showing best-effort preview — try again or edit manually.' });
                addDebug({ event: 'poll.appliedServerMinimalPreview', preview: snippet.slice(0,200) });
                setIsPolling(false);
                return;
              }
    
              addDebug({ event: 'poll.completed.usingServerNormalized', preview: String(normalized.summary ?? "").slice(0,200) });
    
              const sections: IReviewerSection[] = (normalized.rawParsedSections || []).map((s: any, idx: number) => ({
                id: s.id ?? `section-${idx}`,
                title: s.title ?? s.fieldKey ?? `Section ${idx}`,
                content: s.content ?? "",
                fieldKey: s.fieldKey ?? "summary",
                dismissed: !!s.dismissed,
              }));
    
              // Synthesize basic sections when rawParsedSections is empty but other fields exist
              if (!sections.length) {
                const synthSections: IReviewerSection[] = [];
                if (normalized.summary) synthSections.push({ id: 'summary-0', title: 'Summary', content: String(normalized.summary), fieldKey: 'summary', dismissed: false });
                if (normalized.skills || normalized.skillsText) synthSections.push({ id: 'skills-0', title: 'Skills', content: Array.isArray(normalized.skills) ? normalized.skills.join(", ") : (normalized.skillsText ?? ""), fieldKey: 'skills', dismissed: false });
                if (normalized.experienceText || normalized.experience) synthSections.push({ id: 'experience-0', title: 'Experience', content: normalized.experienceText ?? (normalized.experience ? JSON.stringify(normalized.experience, null, 2) : ""), fieldKey: 'experience', dismissed: false });
                if (normalized.educationText || normalized.education) synthSections.push({ id: 'education-0', title: 'Education', content: normalized.educationText ?? (normalized.education ? JSON.stringify(normalized.education, null, 2) : ""), fieldKey: 'education', dismissed: false });
                if (synthSections.length) setReviewerSections(synthSections);
                else setReviewerSections(sections);
              } else {
                setReviewerSections(sections);
              }
    
              setReviewerVisible(true);
              setSuggestions({
                summary: normalized.summary ?? normalized.rawText ?? "",
                skills: Array.isArray(normalized.skills) ? normalized.skills.join(", ") : (normalized.skillsText ?? ""),
                experience: normalized.experienceText ?? (normalized.experience ? JSON.stringify(normalized.experience, null, 2) : undefined),
                education: normalized.educationText ?? (normalized.education ? JSON.stringify(normalized.education, null, 2) : undefined),
                achievements: normalized.achievements ?? undefined,
              });
              setSkipParsedProfileInit(true);
              addDebug({ event: 'poll.appliedServerNormalized', preview: { summaryLength: String(normalized.summary ?? "").length } });
            } catch (e) {
              addDebug({ event: 'poll.applyServerNormalized.error', error: String(e) });
            } finally {
              setIsPolling(false);
            }
          } else {
            // No server-normalized payload — fall back to robust provider-text extraction + server/client repair
            let providerText: string | null = null;
            try {
              const fullResponse = data?.result?.full_response;
              addDebug({ event: 'poll.completed.fullResponseShape', keys: fullResponse ? Object.keys(fullResponse) : null });

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

              providerText = extractProviderText(fullResponse);
              addDebug({ event: 'poll.completed.contentCandidates', providerTextPresent: !!providerText, providerTextPreview: providerText ? String(providerText).slice(0,200) : null });

              const callFormatWithTimeout = (text: string, ms = 8000) => {
                return Promise.race([
                  callFormatCompleteCV(text),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('formatCompleteCV timeout')), ms))
                ]);
              };

              if (providerText) {
                let refinedFromAction: any = null;
                try {
                  refinedFromAction = await callFormatWithTimeout(providerText, 8000);
                  addDebug({ event: 'poll.formatCompleteCV.result', preview: String(refinedFromAction?.summary ?? "").slice(0,200) });
                } catch (e) {
                  addDebug({ event: 'poll.formatCompleteCV.errorOrTimeout', error: String(e) });
                }

                const isMeaningful = Boolean(
                  refinedFromAction &&
                  (
                    (refinedFromAction.summary && String(refinedFromAction.summary).trim().length > 20) ||
                    (Array.isArray(refinedFromAction?.rawParsedSections) && refinedFromAction.rawParsedSections.length > 0) ||
                    (refinedFromAction.skills && ((Array.isArray(refinedFromAction.skills) && refinedFromAction.skills.length > 0) || (typeof refinedFromAction.skillsText === "string" && refinedFromAction.skillsText.trim().length > 0))) ||
                    (refinedFromAction.experience && ((typeof refinedFromAction.experienceText === "string" && refinedFromAction.experienceText.trim().length > 0) || (Array.isArray(refinedFromAction.experience) && refinedFromAction.experience.length > 0))) ||
                    (refinedFromAction.education && ((typeof refinedFromAction.educationText === "string" && refinedFromAction.educationText.trim().length > 0) || (Array.isArray(refinedFromAction.education) && refinedFromAction.education.length > 0)))
                  )
                );

                if (isMeaningful) {
                  const sections: IReviewerSection[] = (refinedFromAction.rawParsedSections || []).map((s: any, idx: number) => ({
                    id: s.id ?? `section-${idx}`,
                    title: s.title ?? s.fieldKey ?? `Section ${idx}`,
                    content: s.content ?? "",
                    fieldKey: s.fieldKey ?? "summary",
                    dismissed: !!s.dismissed,
                  }));
                  if (!sections.length) {
                    const synthSections: IReviewerSection[] = [];
                    if (refinedFromAction.summary) synthSections.push({ id: 'summary-0', title: 'Summary', content: String(refinedFromAction.summary), fieldKey: 'summary', dismissed: false });
                    if (refinedFromAction.skills || refinedFromAction.skillsText) synthSections.push({ id: 'skills-0', title: 'Skills', content: Array.isArray(refinedFromAction.skills) ? refinedFromAction.skills.join(", ") : (refinedFromAction.skillsText ?? ""), fieldKey: 'skills', dismissed: false });
                    if (refinedFromAction.experienceText || refinedFromAction.experience) synthSections.push({ id: 'experience-0', title: 'Experience', content: refinedFromAction.experienceText ?? (refinedFromAction.experience ? JSON.stringify(refinedFromAction.experience, null, 2) : ""), fieldKey: 'experience', dismissed: false });
                    if (refinedFromAction.educationText || refinedFromAction.education) synthSections.push({ id: 'education-0', title: 'Education', content: refinedFromAction.educationText ?? (refinedFromAction.education ? JSON.stringify(refinedFromAction.education, null, 2) : ""), fieldKey: 'education', dismissed: false });
                    if (synthSections.length) {
                      setReviewerSections(synthSections);
                    } else {
                      setReviewerSections(sections);
                    }
                  } else {
                    setReviewerSections(sections);
                  }

                  setReviewerVisible(true);
                  setSuggestions({
                    summary: refinedFromAction.summary ?? providerText,
                    skills: Array.isArray(refinedFromAction.skills) ? refinedFromAction.skills.join(", ") : (refinedFromAction.skillsText ?? ""),
                    experience: refinedFromAction.experienceText ?? (refinedFromAction.experience ? JSON.stringify(refinedFromAction.experience, null, 2) : undefined),
                    education: refinedFromAction.educationText ?? (refinedFromAction.education ? JSON.stringify(refinedFromAction.education, null, 2) : undefined),
                    achievements: refinedFromAction.achievements ?? undefined,
                  });
                  setSkipParsedProfileInit(true);
                  addDebug({ event: 'poll.formatCompleteCV.appliedToReviewer', preview: { summaryLength: String(refinedFromAction.summary ?? "").length } });
                } else {
                  addDebug({ event: 'poll.formatCompleteCV.ignoredOrEmpty', refinedFromAction });
                  const parsed = parseRefinedMarkdown(providerText);
                  const parsedWithFallback = { ...parsed };
                  if (!parsedWithFallback.summary || parsedWithFallback.summary.trim().length === 0) parsedWithFallback.summary = providerText;
                  setSuggestions(parsedWithFallback);
                  addDebug({ event: 'poll.formatCompleteCV.fallbackToClientParse', parsedWithFallback });
                }
              } else {
                // No provider textual content found; attempt server repair on fullResponse string if possible
                try {
                  const fallbackText = fullResponse ? JSON.stringify(fullResponse).slice(0, 2000) : "";
                  let repaired: any = null;
                  try {
                    repaired = await callFormatWithTimeout(fallbackText, 8000);
                    addDebug({ event: 'poll.formatCompleteCV.repairedFromFullResponse', preview: String(repaired?.summary ?? "").slice(0,200) });
                  } catch (e) {
                    addDebug({ event: 'poll.formatCompleteCV.repairFailedOrTimeout', error: String(e) });
                  }
                  if (repaired) {
                    const sections: IReviewerSection[] = (repaired.rawParsedSections || []).map((s: any, idx: number) => ({
                      id: s.id ?? `section-${idx}`,
                      title: s.title ?? s.fieldKey ?? `Section ${idx}`,
                      content: s.content ?? "",
                      fieldKey: s.fieldKey ?? "summary",
                      dismissed: !!s.dismissed,
                    }));
                    setReviewerSections(sections.length ? sections : []);
                    setReviewerVisible(true);
                    setSuggestions({
                      summary: repaired.summary ?? fallbackText,
                      skills: Array.isArray(repaired.skills) ? repaired.skills.join(", ") : (repaired.skillsText ?? ""),
                      experience: repaired.experienceText ?? (repaired.experience ? JSON.stringify(repaired.experience, null, 2) : undefined),
                      education: repaired.educationText ?? (repaired.education ? JSON.stringify(repaired.education, null, 2) : undefined),
                      achievements: repaired.achievements ?? undefined,
                    });
                    setSkipParsedProfileInit(true);
                    addDebug({ event: 'poll.formatCompleteCV.appliedToReviewerFromFullResponse', preview: { summaryLength: String(repaired.summary ?? "").length } });
                  } else {
                    const parsed = parseRefinedMarkdown(fallbackText);
                    const parsedWithFallback = { ...parsed };
                    if (!parsedWithFallback.summary || parsedWithFallback.summary.trim().length === 0) parsedWithFallback.summary = fallbackText;
                    setSuggestions(parsedWithFallback);
                    addDebug({ event: 'poll.formatCompleteCV.finalClientFallback', parsedWithFallback });
                  }
                } catch (e) {
                  addDebug({ event: 'poll.formatCompleteCV.finalFallbackError', error: String(e) });
                }
              }
            } catch (err) {
              console.error('Polling error:', err);
              setMessage({ type: 'error', text: String(err) });
            } finally {
              setIsPolling(false);
            }
          }
        } else if (data.status === 'failed') {
          addDebug({ event: 'poll.failed', data });
          setMessage({ type: 'error', text: data.message || 'Job failed' });
          setIsPolling(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
        setMessage({ type: 'error', text: String(err) });
        setIsPolling(false);
      }
    }, 2000);

    return () => {
      clearTimeout(pollTimeout);
      clearInterval(pollInterval);
    }
  }, [isPolling, jobId]);

  const handleSave = async (notifyParent = true) => {
    addDebug({ event: 'handleSave.invoked', notifyParent, savedProfileId, profileVersion });
    if (!clerkLoaded || !isSignedIn) {
      setMessage({ type: 'error', text: "You must be signed in to save profiles." });
      return null;
    }
  
    setStatus('saving');
    setMessage(null);
  
    const skills: string[] = form.skillsText?.split(",").map((s: string) => s.trim()).filter(Boolean) ?? [];
    let experience: IExperienceItem[] = [];
    try {
      experience = JSON.parse(form.experienceText || "[]");
    } catch (e) {
      addDebug({ event: 'handleSave.invalidJson', field: 'experienceText', error: String(e), snippet: String(form.experienceText ?? '').slice(0,200) });
      // Skip including experience in the saved payload; leave experience as an empty array
      experience = [];
    }
    let education: IEducationItem[] = [];
    try {
      education = JSON.parse(form.educationText || "[]");
    } catch (e) {
      addDebug({ event: 'handleSave.invalidJson', field: 'educationText', error: String(e), snippet: String(form.educationText ?? '').slice(0,200) });
      // Skip including education in the saved payload; leave education as an empty array
      education = [];
    }
    const achievements = form.achievementsText?.split("\n").map((s: string) => s.trim()).filter(Boolean) ?? [];
  
    const profileObj = {
      // Use undefined for optional fields to avoid sending nulls that violate Convex validators.
      name: form.name ?? undefined,
      // email is required by schema; send empty string when missing.
      email: form.email ?? "",
      summary: form.summary ?? undefined,
      skills: skills.length ? skills : undefined,
      experience: experience.length ? experience : undefined,
      education: education.length ? education : undefined,
      achievements: achievements.length ? achievements : undefined,
      raw_text: rawTextLocal ?? undefined,
      confidence: form.confidence ?? 0,
      metadata: { ...form.metadata, reviewedAt: Date.now(), reviewedBy: "frontend_review", refined: suggestions ?? undefined },
    };
  
    try {
      const profileId = savedProfileId ?? (crypto as any).randomUUID();
      const idempotencyKey = (crypto as any).randomUUID();
  
      addDebug({ event: 'handleSave.saving', profileId, idempotencyKey, preview: { name: profileObj.name, email: profileObj.email, summaryLength: String(profileObj.summary ?? "").length } });
      const res = await saveProfileMutation({
        profileId,
        idempotencyKey,
        source: "frontend_confirm_save",
        version: profileVersion ?? 1,
        profile: profileObj,
      });
  
      addDebug({ event: 'handleSave.saveResult', res });
      if (!res || !res.profileId) throw new Error("Failed to save profile");
      
      const convexId = (res).convexId ?? res.profileId;
      setSavedProfileId(convexId);
      if (res.updatedAt) {
        setProfileVersion(typeof res.updatedAt === 'number' ? Math.floor(res.updatedAt / 1000) : profileVersion);
      }
  
      // Update canonicalProfile to reflect the authoritative saved state.
      setCanonicalProfile({
        id: convexId,
        name: profileObj.name ?? "",
        email: profileObj.email ?? "",
        summary: profileObj.summary ?? undefined,
        skills: profileObj.skills ?? undefined,
        experience: profileObj.experience ?? undefined,
        education: profileObj.education ?? undefined,
        achievements: profileObj.achievements ?? undefined,
        rawText: profileObj.raw_text ?? undefined,
        version: profileVersion ?? undefined,
      });
  
      setMessage({ type: 'success', text: "Profile saved" });
      if (notifyParent && onSaved) {
        addDebug({ event: 'handleSave.onSaved', result: res });
        onSaved(res);
      }
      addDebug({ event: 'handleSave.return', convexId });
      return convexId;
    } catch (e) {
      setMessage({ type: 'error', text: (e as Error).message || "Save failed" });
      console.error('[ProfileReviewModal] handleSave error:', e);
      return null;
    } finally {
      setStatus('idle');
    }
  };

  // Handle inline edits coming from the reviewer (Flow B).
  // Map section edits directly into the editable draft (form) so Preview/autosave
  // can persist immediately. Placed after handleSave/updateForm so dependencies exist.
  const handleReviewerEdit = useCallback((id: string, newContent: string) => {
    // Update reviewerSections and capture fieldKey from the previous state
    let mappedFieldKey: string | undefined;
    setReviewerSections(prev => {
      const prevSection = prev.find(s => s.id === id);
      mappedFieldKey = prevSection?.fieldKey;
      return prev.map(s => s.id === id ? { ...s, content: newContent } : s);
    });

    // Merge into draft when section maps to a known fieldKey
    const fieldKey = mappedFieldKey as any;
    if (fieldKey) {
      switch (fieldKey) {
        case "summary":
          updateForm({ summary: newContent });
          break;
        case "skills":
          updateForm({ skillsText: String(newContent || "") });
          break;
        case "experience":
          updateForm({ experienceText: newContent });
          break;
        case "education":
          updateForm({ educationText: newContent });
          break;
        case "achievements":
          updateForm({ achievementsText: newContent });
          break;
        case "identity":
          break;
        default:
          break;
      }
    }

    // Immediately persist the change (non-destructive save) — fire-and-forget
    try {
      void handleSave(false);
    } catch (e) {
      addDebug({ event: 'handleReviewerEdit.saveError', error: String(e) });
    }
  }, [updateForm, handleSave]);

  // Auto-save: persist draft automatically after brief idle.
  // Replaces explicit Save button — saves non-destructively and keeps parent callbacks quiet.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        if (cancelled) return;
        // Only attempt save when there's content and user is signed in.
        if (!isFormEmpty()) {
          await handleSave(false);
        }
      } catch (e) {
        // handleSave logs errors; swallow here.
      }
    }, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // stringify form for shallow change detection
  }, [JSON.stringify(form), isSignedIn, clerkLoaded]);

  const ensureSavedForRefine = async () => {
    addDebug({ event: 'ensureSavedForRefine.invoked', savedProfileId });
    // If we already have a Convex id, use it directly.
    if (savedProfileId) {
      addDebug({ event: 'ensureSavedForRefine.returnExisting', savedProfileId });
      return savedProfileId;
    }
    // Otherwise, run a non-destructive save and return the definitive Convex id
    // produced by the save path (handleSave returns the convexId).
    const saved = await handleSave(false);
    addDebug({ event: 'ensureSavedForRefine.saved', saved });
    return saved;
  };
  
  const handleRefineClick = async () => {
    addDebug({ event: 'handleRefineClick.invoked', status, isFormEmpty: isFormEmpty() });
    // Snapshot the user's draft so we can restore it if the save path or parent callbacks
    // cause any temporary overwrite of the modal form.
    const formSnapshot = { ...form };
    const suggestionsSnapshot = suggestions ? { ...suggestions } : null;
    addDebug({ event: 'handleRefineClick.snapshot', formSnapshotPreview: { summaryLength: String(formSnapshot.summary ?? "").length } });
  
    setResult(null);
    setMessage(null);
  
    // Run save (non-destructive) to obtain a Convex id if needed.
    const profileIdToRefine = await ensureSavedForRefine();
    addDebug({ event: 'handleRefineClick.profileIdToRefine', profileIdToRefine });
  
    // Immediately restore the user's draft to avoid UI clearing while refine enqueues.
    try {
      setForm((prev: IDraftForm) => {
        // restore only if current draft appears empty or was replaced unexpectedly
        const currentlyEmpty = !prev || Object.values(prev).every(v => v === undefined || v === "");
        const snapshotEmpty = !formSnapshot || Object.values(formSnapshot).every(v => v === undefined || v === "");
        addDebug({ event: 'handleRefineClick.restoreCheck', currentlyEmpty, snapshotEmpty, prevPreview: { summaryLength: String(prev?.summary ?? "").length }, snapshotPreview: { summaryLength: String(formSnapshot?.summary ?? "").length } });
        // Restore if the current draft is empty but snapshot had content, or if snapshot differs.
        if (currentlyEmpty && !snapshotEmpty) {
          addDebug({ event: 'handleRefineClick.restoringSnapshot' });
          return { ...formSnapshot };
        }
        // If the draft differs from the snapshot unexpectedly, still re-apply the snapshot
        // to be defensive during this repro phase.
        const differs = JSON.stringify(prev) !== JSON.stringify(formSnapshot);
        if (differs) {
          addDebug({ event: 'handleRefineClick.forceRestoreBecauseDiffers' });
          return { ...formSnapshot };
        }
        return prev;
      });
      // also restore suggestions if they were lost
      if (suggestionsSnapshot) setSuggestions(suggestionsSnapshot);
    } catch (e) {
      addDebug({ event: 'handleRefineClick.restoreError', error: String(e) });
    }
  
    if (profileIdToRefine) {
      await startRefine(profileIdToRefine, rawTextLocal);
    }
  };

  const handleCvParsed = async (parsed: INormalizedProfile) => {
    setStatus('idle');
    addDebug({ event: 'handleCvParsed.invoked', parsedPreview: { name: parsed.name, email: parsed.email, rawLength: String(parsed.rawText ?? "").length } });

    // Directly update suggestions from the parsed content
    setSuggestions({
      summary: parsed.summary ?? parsed.rawText ?? "",
      skills: Array.isArray(parsed.skills) ? parsed.skills.join(", ") : "",
      experience: parsed.experience ? JSON.stringify(parsed.experience, null, 2) : "[]",
      education: parsed.education ? JSON.stringify(parsed.education, null, 2) : "[]",
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements.join("\n") : "",
    });

    // Populate reviewer sections for immediate display
    const sections: IReviewerSection[] = [
      { id: 'summary-0', title: 'Summary', content: parsed.summary ?? parsed.rawText ?? "", fieldKey: 'summary', dismissed: false },
      { id: 'skills-0', title: 'Skills', content: Array.isArray(parsed.skills) ? parsed.skills.join(", ") : "", fieldKey: 'skills', dismissed: false },
      { id: 'experience-0', title: 'Experience', content: parsed.experience ? JSON.stringify(parsed.experience, null, 2) : "[]", fieldKey: 'experience', dismissed: false },
      { id: 'education-0', title: 'Education', content: parsed.education ? JSON.stringify(parsed.education, null, 2) : "[]", fieldKey: 'education', dismissed: false },
      { id: 'achievements-0', title: 'Achievements', content: Array.isArray(parsed.achievements) ? parsed.achievements.join("\n") : "", fieldKey: 'achievements', dismissed: false },
    ];
    setReviewerSections(sections);
    setReviewerVisible(true);

    // Update metadata and IDs without touching draft
    setRawTextLocal(parsed.rawText ?? "");
    setSavedProfileId((parsed as any).convexId ?? null);
    setProfileVersion(parsed.version ?? null);

    // Prevent parsedProfile prop from overwriting the draft
    setSkipParsedProfileInit(true);
    addDebug({ event: 'handleCvParsed.complete', summaryPreviewLength: String(parsed.summary ?? "").length });
  };
  // When a CV is loaded, trigger the background AI refine flow without overwriting the draft.
  // Responsibilities:
  //  - Show immediate parsed content via handleCvParsed (fast feedback)
  //  - Harden the parsed text by calling formatCompleteCV and populate reviewerSections + suggestions
  //    (non-destructive: do not write into `form` or canonicalProfile)
  //  - Then enqueue the heavier LLM refine (/llm-refine) in background so long-running improvements can arrive later.
  const handleFileLoadAndRefine = async (parsed: INormalizedProfile) => {
    addDebug({ event: 'handleFileLoadAndRefine.invoked', parsedPreview: { name: parsed.name, rawLength: String(parsed.rawText ?? "").length } });
    // Directly show the parsed CV content in suggestions and the reviewer.
    await handleCvParsed(parsed);
  
    // Enqueue the heavier LLM refine in the background.
    try {
      const profileIdToRefine = await ensureSavedForRefine();
      if (profileIdToRefine) {
        void startRefine(profileIdToRefine, parsed.rawText ?? '');
      } else {
        addDebug({ event: 'handleFileLoadAndRefine.skipStartRefine.noProfileId' });
      }
    } catch (e) {
      addDebug({ event: 'handleFileLoadAndRefine.startRefine.error', error: String(e) });
    }
  };

  // Apply a suggestion into the editable draft form (non-destructive).
  const applySuggestion = useCallback((field: keyof RefinedContent) => {
    // Prompt for confirmation before applying; store candidate in confirmAccept
    const source = suggestions;
    if (!source) return;
    const val = source[field] as string | undefined | null;
    if (val === null || val === undefined) return;
    addDebug({ event: 'applySuggestion.request', field, preview: String(val).slice(0,200) });
    setConfirmAccept({ field, value: String(val) });
  }, [suggestions]);


  // Undo the last bulk or field-level application saved in lastAppliedSnapshot.
  const undoLastApplied = useCallback(() => {
    if (!lastAppliedSnapshot) {
      try { showToast("No undo available", { variant: "warning" }); } catch (e) {}
      return;
    }
    try {
      addDebug({ event: 'undoLastApplied', field: lastAppliedSnapshot.field });
      // Restore the draft form
      setForm({ ...(lastAppliedSnapshot.previousForm as any) });
      // Restore previous suggestions if we captured them, otherwise fall back to per-field behavior.
      if (lastAppliedSnapshot.previousSuggestions) {
        setSuggestions(lastAppliedSnapshot.previousSuggestions);
      } else {
        if (lastAppliedSnapshot.field !== 'bulk') {
          setSuggestions(prev => ({ ...(prev ?? {}), [lastAppliedSnapshot.field]: lastAppliedSnapshot.acceptedValue }));
        } else {
          setSuggestions(null);
        }
      }
      setLastAppliedSnapshot(null);
      try { showToast("Undo applied", { variant: "success" }); } catch (e) {}
    } catch (e) {
      addDebug({ event: 'undoLastApplied.error', error: String(e) });
      try { showToast("Undo failed", { variant: "error" }); } catch (e) {}
    }
  }, [lastAppliedSnapshot, setForm, setSuggestions, setLastAppliedSnapshot, showToast]);

  // Discard a suggestion by removing it from both `stagedEdits` and `suggestions`.
  const discardSuggestion = useCallback((field: keyof RefinedContent) => {
    setSuggestions(prev => {
      if (!prev) return prev;
      const next = { ...prev };
      delete (next as any)[field];
      return Object.keys(next).length > 0 ? next : null;
    });
  }, []);

  // Clear a specific field from the draft and remove any suggestions for it.
  const clearField = useCallback((field: keyof RefinedContent) => {
    // Clear from draft/form
    switch (field) {
      case "summary":
        updateForm({ summary: "" });
        break;
      case "skills":
        updateForm({ skillsText: "" });
        break;
      case "experience":
        updateForm({ experienceText: "[]" });
        break;
      case "education":
        updateForm({ educationText: "[]" });
        break;
      case "achievements":
        updateForm({ achievementsText: "" });
        break;
      default:
        break;
    }
 
    // Remove suggestion entries for the field
    setSuggestions(prev => {
      if (!prev) return prev;
      const next = { ...prev };
      delete (next as any)[field];
      return Object.keys(next).length > 0 ? next : null;
    });
  }, [updateForm]);

  useEffect(() => {
    if (message) {
      try {
        showToast(message.text, { variant: message.type === 'success' ? 'success' : 'error' });
      } catch (e) {
        // If toast provider isn't available for any reason, fall back to console
        console.warn("showToast failed:", e);
      }
      // Clear the ephemeral message since the toast now represents it
      setMessage(null);
    }
  }, [message, showToast]);


  if (!visible) return null;
 
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black">
      <div className="w-full max-w-4xl bg-background dark:bg-surface rounded-lg shadow-lg p-6 overflow-hidden max-h-[90vh] flex flex-col relative">
        {/* Global Spinner Overlay */}
        {(status === 'refining' || status === 'saving' || status === 'enqueued' || status === 'running') && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 dark:bg-surface/50">
            <LoadingSpinner />
            <span className="ml-2 text-muted dark:text-muted">{status}...</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {savedProfileId ? 'Review profile' : 'New profile'}
            {profileVersion !== null && <span className="ml-2 text-sm text-muted dark:text-gray-400">v{profileVersion}</span>}
          </h2>
          <button onClick={onClose} className="text-gray-400 transition hover:text-muted dark:hover:text-gray-400" aria-label="Close">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Save indicator (visible state for saves/refines) - removed SaveIndicator import to avoid build error */}

        {/* Main Content */}
        <div className="flex-1 mt-4 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col gap-6 md:flex-row">
            {/* Manual Review */}
            <div className="flex-1">
              <h3 className="mb-2 text-xl font-medium text-gray-800 dark:text-gray-200">Manual review</h3>
              <div className="space-y-4">
                <div className="mb-2">
                  <label className="text-sm font-medium text-muted dark:text-muted">Name</label>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => updateForm({ name: String(e.currentTarget.textContent ?? "").trim() })}
                    className="w-full px-1 py-1 border-b border-accent text-foreground bg-background dark:bg-surface"
                    role="textbox"
                    aria-label="Name"
                  >
                    {String(form.name ?? "")}
                  </div>
                </div>
                <div className="mb-2">
                  <label className="text-sm font-medium text-muted dark:text-muted">Email</label>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => updateForm({ email: String(e.currentTarget.textContent ?? "").trim() })}
                    className="w-full px-1 py-1 border-b border-accent text-foreground bg-background dark:bg-surface"
                    role="textbox"
                    aria-label="Email"
                  >
                    {String(form.email ?? "")}
                  </div>
                </div>
                <RefinementField
                  label="Summary"
                  value={String(form.summary ?? "")}
                  suggestion={suggestions?.summary ?? null}
                  isLoading={false}
                  onAccept={() => applySuggestion("summary")}
                  onDiscard={() => discardSuggestion("summary")}
                  onClear={() => clearField("summary")}
                  onChange={(val: string) => updateForm({ summary: String(val ?? "") })}
                  displayMode="text"
                />
                <RefinementField
                  label="Skills"
                  value={String(form.skillsText ?? "")}
                  suggestion={suggestions?.skills ?? null}
                  isLoading={false}
                  onAccept={() => applySuggestion("skills")}
                  onDiscard={() => discardSuggestion("skills")}
                  onClear={() => clearField("skills")}
                  onChange={(val: string) => updateForm({ skillsText: String(val ?? "") })}
                  displayMode="chips"
                />
                <RefinementField
                  label="Experience"
                  value={String(form.experienceText ?? "[]")}
                  suggestion={suggestions?.experience ?? null}
                  isLoading={false}
                  onAccept={() => applySuggestion("experience")}
                  onDiscard={() => discardSuggestion("experience")}
                  onClear={() => clearField("experience")}
                  onChange={handleExperienceChange}
                  displayMode="list"
                />

                <RefinementField
                  label="Education"
                  value={String(form.educationText ?? "[]")}
                  suggestion={suggestions?.education ?? null}
                  isLoading={false}
                  onAccept={() => applySuggestion("education")}
                  onDiscard={() => discardSuggestion("education")}
                  onClear={() => clearField("education")}
                  onChange={handleEducationChange}
                  displayMode="list"
                />

                <RefinementField
                  label="Achievements"
                  value={String(form.achievementsText ?? "")}
                  suggestion={suggestions?.achievements ?? null}
                  isLoading={false}
                  onAccept={() => applySuggestion("achievements")}
                  onDiscard={() => discardSuggestion("achievements")}
                  onClear={() => clearField("achievements")}
                  onChange={(val: string) => updateForm({ achievementsText: String(val ?? "") })}
                  displayMode="text"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Confirmation modal for applying a suggestion (appears when user clicks Load) */}
        {confirmAccept && (
          <div className="fixed inset-0 flex items-center justify-center p-4 bg-black z-60">
            <div className="w-full max-w-md p-6 rounded-lg shadow-lg bg-surface dark:bg-surface">
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Apply suggestion?</h3>
              <p className="mb-4 text-sm text-muted dark:text-gray-300">This will replace your current draft content for <strong>{String(confirmAccept.field)}</strong>. You can undo this action from the footer for one step.</p>
              <div className="p-2 mb-4 overflow-auto text-sm text-gray-800 whitespace-pre-wrap rounded max-h-40 bg-background dark:bg-surface dark:text-gray-100">{confirmAccept.value}</div>
              <div className="flex justify-end gap-2">
                <Button onClick={() =>{ setConfirmAccept(null); }} className="px-3 py-2 rounded-md bg-surface-muted">Cancel</Button>
                <Button onClick={() => {
                  void (async () => {
                    try {
                      const { field, value } = confirmAccept;
                      addDebug({ event: 'performAccept', field, preview: String(value).slice(0,200) });
                      // snapshot current draft and suggestions for undo (deep clone to avoid mutation)
                      setLastAppliedSnapshot({
                        field: String(field),
                        previousForm: JSON.parse(JSON.stringify(form)),
                        acceptedValue: value,
                        previousSuggestions: suggestions ? JSON.parse(JSON.stringify(suggestions)) : null,
                      });
                      // apply to draft
                      switch (field) {
                        case "skills":
                          updateForm({ skillsText: value.split(",").map(s => s.trim()).filter(Boolean).join(", ") });
                          break;
                        case "experience":
                          updateForm({ experienceText: value });
                          break;
                        case "education":
                          updateForm({ educationText: value });
                          break;
                        case "achievements": {
                          const lines = value.split(/\r?\n/).map(s => s.replace(/^[\-\*\•\s]+/, "").trim()).filter(Boolean);
                          updateForm({ achievementsText: lines.join("\n") });
                          break;
                        }
                        case "summary":
                          updateForm({ summary: value });
                          break;
                        default:
                          break;
                      }
                      // remove suggestion after applying
                      setSuggestions(prev => {
                        if (!prev) return null;
                        const next = { ...prev };
                        delete (next as any)[confirmAccept.field];
                        return Object.keys(next).length > 0 ? next : null;
                      });
                      setMessage({ type: 'success', text: 'Suggestion applied — you can Undo from the footer' });
                    } catch (e) {
                      addDebug({ event: 'performAccept.error', error: String(e) });
                      setMessage({ type: 'error', text: 'Failed to apply suggestion' });
                    } finally {
                      setConfirmAccept(null);
                    }
                  })();
                }} className="px-3 py-2 rounded-md text-background bg-accent">Apply</Button>
              </div>
            </div>
          </div>
        )}

        {/* Debug panel (visible for repro) */}
        <div className="mb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-muted">Debug trace</div>
            <div>
              <Button onClick={() =>setShowDebug(s => !s)} className="px-2 py-1 text-xs rounded bg-surface-muted">
                {showDebug ? "Hide debug" : "Show debug"}</Button>
              <Button onClick={() =>setDebugLines([])} className="px-2 py-1 ml-2 text-xs rounded bg-surface">Clear</Button>
            </div>
          </div>
          {showDebug && (
            <pre className="p-2 mt-2 overflow-auto text-xs bg-black rounded custom-scrollbar text-background max-h-40">
              {debugLines.length ? debugLines.join("\n") : "no debug lines yet"}
            </pre>
          )}
        </div>
        {/* Footer Action Bar */}
        <div className="flex items-center justify-start pt-4 mt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mr-auto">
            <CVLoader
              onFileParsed={(parsed) => {
                // Clear any previous inline error and launch the full file-load + background refine flow.
                // handleFileLoadAndRefine is responsible for immediate parsed display + hardened backend parse
                // and will not overwrite the user's draft.
                setCvLoaderError(null);
                void handleFileLoadAndRefine(parsed);
              }}
              onError={(text) => {
                // Show a subtle inline banner in the modal rather than a global toast.
                setCvLoaderError(text ?? "Failed to parse CV");
              }}
              /* onSuccess intentionally omitted to avoid distracting toast */
              label="Charger CV"
            />
            {lastAppliedSnapshot && (
              <Button onClick={() => { undoLastApplied(); }} className="px-2 py-1 text-sm rounded bg-surface-muted">
                Undo
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3 ml-4">
            <Button
              variant="primary"
              onClick={() => { void handleRefineClick(); }}
              disabled={status !== 'idle' || isFormEmpty()}
            >
              Raffiner AI
            </Button>
          </div>
          {/* Only Load CV + global Refine AI remain */}
        </div>

        {/* Inline CV loader error banner (non-blocking) */}
        {cvLoaderError && (
          <div role="alert" aria-live="assertive" className="mt-2 p-2 rounded border border-[var(--accent)] bg-[var(--background)] text-sm text-[var(--text-muted)]">
            {cvLoaderError}
          </div>
        )}

        {/* CV Document Reviewer overlay (Flow B) */}
        {reviewerVisible && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-60 bg-black/50">
            <div className="w-full max-w-5xl bg-[var(--background)] dark:bg-[var(--background)] rounded-lg shadow-lg p-4 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Review parsed CV</h3>
                <div className="flex items-center gap-2">
                  <Button onClick={() => { addDebug({ event: 'reviewer.manualClose' }); reviewerCloseSuppressedRef.current = Date.now(); setReviewerVisible(false); try { showToast("Closed reviewer — no changes applied", { variant: "warning" }); } catch (e) {} }} className="px-3 py-1 rounded bg-surface-muted">Close</Button>
                </div>
              </div>
 
              <div className="flex-1 overflow-auto custom-scrollbar">
                <CVDocumentReviewer
                  sections={reviewerSections}
                  onDismiss={(id) => {
                    setReviewerSections(prev => prev.map(s => s.id === id ? { ...s, dismissed: true } : s));
                  }}
                  onUndo={(id) => {
                    setReviewerSections(prev => prev.map(s => s.id === id ? { ...s, dismissed: false } : s));
                  }}
                  onEdit={handleReviewerEdit}
                />
              </div>
 
              <div className="flex justify-end gap-2 mt-3">
                <Button onClick={() => {
                  void (async () => {
                    addDebug({ event: 'reviewer.applyRemaining.start' });
                    // Apply remaining (non-dismissed) sections directly to the draft and persist.
                    const remaining = reviewerSections.filter(s => !s.dismissed);
                    addDebug({ event: 'reviewer.applyRemaining.remainingCount', count: remaining.length });
                    const prevForm = { ...form };
                    try {
                      // Snapshot current draft and suggestions so we can undo the bulk apply (deep clone)
                      setLastAppliedSnapshot({
                        field: 'bulk',
                        previousForm: JSON.parse(JSON.stringify(prevForm)),
                        acceptedValue: JSON.stringify(remaining),
                        previousSuggestions: suggestions ? JSON.parse(JSON.stringify(suggestions)) : null,
                      });
                      for (const s of remaining) {
                        switch (s.fieldKey) {
                          case "summary":
                            updateForm({ summary: s.content });
                            break;
                          case "skills":
                            updateForm({ skillsText: String(s.content ?? "") });
                            break;
                          case "experience":
                            updateForm({ experienceText: s.content });
                            break;
                          case "education":
                            updateForm({ educationText: s.content });
                            break;
                          case "achievements":
                            updateForm({ achievementsText: String(s.content ?? "") });
                            break;
                          case "identity": {
                            // identity formatted as "Name / Email" — map into name/email if present
                            const parts = String(s.content || "").split("/").map(p => p.trim()).filter(Boolean);
                            if (parts[0]) updateForm({ name: parts[0] });
                            if (parts[1]) updateForm({ email: parts[1] });
                            break;
                          }
                          default:
                            break;
                        }
                      }
                      // Clear suggestions since we've applied the content directly
                      setSuggestions(null);
                      // Persist immediately (non-destructive)
                      addDebug({ event: 'reviewer.applyRemaining.beforeSave' });
                      await handleSave(false);
                      addDebug({ event: 'reviewer.applyRemaining.afterSave' });
                      // Suppress immediate re-open from background refines for 5s
                      reviewerCloseSuppressedRef.current = Date.now();
                      setReviewerVisible(false);
                      addDebug({ event: 'reviewer.applyRemaining.setReviewerVisible.false' });
                      try { showToast("Applied remaining sections and saved — Undo available", { variant: "success" }); } catch (e) {}
                    } catch (err) {
                      addDebug({ event: 'reviewer.applyRemaining.error', error: String(err) });
                      // Restore prior form on error to avoid partial application
                      try { setForm(prevForm); } catch (e) {}
                      try { showToast("Failed to apply remaining sections", { variant: "error" }); } catch (e) {}
                    }
                  })();
                }} className="px-3 py-2 rounded-md bg-accent text-background">Use remaining</Button>
 
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
