import React, { useEffect, useState } from "react";
import { X } from "@/lib/icons";
import type { IProfileItem } from "../../types/cvDocument";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import { Button } from "../ui/button";
import { CvModalShell } from "./CvModalShell";

interface ProfileModalProps {
  open: boolean;
  sectionId: string;
  item: IProfileItem | null;
  onClose: () => void;
  onSavePatch?: (patch: Partial<IProfileItem>) => void;
}

interface FormState {
  name: string;
  desiredPosition: string;
  email: string;
  phone: string;
  linkedin: string;
  website: string;
  location: string;
  photoUrl: string;
}

function ensureString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function buildInitialForm(item: IProfileItem | null): FormState {
  return {
    name: ensureString(item?.name),
    desiredPosition: ensureString(item?.desiredPosition),
    email: ensureString(item?.email),
    phone: ensureString(item?.phone),
    linkedin: ensureString(item?.linkedin),
    website: ensureString(item?.website),
    location: ensureString(item?.location),
    photoUrl: ensureString(item?.photoUrl),
  };
}

export function ProfileModal({
  open,
  sectionId,
  item,
  onClose,
  onSavePatch,
}: ProfileModalProps) {
  const { updateStructuredItem } = useCvLibrary();
  const [form, setForm] = useState<FormState>(() => buildInitialForm(item));
  const [isSaving, setIsSaving] = useState(false);
  const [isClearConfirming, setIsClearConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(buildInitialForm(item));
    setIsClearConfirming(false);
  }, [open, item]);

  const itemId = String(item?.id ?? "");

  function handleChange<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!itemId) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      const patch: Partial<IProfileItem> = {
        name: form.name.trim(),
        desiredPosition: form.desiredPosition.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        linkedin: form.linkedin.trim(),
        website: form.website.trim(),
        location: form.location.trim(),
        photoUrl: form.photoUrl.trim(),
      };

      Object.keys(patch).forEach((key) => {
        const typedKey = key as keyof IProfileItem;
        if (
          typeof patch[typedKey] === "string" &&
          String(patch[typedKey]).trim() === ""
        ) {
          delete (patch as any)[typedKey];
        }
      });

      try {
        onSavePatch?.(patch);
      } catch {
        /* non-fatal */
      }

      updateStructuredItem(String(sectionId), itemId, patch);
    } finally {
      setIsSaving(false);
      onClose();
    }
  }

  function handleClear() {
    if (!itemId) {
      onClose();
      return;
    }

    const patch: Partial<IProfileItem> = {
      name: undefined,
      desiredPosition: undefined,
      email: undefined,
      phone: undefined,
      linkedin: undefined,
      website: undefined,
      location: undefined,
      photoUrl: undefined,
    };

    try {
      onSavePatch?.(patch);
    } catch {
      /* non-fatal */
    }

    updateStructuredItem(
      String(sectionId),
      itemId,
      patch as Partial<Record<string, any>>,
    );
    setIsClearConfirming(false);
    onClose();
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
        aria-label="Edit profile"
        className="dasti-modal"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="dasti-modal-header">
          <div className="dasti-modal-heading">
            <h2 className="dasti-modal-title">Edit profile</h2>
            <p className="dasti-modal-subtitle">Identity and contact details</p>
          </div>

          <button
            type="button"
            onClick={() => (isSaving ? null : onClose())}
            aria-label="Close"
            className="dasti-modal-close"
            disabled={isSaving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="dasti-modal-body">
          <section className="dasti-zone">
            <h3 className="dasti-zone-title">Identity</h3>

            <div className="dasti-grid-2">
              <label className="dasti-field-group">
                <span className="dasti-label">Full name</span>
                <input
                  id="profile-name"
                  className="dasti-field"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  autoFocus
                />
              </label>

              <label className="dasti-field-group">
                <span className="dasti-label">Desired position</span>
                <input
                  id="profile-desired-position"
                  className="dasti-field"
                  value={form.desiredPosition}
                  onChange={(e) =>
                    handleChange("desiredPosition", e.target.value)
                  }
                  placeholder="e.g. Senior Designer"
                />
              </label>
            </div>

            <label className="dasti-field-group">
              <span className="dasti-label">Photo URL</span>
              <input
                id="profile-photo-url"
                className="dasti-field"
                value={form.photoUrl}
                onChange={(e) => handleChange("photoUrl", e.target.value)}
                placeholder="https://..."
              />
            </label>

            <div className="dasti-hint">Optional</div>
          </section>

          <section className="dasti-zone">
            <h3 className="dasti-zone-title">Contact</h3>

            <div className="dasti-grid-2">
              <label className="dasti-field-group">
                <span className="dasti-label">Email</span>
                <input
                  id="profile-email"
                  className="dasti-field"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  type="email"
                />
              </label>

              <label className="dasti-field-group">
                <span className="dasti-label">Phone</span>
                <input
                  id="profile-phone"
                  className="dasti-field"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                />
              </label>

              <label className="dasti-field-group">
                <span className="dasti-label">LinkedIn</span>
                <input
                  id="profile-linkedin"
                  className="dasti-field"
                  value={form.linkedin}
                  onChange={(e) => handleChange("linkedin", e.target.value)}
                  placeholder="linkedin.com/in/..."
                />
              </label>

              <label className="dasti-field-group">
                <span className="dasti-label">Website</span>
                <input
                  id="profile-website"
                  className="dasti-field"
                  value={form.website}
                  onChange={(e) => handleChange("website", e.target.value)}
                  placeholder="https://..."
                />
              </label>
            </div>

            <label className="dasti-field-group">
              <span className="dasti-label">Address</span>
              <input
                id="profile-location"
                className="dasti-field"
                value={form.location}
                onChange={(e) => handleChange("location", e.target.value)}
              />
            </label>
          </section>
        </div>

        <div className="dasti-modal-footer">
          <div className="dasti-modal-footer-note">
            Applied to all resume exports.
          </div>

          <div className="dasti-modal-actions">
            {isClearConfirming ? (
              <span className="sb-doc-confirm" style={{ gap: "var(--s2)" }}>
                <span
                  className="sb-doc-confirm__label"
                  style={{ fontSize: "var(--tx)" }}
                >
                  Clear?
                </span>
                <button
                  type="button"
                  className="sb-doc-confirm__yes"
                  onClick={handleClear}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="sb-doc-confirm__no"
                  onClick={() => setIsClearConfirming(false)}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsClearConfirming(true)}
                disabled={isSaving}
              >
                Clear
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleSave()}
              disabled={isSaving}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </CvModalShell>
  );
}

export default ProfileModal;
