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
            onClick={() => { void fetchMyProfile(); }}
            className="px-3 py-1 text-white bg-blue-600 rounded-md"
          >
            View my profile
          </button>

          {currentProfile && (
            <div className="mt-3">
              <ProfileView profile={currentProfile} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
