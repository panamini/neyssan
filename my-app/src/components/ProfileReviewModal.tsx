"use client";

import { useState, useEffect, useReducer, useMemo, useCallback } from "react";
import LoadingSpinner from "./LoadingSpinner";
import JsonEditor from "./JsonEditor";
import CVLoader from "./CVLoader";
import { useAuth } from "@clerk/clerk-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// --- Type Definitions ---
type ExperienceItem = { company?: string; title?: string; startDate?: string; endDate?: string; description?: string; };
type EducationItem = { institution?: string; degree?: string; fieldOfStudy?: string; startDate?: string; endDate?: string; description?: string; };
type NormalizedProfile = { id?: string; name?: string | null; email?: string | null; summary?: string | null; skills?: string[] | null; experience?: ExperienceItem[] | null; education?: EducationItem[] | null; achievements?: string[] | null; rawText?: string | null; confidence?: number; metadata?: Record<string, unknown> | null; version?: number; };
type PatchOp = { path: string; op: "replace" | string; value: any; };
type LLMHistoryRow = { id: string; profile_id: string; run_time?: string; provider?: string; model?: string; job_id?: string; full_response?: any; patch?: { ops: PatchOp[] } | null; merged?: boolean; confidence?: number; };
type Props = { visible: boolean; parsedProfile: NormalizedProfile | null; onClose: () => void; onSaved?: (result: any) => void; };

// --- Constants and Helpers ---
const API_BASE_URL = import.meta.env?.VITE_PDF_INGEST_URL ?? "";

function buildApiUrl(base: string, ...parts: string[]): string {
  const joinedParts = parts.map(part => part.startsWith('/') ? part.substring(1) : part).join('/');
  return base.endsWith('/') ? `${base}${joinedParts}` : `${base}/${joinedParts}`;
}

// Unified state with useReducer
type AppState = {
  form: Partial<NormalizedProfile> & { skillsText?: string; experienceText?: string; educationText?: string; achievementsText?: string; };
  rawTextLocal: string;
  savedProfileId: string | null;
  profileVersion: number | null;
  refinedData: NormalizedProfile | null;
  refineConfidence: number | null;
  patchOps: PatchOp[] | null;
  acceptedPaths: Record<string, boolean>;
  status: 'idle' | 'loading_cv' | 'refining' | 'saving' | 'error';
  message: { type: 'success' | 'error'; text: string } | null;
  errors: Record<string, string | null>;
};

type Action =
  | { type: 'UPDATE_FORM'; payload: Partial<AppState['form']> }
  | { type: 'SET_RAW_TEXT'; payload: string }
  | { type: 'SET_SAVED_ID'; payload: string | null }
  | { type: 'SET_VERSION'; payload: number | null }
  | { type: 'SET_REFINED'; payload: { data: NormalizedProfile | null; confidence: number | null; patchOps: PatchOp[] | null; acceptedPaths: Record<string, boolean> } }
  | { type: 'SET_STATUS'; payload: AppState['status'] }
  | { type: 'SET_MESSAGE'; payload: AppState['message'] }
  | { type: 'RESET_REFINED' }
  | { type: 'SET_ERROR'; payload: { field: string; error: string | null } };

const initialState: AppState = {
  form: {},
  rawTextLocal: '',
  savedProfileId: null,
  profileVersion: null,
  refinedData: null,
  refineConfidence: null,
  patchOps: null,
  acceptedPaths: {},
  status: 'idle',
  message: null,
  errors: {},
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'UPDATE_FORM': return { ...state, form: { ...state.form, ...action.payload } };
    case 'SET_RAW_TEXT': return { ...state, rawTextLocal: action.payload };
    case 'SET_SAVED_ID': return { ...state, savedProfileId: action.payload };
    case 'SET_VERSION': return { ...state, profileVersion: action.payload };
    case 'SET_REFINED': return { ...state, refinedData: action.payload.data, refineConfidence: action.payload.confidence, patchOps: action.payload.patchOps, acceptedPaths: action.payload.acceptedPaths };
    case 'SET_STATUS': return { ...state, status: action.payload };
    case 'SET_MESSAGE': return { ...state, message: action.payload };
    case 'RESET_REFINED': return { ...state, refinedData: null, refineConfidence: null, patchOps: null, acceptedPaths: {} };
    case 'SET_ERROR': return { ...state, errors: { ...state.errors, [action.payload.field]: action.payload.error } };
    default: return state;
  }
}

export default function ProfileReviewModal({ visible, parsedProfile, onClose, onSaved }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [refineJobId, setRefineJobId] = useState<string | null>(null);
  const [placeholderId, setPlaceholderId] = useState<string | null>(null);
  const [showCacheModal, setShowCacheModal] = useState(false);

  // Clerk auth guard for modal-level effects
  const { isSignedIn, isLoaded: clerkLoaded } = useAuth();

  // Convex mutation - reference the generated module key directly (keeps compatibility with generated api)
  // Use a narrow any cast only for the module access so the rest of the code keeps type-safety.
  const saveProfileMutation = useMutation((api as any)["mutations/upsertProfile"]?.upsertProfile);
  // Use Convex mutation to start an LLM refinement job instead of calling an external HTTP endpoint.
  // Exported from convex/llm.ts as a public mutation `startRefine` (typed) and `startRefineByString` (accepts external string IDs).
  // We call the compatibility wrapper `startRefineByString` because savedProfileId/upsertProfile returns an external profileId string.
  const startRefineMutation = useMutation(api.llm.startRefineByString);

  // Debounced / stable form update (declare before handlers that use it)
  const updateForm = useCallback((updates: Partial<AppState['form']>) => {
    dispatch({ type: 'UPDATE_FORM', payload: updates });
  }, []);

  // Stable callbacks for JsonEditor to avoid creating new function refs each render
  const handleExperienceChange = useCallback((val: string) => {
    updateForm({ experienceText: val });
  }, [updateForm]);

  const handleEducationChange = useCallback((val: string) => {
    updateForm({ educationText: val });
  }, [updateForm]);

  const handleExperienceError = useCallback((err: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: { field: 'experienceText', error: err } });
  }, []);

  const handleEducationError = useCallback((err: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: { field: 'educationText', error: err } });
  }, []);

  // Memoized form validity
  const isFormValid = useMemo(() => {
    const noErrors = Object.values(state.errors).every(err => err === null);
    try {
      JSON.parse(state.form.experienceText ?? '[]');
      JSON.parse(state.form.educationText ?? '[]');
      return noErrors;
    } catch {
      return false;
    }
  }, [state.errors, state.form.experienceText, state.form.educationText]);

  // Populate from prop
  useEffect(() => {
    if (parsedProfile) {
      dispatch({ type: 'UPDATE_FORM', payload: {
        name: parsedProfile.name ?? "",
        email: parsedProfile.email ?? "",
        summary: parsedProfile.summary ?? "",
        skillsText: (parsedProfile.skills || []).join(", "),
        experienceText: JSON.stringify(parsedProfile.experience || [], null, 2),
        educationText: JSON.stringify(parsedProfile.education || parsedProfile.metadata?.education || [], null, 2),
        achievementsText: Array.isArray(parsedProfile.achievements) ? parsedProfile.achievements.join("\n") : String(parsedProfile.achievements ?? ""),
      } });
      dispatch({ type: 'SET_RAW_TEXT', payload: parsedProfile.rawText ?? "" });
      dispatch({ type: 'SET_SAVED_ID', payload: parsedProfile.id ?? null });
      dispatch({ type: 'SET_VERSION', payload: parsedProfile.version ?? null });
      dispatch({ type: 'SET_MESSAGE', payload: null });
    }
  }, [parsedProfile]);

  // Load latest refined
  useEffect(() => {
    if (!visible) return;
    if (!parsedProfile?.id) return;
    const profileId = parsedProfile.id;
    async function load() {
      dispatch({ type: 'SET_STATUS', payload: 'refining' });
      try {
        const url = buildApiUrl(API_BASE_URL, 'api/v1/profiles', profileId, 'llm-history');
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows: LLMHistoryRow[] = await res.json();
        const found = rows.find(r => r.full_response && Object.keys(r.full_response).length > 0) ?? rows[0];
        if (found?.full_response) {
          const parsed = found.full_response.parsed ?? found.full_response;
          dispatch({ type: 'SET_REFINED', payload: { data: parsed, confidence: found.confidence ?? parsed?.confidence ?? null, patchOps: null, acceptedPaths: {} } });
        }
      } catch (err) {
        dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: (err as Error).message } });
      } finally {
        dispatch({ type: 'SET_STATUS', payload: 'idle' });
      }
    }
    load();
  }, [parsedProfile, visible]);

  // Polling with exponential backoff
  useEffect(() => {
    if (state.status !== 'refining' || (!refineJobId && !placeholderId)) return;

    const controller = new AbortController();
    const poll = async () => {
      const profileId = state.savedProfileId;
      if (!profileId) return;

      let delay = 1000; // start at 1s
      const maxAttempts = placeholderId ? 30 : 60;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (controller.signal.aborted) return;
        try {
          let isFinished = false;
          if (placeholderId) {
            const url = buildApiUrl(API_BASE_URL, 'api/v1/llm-history', placeholderId);
            const res = await fetch(url, { signal: controller.signal });
            if (res.ok) {
              const row = await res.json();
              if (row && (row.full_response || row.patch)) {
                const patch = row.full_response?.patch ?? row.patch ?? row.full_response?.parsed?.patch;
                const map = patch?.ops ? patch.ops.reduce((acc: Record<string, boolean>, op: any) => {
                  acc[op.path] = true;
                  return acc;
                }, {} as Record<string, boolean>) : {};
                const parsed = row.full_response?.parsed;
                dispatch({ type: 'SET_REFINED', payload: { data: parsed, confidence: row.confidence ?? parsed?.confidence, patchOps: patch?.ops ?? null, acceptedPaths: map } });
                isFinished = true;
              }
            }
          } else if (refineJobId) {
            const url = buildApiUrl(API_BASE_URL, 'api/v1/rq-job', refineJobId);
            const res = await fetch(url, { signal: controller.signal });
            if (res.ok) {
              const { status } = await res.json();
              if (status === "finished") {
                await fetchLLMHistoryForJob(refineJobId);
                isFinished = true;
              } else if (status === "failed") {
                throw new Error("Refinement failed on server");
              }
            }
          }
          if (isFinished) {
            dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: "AI refinement completed" } });
            return;
          }
        } catch (err) {
          if ((err as Error).name === 'AbortError') return;
          console.error(`Poll attempt ${attempt}:`, err);
        }
        await new Promise(r => setTimeout(r, delay));
        delay = Math.min(delay * 2, 8000); // backoff up to 8s
      }
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: "Refinement timed out" } });
    };
    poll();
    return () => controller.abort();
  }, [state.status, refineJobId, placeholderId, state.savedProfileId]);

  const handleSave = async (notifyParent = true) => {
    // Ensure user auth loaded and signed in before attempting Convex mutation
    if (!clerkLoaded || !isSignedIn) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: "You must be signed in to save profiles." } });
      return null;
    }

    dispatch({ type: 'SET_STATUS', payload: 'saving' });
    dispatch({ type: 'SET_MESSAGE', payload: null });

    // Validate and coerce JSON fields
    let skills: string[] = state.form.skillsText?.split(",").map(s => s.trim()).filter(Boolean) ?? [];
    let experience: ExperienceItem[] = [];
    try {
      experience = JSON.parse(state.form.experienceText || "[]");
      if (!Array.isArray(experience)) throw new Error("Experience must be array");
    } catch (e) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: "Invalid experience JSON" } });
      dispatch({ type: 'SET_STATUS', payload: 'idle' });
      return null;
    }
    let education: EducationItem[] = [];
    try {
      education = JSON.parse(state.form.educationText || "[]");
      if (!Array.isArray(education)) throw new Error("Education must be array");
    } catch (e) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: "Invalid education JSON" } });
      dispatch({ type: 'SET_STATUS', payload: 'idle' });
      return null;
    }
    let achievements = state.form.achievementsText?.split("\n").map(s => s.trim()).filter(Boolean) ?? [];

    const profileObj = {
      name: state.form.name || null,
      email: state.form.email || null,
      summary: state.form.summary || null,
      skills: skills.length ? skills : null,
      experience: experience.length ? experience : null,
      education: education.length ? education : null,
      achievements: achievements.length ? achievements : null,
      raw_text: state.rawTextLocal ?? null,
      confidence: state.form.confidence ?? 0,
      metadata: { ...state.form.metadata, reviewedAt: Date.now(), reviewedBy: "frontend_review" },
    };

    try {
      // Determine a profileId: reuse existing savedProfileId or create a UUID
      const profileId = state.savedProfileId ?? (typeof crypto !== "undefined" && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `p-${Date.now()}`);
      const idempotencyKey = (typeof crypto !== "undefined" && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `k-${Date.now()}`;

      // Call Convex mutation upsertProfile (idempotent upsert) instead of external HTTP endpoint
      const res = await saveProfileMutation({
        profileId,
        idempotencyKey,
        source: "frontend_confirm_save",
        version: state.profileVersion ?? 1,
        profile: profileObj,
      });

      if (!res || !res.profileId) {
        throw new Error("Failed to save profile");
      }

      // Update local state with canonical id and optionally version/metadata
      dispatch({ type: 'SET_SAVED_ID', payload: res.profileId });
      if (res.updatedAt) {
        dispatch({ type: 'SET_VERSION', payload: typeof res.updatedAt === 'number' ? Math.floor(res.updatedAt / 1000) : state.profileVersion });
      }
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: "Profile saved" } });
      if (notifyParent && onSaved) onSaved(res);
      return res.profileId;
    } catch (e) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: (e as Error).message || "Save failed" } });
      return null;
    } finally {
      dispatch({ type: 'SET_STATUS', payload: 'idle' });
    }
  };

  // fetchProfileVersion removed - unused in current component

  const ensureSavedForRefine = async () => {
    if (state.savedProfileId) return state.savedProfileId;
    return await handleSave(false);
  };

  const fetchLLMHistoryForJob = async (jobId: string) => {
    try {
      const url = buildApiUrl(API_BASE_URL, 'api/v1/llm-history', jobId);
      const res = await fetch(url);
      if (res.ok) {
        const row = await res.json();
        if (row.full_response || row.patch) {
          const patch = row.full_response?.patch ?? row.patch ?? row.full_response?.parsed?.patch;
          const map = patch?.ops ? patch.ops.reduce((acc: Record<string, boolean>, op: PatchOp) => ({ ...acc, [op.path]: true }), {} as Record<string, boolean>) : {};
          const parsed = row.full_response?.parsed ?? row.full_response;
          dispatch({ type: 'SET_REFINED', payload: { data: parsed, confidence: row.confidence ?? parsed?.confidence, patchOps: patch?.ops ?? null, acceptedPaths: map } });
        }
      }
    } catch (err) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: "Failed to fetch refinement history" } });
    }
  };

  const handleRefineClick = async () => {
    dispatch({ type: 'SET_STATUS', payload: 'refining' });
    dispatch({ type: 'RESET_REFINED' });
    dispatch({ type: 'SET_MESSAGE', payload: null });

    try {
      const maybeProfileId = await ensureSavedForRefine();
      if (!maybeProfileId) throw new Error("Save required");
      const profileId = maybeProfileId;
      let rawTextToSend = state.rawTextLocal;
      try {
        // Try to fetch canonical full raw text from the ingestion API if available.
        // This is non-critical — fall back to local raw text if it fails.
        const fullUrl = buildApiUrl(API_BASE_URL, 'api/v1/profiles', profileId, 'full-raw-text');
        const fullRes = await fetch(fullUrl);
        if (fullRes.ok) {
          const fj = await fullRes.json();
          rawTextToSend = fj.fullRawText ?? rawTextToSend;
        }
      } catch {}
      
      // Use Convex public mutation to enqueue the job and schedule the worker action.
      // This replaces the previous direct POST to /api/v1/llm-refine which caused connection errors.
      const res = await startRefineMutation({
        profileId,
        rawText: rawTextToSend,
      });

      if (!res) throw new Error("Failed to start refinement");
      // Mutation returns { jobId, placeholderId } per server implementation
      setRefineJobId(res.jobId ?? null);
      setPlaceholderId(res.placeholderId ?? null);
    } catch (e) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: (e as Error).message } });
      dispatch({ type: 'SET_STATUS', payload: 'idle' });
    }
  };

  const handleCvParsed = (parsed: NormalizedProfile) => {
    dispatch({ type: 'SET_STATUS', payload: 'idle' });
    dispatch({ type: 'UPDATE_FORM', payload: {
      name: parsed.name ?? "",
      email: parsed.email ?? "",
      summary: parsed.summary ?? parsed.rawText ?? "",
      skillsText: (parsed.skills || []).join(", "),
      experienceText: JSON.stringify(parsed.experience || [], null, 2),
      educationText: JSON.stringify(parsed.education || [], null, 2),
      achievementsText: Array.isArray(parsed.achievements) ? parsed.achievements.join("\n") : String(parsed.achievements ?? ""),
    } });
    dispatch({ type: 'SET_RAW_TEXT', payload: parsed.rawText ?? "" });
    dispatch({ type: 'SET_SAVED_ID', payload: parsed.id ?? null });
    dispatch({ type: 'SET_VERSION', payload: parsed.version ?? null });
    dispatch({ type: 'RESET_REFINED' });
    dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: "CV loaded" } });
  };

  // Auto-dismiss message after 3s
  useEffect(() => {
    if (state.message) {
      const timer = setTimeout(() => dispatch({ type: 'SET_MESSAGE', payload: null }), 3000);
      return () => clearTimeout(timer);
    }
  }, [state.message]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 overflow-hidden max-h-[90vh] flex flex-col relative">
        {/* Global Spinner Overlay */}
        {state.status !== 'idle' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-gray-900/50">
            <LoadingSpinner />
            <span className="ml-2 text-purple-600 dark:text-purple-400">{state.status}...</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {state.savedProfileId ? 'Revoir le profil' : 'Nouveau profil'}
            {state.profileVersion !== null && <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">v{state.profileVersion}</span>}
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
                  <input id="name" type="text" value={String(state.form.name ?? '')} onChange={e => updateForm({ name: e.target.value })} className="w-full p-2 text-gray-900 border border-gray-300 rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label htmlFor="email" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <input id="email" type="email" value={String(state.form.email ?? '')} onChange={e => updateForm({ email: e.target.value })} className="w-full p-2 text-gray-900 border border-gray-300 rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label htmlFor="summary" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Résumé</label>
                  <textarea id="summary" value={String(state.form.summary ?? '')} onChange={e => updateForm({ summary: e.target.value })} rows={4} className="w-full p-2 text-gray-900 border border-gray-300 rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label htmlFor="skillsText" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Compétences (séparées par virgule)</label>
                  <input id="skillsText" type="text" value={String(state.form.skillsText ?? '')} onChange={e => updateForm({ skillsText: e.target.value })} className="w-full p-2 text-gray-900 border border-gray-300 rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-purple-500" />
                </div>
                <JsonEditor
                  id="experience-json"
                  label="Expérience (JSON)"
                  value={String(state.form.experienceText ?? '[]')}
                  onChange={handleExperienceChange}
                  onError={handleExperienceError}
                />
                <JsonEditor
                  id="education-json"
                  label="Éducation (JSON)"
                  value={String(state.form.educationText ?? '[]')}
                  onChange={handleEducationChange}
                  onError={handleEducationError}
                />
                <div>
                  <label htmlFor="achievementsText" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Réalisations (une par ligne)</label>
                  <textarea id="achievementsText" value={String(state.form.achievementsText ?? '')} onChange={e => updateForm({ achievementsText: e.target.value })} rows={4} className="w-full p-2 text-gray-900 border border-gray-300 rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
            </div>

            {/* AI Refine */}
            <div className="flex-1">
              <h3 className="mb-2 text-xl font-medium text-gray-800 dark:text-gray-200">Raffinement AI</h3>
              {state.refinedData && (
                <div className="p-4 mt-4 border rounded-md bg-gray-50 dark:bg-gray-800">
                  {/* Refined data display, JSON view toggle */}
                </div>
              )}
              {state.refineConfidence !== null && <p className="text-green-600">Confiance: {(state.refineConfidence * 100).toFixed(1)}%</p>}
            </div>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="flex items-center justify-between pt-4 mt-6 border-t border-gray-200 dark:border-gray-700">
          <CVLoader onFileParsed={handleCvParsed} onError={text => dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: text ?? '' } })} onSuccess={text => dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: text ?? '' } })} label="Charger CV" />
          <div className="flex gap-4">
            <button onClick={handleRefineClick} disabled={state.status !== 'idle' || !isFormValid} className="px-4 py-2 text-white transition transform bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 hover:scale-105">
              Raffiner AI
            </button>
            <button onClick={() => handleSave()} disabled={state.status !== 'idle' || !isFormValid} className="px-4 py-2 text-white transition transform bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 hover:scale-105">
              Enregistrer
            </button>
          </div>
        </div>

        {/* Toast Notification */}
        {state.message && (
          <div className={`fixed bottom-4 right-4 p-4 rounded-md shadow-md text-white ${state.message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
            {state.message.text}
          </div>
        )}

        {/* Cache Modal (Portal for better stacking) */}
        {showCacheModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="p-6 bg-white rounded-lg shadow-lg dark:bg-gray-800">
              <h4 className="text-lg font-semibold">Charger du cache</h4>
              {/* Preview cached profile */}
              <button onClick={() => { /* load */ setShowCacheModal(false); }}>Charger</button>
              <button onClick={() => { /* clear */ setShowCacheModal(false); }}>Effacer</button>
              <button onClick={() => setShowCacheModal(false)}>Annuler</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
