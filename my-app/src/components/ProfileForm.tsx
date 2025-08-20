"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import clsx from "clsx";
import { api } from "../../convex/_generated/api";
import { useMutation, useConvex } from "convex/react";
import styles from "./ProposalInputForm.module.css";
import ProfileView from "./ProfileView";
<<<<<<< HEAD
import { SkillAdder, ExperienceAdder, EducationAdder } from "./ProfileEditors";
=======
>>>>>>> 234fc75 (feat(profile): add ProfileView component, add linkedIn/rawText schema and patching)

const _schema = z.object({
  resumeText: z.string().min(20).optional(),
});

type FormValues = z.infer<typeof _schema>;

export default function ProfileForm() {
  const form = useForm<FormValues>({
    defaultValues: { resumeText: "" },
  });

<<<<<<< HEAD
  const profilesPublic = useMutation(api.profilesPublic.default);
=======
  const profilesPublic = useMutation(api.profilesPublic.default) as any;
>>>>>>> 234fc75 (feat(profile): add ProfileView component, add linkedIn/rawText schema and patching)

  const [status, setStatus] = React.useState<string | null>(null);
  console.log("ProfileForm rendered - status:", status);

  const convex = useConvex();
  const [currentProfile, setCurrentProfile] = React.useState<any>(null);

  // UI state for profile panel
  const [expanded, setExpanded] = React.useState(false);
  const [editingSummary, setEditingSummary] = React.useState(false);
  const [summaryDraft, setSummaryDraft] = React.useState<string>("");
  // Inline name editing
  const [editingName, setEditingName] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState<string>("");

  async function fetchMyProfile() {
    try {
      const profile = await convex.query(api.users.getUser as any);
      setCurrentProfile(profile ?? null);
      setSummaryDraft((profile && profile.summary) || "");
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setCurrentProfile({ error: String(err) });
    }
  }

  const saveSummary = async () => {
    try {
      setStatus("Saving summary...");
      await profilesPublic({
        profile: {
          summary: summaryDraft,
        },
      });
      // Refresh profile after save
      await fetchMyProfile();
      setEditingSummary(false);
      setStatus("Summary saved");
      setTimeout(() => setStatus(null), 2000);
    } catch (err: any) {
      console.error("Failed to save summary:", err);
      setStatus(`Failed to save: ${err?.message ?? String(err)}`);
    }
  };

  async function onSubmit(values: FormValues) {
    setStatus(null);
    try {
      // Prefer calling the typed public mutation; fall back to http ingest if needed.
      if (values.resumeText && values.resumeText.length > 20) {
        await profilesPublic({
          profile: {
            summary: values.resumeText.substring(0, 2000), // lightweight summary for now
            rawText: values.resumeText.substring(0, 2000),
            metadata: { source: "manual_paste", importedAt: Date.now() },
          },
        });
      } else {
        throw new Error("Please paste your resume text (min 20 chars).");
      }
      setStatus("Profile ingested successfully");
      // Refresh profile display immediately and expand details so user sees latest info
      await fetchMyProfile();
      setExpanded(true);
      form.reset();
    } catch (err: any) {
      console.error("Profile ingest failed", err);
      setStatus(`Failed: ${err?.message ?? String(err)}`);
    }
  }

  return (
    <div className="w-full max-w-4xl p-3 mb-4 border-2 border-yellow-400" data-testid="profile-ingestion-card">
      <div className="p-4 rounded-md bg-gray-50 dark:bg-gray-900">
        <h3 className="mb-2 text-lg font-medium">Profile ingestion</h3>
        <form
          onSubmit={(e) => {
            void form.handleSubmit(onSubmit)(e);
          }}
          className="grid gap-3"
        >
          <textarea
            placeholder="Paste your resume / CV text (optional, min 20 chars)"
            rows={4}
            {...form.register("resumeText")}
            className={clsx(styles.inputElement)}
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-3 py-1 rounded-md bg-foreground text-background"
            >
              Ingest profile
            </button>
            {status && <span className="text-sm">{status}</span>}
          </div>
        </form>

        <div className="pt-3 mt-4 border-t">
          <button
            type="button"
            onClick={() => {
              // Toggle expanded state and fetch profile when opening
              setExpanded((prev) => {
                const next = !prev;
                if (next) {
                  void fetchMyProfile();
                }
                return next;
              });
            }}
            aria-expanded={expanded}
            aria-controls="profile-details"
            className="px-3 py-1 text-white bg-blue-600 rounded-md"
          >
            {expanded ? "Close profile" : "View profile"}
          </button>

<<<<<<< HEAD
          {expanded && (
            <div id="profile-details" className="mt-3" role="region" aria-label="User profile details">
              {currentProfile ? (
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                    {editingName ? (
                      <div className="flex items-center gap-2">
                        <input
                          aria-label="Edit name"
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          className="px-2 py-1 text-sm border rounded"
                        />
                        <button
                        onClick={() => { void (async () => {
                              try {
                                setStatus("Saving name...");
                                await profilesPublic({ profile: { name: nameDraft } });
                                await fetchMyProfile();
                                setEditingName(false);
                                setStatus("Name saved");
                                setTimeout(() => setStatus(null), 2000);
                              } catch (err: any) {
                                console.error("Failed to save name", err);
                                setStatus(`Failed: ${err?.message ?? String(err)}`);
                              }
                            })(); }}
                          className="px-2 py-1 text-sm text-white bg-blue-600 rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingName(false);
                            setNameDraft((currentProfile && currentProfile.name) || "");
                          }}
                          className="px-2 py-1 text-sm bg-gray-200 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="text-lg font-semibold">{currentProfile.name ?? "No name"}</div>
                        <div className="mt-1">
                          <button
                            onClick={() => {
                              setNameDraft((currentProfile && currentProfile.name) || "");
                              setEditingName(true);
                            }}
                            className="px-2 py-1 text-sm bg-gray-200 rounded"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    )}
                    {currentProfile.email && <div className="mt-1 text-sm text-gray-600">{currentProfile.email}</div>}
                  </div>

                    <div className="flex items-center gap-2">
                      {/* Edit summary button */}
                      {!editingSummary ? (
                        <button
                          onClick={() => setEditingSummary(true)}
                          className="px-2 py-1 text-sm bg-gray-200 rounded"
                        >
                          Edit summary
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingSummary(false);
                            setSummaryDraft((currentProfile && currentProfile.summary) || "");
                          }}
                          className="px-2 py-1 text-sm bg-gray-200 rounded"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Summary editable */}
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Summary</h4>
                    {editingSummary ? (
                      <div className="space-y-2">
                        <textarea
                          value={summaryDraft}
                          onChange={(e) => setSummaryDraft(e.target.value)}
                          rows={4}
                          className={clsx(styles.inputElement, "w-full")}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { void saveSummary(); }}
                            className="px-3 py-1 text-white bg-blue-600 rounded"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingSummary(false);
                              setSummaryDraft((currentProfile && currentProfile.summary) || "");
                            }}
                            className="px-3 py-1 bg-gray-200 rounded"
                          >
                            Cancel
                          </button>
                          {status && <span className="text-sm">{status}</span>}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm">
                        {currentProfile.summary ? (
                          <div dangerouslySetInnerHTML={{ __html: (currentProfile.summary) }} />
                        ) : (
                          <div className="text-sm text-gray-500">No summary provided.</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* LinkedIn (separate field) */}
                  <div>
                    <h4 className="mb-1 text-sm font-medium">LinkedIn</h4>
                    {currentProfile.linkedIn ? (
                      <div className="flex items-center gap-3">
                        <a
                          href={currentProfile.linkedIn}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Open LinkedIn
                        </a>
                        <button
                          onClick={() => { void (async () => {
                            // prompt for new URL
                            const next = window.prompt("Edit LinkedIn URL", currentProfile.linkedIn || "");
                            if (next !== null) {
                              try {
                                setStatus("Saving LinkedIn...");
                                await profilesPublic({ profile: { linkedIn: next } });
                                await fetchMyProfile();
                                setStatus("LinkedIn saved");
                                setTimeout(() => setStatus(null), 2000);
                              } catch (err: any) {
                                console.error("Failed to save LinkedIn", err);
                                setStatus(`Failed: ${err?.message ?? String(err)}`);
                              }
                            }
                          })(); }}
                          className="px-2 py-1 text-sm bg-gray-200 rounded"
                        >
                          Edit
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { void (async () => {
                            const url = window.prompt("Enter LinkedIn URL", "");
                            if (url) {
                              try {
                                setStatus("Saving LinkedIn...");
                                await profilesPublic({ profile: { linkedIn: url } });
                                await fetchMyProfile();
                                setStatus("LinkedIn saved");
                                setTimeout(() => setStatus(null), 2000);
                              } catch (err: any) {
                                console.error("Failed to save LinkedIn", err);
                                setStatus(`Failed: ${err?.message ?? String(err)}`);
                              }
                            }
                          })(); }}
                          className="px-3 py-1 text-sm bg-gray-200 rounded"
                        >
                          Add LinkedIn
                        </button>
                        <div className="text-sm text-gray-500">No LinkedIn provided.</div>
                      </div>
                    )}
                  </div>

                  {/* Skills editor */}
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Skills</h4>
                    <div className="flex flex-wrap items-center gap-2">
                      {(currentProfile.skills || []).map((s: string, i: number) => (
                        <span key={i} className="flex items-center gap-2 px-2 py-1 text-xs bg-gray-100 rounded-full dark:bg-gray-700">
                          <span>{s}</span>
                          <button
                            aria-label={`Remove skill ${s}`}
                            onClick={() => { void (async () => {
                              try {
                                const next = (currentProfile.skills || []).filter((x: string) => x !== s);
                                setStatus("Saving skills...");
                                await profilesPublic({ profile: { skills: next } });
                                await fetchMyProfile();
                                setStatus(null);
                              } catch (err: any) {
                                console.error("Failed to remove skill", err);
                                setStatus(`Failed: ${err?.message ?? String(err)}`);
                              }
                            })(); }}
                            className="text-xs px-1 py-0.5 bg-red-200 rounded"
                          >
                            ×
                          </button>
                        </span>
                      ))}

                      <SkillAdder
                        onAdd={async (val: string) => {
                          try {
                            const next = [...(currentProfile.skills || []), val];
                            setStatus("Saving skills...");
                            await profilesPublic({ profile: { skills: next } });
                            await fetchMyProfile();
                            setStatus(null);
                          } catch (err: any) {
                            console.error("Failed to add skill", err);
                            setStatus(`Failed: ${err?.message ?? String(err)}`);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Experience editor */}
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Experience</h4>
                    <div className="space-y-2">
                      {(currentProfile.experience || []).map((exp: any, idx: number) => (
                        <div key={idx} className="p-2 border rounded">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-semibold">{exp.title} — {exp.company}</div>
                              <div className="text-xs text-gray-500">{exp.startDate ? new Date(exp.startDate).toLocaleDateString() : ""} {exp.endDate ? `— ${new Date(exp.endDate).toLocaleDateString()}` : ""}</div>
                              {exp.description && <div className="mt-1 text-sm">{exp.description}</div>}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => { void (async () => {
                                  // simple delete
                                  try {
                                    const next = (currentProfile.experience || []).filter((_: unknown, i: number) => i !== idx);
                                    setStatus("Saving experience...");
                                    await profilesPublic({ profile: { experience: next } });
                                    await fetchMyProfile();
                                    setStatus(null);
                                  } catch (err: any) {
                                    console.error("Failed to delete experience", err);
                                    setStatus(`Failed: ${err?.message ?? String(err)}`);
                                  }
                                })(); }}
                                className="px-2 py-1 text-xs bg-red-200 rounded"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                        <ExperienceAdder
                        onAdd={async (entry) => {
                          try {
                            const next = [...(currentProfile.experience || []), entry as unknown];
                            setStatus("Saving experience...");
                            await profilesPublic({ profile: { experience: next } });
                            await fetchMyProfile();
                            setStatus(null);
                          } catch (err: any) {
                            console.error("Failed to add experience", err);
                            setStatus(`Failed: ${err?.message ?? String(err)}`);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Education editor */}
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Education</h4>
                    <div className="space-y-2">
                      {(currentProfile.education || []).map((ed: any, idx: number) => (
                        <div key={idx} className="p-2 border rounded">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-semibold">{ed.school} {ed.degree ? `— ${ed.degree}` : ""}</div>
                              {ed.fieldOfStudy && <div className="text-xs text-gray-500">{ed.fieldOfStudy}</div>}
                              <div className="text-xs text-gray-500">{ed.startDate ? new Date(ed.startDate).toLocaleDateString() : ""} {ed.endDate ? `— ${new Date(ed.endDate).toLocaleDateString()}` : ""}</div>
                            </div>
                                </div>
                        </div>
                      ))}
                      <EducationAdder
                        onAdd={async (entry) => {
                          try {
                            const next = [...(currentProfile.education || []), entry as unknown];
                            setStatus("Saving education...");
                            await profilesPublic({ profile: { education: next } });
                            await fetchMyProfile();
                            setStatus(null);
                          } catch (err: any) {
                            console.error("Failed to add education", err);
                            setStatus(`Failed: ${err?.message ?? String(err)}`);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Formatted ProfileView (hide summary because we render it above) */}
                  <ProfileView profile={currentProfile} hideSummary />
                </div>
              ) : (
                <div className="text-sm text-gray-500">Loading profile…</div>
              )}
=======
          {currentProfile && (
            <div className="mt-3">
              <ProfileView profile={currentProfile} />
>>>>>>> 234fc75 (feat(profile): add ProfileView component, add linkedIn/rawText schema and patching)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
