import React, { useEffect, useRef, useState } from "react";
import { User, X } from "@/lib/icons";
import type { IProfileItem } from "../../types/cvDocument";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import { Button } from "../ui/button";
import { CvModalShell } from "./CvModalShell";

interface ProfileModalProps {
  open: boolean;
  sectionId: string;
  item: IProfileItem | null;
  initialItemId?: string;
  recoveryNotes?: string[];
  onDismissRecoveryNotes?: () => void;
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
  initialItemId,
  recoveryNotes = [],
  onDismissRecoveryNotes,
  onClose,
  onSavePatch,
}: ProfileModalProps) {
  const { updateStructuredItem } = useCvLibrary();
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<FormState>(() => buildInitialForm(item));
  const [isSaving, setIsSaving] = useState(false);
  const [isClearConfirming, setIsClearConfirming] = useState(false);
  const normalizedTarget = String(initialItemId ?? "")
    .trim()
    .toLowerCase();
  const targetInputId =
    normalizedTarget === "email"
      ? "profile-email"
      : normalizedTarget === "phone"
        ? "profile-phone"
        : normalizedTarget === "linkedin"
          ? "profile-linkedin"
          : normalizedTarget === "website" ||
              normalizedTarget === "web" ||
              normalizedTarget === "portfolio" ||
              normalizedTarget === "site"
            ? "profile-website"
            : normalizedTarget === "location" ||
                normalizedTarget === "address" ||
                normalizedTarget === "city"
              ? "profile-location"
              : normalizedTarget === "desiredposition" ||
                  normalizedTarget === "desired_position" ||
                  normalizedTarget === "title"
                ? "profile-desired-position"
                : normalizedTarget === "name"
                  ? "profile-name"
                  : "";

  useEffect(() => {
    if (!open) return;
    setForm(buildInitialForm(item));
    setIsClearConfirming(false);
  }, [open, item]);

  useEffect(() => {
    if (!open || !targetInputId) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      const node = document.getElementById(targetInputId);
      if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
        node.focus({ preventScroll: true });
      }
    }, 40);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [open, targetInputId]);

  const itemId = String(item?.id ?? "");

  function handleChange<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openPhotoPicker() {
    photoInputRef.current?.click();
  }

  function handlePhotoFile(file: File | null) {
    if (!file || !file.type.startsWith("image/")) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const nextPhotoUrl =
        typeof reader.result === "string" ? reader.result : "";
      if (!nextPhotoUrl) {
        return;
      }
      setForm((prev) => ({ ...prev, photoUrl: nextPhotoUrl }));
    };
    reader.readAsDataURL(file);
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    handlePhotoFile(file);
  }

  function handleRemovePhoto() {
    setForm((prev) => ({ ...prev, photoUrl: "" }));
  }

  async function handleSave() {
    if (!itemId) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      const desiredPosition = form.desiredPosition.trim();
      const patch: Partial<IProfileItem> = {
        name: form.name.trim(),
        desiredPosition: desiredPosition.length > 0 ? desiredPosition : undefined,
        email: form.email.trim(),
        phone: form.phone.trim(),
        linkedin: form.linkedin.trim(),
        website: form.website.trim(),
        location: form.location.trim(),
        photoUrl: form.photoUrl.trim(),
      };

      Object.keys(patch).forEach((key) => {
        const typedKey = key as keyof IProfileItem;
        if (typedKey === "desiredPosition") {
          return;
        }
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
          {recoveryNotes.length > 0 ? (
            <section className="dasti-zone">
              <div className="dasti-recovery-note-stack__header">
                <span className="dasti-recovery-note__label">Recovered note</span>
                {onDismissRecoveryNotes ? (
                  <button
                    type="button"
                    className="dasti-recovery-inline__dismiss"
                    aria-label="Dismiss recovered notes"
                    onClick={onDismissRecoveryNotes}
                  >
                    <X className="w-3 h-3" aria-hidden />
                  </button>
                ) : null}
              </div>
              <div className="dasti-recovery-note-list">
                {recoveryNotes.map((note) => (
                  <div key={note} className="dasti-recovery-note">
                    <p className="cv-entry-body">{note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          <section className="dasti-zone">
            <h3 className="dasti-zone-title">Identity</h3>

            <div className="dasti-profile-modal__hero">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                onChange={handlePhotoChange}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
              />
              <div className="dasti-profile-modal__media">
                <button
                  type="button"
                  className="dasti-profile-modal__avatar"
                  onClick={openPhotoPicker}
                  aria-label={
                    form.photoUrl ? "Change profile photo" : "Upload profile photo"
                  }
                  title={
                    form.photoUrl ? "Change profile photo" : "Upload profile photo"
                  }
                >
                  {form.photoUrl ? (
                    <img
                      src={form.photoUrl}
                      alt=""
                      className="dasti-profile-modal__avatar-image"
                    />
                  ) : (
                    <span className="dasti-profile-modal__avatar-empty">
                      <User
                        className="dasti-profile-modal__avatar-icon"
                        strokeWidth={1.75}
                      />
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="dasti-icon-button dasti-profile-modal__avatar-remove"
                  onClick={handleRemovePhoto}
                  aria-label="Remove profile photo"
                  title="Remove profile photo"
                  disabled={!form.photoUrl}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="dasti-profile-modal__hero-copy">
                <p className="dasti-profile-modal__hero-name">
                  {form.name.trim() || "Your name"}
                </p>
                <p
                  className={`dasti-profile-modal__hero-role${form.desiredPosition.trim() ? "" : " dasti-profile-modal__hero-role--placeholder"}`}
                >
                  {form.desiredPosition.trim() || "Desired position"}
                </p>
              </div>
            </div>

            <div className="dasti-grid-2">
              <label className="dasti-field-group">
                <span className="dasti-label">Full name</span>
                <input
                  id="profile-name"
                  className="dasti-field"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  autoFocus={!targetInputId || targetInputId === "profile-name"}
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
                  autoFocus={targetInputId === "profile-desired-position"}
                />
              </label>
            </div>

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
                  autoFocus={targetInputId === "profile-email"}
                />
              </label>

              <label className="dasti-field-group">
                <span className="dasti-label">Phone</span>
                <input
                  id="profile-phone"
                  className="dasti-field"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  autoFocus={targetInputId === "profile-phone"}
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
                  autoFocus={targetInputId === "profile-linkedin"}
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
                  autoFocus={targetInputId === "profile-website"}
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
                autoFocus={targetInputId === "profile-location"}
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
