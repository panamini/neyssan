import { useCallback, useMemo, useState } from "react";
import type { ICvState, ICvStateActions, IDraftForm } from "../types/cv";
import type { INormalizedProfile, IReviewerSection } from "../types/profile";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { remirrorJsonToString } from "../lib/utils";

/**
 * Compatibility hook: useCvState
 *
 * During the migration to a block-based CvDocument we keep a small compatibility
 * layer that exposes the legacy useCvState API used across the app. This allows
 * components like ProfileReviewModal to continue working while we progressively
 * migrate logic to the new CvLibraryContext.
 *
 * The implementation is intentionally conservative:
 * - mappedSections and rawSections are shallow arrays of IReviewerSection
 * - actions provide basic behavior (updateManualInput, loadProfile, setControls, reset)
 * - setMappedSections is exposed so callers (ProfileReviewModal) can still mutate the reviewer view
 *
 * This file should be removed as the migration completes and consumers are updated
 * to the new block-based primitives.
 */

/* Minimal helpers to build reviewer-style sections from a draft profile */
function buildSectionsFromDraft(form: IDraftForm): IReviewerSection[] {
  const sections: IReviewerSection[] = [];
  if (form.summary && String(form.summary).trim().length > 0)
    sections.push({ id: "summary-0", title: "Summary", content: String(form.summary), fieldKey: "summary", dismissed: false });
  if (form.skillsText && String(form.skillsText).trim().length > 0)
    sections.push({ id: "skills-0", title: "Skills", content: String(form.skillsText), fieldKey: "skills", dismissed: false });
  if (form.experienceText && String(form.experienceText).trim().length > 0)
    sections.push({ id: "experience-0", title: "Experience", content: String(form.experienceText), fieldKey: "experience", dismissed: false });
  if (form.educationText && String(form.educationText).trim().length > 0)
    sections.push({ id: "education-0", title: "Education", content: String(form.educationText), fieldKey: "education", dismissed: false });
  if (form.achievementsText && String(form.achievementsText).trim().length > 0)
    sections.push({ id: "achievements-0", title: "Achievements", content: String(form.achievementsText), fieldKey: "achievements", dismissed: false });
  if ((form.name && String(form.name).trim()) || (form.email && String(form.email).trim())) {
    const parts = [String(form.name ?? "").trim(), String(form.email ?? "").trim()].filter(Boolean).join(" / ");
    if (parts.length) sections.unshift({ id: "identity-0", title: "Identity", content: parts, fieldKey: "identity", dismissed: false });
  }
  return sections;
}

function buildSectionsFromProfile(profile: INormalizedProfile): IReviewerSection[] {
  const sections: IReviewerSection[] = [];
  if (profile.summary) sections.push({ id: "summary-0", title: "Summary", content: String(profile.summary), fieldKey: "summary", dismissed: false });
  if (profile.skills && Array.isArray(profile.skills) && profile.skills.length)
    sections.push({ id: "skills-0", title: "Skills", content: profile.skills.join(", "), fieldKey: "skills", dismissed: false });
  if (profile.experience && Array.isArray(profile.experience) && profile.experience.length)
    sections.push({ id: "experience-0", title: "Experience", content: JSON.stringify(profile.experience, null, 2), fieldKey: "experience", dismissed: false });
  if ((profile.education && Array.isArray(profile.education) && profile.education.length) || profile.metadata?.education) {
    const edu = profile.education ?? profile.metadata?.education ?? [];
    sections.push({ id: "education-0", title: "Education", content: JSON.stringify(edu, null, 2), fieldKey: "education", dismissed: false });
  }
  if (profile.achievements && Array.isArray(profile.achievements) && profile.achievements.length)
    sections.push({ id: "achievements-0", title: "Achievements", content: profile.achievements.join("\n"), fieldKey: "achievements", dismissed: false });

  if (profile.name || profile.email) {
    const parts = [profile.name ?? "", profile.email ?? ""].filter(Boolean).join(" / ");
    if (parts.length) sections.unshift({ id: "identity-0", title: "Identity", content: parts, fieldKey: "identity", dismissed: false });
  }

  return sections;
}

/**
 * useCvState compatibility hook
 *
 * Returns [ICvState, ICvStateActions] where mappedSections are derived from
 * the canonical profile (if available) or from the draft manual form.
 */
export function useCvState(): [ // Return a legacy-friendly state where mapped/raw sections use IReviewerSection (content: string)
  Omit<ICvState, "rawSections" | "mappedSections" | "displayedSections"> & {
    rawSections?: IReviewerSection[];
    mappedSections?: IReviewerSection[];
    displayedSections?: IReviewerSection[];
  },
  ICvStateActions & { setMappedSections: (sections: IReviewerSection[]) => void }
] {
  // We keep a small local state for draft/manual input so existing flows that call
  // updateManualInput continue to function.
  const [rawSections, setRawSections] = useState<IReviewerSection[]>([]);
  const [mappedSections, setMappedSectionsInternal] = useState<IReviewerSection[]>([]);
  const [controls, setControlsInternal] = useState<ICvState["controls"]>({ showRaw: false, useMapperStripping: true });
  const [draftProfile, setDraftProfile] = useState<Partial<import("../types/profile").INormalizedProfile> & IDraftForm>({});
  const [source, setSource] = useState<ICvState["source"]>("none");

  // Expose the new CvLibraryContext so migration can co-exist. We do not rely on it for core behavior,
  // but consumers may use the new provider elsewhere.
  const cvLibrary = useCvLibrary();

  const updateManualInput = useCallback((formData: IDraftForm) => {
    const raw = buildSectionsFromDraft(formData);
    setRawSections(raw);
    const mapped = buildSectionsFromDraft(formData);
    setMappedSectionsInternal(mapped);
    setDraftProfile((prev) => ({ ...(prev ?? {}), ...formData }));
    setSource("manual");
  }, []);

  const loadProfile = useCallback((profile: INormalizedProfile) => {
    // Prefer incoming rawSections from parser when provided, otherwise derive from profile fields
    const incomingRaw: any = (profile as unknown as { rawSections?: Array<{ id?: string; title?: string; content?: unknown; fieldKey?: string; dismissed?: boolean }> })?.rawSections;
    if (Array.isArray(incomingRaw) && incomingRaw.length > 0) {
      const normalized: IReviewerSection[] = incomingRaw.map((s, i) => ({
        id: s?.id ?? `raw-${i}`,
        title: String(s?.title ?? `Raw Section ${i}`),
        fieldKey: s?.fieldKey ?? "unknown",
        content: remirrorJsonToString((s)?.content),
        dismissed: Boolean(s?.dismissed ?? false),
      }));
      setRawSections(normalized);
    } else {
      const raw = buildSectionsFromProfile(profile);
      setRawSections(raw);
    }
    const mapped = buildSectionsFromProfile(profile);
    setMappedSectionsInternal(mapped);
    setDraftProfile(profile as Partial<INormalizedProfile> & IDraftForm);
    setSource("loaded");
  }, []);

  const setControls = useCallback((updates: Partial<ICvState["controls"]>) => {
    setControlsInternal((prev) => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => {
    setRawSections([]);
    setMappedSectionsInternal([]);
    setControlsInternal({ showRaw: false, useMapperStripping: true });
    setDraftProfile({});
    setSource("none");
  }, []);

  const state = useMemo(
    () =>
      ({
        // legacy consumers expect `sections` as the authoritative list — keep empty to avoid confusion
        sections: [],
        rawSections,
        mappedSections: mappedSections,
        displayedSections: undefined,
        controls,
        draftProfile,
        source,
        history: undefined,
        undoStack: undefined,
        redoStack: undefined,
        isDirty: false,
        lastSavedAt: null,
      }),
    [rawSections, mappedSections, controls, draftProfile, source]
  );

  const actions: ICvStateActions & { setMappedSections: (sections: IReviewerSection[]) => void } = {
    updateManualInput,
    loadProfile,
    setControls,
    reset,
    setMappedSections: (sections: IReviewerSection[]) => setMappedSectionsInternal(sections),
  };

  return [state as any, actions];
}