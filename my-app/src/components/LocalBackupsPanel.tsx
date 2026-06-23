"use client";

/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import React, { useEffect, useState, useRef } from "react";
import { Button } from "./ui/button";
import type { ICvState } from "../types/cv";
import { useCvLibrary } from "../contexts/CvLibraryContext";

/**
 * LocalBackupsPanel
 *
 * - Lists localStorage backups matching the `cv-backup-` prefix.
 * - Allows restoring a backup into the CV library (uses createCvFromState).
 * - Allows deleting individual backups.
 * - Supports importing a JSON file (exported CV) and restoring it.
 *
 * Usage: Render near your Save / Download buttons in ProfileReviewCard.
 */
export function LocalBackupsPanel(): JSX.Element {
  const { createCvFromState } = useCvLibrary();
  const [open, setOpen] = useState(false);
  const [backups, setBackups] = useState<
    { key: string; title: string; savedAt?: string; raw: any }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function scanBackups() {
    const found: { key: string; title: string; savedAt?: string; raw: any }[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith("cv-backup-")) {
          try {
            const raw = JSON.parse(String(localStorage.getItem(key)));
            const title = raw?.title ?? key;
            const savedAt = raw?.savedAt ?? raw?.exportedAt ?? undefined;
            found.push({ key, title, savedAt, raw });
          } catch {
            // ignore invalid JSON entries
          }
        }
      }
    } catch (err) {
      // localStorage can throw in some environments; fail gracefully

      console.error("[LocalBackupsPanel] scanBackups failed", err);
    }
    // sort newest-first by savedAt (fallback to key order)
    found.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
    setBackups(found);
  }

  useEffect(() => {
    if (open) scanBackups();
  }, [open]);

  function handleRestore(key: string) {
    try {
      const raw = JSON.parse(String(localStorage.getItem(key)));
      const state: ICvState | undefined = raw?.cvState ?? raw?.state ?? undefined;
      const title: string | undefined = raw?.title ?? undefined;
      if (!state) {

        console.warn("[LocalBackupsPanel] backup missing cvState", key);
        return;
      }
      createCvFromState(state, title);
      setOpen(false);
    } catch (err) {

      console.error("[LocalBackupsPanel] restore failed", err);
    }
  }

  function handleDelete(key: string) {
    try {
      localStorage.removeItem(key);
      scanBackups();
    } catch (err) {

      console.error("[LocalBackupsPanel] delete failed", err);
    }
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const state: ICvState | undefined = raw?.cvState ?? raw?.state ?? undefined;
        const title: string | undefined = raw?.title ?? raw?.id ?? undefined;
        if (!state) {

          console.warn("[LocalBackupsPanel] imported file missing cvState");
          return;
        }
        createCvFromState(state, title);
        setOpen(false);
      } catch (err) {

        console.error("[LocalBackupsPanel] failed to import file", err);
      }
    };
    reader.readAsText(file);
    // reset input so same file can be re-selected later
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="relative">
      <Button
        onClick={() => setOpen((v) => !v)}
        variant="secondary"
        aria-label="Open local backups"
      >
        Backups
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Local backups"
          className="absolute right-0 z-40 w-[320px] mt-2 p-3 bg-background border rounded-md [box-shadow:var(--shc)] [border-color:var(--color-border)]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Local Backups</div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleImportFile}
                className="hidden"
                id="local-backup-import"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="ghost"
                aria-label="Import backup JSON"
              >
                Import
              </Button>
              <Button onClick={() => setOpen(false)} variant="ghost" aria-label="Close backups">
                Close
              </Button>
            </div>
          </div>

          <div className="space-y-2 overflow-auto max-h-72">
            {backups.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">No local backups found.</div>
            ) : (
              backups.map((b) => (
                <div key={b.key} className="flex items-start justify-between p-2 border rounded-md [background:var(--sfr)]">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{b.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.savedAt ? new Date(b.savedAt).toLocaleString() : b.key}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-3">
                    <Button onClick={() => handleRestore(b.key)} variant="primary" aria-label={`Restore ${b.title}`}>
                      Restore
                    </Button>
                    <Button onClick={() => handleDelete(b.key)} variant="danger" aria-label={`Delete ${b.title}`}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LocalBackupsPanel;