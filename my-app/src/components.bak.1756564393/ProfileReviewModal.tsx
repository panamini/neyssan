"use client";

import { useState, useEffect, useCallback } from "react";
import LoadingSpinner from "./LoadingSpinner";
import CVLoader from "./CVLoader";
import { useAuth } from "@clerk/clerk-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { parseRefinedMarkdown, RefinedContent } from "../utils/parseRefinedMarkdown";
import { RefinementField } from "./RefinementField";
import { Button } from "./ui/button";

// --- Type Definitions ---
type ExperienceItem = { company?: string; title?: string; startDate?: string; endDate?: string; description?: string; };
type EducationItem = { institution?: string; degree?: string; fieldOfStudy?: string; startDate?: string; endDate?: string; description?: string; };
type NormalizedProfile = { id?: string; name?: string | null; email?: string | null; summary?: string | null; skills?: string[] | null; experience?: ExperienceItem[] | null; education?: EducationItem[] | null; achievements?: string[] | null; rawText?: string | null; confidence?: number; metadata?: Record<string, unknown> | null; version?: number; };

type Props = { visible: boolean; parsedProfile: NormalizedProfile | null; onClose: () => void; onSaved?: (result: any) => void; };

// --- Constants and Helpers ---
const CONVEX_URL = import.meta.env?.VITE_CONVEX_URL ?? "";
const CONVEX_SITE_URL = CONVEX_URL.replace('.cloud', '.site');

export default function ProfileReviewModal({ visible, parsedProfile, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Partial<NormalizedProfile> & { skillsText?: string; experienceText?: string; educationText?: string; achievementsText?: string; }>({});
  const [rawTextLocal, setRawTextLocal] = useState('');
  const [savedProfileId, setSavedProfileId] = useState<string | null>(null);
  const [profileVersion, setProfileVersion] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // State for the refinement process
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading_cv' | 'refining' | 'saving' | 'completed' | 'failed' | 'enqueued' | 'running' | null>('idle');
  const [, setResult] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Phase 1: explicit state separation
  // canonicalProfile: authoritative data loaded from DB (source of truth)
  // form (draft) remains the user's editable state
  // suggestions: non-destructive suggestions from CV parsing or AI refine
  const [canonicalProfile, setCanonicalProfile] = useState<Partial<NormalizedProfile> | null>(null);
  const [suggestions, setSuggestions] = useState<RefinedContent | null>(null);
  // Confirmation + undo snapshot for accepting suggestions
  const [confirmAccept, setConfirmAccept] = useState<{ field: keyof RefinedContent; value: string } | null>(null);
  const [lastAppliedSnapshot, setLastAppliedSnapshot] = useState<{ field: keyof RefinedContent; previousForm: Partial<NormalizedProfile> & { skillsText?: string; experienceText?: string; educationText?: string; achievementsText?: string; }; acceptedValue: string } | null>(null);

  const { isSignedIn, isLoaded: clerkLoaded, getToken } = useAuth();
  const saveProfileMutation = useMutation((api as any)["mutations/upsertProfile"]?.upsertProfile);
  
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

  const updateForm = useCallback((updates: Partial<typeof form>) => {
    addDebug({ event: 'updateForm', updates });
    setForm(prev => {
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
  
  // Determine whether the current draft (form) differs from the canonicalProfile.
  // If canonicalProfile is null, any non-empty draft is considered dirty.
  function isDirty() {
    if (!canonicalProfile) return !isFormEmpty();
  
    const canon = {
      name: canonicalProfile.name ?? "",
      email: canonicalProfile.email ?? "",
      summary: canonicalProfile.summary ?? "",
      skillsText: (canonicalProfile.skills || []).join(", "),
      experienceText: JSON.stringify(canonicalProfile.experience || [], null, 2),
      educationText: JSON.stringify(canonicalProfile.education || canonicalProfile.metadata?.education || [], null, 2),
      achievementsText: Array.isArray(canonicalProfile.achievements) ? canonicalProfile.achievements.join("\n") : String(canonicalProfile.achievements ?? ""),
    };
  
    const draft = {
      name: String(form.name ?? ""),
      email: String(form.email ?? ""),
      summary: String(form.summary ?? ""),
      skillsText: String(form.skillsText ?? ""),
      experienceText: String(form.experienceText ?? "[]"),
      educationText: String(form.educationText ?? "[]"),
      achievementsText: String(form.achievementsText ?? ""),
    };
  
    return Object.keys(canon).some((k) => (canon as any)[k] !== (draft as any)[k]);
  }

  // Initialize canonical + draft states when a parsedProfile prop arrives.
  // Do not overwrite user's existing draft edits if they already exist.
  useEffect(() => {
    addDebug({ event: 'parsedProfile.effect.run', present: !!parsedProfile });
    if (parsedProfile) {
      addDebug({ event: 'parsedProfile.init', id: (parsedProfile as any).id, convexId: (parsedProfile as any).convexId });
      setCanonicalProfile(parsedProfile);
  
      // Initialize draft form only when the draft is empty to avoid overwriting manual edits
      setForm(prev => {
        const isEmpty = !prev || Object.keys(prev).length === 0 || Object.values(prev).every(v => v === undefined || v === "");
        addDebug({ event: 'parsedProfile.init.checkEmpty', isEmpty, prev });
        if (isEmpty) {
          const initial = {
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
    setForm(prev => {
      const isEmpty = !prev || Object.keys(prev).length === 0 || Object.values(prev).every(v => v === undefined || v === "");
      addDebug({ event: 'visible.effect.init', isEmpty, canonicalPreview: { name: canonicalProfile.name, summaryLength: String(canonicalProfile.summary ?? "").length } });
      if (isEmpty) {
        const initial = {
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
      throw new Error((body && (body as any).message) || `Request failed with status ${res.status}`);
    }
    return res.json();
  };

  const startRefine = async (profileId: string) => {
    // Debug: snapshot before starting refine
    try {
      console.debug('[ProfileReviewModal] startRefine called', {
        profileId,
        savedProfileId,
        profileVersion,
        status,
        rawTextLocalPreview: String(rawTextLocal).slice(0, 200),
      });
    } catch (e) {
      // avoid breaking in restricted consoles
    }
    setStatus('refining');
    try {
      const payload = { profileId, rawText: rawTextLocal };
      addDebug({ event: 'startRefine.payload', payload });
      try { console.debug('[ProfileReviewModal] POST /llm-refine payload', payload); } catch (e) {}
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
      } else {
        addDebug({ event: 'startRefine.enqueueFailed', data });
        throw new Error('Failed to enqueue job');
      }
    } catch (err) {
      console.error('Start refine error:', err);
      setMessage({ type: 'error', text: String(err) });
      setStatus('failed');
    }
  };

  useEffect(() => {
    if (!isPolling || !jobId) return;

    const pollInterval = setInterval(async () => {
      try {
        try {
          const data = await authenticatedFetch(`${CONVEX_SITE_URL}/llm-refine`, {
            method: 'POST',
            body: JSON.stringify({ jobId }),
          });
          addDebug({ event: 'poll.response', data });
          setStatus(data.status);
  
          if (data.status === 'completed') {
            addDebug({ event: 'poll.completed.result', result: data.result });
            setResult(data.result);
            // Parse the human-readable LLM content into structured suggestions (non-destructive)
            try {
              const content = data?.result?.full_response?.choices?.[0]?.message?.content;
              addDebug({ event: 'poll.completed.contentType', type: typeof content });
              if (typeof content === "string") {
                const parsed = parseRefinedMarkdown(content);
                addDebug({ event: 'poll.completed.parsed', parsed });
                // Ensure suggestions/stagedEdits are populated. If the parser failed to
                // extract named sections, fall back to using the full LLM content as the
                // summary so the user sees something useful.
                const parsedWithFallback = { ...parsed };
                if (!parsedWithFallback.summary || parsedWithFallback.summary.trim().length === 0) {
                  parsedWithFallback.summary = content;
                  addDebug({ event: 'poll.parsed.fallbackSummaryApplied', length: String(parsedWithFallback.summary).length });
                }
                // suggestions: original suggestions from LLM
                setSuggestions(parsedWithFallback);
                // Minimal UX improvement: suggestions populated; require explicit accept to apply to draft
                // Non-destructive: only apply fields that the parsed content provides and
                // ensure we don't put non-JSON markdown into JSON editors (experience/education).
                // Do NOT auto-load LLM suggestions into the user's draft.
                // Keep parsed suggestions in `suggestions` / `stagedEdits` and require explicit user
                // action ("Load into form") to apply them. This preserves the non-destructive UX.
                addDebug({
                  event: 'poll.autoLoadSkipped',
                  reason: 'require-explicit-accept',
                  preview: { summaryLength: String(parsedWithFallback.summary ?? "").length, skillsPreview: String(parsedWithFallback.skills ?? "").slice(0,80) }
                });
              } else {
                addDebug({ event: 'poll.completed.noStringContent', content });
              }
            } catch (e) {
              addDebug({ event: 'poll.parseError', error: String(e) });
              console.error("parseRefinedMarkdown failed", e);
            }
            setIsPolling(false);
            clearInterval(pollInterval);
          } else if (data.status === 'failed') {
            addDebug({ event: 'poll.failed', data });
            setMessage({ type: 'error', text: data.message || 'Job failed' });
            setIsPolling(false);
            clearInterval(pollInterval);
          }
        } catch (err) {
          throw err;
        }
      } catch (err) {
        console.error('Polling error:', err);
        setMessage({ type: 'error', text: String(err) });
        setIsPolling(false);
        clearInterval(pollInterval);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [isPolling, jobId]);

  const handleSave = async (notifyParent = true) => {
    addDebug({ event: 'handleSave.invoked', notifyParent, savedProfileId, profileVersion });
    if (!clerkLoaded || !isSignedIn) {
      setMessage({ type: 'error', text: "You must be signed in to save profiles." });
      return null;
    }
  
    setStatus('saving');
    setMessage(null);
  
    let skills: string[] = form.skillsText?.split(",").map(s => s.trim()).filter(Boolean) ?? [];
    let experience: ExperienceItem[] = [];
    try {
      experience = JSON.parse(form.experienceText || "[]");
    } catch (e) {
      addDebug({ event: 'handleSave.invalidJson', field: 'experienceText', error: String(e), snippet: String(form.experienceText ?? '').slice(0,200) });
      // Skip including experience in the saved payload; leave experience as an empty array
      experience = [];
    }
    let education: EducationItem[] = [];
    try {
      education = JSON.parse(form.educationText || "[]");
    } catch (e) {
      addDebug({ event: 'handleSave.invalidJson', field: 'educationText', error: String(e), snippet: String(form.educationText ?? '').slice(0,200) });
      // Skip including education in the saved payload; leave education as an empty array
      education = [];
    }
    let achievements = form.achievementsText?.split("\n").map(s => s.trim()).filter(Boolean) ?? [];
  
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
      
      const convexId = (res as any).convexId ?? res.profileId;
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
      setForm(prev => {
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
      await startRefine(profileIdToRefine);
    }
  };

  const handleCvParsed = (parsed: NormalizedProfile) => {
    setStatus('idle');

    // Build non-destructive suggestions from parsed CV instead of overwriting draft form
    const cvSuggestions: RefinedContent = {
      summary: parsed.summary ?? parsed.rawText ?? "",
      skills: (parsed.skills || []).join(", "),
      experience: parsed.experience ? JSON.stringify(parsed.experience, null, 2) : undefined,
      education: parsed.education ? JSON.stringify(parsed.education, null, 2) : undefined,
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements.join("\n") : String(parsed.achievements ?? ""),
      identity: [parsed.name ?? "", parsed.email ?? ""].filter(Boolean).join(" / ") || undefined,
    };

    // Populate suggestions and stagedEdits so the user can review and accept per-field.
    setSuggestions(cvSuggestions);

    // Keep metadata/raw text and IDs updated but do not overwrite the user's current draft form.
    setRawTextLocal(parsed.rawText ?? "");
    // Prefer Convex id when available; avoid storing external UUIDs in savedProfileId
    setSavedProfileId((parsed as any).convexId ?? null);
    setProfileVersion(parsed.version ?? null);
    setMessage({ type: 'success', text: "CV parsed — suggestions available" });
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
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);


  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 overflow-hidden max-h-[90vh] flex flex-col relative">
        {/* Global Spinner Overlay */}
        {(status === 'refining' || status === 'saving' || status === 'enqueued' || status === 'running') && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-gray-900/50">
            <LoadingSpinner />
            <span className="ml-2 text-purple-600 dark:text-purple-400">{status}...</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {savedProfileId ? 'Review profile' : 'New profile'}
            {profileVersion !== null && <span className="ml-2 text-sm text-muted dark:text-gray-400">v{profileVersion}</span>}
          </h2>
          <button onClick={onClose} className="text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-400" aria-label="Close">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 mt-4 space-y-6 overflow-y-auto">
          <div className="flex flex-col gap-6 md:flex-row">
            {/* Manual Review */}
            <div className="flex-1">
              <h3 className="mb-2 text-xl font-medium text-gray-800 dark:text-gray-200">Manual review</h3>
              <div className="space-y-4">
                <RefinementField
                  label="Name"
                  value={String(form.name ?? "")}
                  suggestion={null}
                  isLoading={false}
                  onChange={(val: string) => updateForm({ name: String(val ?? "") })}
                  onClear={() => clearField("summary")}
                />
                <RefinementField
                  label="Email"
                  value={String(form.email ?? "")}
                  suggestion={null}
                  isLoading={false}
                  onChange={(val: string) => updateForm({ email: String(val ?? "") })}
                  onClear={() => clearField("summary")}
                />
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
          <div className="fixed inset-0 flex items-center justify-center p-4 z-60">
            <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg dark:bg-gray-900">
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Apply suggestion?</h3>
              <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">This will replace your current draft content for <strong>{String(confirmAccept.field)}</strong>. You can undo this action from the footer for one step.</p>
              <div className="p-2 mb-4 overflow-auto text-sm text-gray-800 whitespace-pre-wrap rounded max-h-40 bg-gray-50 dark:bg-gray-800 dark:text-gray-100">{confirmAccept.value}</div>
              <div className="flex justify-end gap-2">
                <Button onClick={() =>{ setConfirmAccept(null); }} className="px-3 py-2 bg-surface-muted rounded-md">Cancel</Button>
                <Button onClick={async () =>{
                  try {
                    const { field, value } = confirmAccept;
                    addDebug({ event: 'performAccept', field, preview: String(value).slice(0,200) });
                    // snapshot current draft for undo
                    setLastAppliedSnapshot({ field, previousForm: { ...form }, acceptedValue: value });
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
                }} className="px-3 py-2 text-white bg-success rounded-md">Apply</Button>
              </div>
            </div>
          </div>
        )}

        {/* Debug panel (visible for repro) */}
        <div className="mb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-gray-600">Debug trace</div>
            <div>
              <Button onClick={() =>setShowDebug(s => !s)} className="px-2 py-1 text-xs bg-surface-muted rounded">
                {showDebug ? "Hide debug" : "Show debug"}</Button>
              <Button onClick={() =>setDebugLines([])} className="px-2 py-1 ml-2 text-xs bg-surface rounded">Clear</Button>
            </div>
          </div>
          {showDebug && (
            <pre className="p-2 mt-2 overflow-auto text-xs text-white bg-black rounded max-h-40">
              {debugLines.length ? debugLines.join("\n") : "no debug lines yet"}
            </pre>
          )}
        </div>
        {/* Footer Action Bar */}
        <div className="flex items-center justify-between pt-4 mt-6 border-t border-gray-200 dark:border-gray-700">
          <CVLoader onFileParsed={handleCvParsed} onError={text => setMessage({ type: 'error', text: text ?? '' })} onSuccess={text => setMessage({ type: 'success', text: text ?? '' })} label="Charger CV" />
          <div className="flex items-center gap-4">
            <Button variant="primary" onClick={handleRefineClick} disabled={status !== 'idle' || isFormEmpty()}>
              Raffiner AI
            </Button>
            <Button variant="primary" onClick={() => handleSave()} disabled={status !== 'idle' || !isDirty()}>
              Enregistrer
            </Button>
            <Button variant="secondary" onClick={() => {
              if (!lastAppliedSnapshot) return;
              try {
                addDebug({ event: 'undoLastApplied.invoked', field: lastAppliedSnapshot.field });
                // restore previous form snapshot
                setForm({ ...(lastAppliedSnapshot.previousForm as any) });
                // restore suggestion entry for the field (re-add accepted value)
                setSuggestions(prev => ({ ...(prev ?? {}), [lastAppliedSnapshot.field]: lastAppliedSnapshot.acceptedValue }));
                setMessage({ type: 'success', text: 'Undo applied' });
                setLastAppliedSnapshot(null);
              } catch (e) {
                setMessage({ type: 'error', text: 'Undo failed' });
              }
            }} disabled={!lastAppliedSnapshot}>
              Undo last suggestion
            </Button>
          </div>
        </div>

        {/* Toast Notification */}
        {message && (
          <div className={`fixed bottom-4 right-4 p-4 rounded-md shadow-md text-white ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
