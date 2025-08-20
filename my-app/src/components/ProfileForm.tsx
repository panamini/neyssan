"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import clsx from "clsx";
import { api } from "../../convex/_generated/api";
import { useMutation, useConvex } from "convex/react";
import styles from "./ProposalInputForm.module.css";
import ProfileView from "./ProfileView";

const schema = z.object({
  linkedInUrl: z.string().url().optional(),
  resumeText: z.string().min(20).optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ProfileForm() {
  const form = useForm<FormValues>({
    defaultValues: { linkedInUrl: "", resumeText: "" },
  });

  const profilesPublic = useMutation(api.profilesPublic.default) as any;

  const [status, setStatus] = React.useState<string | null>(null);
  console.log("ProfileForm rendered - status:", status);

  const convex = useConvex();
  const [currentProfile, setCurrentProfile] = React.useState<any | null>(null);

  // UI state for profile panel
  const [expanded, setExpanded] = React.useState(false);
  const [editingSummary, setEditingSummary] = React.useState(false);
  const [summaryDraft, setSummaryDraft] = React.useState<string>("");

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
          },
        });
      } else if (values.linkedInUrl) {
        // LinkedIn URL provided — call the public mutation as a simple ingest fallback.
        // The HTTP /profiles/ingest endpoint isn't exposed as a Convex public mutation
        // to the browser, so use profilesPublic to record the URL (server-side scraping
        // can be wired to handle it in a later change).
        await profilesPublic({
          profile: {
            summary: `LinkedIn: ${values.linkedInUrl}`,
          },
        });
      } else {
        throw new Error("Provide a LinkedIn URL or paste your resume text (min 20 chars).");
      }
      setStatus("Profile ingested successfully");
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
          <input
            type="url"
            placeholder="LinkedIn profile URL (optional)"
            {...form.register("linkedInUrl")}
            className={clsx(styles.inputElement)}
          />
          <textarea
            placeholder="Or paste your resume / CV text (optional, min 20 chars)"
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

          {expanded && (
            <div id="profile-details" className="mt-3" role="region" aria-label="User profile details">
              {currentProfile ? (
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold">{currentProfile.name ?? "No name"}</div>
                      {currentProfile.email && <div className="text-sm text-gray-600">{currentProfile.email}</div>}
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
                          onClick={async () => {
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
                          }}
                          className="px-2 py-1 text-sm bg-gray-200 rounded"
                        >
                          Edit
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
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
                          }}
                          className="px-3 py-1 text-sm bg-gray-200 rounded"
                        >
                          Add LinkedIn
                        </button>
                        <div className="text-sm text-gray-500">No LinkedIn provided.</div>
                      </div>
                    )}
                  </div>

                  {/* Formatted ProfileView (hide summary because we render it above) */}
                  <ProfileView profile={currentProfile} hideSummary />
                </div>
              ) : (
                <div className="text-sm text-gray-500">Loading profile…</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
