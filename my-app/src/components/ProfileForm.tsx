"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import clsx from "clsx";
import { api } from "../../convex/_generated/api";
import { useMutation, useConvex } from "convex/react";
import styles from "./ProposalInputForm.module.css";
import ProfileView from "./ProfileView";
import { SkillAdder, ExperienceAdder, EducationAdder } from "./ProfileEditors";
import ProfileReviewModal from "./ProfileReviewModal";
import { Button } from "./ui/button";

const _schema = z.object({
  resumeText: z.string().min(20).optional(),
});

type FormValues = z.infer<typeof _schema>;

export default function ProfileForm() {
  const form = useForm<FormValues>({
    defaultValues: { resumeText: "" },
  });

  const profilesPublic = useMutation(api.profilesPublic.default);

  const [status, setStatus] = React.useState<string | null>(null);

  // New: parsed profile and modal state for review-before-save flow
  const [parsedProfile, setParsedProfile] = React.useState<any | null>(null);
  const [showReviewModal, setShowReviewModal] = React.useState(false);

  // NOTE:
  // ProfileForm no longer handles direct file parsing/upload. The ProfileReviewModal
  // is the single place that accepts a file (Load CV) and handles parse -> confirm-save -> llm-refine -> persist.
  // This avoids confusion where two places both tried to upload/parse and opens modal unexpectedly.
  // To load a new CV, open the Review modal (it exposes its own file picker).
  // To open the modal for editing the existing profile (ProfileView load), call setShowReviewModal(true) and
  // pass parsedProfile sourced from backend (handled elsewhere).

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
      console.error("Failed to save summary", err);
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
              raw_text: values.resumeText.substring(0, 2000),
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

  // callback passed to modal when user confirms save
  const handleModalSaved = async (result: any) => {
    // result can be backend response (id etc) or an object containing { profile, __closeAfterSave }
    try {
      const profileFromResult = result?.profile ?? null;
      const id = result?.id ?? (profileFromResult && profileFromResult.id) ?? null;

      if (profileFromResult) {
        // If the modal returned a merged/full profile object, use it directly to update UI.
        setCurrentProfile(profileFromResult);
        setSummaryDraft(profileFromResult.summary ?? "");
        setExpanded(true);
      } else if (id) {
        // Fetch the saved profile from the backend by id (not via Convex user query)
        const backendBase = (import.meta as any).env?.VITE_PDF_INGEST_URL ?? "";
        const url = backendBase ? `${backendBase}/api/v1/profiles/${id}` : `/api/v1/profiles/${id}`;

        const resp = await fetch(url);
        if (!resp.ok) {
          console.warn("Failed to fetch saved profile", await resp.text());
        } else {
          const profileJson = await resp.json();
          setCurrentProfile(profileJson);
          setSummaryDraft(profileJson.summary ?? "");
          setExpanded(true);
        }
      } else {
        // fallback to existing fetchMyProfile if no id or profile returned
        await fetchMyProfile();
      }

      // Respect the modal's explicit close flag if provided; default = false (do not close)
      const shouldClose = result?.__closeAfterSave ?? false;
      if (shouldClose) {
        // Only clear the parsedProfile and close the modal when the modal explicitly requests it.
        setParsedProfile(null);
        setShowReviewModal(false);
      }

      setStatus("Profile saved");
      setTimeout(() => setStatus(null), 2000);
    } catch (err: any) {
      console.error("Error handling saved modal result", err);
      setStatus("Saved but failed to refresh profile");
    }
  };

  return (
    <div className="w-full max-w-4xl p-3 mb-4 border-2 [border-color:var(--color-border)]" data-testid="profile-ingestion-card">
      <ProfileReviewModal
        visible={showReviewModal}
        parsedProfile={parsedProfile}
        onClose={() => {
          // When closing modal, always refresh the canonical profile stored in backend/Convex
          setShowReviewModal(false);
          setParsedProfile(null);
          void fetchMyProfile();
        }}
        onSaved={(res) => {
          // Modal will return the saved result. We handle UI update and ensure we fetch canonical data.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises -- Existing fire-and-forget async call is preserved for this release-gate cleanup.
          handleModalSaved(res);
        }}
      />

      <div className="p-4 rounded-md bg-background">
        <h3 className="mb-2 text-lg font-medium">Profile ingestion</h3>
        <form
          onSubmit={(e) => {
            void form.handleSubmit(onSubmit)(e);
          }}
          className="grid gap-3"
        >
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => {
                setParsedProfile(null);
                setShowReviewModal(true);
              }}
              className="px-3 py-1"
              variant="secondary"
              size="md"
            >
              Load my CV
            </Button>
          </div>

          <textarea
            aria-label="Resume text"
            placeholder="Paste your resume / CV text (optional, min 20 chars)"
            rows={4}
            {...form.register("resumeText")}
            className={clsx(styles.inputElement)}
          />
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              className="px-3 py-1 rounded-md bg-primary text-background"
            >Ingest profile</Button>
            {status && <span className="text-sm">{status}</span>}
          </div>
        </form>

        <div className="pt-3 mt-4 border-t">
          <Button
            type="button"
            onClick={() =>{
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
            className="px-3 py-1 rounded-md text-background bg-primary"
          >
            {expanded ? "Close profile" : "View profile"}</Button>

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
                          <Button
                            onClick={() =>{ void (async () => {
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
                            className="px-2 py-1 text-sm rounded text-background bg-primary"
                          >
                            Save</Button>
                          <Button
                            onClick={() =>{
                              setEditingName(false);
                              setNameDraft((currentProfile && currentProfile.name) || "");
                            }}
                            className="px-2 py-1 text-sm rounded bg-surface-muted"
                          >
                            Cancel</Button>
                        </div>
                      ) : (
                        <div>
                          <div className="text-lg font-semibold">{currentProfile.name ?? "No name"}</div>
                          <div className="mt-1">
                            <Button
                              onClick={() =>{
                                setNameDraft((currentProfile && currentProfile.name) || "");
                                setEditingName(true);
                              }}
                              className="px-2 py-1 text-sm rounded bg-surface-muted"
                            >
                              Edit</Button>
                          </div>
                        </div>
                      )}
                      {currentProfile.email && <div className="mt-1 text-sm text-muted">{currentProfile.email}</div>}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Edit summary button */}
                      {!editingSummary ? (
                        <Button
                          onClick={() =>setEditingSummary(true)}
                          className="px-2 py-1 text-sm rounded bg-surface-muted"
                        >
                          Edit summary</Button>
                      ) : (
                        <Button
                          onClick={() =>{
                            setEditingSummary(false);
                            setSummaryDraft((currentProfile && currentProfile.summary) || "");
                          }}
                          className="px-2 py-1 text-sm rounded bg-surface-muted"
                        >
                          Cancel</Button>
                      )}
                    </div>
                  </div>

                  {/* Summary editable */}
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Summary</h4>
                    {editingSummary ? (
                      <div className="space-y-2">
                        <textarea
                          aria-label="Edit summary"
                          value={summaryDraft}
                          onChange={(e) => setSummaryDraft(e.target.value)}
                          rows={4}
                          className={clsx(styles.inputElement, "w-full")}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() =>{ void saveSummary(); }}
                            className="px-3 py-1 rounded text-background bg-primary"
                          >
                            Save</Button>
                          <Button
                            onClick={() =>{
                              setEditingSummary(false);
                              setSummaryDraft((currentProfile && currentProfile.summary) || "");
                            }}
                            className="px-3 py-1 rounded bg-surface-muted"
                          >
                            Cancel</Button>
                          {status && <span className="text-sm">{status}</span>}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm">
                        {currentProfile.summary ? (
                          <div dangerouslySetInnerHTML={{ __html: (currentProfile.summary) }} />
                        ) : (
                          <div className="text-sm text-muted">No summary provided.</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* The rest of the profile UI (LinkedIn, Skills, Experience, Education, ProfileView) */}
                  {/* LinkedIn, Skills, Experience, Education blocks unchanged from previous implementation */}
                  <div>
                    <h4 className="mb-1 text-sm font-medium">LinkedIn</h4>
                    {currentProfile.linkedIn ? (
                      <div className="flex items-center gap-3">
                        <a
                          href={currentProfile.linkedIn}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-sm [color:var(--am)] hover:underline"
                        >
                          Open LinkedIn
                        </a>
                        <Button
                          onClick={() =>{ void (async () => {
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
                          className="px-2 py-1 text-sm rounded bg-surface-muted"
                        >
                          Edit</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() =>{ void (async () => {
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
                          className="px-3 py-1 text-sm rounded bg-surface-muted"
                        >
                          Add LinkedIn</Button>
                        <div className="text-sm text-muted">No LinkedIn provided.</div>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="mb-1 text-sm font-medium">Skills</h4>
                    <div className="flex flex-wrap items-center gap-2">
                      {(currentProfile.skills || []).map((s: string, i: number) => (
                        <span key={i} className="flex items-center gap-2 px-2 py-1 text-xs rounded-full bg-surface-muted">
                          <span>{s}</span>
                          <Button
                            aria-label={`Remove skill ${s}`}
                            onClick={() =>{ void (async () => {
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
                            className="text-xs px-1 py-0.5 bg-surface-muted rounded"
                          >
                            ×</Button>
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

                  <div>
                    <h4 className="mb-1 text-sm font-medium">Experience</h4>
                    <div className="space-y-2">
                      {(currentProfile.experience || []).map((exp: any, idx: number) => (
                        <div key={idx} className="p-2 border rounded">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-semibold">{exp.title} — {exp.company}</div>
                              <div className="text-xs text-muted">{exp.startDate ? new Date(exp.startDate).toLocaleDateString() : ""} {exp.endDate ? `— ${new Date(exp.endDate).toLocaleDateString()}` : ""}</div>
                              {exp.description && <div className="mt-1 text-sm">{exp.description}</div>}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() =>{ void (async () => {
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
                                className="px-2 py-1 text-xs rounded bg-surface-muted"
                              >
                                Delete</Button>
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

                  <div>
                    <h4 className="mb-1 text-sm font-medium">Education</h4>
                    <div className="space-y-2">
                      {(currentProfile.education || []).map((ed: any, idx: number) => (
                        <div key={idx} className="p-2 border rounded">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-semibold">{ed.school} {ed.degree ? `— ${ed.degree}` : ""}</div>
                              {ed.fieldOfStudy && <div className="text-xs text-muted">{ed.fieldOfStudy}</div>}
                              <div className="text-xs text-muted">{ed.startDate ? new Date(ed.startDate).toLocaleDateString() : ""} {ed.endDate ? `— ${new Date(ed.endDate).toLocaleDateString()}` : ""}</div>
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

                  <ProfileView profile={currentProfile} hideSummary />
                </div>
              ) : (
                <div className="text-sm text-muted">Loading profile…</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
