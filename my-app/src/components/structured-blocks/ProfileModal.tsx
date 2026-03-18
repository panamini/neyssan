import React, { useEffect, useMemo, useState } from "react";
import type { IProfileItem } from "../../types/cvDocument";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import { X, Mail, Phone, Linkedin, Globe, MapPin, UserRound, Briefcase } from "lucide-react";

interface ProfileModalProps {
  open: boolean;
  sectionId: string;
  item: IProfileItem | null;
  onClose: () => void;
  /** Test/override hook: invoked with the sanitized patch before context update */
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

function ensureString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function toInitials(name: string): string {
  const s = name.trim();
  if (!s) return "";
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map(p => p.charAt(0).toUpperCase()).join("");
}

export function ProfileModal({ open, sectionId, item, onClose, onSavePatch }: ProfileModalProps) {
  const { updateStructuredItem } = useCvLibrary();
  const [form, setForm] = useState<FormState>(() => ({
    name: ensureString(item?.name),
    desiredPosition: ensureString(item?.desiredPosition),
    email: ensureString(item?.email),
    phone: ensureString(item?.phone),
    linkedin: ensureString(item?.linkedin),
    website: ensureString(item?.website),
    location: ensureString(item?.location),
    photoUrl: ensureString(item?.photoUrl),
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setForm({
      name: ensureString(item?.name),
      desiredPosition: ensureString(item?.desiredPosition),
      email: ensureString(item?.email),
      phone: ensureString(item?.phone),
      linkedin: ensureString(item?.linkedin),
      website: ensureString(item?.website),
      location: ensureString(item?.location),
      photoUrl: ensureString(item?.photoUrl),
    });
    setPreviewUrl(ensureString(item?.photoUrl));
  }, [open, item?.id]);

  const itemId = useMemo(() => String(item?.id ?? ""), [item?.id]);
  const initials = useMemo(() => toInitials(form.name), [form.name]);

  if (!open) return null;

  function handleChange<K extends keyof FormState>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleFileSelected(file: File | null) {
    if (!file) return;
    try {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      // For v1 we persist the object URL as photoUrl. In production, integrate an upload adapter.
      setForm(prev => ({ ...prev, photoUrl: url }));
    } catch {
      /* noop */
    }
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
      // Remove empty strings to keep structured content clean
      Object.keys(patch).forEach(k => {
        const key = k as keyof IProfileItem;
        if (typeof patch[key] === "string" && (patch[key] as unknown as string).trim() === "") {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete (patch as any)[key];
        }
      });

      try {
        onSavePatch?.(patch);
      } catch {
        /* non-fatal for tests */
      }

      updateStructuredItem(String(sectionId), String(itemId), patch);
    } finally {
      setIsSaving(false);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" onMouseDownCapture={(e) => e.stopPropagation()}>
      <div className="absolute inset-0" onClick={() => (isSaving ? null : onClose())}  style={{ background: 'hsla(30,12%,11%,.32)', backdropFilter: 'blur(8px)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit profile"
        className="relative w-full max-w-2xl [background:var(--sfr)] rounded-rl [box-shadow:var(--shc)] overflow-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-bo">
          <h2 className="text-lg font-semibold">Edit profile</h2>
          <button
            type="button"
            onClick={() => (isSaving ? null : onClose())}
            aria-label="Close"
            className="p-1 rounded hover:[background:var(--sf2)] disabled:opacity-50"
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center w-16 h-16 overflow-hidden text-sm font-semibold rounded-full [background:var(--sf2)] [color:var(--ti)]">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt={form.name ? `${form.name} avatar` : "Profile avatar"} className="object-cover w-full h-full" />
              ) : (
                <span>{initials || <UserRound className="w-5 h-5 opacity-60" />}</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs [color:var(--tg2)]" htmlFor="photoUrl">Photo URL</label>
              <input
                id="photoUrl"
                className="px-2 py-1 text-sm bg-transparent border border-[color:var(--bm)] rounded-[var(--rs)] focus:border-[color:var(--ac)] focus:[box-shadow:0_0_0_3px_var(--fr)] outline-none w-72"
                placeholder="https://..."
                value={form.photoUrl}
                onChange={(e) => handleChange("photoUrl", e.target.value)}
              />
              <div className="text-xs [color:var(--tg2)]">or upload a local image</div>
              <input
                type="file"
                accept="image/*"
                className="text-xs"
                onChange={(e) => void handleFileSelected(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-xs [color:var(--tg2)]" htmlFor="name">Name</label>
              <input
                id="name"
                className="w-full px-2 py-1 mt-1 text-sm bg-transparent border border-[color:var(--bm)] rounded-[var(--rs)] focus:border-[color:var(--ac)] focus:[box-shadow:0_0_0_3px_var(--fr)] outline-none"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                autoFocus
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs [color:var(--tg2)]" htmlFor="desiredPosition">Desired position</label>
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 [color:var(--tg2)]" />
                <input
                  id="desiredPosition"
                  className="w-full px-2 py-1 mt-1 text-sm bg-transparent border border-[color:var(--bm)] rounded-[var(--rs)] focus:border-[color:var(--ac)] focus:[box-shadow:0_0_0_3px_var(--fr)] outline-none"
                  value={form.desiredPosition}
                  onChange={(e) => handleChange("desiredPosition", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs [color:var(--tg2)]" htmlFor="email">Email</label>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 [color:var(--tg2)]" />
                <input
                  id="email"
                  className="w-full px-2 py-1 mt-1 text-sm bg-transparent border border-[color:var(--bm)] rounded-[var(--rs)] focus:border-[color:var(--ac)] focus:[box-shadow:0_0_0_3px_var(--fr)] outline-none"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  type="email"
                />
              </div>
            </div>
            <div>
              <label className="text-xs [color:var(--tg2)]" htmlFor="phone">Phone</label>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 [color:var(--tg2)]" />
                <input
                  id="phone"
                  className="w-full px-2 py-1 mt-1 text-sm bg-transparent border border-[color:var(--bm)] rounded-[var(--rs)] focus:border-[color:var(--ac)] focus:[box-shadow:0_0_0_3px_var(--fr)] outline-none"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-xs [color:var(--tg2)]" htmlFor="linkedin">LinkedIn</label>
              <div className="flex items-center gap-2">
                <Linkedin className="w-4 h-4 [color:var(--tg2)]" />
                <input
                  id="linkedin"
                  className="w-full px-2 py-1 mt-1 text-sm bg-transparent border border-[color:var(--bm)] rounded-[var(--rs)] focus:border-[color:var(--ac)] focus:[box-shadow:0_0_0_3px_var(--fr)] outline-none"
                  value={form.linkedin}
                  onChange={(e) => handleChange("linkedin", e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
            </div>
            <div>
              <label className="text-xs [color:var(--tg2)]" htmlFor="website">Website</label>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 [color:var(--tg2)]" />
                <input
                  id="website"
                  className="w-full px-2 py-1 mt-1 text-sm bg-transparent border border-[color:var(--bm)] rounded-[var(--rs)] focus:border-[color:var(--ac)] focus:[box-shadow:0_0_0_3px_var(--fr)] outline-none"
                  value={form.website}
                  onChange={(e) => handleChange("website", e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs [color:var(--tg2)]" htmlFor="location">Location</label>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 [color:var(--tg2)]" />
                <input
                  id="location"
                  className="w-full px-2 py-1 mt-1 text-sm bg-transparent border border-[color:var(--bm)] rounded-[var(--rs)] focus:border-[color:var(--ac)] focus:[box-shadow:0_0_0_3px_var(--fr)] outline-none"
                  value={form.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => (isSaving ? null : onClose())}
              className="px-3 py-2 rounded [background:var(--sf2)] disabled:opacity-50"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              className="px-3 py-2 [background:var(--ac)] [color:var(--op)] rounded disabled:opacity-50"
              disabled={isSaving}
              aria-busy={isSaving}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileModal;