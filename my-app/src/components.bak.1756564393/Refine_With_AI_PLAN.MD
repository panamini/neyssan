### Implementation Plan

My plan is to create the two new supporting component files and then update the main modal component, exactly as you've designed.

1.  **Create `LoadingSpinner.tsx`**: A simple, reusable spinner for indicating loading states.
2.  **Create `JsonEditor.tsx`**: A dedicated component for editing JSON fields, which cleans up the main component's JSX.
3.  **Update `ProfileReviewModal.tsx`**: Replace the existing modal code with your new, enhanced version that includes the improved layout and integrates the new components.

Here is the code for each file:

---

#### 1. `my-app/src/components/LoadingSpinner.tsx`

```typescript
import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div
      className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600 dark:border-purple-400"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default LoadingSpinner;
```

---

#### 2. `my-app/src/components/JsonEditor.tsx`

```typescript
import React from 'react';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
};

const JsonEditor: React.FC<Props> = ({ label, value, onChange, error }) => {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        className={`w-full p-2 font-mono text-xs border rounded-md shadow-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-300 dark:border-gray-700 focus:ring-purple-500'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

export default JsonEditor;
```

---

#### 3. `my-app/src/components/ProfileReviewModal.tsx` (Final Version)

```typescript
"use client";

import React, { useState, useEffect } from "react";
import LoadingSpinner from "./LoadingSpinner";
import JsonEditor from "./JsonEditor";

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

export default function ProfileReviewModal({ visible, parsedProfile, onClose, onSaved }: Props) {
  // --- State Definitions ---
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [skillsText, setSkillsText] = useState<string>("");
  const [experienceText, setExperienceText] = useState<string>("[]");
  const [educationText, setEducationText] = useState<string>("[]");
  const [achievementsText, setAchievementsText] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [refining, setRefining] = useState<boolean>(false);
  const [refineJobId, setRefineJobId] = useState<string | null>(null);
  const [placeholderId, setPlaceholderId] = useState<string | null>(null);
  const [refineStatus, setRefineStatus] = useState<string | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [refinedData, setRefinedData] = useState<NormalizedProfile | null>(null);
  const [refinedJsonView, setRefinedJsonView] = useState<boolean>(false);
  const [refineConfidence, setRefineConfidence] = useState<number | null>(null);

  const [savedProfileId, setSavedProfileId] = useState<string | null>(null);
  const [profileVersion, setProfileVersion] = useState<number | null>(null);
  const [rawTextLocal, setRawTextLocal] = useState<string>("");

  const [patchOps, setPatchOps] = useState<PatchOp[] | null>(null);
  const [acceptedPaths, setAcceptedPaths] = useState<Record<string, boolean>>({});

  // --- Effect Hooks ---
  useEffect(() => {
    if (parsedProfile) {
      setName(parsedProfile.name ?? "");
      setEmail(parsedProfile.email ?? "");
      setSummary(parsedProfile.summary ?? "");
      setSkillsText((parsedProfile.skills || []).join(", "));
      setExperienceText(JSON.stringify(parsedProfile.experience || [], null, 2));
      setEducationText(JSON.stringify(parsedProfile.education || parsedProfile.metadata?.education || [], null, 2));
      const ach = parsedProfile.achievements ?? parsedProfile.metadata?.achievements ?? [];
      setAchievementsText(Array.isArray(ach) ? ach.join("\n") : String(ach));
      setError(null);
      setSuccessMsg(null);
      setSavedProfileId(parsedProfile.id ?? null);
      setProfileVersion(parsedProfile.version ?? null);
      setRawTextLocal(parsedProfile.rawText ?? "");
    }
  }, [parsedProfile]);

  useEffect(() => {
    async function loadLatestRefined() {
      const profileId = parsedProfile?.id;
      if (!profileId) return;
      try {
        const url = buildApiUrl(API_BASE_URL, 'api/v1/profiles', profileId, 'llm-history');
        const res = await fetch(url);
        if (!res.ok) return;
        const rows: LLMHistoryRow[] = await res.json();
        const found = rows.find(r => r.full_response && Object.keys(r.full_response).length > 0) ?? rows[0];
        if (found?.full_response) {
          const parsed = found.full_response.parsed ?? found.full_response;
          setRefinedData(parsed ?? null);
          setRefineConfidence(found.confidence ?? parsed?.confidence ?? null);
        }
      } catch (err) {
        console.error("Failed to load latest refined data:", err);
      }
    }
    if (visible) loadLatestRefined();
  }, [parsedProfile, visible]);

  useEffect(() => {
    if (!refining || (!refineJobId && !placeholderId)) return;

    const controller = new AbortController();
    const { signal } = controller;

    const poll = async () => {
      try {
        const profileId = await ensureSavedForRefine();
        if (!profileId || signal.aborted) return;

        const maxAttempts = placeholderId ? 30 : 60;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (signal.aborted) return;

          try {
            let isFinished = false;
            if (placeholderId) {
              const url = buildApiUrl(API_BASE_URL, 'api/v1/llm-history', placeholderId);
              const res = await fetch(url, { signal });
              if (res.ok) {
                const row = await res.json();
                if (row && (row.full_response || row.patch)) {
                  const patch = row.full_response?.patch ?? row.patch ?? row.full_response?.parsed?.patch;
                  if (patch?.ops) {
                    setPatchOps(patch.ops);
                    const map: Record<string, boolean> = {};
                    patch.ops.forEach((op: PatchOp) => (map[op.path] = true));
                    setAcceptedPaths(map);
                  }
                  const parsed = row.full_response?.parsed;
                  if (parsed) {
                    setRefinedData(parsed);
                    setRefineConfidence(row.confidence ?? parsed.confidence);
                  }
                  isFinished = true;
                }
              }
            } else if (refineJobId) {
              const url = buildApiUrl(API_BASE_URL, 'api/v1/rq-job', refineJobId);
              const res = await fetch(url, { signal });
              if (res.ok) {
                const { status } = await res.json();
                setRefineStatus(status);
                if (status === "finished") {
                  await fetchLLMHistoryForJob(profileId, refineJobId);
                  isFinished = true;
                } else if (status === "failed") {
                  throw new Error("Refinement job failed on server");
                }
              }
            }

            if (isFinished) {
              setRefineStatus("finished");
              setSuccessMsg("AI refinement completed");
              return;
            }

          } catch (err: any) {
            if (err.name === 'AbortError') return;
            console.error(`Polling attempt ${attempt + 1} failed:`, err);
          }

          await new Promise(r => setTimeout(r, attempt < 5 ? 1500 : 3000));
        }
        throw new Error("Refinement job timed out.");

      } catch (e: any) {
        if (e.name !== "AbortError") {
          setRefineError(e.message || "Polling failed");
          setRefineStatus("failed");
        }
      } finally {
        if (!signal.aborted) setRefining(false);
      }
    };

    poll();

    return () => controller.abort();
  }, [refining, refineJobId, placeholderId]);


  if (!visible) return null;

  // --- API Functions ---
  async function handleSave(notifyParent: boolean = true): Promise<string | undefined> {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    let skills: string[] = skillsText.split(",").map((s) => s.trim()).filter(Boolean);
    let experience: ExperienceItem[] = [];
    try {
      const parsed = JSON.parse(experienceText || "[]");
      if (!Array.isArray(parsed)) throw new Error("Experience must be an array");
      experience = parsed;
    } catch (e: any) {
      setError("Invalid experience JSON: " + (e.message || String(e)));
      setSaving(false);
      return undefined;
    }
    let education: EducationItem[] = [];
    try {
      const parsed = JSON.parse(educationText || "[]");
      if (!Array.isArray(parsed)) throw new Error("Education must be an array");
      education = parsed;
    } catch (e: any) {
      setError("Invalid education JSON: " + (e.message || String(e)));
      setSaving(false);
      return undefined;
    }
    const achievements = achievementsText.split("\n").map((s) => s.trim()).filter(Boolean);
    const payload: Partial<NormalizedProfile> = {
      name: name || null,
      email: email || null,
      summary: summary || null,
      skills: skills.length ? skills : null,
      experience: experience.length ? experience : null,
      education: education.length ? education : null,
      achievements: achievements.length ? achievements : null,
      rawText: parsedProfile?.rawText ?? rawTextLocal ?? null,
      confidence: parsedProfile?.confidence ?? 0,
      metadata: { ...(parsedProfile?.metadata || {}), reviewedAt: Date.now(), reviewedBy: "frontend_review" },
    };
    try {
      const url = buildApiUrl(API_BASE_URL, 'api/v1/confirm-save');
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (json && (json.detail || json.error || json.message)) || res.statusText || `HTTP ${res.status}`;
        setError(String(msg));
        return undefined;
      } else {
        setSuccessMsg("Profile saved successfully");
        if (notifyParent && onSaved) onSaved({ ...(json || {}), __closeAfterSave: false });
        if (json && json.id) {
          setSavedProfileId(json.id);
          await fetchProfileVersion(json.id);
          return json.id;
        }
        return "success";
      }
    } catch (e: any) {
      setError(e.message || String(e));
      return undefined;
    } finally {
      setSaving(false);
    }
  }

  async function fetchProfileVersion(profileId: string) {
    try {
      const url = buildApiUrl(API_BASE_URL, 'api/v1/profiles', profileId);
      const res = await fetch(url);
      if (!res.ok) return;
      const j = await res.json();
      setProfileVersion(j?.version ?? null);
    } catch (err) {
      console.error("Failed to fetch profile version:", err);
    }
  }

  async function ensureSavedForRefine(): Promise<string | null> {
    const existing = savedProfileId ?? parsedProfile?.id;
    if (existing) return existing;
    const id = await handleSave(false);
    if (!id) {
      setRefineError("A profile must be saved before it can be refined.");
      return null;
    }
    return id;
  }

  async function fetchLLMHistoryForJob(profileId: string, jobId: string) {
    try {
      const url = buildApiUrl(API_BASE_URL, 'api/v1/llm-history', jobId);
      const res = await fetch(url);
      if (res.ok) {
        const row = await res.json();
        if (row && (row.full_response || row.patch)) {
          const patch = row.full_response?.patch ?? row.patch ?? row.full_response?.parsed?.patch;
          if (patch?.ops) {
            setPatchOps(patch.ops);
            const map: Record<string, boolean> = {};
            patch.ops.forEach((op: PatchOp) => (map[op.path] = true));
            setAcceptedPaths(map);
          }
          const parsed = row.full_response?.parsed ?? row.full_response;
          if (parsed) {
            setRefinedData(parsed);
            setRefineConfidence(row.confidence ?? parsed.confidence);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch LLM history for job:", err);
    }
  }

  async function handleRefineClick() {
    setRefineError(null);
    setRefining(true);
    setRefineStatus("queued");
    setRefinedData(null);
    setRefineConfidence(null);
    setPatchOps(null);
    setAcceptedPaths({});
    try {
      const profileId = await ensureSavedForRefine();
      if (!profileId) {
        setRefining(false);
        return;
      }
      let rawTextToSend = parsedProfile?.rawText ?? rawTextLocal;
      const url = buildApiUrl(API_BASE_URL, 'api/v1/llm-refine');
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId, rawText: rawTextToSend }) });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error((json?.detail || json?.error || json?.message) || res.statusText);
      }
      const j = await res.json();
      setRefineJobId(j?.jobId ?? j?.llm_job_id ?? null);
      setPlaceholderId(j?.placeholderId ?? j?.placeholder_id ?? null);
    } catch (e: any) {
      setRefineError(e.message || String(e));
      setRefineStatus("failed");
      setRefining(false);
    }
  }

  // --- JSX Rendering ---
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 overflow-auto max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {parsedProfile?.id ? `Revoir le profil` : 'Revoir un nouveau profil'}
            {profileVersion !== null && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">v{profileVersion}</span>
            )}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto mt-4">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-2">Revue manuelle</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
                  <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label htmlFor="summary" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Résumé</label>
                  <textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={4}
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label htmlFor="skills" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Compétences (séparées par des virgules)</label>
                  <input id="skills" type="text" value={skillsText} onChange={(e) => setSkillsText(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <JsonEditor label="Expérience (tableau JSON)" value={experienceText} onChange={setExperienceText} error={null} />
                <JsonEditor label="Éducation (tableau JSON)" value={educationText} onChange={setEducationText} error={null} />
                <div>
                  <label htmlFor="achievements" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Réalisations (une par ligne)</label>
                  <textarea id="achievements" value={achievementsText} onChange={(e) => setAchievementsText(e.target.value)} rows={4}
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
            </div>

            <div className="flex-1">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200">Raffinement par l'IA</h3>
                <button onClick={handleRefineClick} disabled={refining || saving}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md shadow-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {refining ? 'Raffinage...' : 'Raffiner avec l\'IA'}
                </button>
              </div>

              {refining && (
                <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400">
                  <LoadingSpinner />
                  <span>{refineStatus}...</span>
                </div>
              )}
              {refineError && <p className="text-red-600 dark:text-red-400 text-sm mt-2">{refineError}</p>}
              {refineConfidence !== null && (
                <p className="text-green-600 dark:text-green-400 text-sm mt-2">
                  Score de confiance de l'IA : <span className="font-bold">{(refineConfidence * 100).toFixed(1)}%</span>
                </p>
              )}

              {refinedData && (
                <div className="mt-4 p-4 border rounded-md shadow-sm bg-gray-50 dark:bg-gray-800">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Données raffinées par l'IA</h4>
                    <button onClick={() => setRefinedJsonView(!refinedJsonView)} className="text-sm text-purple-600 hover:underline">
                      {refinedJsonView ? 'Masquer le JSON brut' : 'Voir le JSON brut'}
                    </button>
                  </div>

                  {refinedJsonView ? (
                    <pre className="text-xs text-gray-800 dark:text-gray-200 overflow-x-auto">
                      {JSON.stringify(refinedData, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      <p><strong>Nom :</strong> {refinedData.name}</p>
                      <p><strong>Email :</strong> {refinedData.email}</p>
                      <p><strong>Résumé :</strong> {refinedData.summary}</p>
                      <p><strong>Compétences :</strong> {(refinedData.skills || []).join(', ')}</p>
                      <p><strong>Expérience :</strong></p>
                      <ul className="list-disc list-inside ml-4">
                        {(refinedData.experience || []).map((exp, i) => (
                          <li key={i}>{exp.title} chez {exp.company}</li>
                        ))}
                      </ul>
                      <p><strong>Éducation :</strong></p>
                      <ul className="list-disc list-inside ml-4">
                        {(refinedData.education || []).map((edu, i) => (
                          <li key={i}>{edu.degree} de {edu.institution}</li>
                        ))}
                      </ul>
                      <p><strong>Réalisations :</strong></p>
                      <ul className="list-disc list-inside ml-4">
                        {(refinedData.achievements || []).map((ach, i) => (
                          <li key={i}>{ach}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-400 border rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            Annuler
          </button>
          <div className="flex items-center space-x-4">
            {successMsg && <p className="text-sm text-green-600 dark:text-green-400">{successMsg}</p>}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button onClick={() => handleSave()} disabled={saving}
              className="px-4 py-2 bg-purple-600 text-white rounded-md shadow-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'Enregistrement...' : 'Enregistrer le profil'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

This plan is now complete and incorporates all the excellent work you've done.

Please **toggle to Act mode**, and I will execute this plan by creating and updating the files.