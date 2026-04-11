import React, { useEffect, useMemo, useRef, useState } from "react";

import { Plus, X } from "@/lib/icons";

import type { IProjectItem } from "../../types/cvDocument";
import { Button } from "../ui/button";
import { CvModalShell } from "./CvModalShell";

function newProjectItem(): IProjectItem {
  return {
    id: `project-${Math.random().toString(36).slice(2, 10)}`,
    title: "",
    meta: "",
    description: "",
  };
}

interface ProjectsModalProps {
  open: boolean;
  items: IProjectItem[];
  onClose: () => void;
  onSave: (next: IProjectItem[]) => void;
}

export function ProjectsModal({
  open,
  items,
  onClose,
  onSave,
}: ProjectsModalProps) {
  const [rows, setRows] = useState<IProjectItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const lastSeedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      lastSeedRef.current = null;
      return;
    }
    try {
      const nextStr = JSON.stringify(items ?? []);
      if (lastSeedRef.current === nextStr) return;
      lastSeedRef.current = nextStr;
      const parsed = JSON.parse(nextStr) as IProjectItem[];
      setRows(parsed.length > 0 ? parsed : [newProjectItem()]);
    } catch {
      setRows(items.length > 0 ? [...items] : [newProjectItem()]);
    }
  }, [items, open]);

  const canSave = useMemo(
    () =>
      rows.every((row) => {
        const title = String(row.title ?? row.name ?? "").trim();
        const description = String(row.description ?? row.summary ?? "").trim();
        return title.length > 0 || description.length > 0;
      }),
    [rows],
  );

  function updateRow(idx: number, patch: Partial<IProjectItem>) {
    setRows((current) =>
      current.map((row, rowIdx) => (rowIdx === idx ? { ...row, ...patch } : row)),
    );
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      onSave(
        rows
          .map((row) => {
            const title = String(row.title ?? row.name ?? "").trim();
            const meta = String(row.meta ?? row.subtitle ?? "").trim();
            const description = String(row.description ?? row.summary ?? "").trim();

            return {
              ...row,
              title,
              name: undefined,
              meta: meta || undefined,
              subtitle: undefined,
              description: description || undefined,
              summary: undefined,
            };
          })
          .filter((row) => row.title || row.description),
      );
    } finally {
      setIsSaving(false);
      onClose();
    }
  }

  return (
    <CvModalShell
      open={open}
      onClose={onClose}
      onBackdropClick={() => (isSaving ? undefined : onClose())}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit projects"
        className="dasti-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b [border-color:var(--color-border)]">
          <div>
            <h2 className="text-lg font-semibold">Edit projects</h2>
            <p className="text-sm [color:var(--tm2)]">
              Keep projects as clean titled entries instead of raw nested blocks.
            </p>
          </div>
          <button
            type="button"
            onClick={() => (isSaving ? null : onClose())}
            aria-label="Close"
            className="dasti-modal-close disabled:opacity-50"
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm [color:var(--tm2)]">
              Title, stack/date meta, and one concise project summary.
            </div>
            <Button
              type="button"
              onClick={() => setRows((current) => [...current, newProjectItem()])}
              variant="ghost"
              size="sm"
              ariaLabel="Add project"
              className="gap-1"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>

          <div className="space-y-3">
            {rows.map((row, idx) => (
              <div
                key={row.id ?? `project-${idx}`}
                className="rounded-[var(--radius-card)] border [border-color:var(--color-border)] [background:var(--sf1)] p-3 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium [color:var(--ti)]">
                    Project {idx + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setRows((current) =>
                        current.length > 1
                          ? current.filter((_, rowIdx) => rowIdx !== idx)
                          : [newProjectItem()],
                      )
                    }
                    className="dasti-modal-close"
                    aria-label={`Remove project ${idx + 1}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm [color:var(--tm2)]">
                    <span>Project Title</span>
                    <input
                      className="dasti-select dasti-select--sm"
                      value={String(row.title ?? row.name ?? "")}
                      onChange={(event) =>
                        updateRow(idx, { title: event.currentTarget.value })
                      }
                      placeholder="Gitlytics"
                    />
                  </label>
                  <label className="grid gap-1 text-sm [color:var(--tm2)]">
                    <span>Meta</span>
                    <input
                      className="dasti-select dasti-select--sm"
                      value={String(row.meta ?? row.subtitle ?? "")}
                      onChange={(event) =>
                        updateRow(idx, { meta: event.currentTarget.value })
                      }
                      placeholder="Python, Flask, React | June 2020 – Present"
                    />
                  </label>
                </div>
                <label className="grid gap-1 text-sm [color:var(--tm2)]">
                  <span>Description</span>
                  <textarea
                    className="min-h-[104px] dasti-select dasti-select--sm"
                    value={String(row.description ?? row.summary ?? "")}
                    onChange={(event) =>
                      updateRow(idx, { description: event.currentTarget.value })
                    }
                    placeholder="Built a full-stack application with GitHub OAuth and collaboration insights."
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleSave()}
              disabled={isSaving || !canSave}
              ariaLabel="Save projects"
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </CvModalShell>
  );
}

export default ProjectsModal;
