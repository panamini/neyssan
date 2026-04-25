"use client";

import React from "react";
import { Button } from "./ui/button";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import debounce from "lodash/debounce";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { useToast } from "./ui/toast";

/**
 * ProfileEditorUnified
 *
 * - Reads canonical profile from Convex (server-side canonical source).
 * - Allows uploading a CV (sends to pdf-ingest /api/v1/parse-now or /api/v1/llm-refine flow).
 * - Shows LLMHistory placeholder status (convex_write_status) when available and polls until success.
 *
 * This component intentionally keeps write operations server-authoritative:
 * - Upload CV -> POST /api/v1/parse-now (or existing upload endpoints)
 * - Reapply refine -> POST /api/v1/llm-refine
 * - Manual edits call backend endpoints (confirm-save / merge) rather than writing directly to Convex
 *   to preserve backend authority.
 */

export default function ProfileEditorUnified() {
  const [placeholderId, setPlaceholderId] = React.useState<string | null>(null);
  const [llmStatus, setLlmStatus] = React.useState<any>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  // New UI state for missing fields and AI suggestions
  const [missingFields, setMissingFields] = React.useState<string[]>([]);
  const [aiCategory, setAiCategory] = React.useState<string>("Unknown");
  const [aiFlags, setAiFlags] = React.useState<string[]>([]);
  const { showToast } = useToast();
  
  // Backend base URL (set in my-app/.env as VITE_PDF_INGEST_URL, e.g. http://127.0.0.1:8000)
  const baseUrl = import.meta.env.VITE_PDF_INGEST_URL || "";

  const profile = useQuery(api.profilesPublic.get);

  const calculateConfidence = (data: any) => {
    let score = 0;
    if (data?.name) score += 0.2;
    if (data?.email) score += 0.4;
    if (data?.summary) score += 0.15;
    // Add for skills/experience/etc.
    return Math.min(1.0, score); // Or default 1.0 if not computed
  };

  const debouncedSave = debounce(async (payload) => {
    try {
      const response = await fetch(`${baseUrl}/api/v1/confirm-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          confidence: calculateConfidence(payload),
        }),
      });
      if (!response.ok) {
        // If backend returns structured error JSON, try to parse
        const text = await response.text();
        try {
          const parsed = JSON.parse(text);
          console.warn("confirm-save returned non-OK:", parsed);
        } catch {
          console.warn("confirm-save returned non-OK text:", text);
        }
        throw new Error(text);
      }
      const data = await response.json();

      // Extract meta and surface missing fields / AI suggestions to the UI
      const meta = data.meta || {};
      setMissingFields(meta.missing_fields || []);
      setAiCategory(meta.ai_category || "Unknown");
      setAiFlags(meta.ai_flags || []);

      if (data.placeholderId) {
        setPlaceholderId(data.placeholderId);
      }
    } catch (error) {
      console.error("Save failed", error);
      // UI toast/error handling can be added here
    }
  }, 500);

  async function loadCanonical() {
    // The useQuery hook handles loading; this is a no-op refresh placeholder.
  }

  // Poll LLMHistory endpoint by placeholderId
  React.useEffect(() => {
    if (!placeholderId) return;
    let cancelled = false;
    const maxElapsed = 5 * 60 * 1000; // 5 minutes
    const delays = [1000, 2000, 4000, 8000, 16000, 30000]; // ms
    let attempt = 0;
    let elapsed = 0;

    async function pollOnce() {
      try {
        const resp = await fetch(`${baseUrl}/api/v1/llm-history/${placeholderId}`);
        if (!resp.ok) throw new Error(await resp.text());
        const body = await resp.json();
        if (cancelled) return;
        setLlmStatus(body);

        if (body.convex_write_status === "success") {
          await loadCanonical();
          // clear placeholder and status after a short delay so UI updates
          setTimeout(() => {
            if (!cancelled) setPlaceholderId(null);
          }, 800);
          return;
        }

        if (body.convex_write_status === "failed") {
          // stop polling; allow user to retry manually
          return;
        }

        // still pending -> schedule next poll
        const delay = attempt < delays.length ? delays[attempt] : delays[delays.length - 1];
        attempt += 1;
        elapsed += delay;
        if (elapsed >= maxElapsed) {
          console.warn("Polling llm-history timed out for", placeholderId);
          return;
        }
        setTimeout(() => {
          if (!cancelled) void pollOnce();
        }, delay);
      } catch (e) {
        console.warn("Polling llm-history failed", e);
        const delay = attempt < delays.length ? delays[attempt] : delays[delays.length - 1];
        attempt += 1;
        elapsed += delay;
        if (elapsed >= maxElapsed) {
          console.warn("Polling llm-history timed out after error for", placeholderId);
          return;
        }
        if (!cancelled) setTimeout(() => void pollOnce(), delay);
      }
    }

    void pollOnce();
    return () => {
      cancelled = true;
    };
  }, [placeholderId]);

  async function handleUpload(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    try {
      // Use synchronous parse-now for quick feedback if supported
      const form = new FormData();
      form.append("file", file);
      const parseResp = await fetch(`${baseUrl}/api/v1/parse-now`, { method: "POST", body: form });
      if (parseResp.ok) {
        // parse-now returns normalized JSON; we send that to confirm-save then llm-refine
        const parsed = await parseResp.json();
        // confirm-save to persist and maybe enqueue refine
        const confirmResp = await fetch(`${baseUrl}/api/v1/confirm-save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...parsed, confidence: calculateConfidence(parsed) }),
        });
        if (!confirmResp.ok) {
          // if confirm-save failed, fallback to show error
          const txt = await confirmResp.text();
          throw new Error("confirm-save failed: " + txt);
        }
        const confirmBody = await confirmResp.json();

        // Update UI meta state from returned meta
        const meta = confirmBody.meta || {};
        setMissingFields(meta.missing_fields || []);
        setAiCategory(meta.ai_category || "Unknown");
        setAiFlags(meta.ai_flags || []);

        // If a placeholder id is returned, monitor it
        if (confirmBody.placeholderId) {
          setPlaceholderId(confirmBody.placeholderId);
        } else {
          // If no placeholder, optionally call llm-refine to force refine.
          // Prefer the definitive Convex id returned by confirm-save (convexId) when present.
          const profileIdToUse = (confirmBody)?.convexId ?? confirmBody.id;
          const refineResp = await fetch(`${baseUrl}/api/v1/llm-refine`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profileId: profileIdToUse }),
          });
          if (refineResp.ok) {
            const r = await refineResp.json();
            if (r.placeholderId) setPlaceholderId(r.placeholderId);
          }
        }
      } 
    } catch (e) {
      console.error("Upload/ingest failed", e);
      showToast("Upload failed.", { variant: "error" });
    }
  }

  async function reapplyRefine() {
    try {
      if (!profile) {
        showToast("No resume loaded.", { variant: "warning" });
        return;
      }
      const pid = profile?._id;
      if (!pid) {
        console.warn("Cannot determine profile id");
        return;
      }
      const resp = await fetch(`${baseUrl}/api/v1/llm-refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: String(pid) }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const body = await resp.json();
      if (body.placeholderId) {
        setPlaceholderId(body.placeholderId);
      }
    } catch (e) {
      console.error("Reapply refine failed", e);
      showToast("Refine failed.", { variant: "error" });
    }
  }

  return (
    <div className="max-w-4xl p-2 mx-auto bg-background text-foreground">
      <h1 className="mb-2 text-2xl font-semibold">Profile Editor (Unified)</h1>

      <div className="mb-4">
        {missingFields.length > 0 && (
          <div className="p-2 mb-4 text-sm border rounded text-muted bg-surface-muted [border-color:var(--color-border)]">
            Missing required fields: <strong>{missingFields.join(", ")}</strong>. You can still save, but consider adding them.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="p-2 border rounded-md bg-background [border-color:var(--color-border)]">
          <h2 className="mb-2 text-lg font-medium">Canonical profile (Convex)</h2>
          <div className="mb-2 text-sm text-muted">This view reads the canonical profile from Convex. All authoritative writes are performed by the backend.</div>
          <pre className="p-2 overflow-auto text-sm border rounded-md bg-background h-72">
            {profile ? JSON.stringify(profile, null, 2) : "Loading canonical profile..."}
          </pre>

          <div className="flex gap-2 mt-3">
            <label className="px-3 py-2 border rounded-md cursor-pointer bg-background [border-color:var(--color-border)]">
              Upload CV
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                  void handleUpload(f);
                }}
              />
            </label>

            <Button
              onClick={() =>{
                void reapplyRefine();
              }}
              className="px-3 py-2 rounded-md text-background bg-primary"
            >
              Reapply AI refine</Button>

            <Button
              onClick={async () =>{
                // Retry Convex persist for current placeholder if present
                if (!placeholderId) {
                  showToast("Nothing to retry.", { variant: "warning" });
                  return;
                }
                try {
                  const resp = await fetch(`${baseUrl}/api/v1/convex-persist-retry`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ placeholderId }),
                  });
                  if (!resp.ok) {
                    const text = await resp.text();
                    throw new Error(text);
                  }
                  // restart polling by re-setting placeholderId (no-op) to trigger effect if needed
                  setTimeout(() => {
                    void loadCanonical();
                  }, 800);
                } catch (err) {
                  console.error("Retry Convex persist failed", err);
                  showToast("Retry failed.", { variant: "error" });
                }
              }}
              className="px-3 py-2 rounded-md text-background bg-accent"
            >
              Retry Convex persist</Button>

            <Button
              onClick={() =>{
                void loadCanonical();
              }}
              className="px-3 py-2 rounded-md bg-surface"
            >
              Refresh</Button>
          </div>

          <div className="mt-3 text-sm">
            <div>Uploaded file: {fileName ?? "none"}</div>
            <div>LLMHistory placeholder: {placeholderId ?? "none"}</div>
            <div>Status: {llmStatus ? llmStatus.convex_write_status ?? JSON.stringify(llmStatus) : "idle"}</div>
            {llmStatus?.convex_error && <div className="text-danger">Error: {llmStatus.convex_error}</div>}
          </div>
        </Card>

        <Card className="p-2 border rounded-md bg-background [border-color:var(--color-border)]">
          <h2 className="mb-2 text-lg font-medium">Edit (manual)</h2>
          <div className="mb-2 text-sm text-muted">Manual edits should call backend endpoints to keep pdf-ingest as authoritative writer.</div>

          <div>
            <label className="block mb-1 text-sm font-medium">Name</label>
            <Input
              type="text"
              defaultValue={profile?.name ?? ""}
              onBlur={(e) => {
                const newName = e.currentTarget.value;
                const merged = {
                  name: newName,
                  email: profile?.email ?? null,
                  summary: profile?.summary ?? null,
                  skills: profile?.skills ?? [],
                  experience: profile?.experience ?? [],
                  education: profile?.education ?? [],
                  raw_text: profile?.raw_text ?? null,
                  metadata: profile?.metadata ?? {},
                };
                debouncedSave(merged);
              }}
              className={`w-full px-2 py-1 border rounded-md ${missingFields.includes("name") ? "border-danger" : ""}`}
              size="md"
              variant="default"
            />
          </div>

          <div className="mt-3">
            <label className="block mb-1 text-sm font-medium">Email</label>
            <Input
              type="email"
              defaultValue={profile?.email ?? ""}
              onBlur={(e) => {
                const merged = {
                  name: profile?.name ?? null,
                  email: e.currentTarget.value ?? null,
                  summary: profile?.summary ?? null,
                  skills: profile?.skills ?? [],
                  experience: profile?.experience ?? [],
                  education: profile?.education ?? [],
                  raw_text: profile?.raw_text ?? null,
                  metadata: profile?.metadata ?? {},
                };
                debouncedSave(merged);
              }}
              className={`w-full px-2 py-1 border rounded-md ${missingFields.includes("email") ? "border-danger" : ""}`}
              size="md"
              variant="default"
            />
          </div>

          <div className="mt-3">
            <label className="block mb-1 text-sm font-medium">Summary</label>
            <textarea
              rows={6}
              defaultValue={profile?.summary ?? ""}
              onBlur={(e) => {
                const newSummary = e.currentTarget.value;
                const merged = {
                  name: profile?.name ?? null,
                  email: profile?.email ?? null,
                  summary: newSummary,
                  skills: profile?.skills ?? [],
                  experience: profile?.experience ?? [],
                  education: profile?.education ?? [],
                  raw_text: profile?.raw_text ?? null,
                  metadata: profile?.metadata ?? {},
                };
                debouncedSave(merged);
              }}
              className="w-full px-2 py-1 border rounded-md"
            />
          </div>
        </Card>
      </div>

      {aiCategory !== "Unknown" && (
        <section className="p-2 mt-4 border rounded-md bg-background">
          <h3 className="mb-2 text-lg font-medium">AI Suggestions</h3>
          <p>Suggested Category: <strong>{aiCategory}</strong></p>
          {aiFlags.length > 0 && (
            <ul className="pl-5 list-disc">
              {aiFlags.map((flag, idx) => <li key={idx}>{flag}</li>)}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
