"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import LoadingSpinner from "./LoadingSpinner";
import JsonEditor from "./JsonEditor";
import CVLoader from "./CVLoader";
import { useAuth } from "@clerk/clerk-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { parseRefinedMarkdown, RefinedContent } from "../utils/parseRefinedMarkdown";
import { SuggestionBlock } from "./SuggestionBlock";

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
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  
  // State for the refinement process
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading_cv' | 'refining' | 'saving' | 'completed' | 'failed' | 'enqueued' | 'running' | null>('idle');
  const [result, setResult] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [stagedEdits, setStagedEdits] = useState<RefinedContent | null>(null);

  // Phase 1: explicit state separation
  // canonicalProfile: authoritative data loaded from DB (source of truth)
  // form (draft) remains the user's editable state
  // suggestions: non-destructive suggestions from CV parsing or AI refine
  const [canonicalProfile, setCanonicalProfile] = useState<Partial<NormalizedProfile> | null>(null);
  const [suggestions, setSuggestions] = useState<RefinedContent | null>(null);

  const { isSignedIn, isLoaded: clerkLoaded, getToken } = useAuth();
  const saveProfileMutation = useMutation((api as any)["mutations/upsertProfile"]?.upsertProfile);

  const updateForm = useCallback((updates: Partial<typeof form>) => {
    setForm(prev => ({ ...prev, ...updates }));
  }, []);

  const handleExperienceChange = useCallback((val: string) => updateForm({ experienceText: val }), [updateForm]);
  const handleEducationChange = useCallback((val: string) => updateForm({ educationText: val }), [updateForm]);
  const handleExperienceError = useCallback((err: string | null) => setErrors(prev => ({ ...prev, experienceText: err })), []);
  const handleEducationError = useCallback((err: string | null) => setErrors(prev => ({ ...prev, educationText: err })), []);

  const isFormValid = useMemo(() => {
    const noErrors = Object.values(errors).every(err => err === null);
    try {
      JSON.parse(form.experienceText ?? '[]');
      JSON.parse(form.educationText ?? '[]');
      return noErrors;
    } catch {
      return false;
    }
  }, [errors, form.experienceText, form.educationText]);
  
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
    // stagedEdits presence also counts as content
    if (stagedEdits) return false;
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
    if (parsedProfile) {
      setCanonicalProfile(parsedProfile);

      // Initialize draft form only when the draft is empty to avoid overwriting manual edits
      setForm(prev => {
        const isEmpty = !prev || Object.keys(prev).length === 0 || Object.values(prev).every(v => v === undefined || v === "");
        if (isEmpty) {
          return {
            name: parsedProfile.name ?? "",
            email: parsedProfile.email ?? "",
            summary: parsedProfile.summary ?? "",
            skillsText: (parsedProfile.skills || []).join(", "),
            experienceText: JSON.stringify(parsedProfile.experience || [], null, 2),
            educationText: JSON.stringify(parsedProfile.education || parsedProfile.metadata?.education || [], null, 2),
            achievementsText: Array.isArray(parsedProfile.achievements) ? parsedProfile.achievements.join("\n") : String(parsedProfile.achievements ?? ""),
          };
        }
        return prev;
      });

      // Always update metadata/raw text and IDs without touching draft
      setRawTextLocal(parsedProfile.rawText ?? "");
      setSavedProfileId(parsedProfile.id ?? null);
      setProfileVersion(parsedProfile.version ?? null);
      setMessage(null);

      // Reset suggestions when a new profile arrives; CV parsing will populate suggestions via handleCvParsed
      setSuggestions(null);
    }
  }, [parsedProfile]);

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
    setStatus('refining');
    try {
      const data = await authenticatedFetch(`${CONVEX_SITE_URL}/llm-refine`, {
        method: 'POST',
        body: JSON.stringify({ profileId, rawText: rawTextLocal }),
      });

      if (data.status === 'enqueued') {
        setJobId(data.jobId);
        setStatus('enqueued');
        setIsPolling(true);
      } else {
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
          setStatus(data.status);
  
          if (data.status === 'completed') {
            setResult(data.result);
            // Parse the human-readable LLM content into structured suggestions (non-destructive)
            try {
              const content = data?.result?.full_response?.choices?.[0]?.message?.content;
              if (typeof content === "string") {
                const parsed = parseRefinedMarkdown(content);
                // suggestions: original suggestions from LLM
                setSuggestions(parsed);
                // stagedEdits: editable copy initialized from suggestions
                setStagedEdits(parsed);
              }
            } catch (e) {
              console.error("parseRefinedMarkdown failed", e);
            }
            setIsPolling(false);
            clearInterval(pollInterval);
          } else if (data.status === 'failed') {
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
      setMessage({ type: 'error', text: "Invalid experience JSON" });
      setStatus('idle');
      return null;
    }
    let education: EducationItem[] = [];
    try {
      education = JSON.parse(form.educationText || "[]");
    } catch (e) {
      setMessage({ type: 'error', text: "Invalid education JSON" });
      setStatus('idle');
      return null;
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
      metadata: { ...form.metadata, reviewedAt: Date.now(), reviewedBy: "frontend_review", refined: stagedEdits ?? undefined },
    };

    try {
      const profileId = savedProfileId ?? (crypto as any).randomUUID();
      const idempotencyKey = (crypto as any).randomUUID();

      const res = await saveProfileMutation({
        profileId,
        idempotencyKey,
        source: "frontend_confirm_save",
        version: profileVersion ?? 1,
        profile: profileObj,
      });
 
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
      if (notifyParent && onSaved) onSaved(res);
      return res.profileId;
    } catch (e) {
      setMessage({ type: 'error', text: (e as Error).message || "Save failed" });
      return null;
    } finally {
      setStatus('idle');
    }
  };

  const ensureSavedForRefine = async () => {
    if (savedProfileId) return savedProfileId;
    return await handleSave(false);
  };

  const handleRefineClick = async () => {
    setResult(null);
    setMessage(null);
    const profileIdToRefine = await ensureSavedForRefine();
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
    setStagedEdits(cvSuggestions);

    // Keep metadata/raw text and IDs updated but do not overwrite the user's current draft form.
    setRawTextLocal(parsed.rawText ?? "");
    setSavedProfileId(parsed.id ?? null);
    setProfileVersion(parsed.version ?? null);
    setMessage({ type: 'success', text: "CV parsed — suggestions available" });
  };

  // Apply a suggestion into the editable draft form (non-destructive).
  const applySuggestion = useCallback((field: keyof RefinedContent) => {
    const source = stagedEdits ?? suggestions;
    if (!source) return;
    const val = source[field] as string | undefined | null;
    if (val === null || val === undefined) return;

    // Based on the field, update the corresponding part of the form draft
    switch (field) {
      case "skills":
        updateForm({ skillsText: val.split(",").map(s => s.trim()).filter(Boolean).join(", ") });
        break;
      case "experience":
        updateForm({ experienceText: val });
        break;
      case "education":
        updateForm({ educationText: val });
        break;
      case "achievements": {
        const lines = val.split(/\r?\n/).map(s => s.replace(/^[\-\*\•\s]+/, "").trim()).filter(Boolean);
        updateForm({ achievementsText: lines.join("\n") });
        break;
      }
      case "summary":
        updateForm({ summary: val });
        break;
      default:
        // For other fields like 'identity' if they exist, do nothing by default
        break;
    }

    // After applying, remove the suggestion from the `stagedEdits` so it disappears from the UI.
    setStagedEdits(prev => {
      if (!prev) return null;
      const next = { ...prev };
      delete (next as any)[field];
      // If no more staged edits are left, collapse the container by setting to null
      return Object.keys(next).length > 0 ? next : null;
    });
  }, [stagedEdits, suggestions, updateForm]);

  // Discard a suggestion by removing it from `stagedEdits`.
  const discardSuggestion = useCallback((field: keyof RefinedContent) => {
    setStagedEdits(prev => {
      if (!prev) return null;
      const next = { ...prev };
      delete (next as any)[field];
      return Object.keys(next).length > 0 ? next : null;
    });
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Small presentational subcomponent for editing a refined section
  function StagedEditBlock({ title, content, onContentChange }: { title: string; content?: string | null; onContentChange: (v: string) => void; }) {
    return (
      <div className="p-3 mt-2 bg-white border rounded-md dark:bg-gray-800">
        <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">{title}</label>
        <textarea value={String(content ?? "")} onChange={(e) => onContentChange(e.target.value)} rows={4} className="w-full p-2 text-gray-900 border border-gray-300 rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-purple-500" />
      </div>
    );
  }

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
            {savedProfileId ? 'Revoir le profil' : 'Nouveau profil'}
            {profileVersion !== null && <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">v{profileVersion}</span>}
          </h2>
          <button onClick={onClose} className="text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-400" aria-label="Fermer">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 mt-4 space-y-6 overflow-y-auto">
          <div className="flex flex-col gap-6 md:flex-row">
            {/* Manual Review */}
            <div className="flex-1">
              <h3 className="mb-2 text-xl font-medium text-gray-800 dark:text-gray-200">Revue manuelle</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Nom</label>
                  <input id="name" type="text" value={String(form.name ?? '')} onChange={e => updateForm({ name: e.target.value })} className="w-full p-2 text-gray-900 border border-gray-300 rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label htmlFor="email" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <input id="email" type="email" value={String(form.email ?? '')} onChange={e => updateForm({ email: e.target.value })} className="w-full p-2 text-gray-900 border border-gray-300 rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label htmlFor="summary" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Résumé</label>
                  <textarea id="summary" value={String(form.summary ?? '')} onChange={e => updateForm({ summary: e.target.value })} rows={4} className="w-full p-2 text-gray-900 border border-gray-300 rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-purple-500" />
                </div>
                {/* Suggestion (non-destructive) for Summary */}
                <SuggestionBlock title="Résumé" suggestion={suggestions?.summary ?? stagedEdits?.summary ?? null} onApply={() => applySuggestion("summary")} onDiscard={() => discardSuggestion("summary")} />
                <div>
                  <label htmlFor="skillsText" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Compétences (séparées par virgule)</label>
                  <input id="skillsText" type="text" value={String(form.skillsText ?? '')} onChange={e => updateForm({ skillsText: e.target.value })} className="w-full p-2 text-gray-900 border border-gray-300 rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-purple-500" />
                </div>
                <SuggestionBlock title="Compétences" suggestion={suggestions?.skills ?? stagedEdits?.skills ?? null} onApply={() => applySuggestion("skills")} onDiscard={() => discardSuggestion("skills")} />
                <JsonEditor
                  id="experience-json"
                  label="Expérience (JSON)"
                  value={String(form.experienceText ?? '[]')}
                  onChange={handleExperienceChange}
                  onError={handleExperienceError}
                />
                <SuggestionBlock title="Expérience (raw)" suggestion={suggestions?.experience ?? stagedEdits?.experience ?? null} onApply={() => applySuggestion("experience")} onDiscard={() => discardSuggestion("experience")} />
                <JsonEditor
                  id="education-json"
                  label="Éducation (JSON)"
                  value={String(form.educationText ?? '[]')}
                  onChange={handleEducationChange}
                  onError={handleEducationError}
                />
                <SuggestionBlock title="Éducation (raw)" suggestion={suggestions?.education ?? stagedEdits?.education ?? null} onApply={() => applySuggestion("education")} onDiscard={() => discardSuggestion("education")} />
                <div>
                  <label htmlFor="achievementsText" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Réalisations (une par ligne)</label>
                  <textarea id="achievementsText" value={String(form.achievementsText ?? '')} onChange={e => updateForm({ achievementsText: e.target.value })} rows={4} className="w-full p-2 text-gray-900 border border-gray-300 rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-purple-500" />
                </div>
                <SuggestionBlock title="Réalisations" suggestion={suggestions?.achievements ?? stagedEdits?.achievements ?? null} onApply={() => applySuggestion("achievements")} onDiscard={() => discardSuggestion("achievements")} />
              </div>
            </div>

            {/* AI Refine */}
            <div className="flex-1">
              <h3 className="mb-2 text-xl font-medium text-gray-800 dark:text-gray-200">Raffinement AI</h3>
              {stagedEdits ? (
                <div className="p-4 mt-4 space-y-3 border rounded-md bg-gray-50 dark:bg-gray-800">
                  <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Refined Suggestions (editable)</label>
                  <StagedEditBlock title="Résumé / Summary" content={stagedEdits.summary} onContentChange={(v) => setStagedEdits(prev => ({ ...(prev ?? {}), summary: v }))} />
                  <StagedEditBlock title="Expérience / Experience" content={stagedEdits.experience} onContentChange={(v) => setStagedEdits(prev => ({ ...(prev ?? {}), experience: v }))} />
                  <StagedEditBlock title="Éducation / Education" content={stagedEdits.education} onContentChange={(v) => setStagedEdits(prev => ({ ...(prev ?? {}), education: v }))} />
                  <StagedEditBlock title="Compétences / Skills" content={stagedEdits.skills} onContentChange={(v) => setStagedEdits(prev => ({ ...(prev ?? {}), skills: v }))} />
                  <StagedEditBlock title="Identité & Contact" content={stagedEdits.identity} onContentChange={(v) => setStagedEdits(prev => ({ ...(prev ?? {}), identity: v }))} />
                  <div className="flex gap-3 mt-2">
                    <button onClick={() => { /* apply staged edits to form */ setForm(prev => ({ ...prev, summary: stagedEdits.summary ?? prev.summary, skillsText: stagedEdits.skills ? (stagedEdits.skills.split(",").map(s => s.trim()).join(", ")) : prev.skillsText, experienceText: stagedEdits.experience ?? prev.experienceText, educationText: stagedEdits.education ?? prev.educationText })); setMessage({ type: 'success', text: 'Suggestions loaded into the editor' }); }} className="px-3 py-2 text-white bg-green-600 rounded-md">Load into form</button>
                    <button onClick={() => { setStagedEdits(null); setMessage({ type: 'success', text: 'Suggestions cleared' }); }} className="px-3 py-2 bg-gray-300 rounded-md dark:bg-gray-700">Discard</button>
                  </div>
                </div>
              ) : result ? (
                <div className="p-4 mt-4 border rounded-md bg-gray-50 dark:bg-gray-800">
                  <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Refined Data</label>
                  <pre className="p-2 overflow-auto text-sm bg-white border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="flex items-center justify-between pt-4 mt-6 border-t border-gray-200 dark:border-gray-700">
          <CVLoader onFileParsed={handleCvParsed} onError={text => setMessage({ type: 'error', text: text ?? '' })} onSuccess={text => setMessage({ type: 'success', text: text ?? '' })} label="Charger CV" />
          <div className="flex gap-4">
            <button onClick={handleRefineClick} disabled={status !== 'idle' || isFormEmpty()} className="px-4 py-2 text-white transition transform bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 hover:scale-105">
              Raffiner AI
            </button>
            <button onClick={() => handleSave()} disabled={status !== 'idle' || !isDirty()} className="px-4 py-2 text-white transition transform bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 hover:scale-105">
              Enregistrer
            </button>
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
