import React, { useEffect, useMemo, useRef, useState } from "react";

import { Plus, X } from "@/lib/icons";

import type { IAffiliationItem, ICertificationItem } from "../../types/cvDocument";
import { Button } from "../ui/button";
import { CvModalShell } from "./CvModalShell";

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function fromDateInputValue(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed).toISOString();
}

function newCertificationItem(): ICertificationItem {
  return {
    id: `cert-${Math.random().toString(36).slice(2, 10)}`,
    certificationName: "",
    issuingOrganization: "",
    issueDate: undefined,
    expirationDate: null,
    credentialId: "",
  };
}

function newAffiliationItem(): IAffiliationItem {
  return {
    id: `aff-${Math.random().toString(36).slice(2, 10)}`,
    organizationName: "",
    roleOrMembershipType: "",
    startDate: undefined,
    endDate: null,
    isCurrent: false,
    notes: "",
  };
}

interface CertificationModalProps {
  open: boolean;
  items: ICertificationItem[];
  onClose: () => void;
  onSave: (next: ICertificationItem[]) => void;
}

interface AffiliationModalProps {
  open: boolean;
  items: IAffiliationItem[];
  onClose: () => void;
  onSave: (next: IAffiliationItem[]) => void;
}

export function CertificationModal({
  open,
  items,
  onClose,
  onSave,
}: CertificationModalProps) {
  const [rows, setRows] = useState<ICertificationItem[]>([]);
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
      setRows((JSON.parse(nextStr) as ICertificationItem[]).length > 0
        ? (JSON.parse(nextStr) as ICertificationItem[])
        : [newCertificationItem()]);
    } catch {
      setRows(items.length > 0 ? [...items] : [newCertificationItem()]);
    }
  }, [items, open]);

  const canSave = useMemo(
    () => rows.every((row) => String(row.certificationName ?? "").trim().length > 0),
    [rows],
  );

  function updateRow(idx: number, patch: Partial<ICertificationItem>) {
    setRows((current) => current.map((row, rowIdx) => (rowIdx === idx ? { ...row, ...patch } : row)));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      onSave(
        rows
          .map((row) => ({
            ...row,
            certificationName: String(row.certificationName ?? "").trim(),
            issuingOrganization: String(row.issuingOrganization ?? "").trim(),
            credentialId: String(row.credentialId ?? "").trim(),
          }))
          .filter((row) => row.certificationName.length > 0),
      );
    } finally {
      setIsSaving(false);
      onClose();
    }
  }

  return (
    <CvModalShell open={open} onClose={onClose} onBackdropClick={() => (isSaving ? undefined : onClose())}>
      <div role="dialog" aria-modal="true" aria-label="Edit certifications" className="dasti-modal" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b [border-color:var(--color-border)]">
          <div>
            <h2 className="text-lg font-semibold">Edit certifications</h2>
            <p className="text-sm [color:var(--tm2)]">Track certificate name, issuer, dates, and credential details.</p>
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
            <div className="text-sm [color:var(--tm2)]">Keep certifications lightweight but structured.</div>
            <Button type="button" onClick={() => setRows((current) => [...current, newCertificationItem()])} variant="ghost" size="sm" ariaLabel="Add certification" className="gap-1">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>

          <div className="space-y-3">
            {rows.map((row, idx) => (
              <div key={row.id ?? `cert-${idx}`} className="rounded-[var(--radius-card)] border [border-color:var(--color-border)] [background:var(--sf1)] p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium [color:var(--ti)]">Certification {idx + 1}</div>
                  <button type="button" onClick={() => setRows((current) => (current.length > 1 ? current.filter((_, rowIdx) => rowIdx !== idx) : [newCertificationItem()]))} className="dasti-modal-close" aria-label={`Remove certification ${idx + 1}`}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm [color:var(--tm2)]">
                    <span>Certification Name</span>
                    <input className="dasti-select dasti-select--sm" value={row.certificationName ?? ""} onChange={(event) => updateRow(idx, { certificationName: event.currentTarget.value })} placeholder="AWS Certified Developer" />
                  </label>
                  <label className="grid gap-1 text-sm [color:var(--tm2)]">
                    <span>Issuing Organization</span>
                    <input className="dasti-select dasti-select--sm" value={row.issuingOrganization ?? ""} onChange={(event) => updateRow(idx, { issuingOrganization: event.currentTarget.value })} placeholder="Amazon Web Services" />
                  </label>
                  <label className="grid gap-1 text-sm [color:var(--tm2)]">
                    <span>Issue Date</span>
                    <input type="date" className="dasti-select dasti-select--sm" value={toDateInputValue(row.issueDate)} onChange={(event) => updateRow(idx, { issueDate: fromDateInputValue(event.currentTarget.value) })} />
                  </label>
                  <label className="grid gap-1 text-sm [color:var(--tm2)]">
                    <span>Expiration Date</span>
                    <input type="date" className="dasti-select dasti-select--sm" value={toDateInputValue(row.expirationDate)} onChange={(event) => updateRow(idx, { expirationDate: fromDateInputValue(event.currentTarget.value) ?? null })} />
                  </label>
                </div>
                <label className="grid gap-1 text-sm [color:var(--tm2)]">
                  <span>Credential ID</span>
                  <input className="dasti-select dasti-select--sm" value={row.credentialId ?? ""} onChange={(event) => updateRow(idx, { credentialId: event.currentTarget.value })} placeholder="Credential or license number" />
                </label>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="primary" onClick={() => void handleSave()} disabled={isSaving || !canSave} ariaLabel="Save certifications">
              Save
            </Button>
          </div>
        </div>
      </div>
    </CvModalShell>
  );
}

export function AffiliationModal({
  open,
  items,
  onClose,
  onSave,
}: AffiliationModalProps) {
  const [rows, setRows] = useState<IAffiliationItem[]>([]);
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
      setRows((JSON.parse(nextStr) as IAffiliationItem[]).length > 0
        ? (JSON.parse(nextStr) as IAffiliationItem[])
        : [newAffiliationItem()]);
    } catch {
      setRows(items.length > 0 ? [...items] : [newAffiliationItem()]);
    }
  }, [items, open]);

  const canSave = useMemo(
    () => rows.every((row) => String(row.organizationName ?? "").trim().length > 0),
    [rows],
  );

  function updateRow(idx: number, patch: Partial<IAffiliationItem>) {
    setRows((current) => current.map((row, rowIdx) => (rowIdx === idx ? { ...row, ...patch } : row)));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      onSave(
        rows
          .map((row) => ({
            ...row,
            organizationName: String(row.organizationName ?? "").trim(),
            roleOrMembershipType: String(row.roleOrMembershipType ?? "").trim(),
            notes: String(row.notes ?? "").trim(),
            endDate: row.isCurrent ? null : row.endDate ?? null,
          }))
          .filter((row) => row.organizationName.length > 0),
      );
    } finally {
      setIsSaving(false);
      onClose();
    }
  }

  return (
    <CvModalShell open={open} onClose={onClose} onBackdropClick={() => (isSaving ? undefined : onClose())}>
      <div role="dialog" aria-modal="true" aria-label="Edit affiliations" className="dasti-modal" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b [border-color:var(--color-border)]">
          <div>
            <h2 className="text-lg font-semibold">Edit affiliations</h2>
            <p className="text-sm [color:var(--tm2)]">Track memberships, associations, dates, and notes without turning them into job entries.</p>
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
            <div className="text-sm [color:var(--tm2)]">Capture organizations and membership context clearly.</div>
            <Button type="button" onClick={() => setRows((current) => [...current, newAffiliationItem()])} variant="ghost" size="sm" ariaLabel="Add affiliation" className="gap-1">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>

          <div className="space-y-3">
            {rows.map((row, idx) => (
              <div key={row.id ?? `aff-${idx}`} className="rounded-[var(--radius-card)] border [border-color:var(--color-border)] [background:var(--sf1)] p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium [color:var(--ti)]">Affiliation {idx + 1}</div>
                  <button type="button" onClick={() => setRows((current) => (current.length > 1 ? current.filter((_, rowIdx) => rowIdx !== idx) : [newAffiliationItem()]))} className="dasti-modal-close" aria-label={`Remove affiliation ${idx + 1}`}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm [color:var(--tm2)]">
                    <span>Organization</span>
                    <input className="dasti-select dasti-select--sm" value={row.organizationName ?? ""} onChange={(event) => updateRow(idx, { organizationName: event.currentTarget.value })} placeholder="IEEE" />
                  </label>
                  <label className="grid gap-1 text-sm [color:var(--tm2)]">
                    <span>Membership / Role</span>
                    <input className="dasti-select dasti-select--sm" value={row.roleOrMembershipType ?? ""} onChange={(event) => updateRow(idx, { roleOrMembershipType: event.currentTarget.value })} placeholder="Member" />
                  </label>
                  <label className="grid gap-1 text-sm [color:var(--tm2)]">
                    <span>Start Date</span>
                    <input type="date" className="dasti-select dasti-select--sm" value={toDateInputValue(row.startDate)} onChange={(event) => updateRow(idx, { startDate: fromDateInputValue(event.currentTarget.value) })} />
                  </label>
                  <label className="grid gap-1 text-sm [color:var(--tm2)]">
                    <span>End Date</span>
                    <input type="date" className="dasti-select dasti-select--sm" value={toDateInputValue(row.endDate)} onChange={(event) => updateRow(idx, { endDate: fromDateInputValue(event.currentTarget.value) ?? null })} disabled={Boolean(row.isCurrent)} />
                  </label>
                </div>
                <label className="inline-flex items-center gap-2 text-sm [color:var(--tm2)]">
                  <input type="checkbox" checked={Boolean(row.isCurrent)} onChange={(event) => updateRow(idx, { isCurrent: event.currentTarget.checked, endDate: event.currentTarget.checked ? null : row.endDate ?? null })} />
                  Present
                </label>
                <label className="grid gap-1 text-sm [color:var(--tm2)]">
                  <span>Notes</span>
                  <textarea className="min-h-[88px] dasti-select dasti-select--sm" value={String(row.notes ?? "")} onChange={(event) => updateRow(idx, { notes: event.currentTarget.value })} placeholder="Professional membership, committee, or chapter details" />
                </label>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="primary" onClick={() => void handleSave()} disabled={isSaving || !canSave} ariaLabel="Save affiliations">
              Save
            </Button>
          </div>
        </div>
      </div>
    </CvModalShell>
  );
}
