"use client";

import React, { useState, useEffect } from "react";

type ExperienceItem = {
  company?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
};

type NormalizedProfile = {
  id?: string;
  name?: string | null;
  email?: string | null;
  summary?: string | null;
  skills?: string[] | null;
  experience?: ExperienceItem[] | null;
  education?: any[] | null;
  achievements?: string[] | null;
  rawText?: string | null;
  confidence?: number;
  metadata?: Record<string, unknown> | null;
  version?: number;
};

type PatchOp = {
  path: string;
  op: "replace" | string;
  value: any;
};

type LLMHistoryRow = {
  id: string;
  profile_id: string;
  run_time?: string;
  provider?: string;
  model?: string;
  job_id?: string;
  full_response?: any;
  patch?: { ops: PatchOp[] } | null;
  merged?: boolean;
};

type Props = {
  visible: boolean;
  parsedProfile: NormalizedProfile | null;
  onClose: () => void;
  onSaved?: (result: any) => void;
};

export default function ProfileReviewModal({ visible, parsedProfile, onClose, onSaved }: Props) {
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [skillsText, setSkillsText] = useState<string>("");
  const [experienceText, setExperienceText] = useState<string>("");
  const [educationText, setEducationText] = useState<string>("[]");
  const [achievementsText, setAchievementsText] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // LLM refine states
  const [refining, setRefining] = useState<boolean>(false);
  const [refineJobId, setRefineJobId] = useState<string | null>(null);
  const [refineStatus, setRefineStatus] = useState<string | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);

  // Track saved profile id and current profile version
  const [savedProfileId, setSavedProfileId] = useState<string | null>(null);
  const [profileVersion, setProfileVersion] = useState<number | null>(null);
  // Local copy of raw extracted text so UI doesn't disappear when parsedProfile prop isn't immediately updated
  const [rawTextLocal, setRawTextLocal] = useState<string>("");

  // Patch UI
  const [patchOps, setPatchOps] = useState<PatchOp[] | null>(null);
  const [acceptedPaths, setAcceptedPaths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (parsedProfile) {
      setName((parsedProfile as any).name ?? "");
      setEmail((parsedProfile as any).email ?? "");
      setSummary((parsedProfile as any).summary ?? "");
      setSkillsText(((parsedProfile as any).skills || []).join(", "));
      try {
        setExperienceText(JSON.stringify((parsedProfile as any).experience || [], null, 2));
      } catch {
        setExperienceText("[]");
      }
      try {
        setEducationText(JSON.stringify(((parsedProfile as any).education || (parsedProfile as any).metadata?.education) || [], null, 2));
      } catch {
        setEducationText("[]");
      }
      const ach = (parsedProfile as any).achievements ?? (parsedProfile as any).metadata?.achievements ?? [];
      setAchievementsText(Array.isArray(ach) ? ach.join("\n") : String(ach));
      setError(null);
      setSuccessMsg(null);
      setSavedProfileId((parsedProfile as any)?.id ?? null);
      setProfileVersion((parsedProfile as any)?.version ?? null);
    }
  }, [parsedProfile]);

  if (!visible) return null;

  async function handleSave(notifyParent: boolean = true): Promise<string | undefined> {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    // Build payload
    let skills: string[] = skillsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    let experience: ExperienceItem[] = [];
    try {
      const parsed = JSON.parse(experienceText || "[]");
      if (Array.isArray(parsed)) {
        experience = parsed;
      } else {
        throw new Error("Experience JSON must be an array");
      }
    } catch (e: any) {
      setError("Invalid experience JSON: " + (e?.message || String(e)));
      setSaving(false);
      return undefined;
    }

    // parse education & achievements from the modal fields
    let education: any[] | undefined = undefined;
    try {
      const parsedEdu = JSON.parse(educationText || "[]");
      if (Array.isArray(parsedEdu)) education = parsedEdu;
    } catch (e) {
      setError("Invalid education JSON: " + (e as any).message || String(e));
      setSaving(false);
      return undefined;
    }

    const achievements = achievementsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: NormalizedProfile = {
      name: name || undefined,
      email: email || undefined,
      summary: summary || undefined,
      skills: skills.length ? skills : undefined,
      experience: experience.length ? experience : undefined,
      education: education && education.length ? education : undefined,
      achievements: achievements.length ? achievements : undefined,
      rawText: parsedProfile?.rawText ?? undefined,
      confidence: parsedProfile?.confidence ?? 0,
      metadata: {
        ...(parsedProfile?.metadata || {}),
        reviewedAt: Date.now(),
        reviewedBy: "frontend_review",
      },
    };

    const base = (import.meta as any).env?.VITE_PDF_INGEST_URL ?? "";
    const url = base ? (base.endsWith("/") ? `${base}api/v1/confirm-save` : `${base}/api/v1/confirm-save`) : "/api/v1/confirm-save";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (json && (json.detail || json.error || json.message)) || res.statusText || `HTTP ${res.status}`;
        setError(String(msg));
        return undefined;
      } else {
        setSuccessMsg("Saved successfully");
        // Inform parent but do not instruct it to close the modal by default.
        if (notifyParent && onSaved) onSaved({ ...(json || {}), __closeAfterSave: false });
        if (json && json.id) {
          setSavedProfileId(json.id);
          // fetch profile to get version
          await fetchProfileVersion(json.id);
          setSaving(false);
          return json.id;
        }
        setSaving(false);
        return undefined;
      }
    } catch (e: any) {
      setError(e?.message || String(e));
      return undefined;
    } finally {
      setSaving(false);
    }
  }

  async function fetchProfileVersion(profileId: string) {
    try {
      const base = (import.meta as any).env?.VITE_PDF_INGEST_URL ?? "";
      const url = base ? (base.endsWith("/") ? `${base}api/v1/profiles/${profileId}` : `${base}/api/v1/profiles/${profileId}`) : `/api/v1/profiles/${profileId}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const j = await res.json().catch(() => null);
      setProfileVersion(j?.version ?? null);
    } catch {
      // ignore
    }
  }

  /**
   * Ensure we have a saved profile id before issuing a refine job.
   * If there is no savedProfileId, attempt to save the current modal data.
   * Returns the profileId on success or null on failure.
   */
  async function ensureSavedForRefine(): Promise<string | null> {
    const existing = savedProfileId ?? (parsedProfile as any)?.id ?? null;
    if (existing) return existing;
    // Try to save
      try {
      const id = await handleSave(false); // auto-save without notifying parent to avoid UI race
      if (!id) {
        setRefining(false);
        setRefineStatus(null);
        setRefineError("Save required before refine.");
        return null;
      }
      return id;
    } catch (e: any) {
      setRefining(false);
      setRefineError(e?.message || String(e));
      return null;
    }
  }

  async function fetchLLMHistoryForJob(profileId: string, jobId: string) {
    try {
      // Prefer job-specific endpoint if available
      const base = (import.meta as any).env?.VITE_PDF_INGEST_URL ?? "";
      const jobUrl = base ? (base.endsWith("/") ? `${base}api/v1/llm-history/${jobId}` : `${base}/api/v1/llm-history/${jobId}`) : `/api/v1/llm-history/${jobId}`;
      const byJob = await fetch(jobUrl);
      if (byJob.ok) {
        const row = await byJob.json().catch(() => null);
        if (row) {
          const patch = row.full_response?.patch ?? row.patch ?? (row.full_response && row.full_response.parsed && row.full_response.parsed.patch) ?? null;
          if (patch && patch.ops) {
            setPatchOps(patch.ops);
            const map: Record<string, boolean> = {};
            patch.ops.forEach((op: PatchOp) => (map[op.path] = true));
            setAcceptedPaths(map);
          }
          return;
        }
      }

      // Fallback: fetch profile history and find matching job id
      const getUrl = base ? (base.endsWith("/") ? `${base}api/v1/profiles/${profileId}/llm-history` : `${base}/api/v1/profiles/${profileId}/llm-history`) : `/api/v1/profiles/${profileId}/llm-history`;
      const res = await fetch(getUrl);
      if (!res.ok) return;
      const rows: LLMHistoryRow[] = await res.json().catch(() => []);
      const match = rows.find((r) => String(r.job_id) === String(jobId));
      if (match) {
        const patch = match.full_response?.patch ?? match.patch ?? (match.full_response && match.full_response.parsed && match.full_response.parsed.patch) ?? null;
        if (patch && patch.ops) {
          setPatchOps(patch.ops);
          const map: Record<string, boolean> = {};
          patch.ops.forEach((op: PatchOp) => (map[op.path] = true));
          setAcceptedPaths(map);
        }
      }
    } catch (e) {
      // ignore
    }
  }

  async function applySelectedPatch() {
    if (!savedProfileId) {
      setError("No saved profile id available. Save first.");
      return;
    }
    if (!patchOps || patchOps.length === 0) {
      setError("No patch available to apply.");
      return;
    }
    // Build selected ops array
    const selected = patchOps.filter((op) => acceptedPaths[op.path]);
    if (selected.length === 0) {
      setError("No fields selected.");
      return;
    }
    const payload = {
      patch: { ops: selected },
      client_version: profileVersion ?? null,
      job_id: refineJobId ?? null,
    };

    try {
      const base = (import.meta as any).env?.VITE_PDF_INGEST_URL ?? "";
      const url = base ? (base.endsWith("/") ? `${base}api/v1/profiles/${savedProfileId}/merge` : `${base}/api/v1/profiles/${savedProfileId}/merge`) : `/api/v1/profiles/${savedProfileId}/merge`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError((j && (j.detail || j.error || j.message)) || res.statusText || `HTTP ${res.status}`);
        return;
      }
      setSuccessMsg("Selected changes merged");
      // Try to fetch the merged profile and update modal fields so the UI reflects the merge immediately.
      let mergedProfile: any = null;
      try {
        const base = (import.meta as any).env?.VITE_PDF_INGEST_URL ?? "";
        const url = base ? (base.endsWith("/") ? `${base}api/v1/profiles/${savedProfileId}` : `${base}/api/v1/profiles/${savedProfileId}`) : `/api/v1/profiles/${savedProfileId}`;
        const resp = await fetch(url);
        if (resp.ok) {
          mergedProfile = await resp.json().catch(() => null);
          if (mergedProfile) {
            setName(mergedProfile.name ?? "");
            setEmail(mergedProfile.email ?? "");
            setSummary(mergedProfile.summary ?? "");
            setSkillsText(((mergedProfile.skills || []) as string[]).join(", "));
            try {
              setExperienceText(JSON.stringify(mergedProfile.experience || [], null, 2));
            } catch {
              // ignore
            }
            try {
              setEducationText(JSON.stringify(mergedProfile.education || [], null, 2));
            } catch {
              // ignore
            }
            setAchievementsText((mergedProfile.achievements || []).join("\n"));
            setProfileVersion(mergedProfile.version ?? profileVersion);
            setSavedProfileId(mergedProfile.id ?? savedProfileId);
          }
        }
      } catch (err) {
        // ignore fetch errors - we still refreshed version below
      }

      // Refresh profile version (fallback)
      await fetchProfileVersion(savedProfileId);
      // Notify parent but do not close modal by default.
      if (onSaved) onSaved({ ...(j || {}), profile: mergedProfile, __closeAfterSave: false });
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded shadow-lg p-4 overflow-auto max-h-[90vh]">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold">Review parsed profile</h3>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onClose();
              }}
              className="px-3 py-1 text-sm bg-gray-200 rounded"
            >
              Close
            </button>
          </div>
        </div>

        <div className="mt-3 space-y-3 text-sm">
          <div>
            <label className="block text-xs font-medium">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-2 py-1 border rounded" />
          </div>

          <div>
            <label className="block text-xs font-medium">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-2 py-1 border rounded" />
          </div>

          <div>
            <label className="block text-xs font-medium">Summary</label>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} className="w-full px-2 py-1 border rounded" />
          </div>

          <div>
            <label className="block text-xs font-medium">Skills (comma separated)</label>
            <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} className="w-full px-2 py-1 border rounded" />
          </div>

          <div>
            <label className="block text-xs font-medium">Experience (JSON array)</label>
            <textarea value={experienceText} onChange={(e) => setExperienceText(e.target.value)} rows={6} className="w-full px-2 py-1 font-mono text-xs border rounded" />
            <div className="mt-1 text-xs text-gray-500">Example: [&#123;"company":"Acme","title":"Engineer","startDate":"2020","endDate":"2022","description":"..."&#125;]</div>
          </div>

          <div>
            <label className="block text-xs font-medium">Raw extracted text (read-only)</label>
            <textarea value={parsedProfile?.rawText ?? ""} readOnly rows={6} className="w-full px-2 py-1 text-xs border rounded bg-gray-50" />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
          {successMsg && <div className="text-sm text-green-600">{successMsg}</div>}
        </div>

        <div className="flex items-center justify-between gap-2 mt-4">
          <div className="flex items-center gap-2 mr-auto text-sm">
            <button
            onClick={async () => {
                // Ensure profile is saved (auto-save) before enqueueing a refine job.
                setRefineError(null);
                setRefining(true);
                setRefineStatus("queued");
                try {
                  const profileId = await ensureSavedForRefine();
                  if (!profileId) {
                    // ensureSavedForRefine already set appropriate error
                    return;
                  }
                  const base = (import.meta as any).env?.VITE_PDF_INGEST_URL ?? "";

                  // Obtain a canonical fullRawText from the server (non-destructive).
                  // Fall back to parsedProfile.rawText if the fetch fails.
                  let rawTextToSend = parsedProfile?.rawText ?? "";
                  try {
                    const fullTextUrl = base
                      ? (base.endsWith("/") ? `${base}api/v1/profiles/${profileId}/full-raw-text` : `${base}/api/v1/profiles/${profileId}/full-raw-text`)
                      : `/api/v1/profiles/${profileId}/full-raw-text`;
                    const fullResp = await fetch(fullTextUrl);
                    if (fullResp.ok) {
                      const fullJson = await fullResp.json().catch(() => null);
                      if (fullJson && typeof fullJson.fullRawText === "string") {
                        rawTextToSend = fullJson.fullRawText;
                      }
                    }
                  } catch (e) {
                    // Best-effort: if we can't fetch the canonical raw text, continue with existing parsedProfile.rawText
                  }

                  const url = base ? (base.endsWith("/") ? `${base}api/v1/llm-refine` : `${base}/api/v1/llm-refine`) : "/api/v1/llm-refine";
                  const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ profileId, rawText: rawTextToSend }),
                  });
                  if (!res.ok) {
                    const json = await res.json().catch(() => null);
                    const msg = (json && (json.detail || json.error || json.message)) || res.statusText || `HTTP ${res.status}`;
                    setRefineError(String(msg));
                    setRefining(false);
                    setRefineStatus("failed");
                    return;
                  }
                  const j = await res.json().catch(() => null);
                  const jobId = j?.jobId ?? j?.llm_job_id ?? null;
                  if (!jobId) {
                    setRefineError("No jobId returned from server");
                    setRefining(false);
                    setRefineStatus("failed");
                    return;
                  }
                  setRefineJobId(jobId);
                  setRefineStatus("queued");
 
                  // Poll RQ job status and when finished fetch llm_history
                  const pollUrlBase = base ? (base.endsWith("/") ? `${base}api/v1/rq-job/` : `${base}/api/v1/rq-job/`) : "/api/v1/rq-job/";
                  let attempts = 0;
                  const maxAttempts = 60; // ~1 minute
                  while (attempts < maxAttempts) {
                    attempts += 1;
                    try {
                      const st = await fetch(pollUrlBase + encodeURIComponent(jobId));
                      if (!st.ok) {
                        await new Promise((r) => setTimeout(r, 1000));
                        continue;
                      }
                      const sj = await st.json().catch(() => null);
                      const status = sj?.status ?? null;
                      setRefineStatus(status);
                      if (status === "finished" || status === "failed") {
                        if (status === "finished") {
                          // fetch llm_history and set patch
                          await fetchLLMHistoryForJob(profileId, jobId);
                          // refresh profile to get latest values & version
                          await fetchProfileVersion(profileId);
                          setSuccessMsg("AI refinement completed");
                        } else {
                          setRefineError("Refinement job failed on server");
                        }
                        break;
                      }
                      await new Promise((r) => setTimeout(r, 1000));
                    } catch {
                      await new Promise((r) => setTimeout(r, 1000));
                    }
                  }
 
                  setRefining(false);
                } catch (e: any) {
                  setRefineError(e?.message || String(e));
                  setRefining(false);
                  setRefineStatus("failed");
                }
              }}
              disabled={refining}
              className="px-3 py-1 text-sm text-white bg-purple-600 rounded"
            >
              {refining ? "Refining…" : "Refine with AI"}
            </button>

            {refineStatus && <span className="text-xs text-gray-600">Status: {refineStatus}</span>}
            {refineJobId && <span className="text-xs text-gray-500">Job: {refineJobId}</span>}
            {refineError && <span className="text-xs text-red-600">Error: {refineError}</span>}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
            <button onClick={() => { void handleSave(); }} disabled={saving} className="px-3 py-1 text-white bg-blue-600 rounded">
              {saving ? "Saving…" : "Save to DB"}
            </button>
            <button
              onClick={applySelectedPatch}
              disabled={!patchOps || Object.values(acceptedPaths).filter(Boolean).length === 0}
              className="px-3 py-1 text-white bg-green-600 rounded"
            >
              Apply selected AI changes
            </button>
          </div>
        </div>

        {/* Patch review UI */}
        {patchOps && (
          <div className="pt-4 mt-4 border-t">
            <h4 className="mb-2 text-sm font-medium">AI suggested changes</h4>
            <div className="space-y-2 text-sm">
              {patchOps.map((op, idx) => {
                const field = op.path.replace(/^\//, "");
                // get current/original value from parsedProfile or savedProfile fields
                const originalVal = (parsedProfile as any)?.[field] ?? (parsedProfile as any)?.metadata?.[field] ?? null;
                const newVal = op.value;
                const checked = !!acceptedPaths[op.path];
                return (
                  <div key={idx} className="flex items-start gap-3 p-2 border rounded">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setAcceptedPaths({ ...acceptedPaths, [op.path]: e.target.checked })}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="text-xs text-gray-600">{field}</div>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div>
                          <div className="text-[11px] font-semibold">Current</div>
                          <pre className="p-2 text-xs whitespace-pre-wrap rounded bg-gray-50">{JSON.stringify(originalVal, null, 2)}</pre>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold">Suggested</div>
                          <pre className="p-2 text-xs whitespace-pre-wrap rounded bg-yellow-50">{JSON.stringify(newVal, null, 2)}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
