"use client";

import React from "react";
import { useMutation, useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import ProfileView from "./ProfileView";
import { SkillAdder, ExperienceAdder, EducationAdder } from "./ProfileEditors";
import clsx from "clsx";

/**
 * ProfileEditor
 *
 * Left column: ingest resume + structured editable form (summary, skills, experience, education)
 * Right column: live preview card (ProfileView) + preferences display
 *
 * Saves use the public mutation `profilesPublic` and refresh the local preview immediately.
 *
 * This component is meant to be dropped into the app; it uses Tailwind classes.
 */

type Preferences = {
  autoSend: boolean;
  tonePreference: string;
  writingStyle: string;
};

export default function ProfileEditor() {
  const convex = useConvex();
  const profilesPublic = useMutation(api.profilesPublic.default) as any;

  const [profile, setProfile] = React.useState<any>(null);
  const [ingestText, setIngestText] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);

  const [showSettings, setShowSettings] = React.useState(false);
  const [preferences, setPreferences] = React.useState<Preferences>({
    autoSend: false,
    tonePreference: "neutral",
    writingStyle: "professional",
  });

  async function fetchMyProfile() {
    try {
      const result = await convex.query((window as any).api?.users?.getUser);
      setProfile(result ?? null);
      // If profile has preferences merge to local preferences
      if (result?.preferences) {
        setPreferences((p) => ({ ...p, ...result.preferences }));
      }
    } catch (err) {
      console.error("Failed to load profile", err);
    }
  }

  React.useEffect(() => {
    // load on mount
    void fetchMyProfile();
  }, []);

  async function ingestResume() {
    if (!ingestText || ingestText.length < 20) {
      setStatus("Please paste at least 20 characters of resume text.");
      return;
    }
    try {
      setStatus("Ingesting...");
      await profilesPublic({
        profile: {
          summary: ingestText.substring(0, 2000),
          rawText: ingestText.substring(0, 2000),
          metadata: { source: "manual_paste", importedAt: Date.now() },
        },
      });
      await fetchMyProfile();
      setStatus("Ingested and updated.");
      setIngestText("");
    } catch (err: any) {
      console.error("Ingest failed", err);
      setStatus(`Ingest failed: ${err?.message ?? String(err)}`);
    } finally {
      setTimeout(() => setStatus(null), 2500);
    }
  }

  async function updateField(partial: Record<string, any>, showMsg = true) {
    try {
      if (showMsg) setStatus("Saving...");
      await profilesPublic({ profile: partial });
      await fetchMyProfile();
      if (showMsg) {
        setStatus("Saved");
        setTimeout(() => setStatus(null), 1500);
      }
    } catch (err: any) {
      console.error("Save failed", err);
      setStatus(`Save failed: ${err?.message ?? String(err)}`);
    }
  }

  // Preferences modal save
  async function savePreferences() {
    setPreferences((p) => p); // ensure up-to-date
    await updateField({ preferences }, false);
    setShowSettings(false);
  }

  return (
    <div className="max-w-6xl p-4 mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Profile Editor</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            aria-label="Open settings"
            className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
            title="Settings"
          >
            ⚙️
          </button>
          {status && <div className="text-sm text-gray-600">{status}</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left: Edit form */}
        <div className="space-y-4">
          {/* Ingest */}
          <section className="p-4 bg-white border rounded">
            <h2 className="mb-2 text-lg font-medium">Ingest résumé</h2>
            <textarea
              rows={6}
              value={ingestText}
              onChange={(e) => setIngestText(e.target.value)}
              placeholder="Paste your resume or profile text here..."
              className="w-full p-2 text-sm border rounded"
            />
              <div className="flex items-center gap-2 mt-2">
              <button onClick={() => { void ingestResume(); }} className="px-3 py-1 text-white bg-blue-600 rounded">
                Ingest profile
              </button>
              <div className="text-sm text-gray-500">Pastes summary + rawText to profile</div>
            </div>
          </section>

          {/* Modify structured fields */}
          <section className="p-4 space-y-4 bg-white border rounded">
            <h2 className="text-lg font-medium">Modify profile</h2>

            {/* Display name */}
            <div>
              <label className="block mb-1 text-sm font-medium">Display name</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={profile?.name ?? ""}
                  onChange={(e) => setProfile((p: any) => ({ ...p, name: e.target.value }))}
                  onBlur={(e) => {
                    void updateField({ name: e.currentTarget.value });
                  }}
                  placeholder="Display name"
                  className="w-full px-2 py-1 border rounded"
                />
                <button
                  onClick={() => {
                    void updateField({ name: profile?.name ?? "" });
                  }}
                  className="px-3 py-1 bg-gray-200 rounded"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Summary (editable textarea) */}
            <div>
              <label className="block mb-1 text-sm font-medium">Summary</label>
              <textarea
                rows={4}
                value={profile?.summary ?? ""}
                onChange={(e) => setProfile((p: any) => ({ ...p, summary: e.target.value }))}
                onBlur={(e) => {
                  void updateField({ summary: e.currentTarget.value });
                }}
                className="w-full px-2 py-1 border rounded"
              />
            </div>

            {/* LinkedIn */}
            <div>
              <label className="block mb-1 text-sm font-medium">LinkedIn</label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={profile?.linkedIn ?? ""}
                  onChange={(e) => setProfile((p: any) => ({ ...p, linkedIn: e.target.value }))}
                  onBlur={(e) => {
                    void updateField({ linkedIn: e.currentTarget.value });
                  }}
                  placeholder="https://www.linkedin.com/in/your-profile"
                  className="w-full px-2 py-1 border rounded"
                />
                <a
                  className={clsx("px-3 py-1 rounded text-sm", profile?.linkedIn ? "bg-blue-600 text-white" : "bg-gray-200")}
                  href={profile?.linkedIn ?? "#"}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Open
                </a>
              </div>
            </div>

            {/* Skills */}
            <div>
              <label className="block mb-1 text-sm font-medium">Skills</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(profile?.skills || []).map((s: string, i: number) => (
                  <span key={i} className="flex items-center gap-2 px-2 py-1 text-sm bg-gray-100 rounded">
                    <span>{s}</span>
                      <button
                        onClick={() => {
                          const next = (profile?.skills || []).filter((x: string) => x !== s);
                          void updateField({ skills: next });
                        }}
                        className="px-1 text-xs bg-red-200 rounded"
                        aria-label={`Remove skill ${s}`}
                      >
                        ×
                      </button>
                  </span>
                ))}
              </div>
              <SkillAdder
                onAdd={async (val: string) => {
                  const next = [...(profile?.skills || []), val];
                  await updateField({ skills: next });
                }}
              />
            </div>

            {/* Experience */}
            <div>
              <label className="block mb-1 text-sm font-medium">Experience</label>
              <div className="mb-2 space-y-2">
                {(profile?.experience || []).map((exp: any, idx: number) => (
                  <div key={idx} className="p-2 border rounded">
                    <div className="text-sm font-semibold">{exp.title} — {exp.company}</div>
                    {exp.description && <div className="mt-1 text-sm text-gray-700">{exp.description}</div>}
                    <div className="mt-2">
                      <button
                        onClick={() => {
                          const next = (profile?.experience || []).filter((_: any, i: number) => i !== idx);
                          void updateField({ experience: next });
                        }}
                        className="px-2 py-1 text-xs bg-red-200 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
                      <ExperienceAdder
                        onAdd={(entry) => {
                          const next = [...(profile?.experience || []), entry];
                          void updateField({ experience: next });
                        }}
                      />
            </div>

            {/* Education */}
            <div>
              <label className="block mb-1 text-sm font-medium">Education</label>
              <div className="mb-2 space-y-2">
                {(profile?.education || []).map((ed: any, idx: number) => (
                  <div key={idx} className="p-2 border rounded">
                    <div className="text-sm font-semibold">{ed.school} {ed.degree ? `— ${ed.degree}` : ""}</div>
                    <div className="mt-1 text-sm text-gray-700">{ed.fieldOfStudy ?? ""}</div>
                    <div className="mt-2">
                      <button
                        onClick={() => {
                          const next = (profile?.education || []).filter((_: any, i: number) => i !== idx);
                          void updateField({ education: next });
                        }}
                        className="px-2 py-1 text-xs bg-red-200 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
                      <EducationAdder
                        onAdd={(entry) => {
                          const next = [...(profile?.education || []), entry];
                          void updateField({ education: next });
                        }}
                      />
            </div>
          </section>
        </div>

        {/* Right: Live preview */}
        <aside className="p-4 bg-white border rounded">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">{profile?.name ?? profile?.email ?? "No user"}</h2>
              <div className="text-sm text-gray-500">{profile?.email ?? ""}</div>
            </div>
            <div className="text-sm text-gray-600">
              Tone: {preferences.tonePreference}, Style: {preferences.writingStyle}, Auto-send: {preferences.autoSend ? "On" : "Off"}
            </div>
          </div>

          <div className="mt-4">
            <ProfileView profile={profile ?? {}} />
          </div>
        </aside>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md p-6 bg-white rounded">
            <h3 className="mb-4 text-lg font-medium">Preferences</h3>
            <div className="space-y-3">
              <div>
                <label className="block mb-1 text-sm">Tone</label>
                <select
                  value={preferences.tonePreference}
                  onChange={(e) => setPreferences((p) => ({ ...p, tonePreference: e.target.value }))}
                  className="px-2 py-1 border rounded"
                >
                  <option value="formal">Formal</option>
                  <option value="neutral">Neutral</option>
                  <option value="informal">Informal</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-sm">Writing style</label>
                <select
                  value={preferences.writingStyle}
                  onChange={(e) => setPreferences((p) => ({ ...p, writingStyle: e.target.value }))}
                  className="px-2 py-1 border rounded"
                >
                  <option value="professional">Professional</option>
                  <option value="conversational">Conversational</option>
                  <option value="creative">Creative</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm">Auto-send</label>
                <input
                  type="checkbox"
                  checked={preferences.autoSend}
                  onChange={(e) => setPreferences((p) => ({ ...p, autoSend: e.target.checked }))}
                />
              </div>

                <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowSettings(false)} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
                <button onClick={() => { void savePreferences(); }} className="px-3 py-1 text-white bg-blue-600 rounded">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
