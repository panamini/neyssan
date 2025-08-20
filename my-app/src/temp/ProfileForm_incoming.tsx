"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import clsx from "clsx";
import { api } from "../../convex/_generated/api";
import { useMutation } from "convex/react";
import styles from "../components/ProposalInputForm.module.css";

const _schema = z.object({
  linkedInUrl: z.string().url().optional(),
  resumeText: z.string().min(20).optional(),
});

type FormValues = z.infer<typeof _schema>;

export default function ProfileFormIncoming() {
  const form = useForm<FormValues>({
    defaultValues: { linkedInUrl: "", resumeText: "" },
  });

  const ingestProfile = useMutation((api as any).ingestProfile?.default) as any;
  const profilesPublic = useMutation(api.profilesPublic.default) as any;

  const [status, setStatus] = React.useState<string | null>(null);

  async function onSubmit(values: FormValues) {
    setStatus(null);
    try {
      if (values.resumeText && values.resumeText.length > 20) {
        await profilesPublic({
          profile: {
            summary: values.resumeText.substring(0, 2000),
            rawText: values.resumeText.substring(0, 2000),
            metadata: { source: "manual_paste", importedAt: Date.now() },
          },
        });
      } else if (values.linkedInUrl) {
        if (!ingestProfile) throw new Error("Ingest endpoint not available");
        await ingestProfile({ url: values.linkedInUrl });
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
    <div className="w-full max-w-4xl mb-4">
      <div className="p-4 rounded-md bg-gray-50 dark:bg-gray-900">
        <h3 className="mb-2 text-lg font-medium">Profile ingestion (incoming)</h3>
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
              Ingest profile (incoming)
            </button>
            {status && <span className="text-sm">{status}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
