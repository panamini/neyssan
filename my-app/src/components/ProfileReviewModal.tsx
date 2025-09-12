"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useCvState } from "../hooks/useCvState";
import { IDraftForm } from "../types/cv";
import { INormalizedProfile, IReviewerSection, IProfileReviewProps } from "../types/profile";
import { remirrorJsonToString } from "../lib/utils";
import { RefinedContent } from "../utils/parseRefinedMarkdown";
import { useProfilePersistence } from "./profile-review-modal/hooks/useProfilePersistence";
import { useLlmRefinement } from "./profile-review-modal/hooks/useLlmRefinement";
import { ProfileReviewHeader } from "./profile-review-modal/ProfileReviewHeader";
import { ProfileReviewForm } from "./profile-review-modal/ProfileReviewForm";
import { ProfileReviewFooter } from "./profile-review-modal/ProfileReviewFooter";
import { CVReviewerOverlay } from "./profile-review-modal/CVReviewerOverlay";
import LoadingSpinner from "./LoadingSpinner";
import { useToast } from "./ui/toast";

export default function ProfileReviewModal({ visible, parsedProfile, onClose, onSaved }: IProfileReviewProps) {
  const [form, setForm] = useState<IDraftForm>({});
  const [rawTextLocal, setRawTextLocal] = useState('');
  const [suggestions, setSuggestions] = useState<RefinedContent | null>(null);
  const [reviewerVisible, setReviewerVisible] = useState<boolean>(false);
  const [cvLoaderError, setCvLoaderError] = useState<string | null>(null);
  const [skipParsedProfileInit, setSkipParsedProfileInit] = useState<boolean>(false);
  const [lastAppliedSnapshot, setLastAppliedSnapshot] = useState<any>(null);

  const [cvState, cvActions] = useCvState();
  const { showToast } = useToast();
  const { isLoaded: clerkLoaded } = useAuth();

  const {
    status: persistenceStatus,
    message: persistenceMessage,
    handleSave,
    canonicalProfile,
    savedProfileId,
    profileVersion,
    setCanonicalProfile,
    setMessage: setPersistenceMessage,
  } = useProfilePersistence(form, rawTextLocal, suggestions, null, null, onSaved);

  const {
    status: refinementStatus,
    message: refinementMessage,
    handleRefineClick,
  } = useLlmRefinement(rawTextLocal, handleSave, cvActions, setReviewerVisible, setSuggestions, setSkipParsedProfileInit);

  useEffect(() => {
    if (parsedProfile) {
      if (skipParsedProfileInit) {
        setSkipParsedProfileInit(false);
        setRawTextLocal(parsedProfile.rawText ?? "");
        setCanonicalProfile(parsedProfile);
        return;
      }
      setCanonicalProfile(parsedProfile);
      cvActions.loadProfile(parsedProfile as INormalizedProfile);
      setForm({
        name: parsedProfile.name ?? "",
        email: parsedProfile.email ?? "",
        summary: parsedProfile.summary ?? "",
        skillsText: (parsedProfile.skills || []).join(", "),
        experienceText: JSON.stringify(parsedProfile.experience || [], null, 2),
        educationText: JSON.stringify(parsedProfile.education || [], null, 2),
        achievementsText: Array.isArray(parsedProfile.achievements) ? parsedProfile.achievements.join("\n") : String(parsedProfile.achievements ?? ""),
      });
      setRawTextLocal(parsedProfile.rawText ?? "");
      setSuggestions(null);
      setReviewerVisible(true);
    }
  }, [parsedProfile, skipParsedProfileInit, setCanonicalProfile, cvActions]);

  const updateForm = useCallback((updates: Partial<IDraftForm>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  }, []);
  
  /**
   * Map a reviewer section field key to draft form updates.
   * The old reviewer uses generic keys like "skills" or "experience" while
   * the draft form expects keys such as "skillsText" / "experienceText".
   */
  function mapReviewerFieldToFormUpdates(fieldKey?: string | null, value?: string): Partial<IDraftForm> {
    if (!fieldKey) return {};
    switch (fieldKey) {
      case "skills":
        return { skillsText: value ?? "" };
      case "experience":
        return { experienceText: value ?? "[]" };
      case "education":
        return { educationText: value ?? "[]" };
      case "achievements":
        return { achievementsText: value ?? "" };
      case "identity": {
        // Expecting "Name / email" format — split if possible
        const parts = (value ?? "").split("/").map(p => p.trim()).filter(Boolean);
        const [namePart, emailPart] = parts;
        const out: Partial<IDraftForm> = {};
        if (namePart) out.name = namePart;
        if (emailPart) out.email = emailPart;
        return out;
      }
      case "summary":
        return { summary: value ?? "" };
      default:
        // For unknown keys we fall back to placing the raw value in summary
        return { summary: value ?? "" };
    }
  }

  const handleExperienceChange = useCallback((val: string) => {
    updateForm({ experienceText: val });
  }, [updateForm]);

  const handleEducationChange = useCallback((val: string) => {
    updateForm({ educationText: val });
  }, [updateForm]);

  const isFormEmpty = () => {
    return !Object.values(form).some(v => v);
  };

  const displayedSections = useMemo((): IReviewerSection[] => {
    const { controls, mappedSections, rawSections } = cvState;
    if (controls?.showRaw) {
      if (!rawSections || rawSections.length === 0) return [];
      return rawSections.map((s, i) => ({
        id: s.id ?? `raw-${i}`,
        title: s.title ?? `Raw Section ${i}`,
        fieldKey: s.fieldKey ?? "unknown",
        content: remirrorJsonToString(s.content),
        dismissed: s.dismissed ?? false,
      }));
    }
    if (!mappedSections || mappedSections.length === 0) return [];
    return mappedSections.map(s => ({
      ...s,
      content: remirrorJsonToString(s.content),
    }));
  }, [cvState?.rawSections, cvState?.mappedSections, cvState?.controls]);

  const handleReviewerEdit = useCallback((id: string, newContent: string) => {
    const prevSection = (cvState?.mappedSections ?? []).find(s => s.id === id);
    if (!prevSection) return;
  
    // Update the reviewer view
    const ms = (cvState?.mappedSections ?? []).map((s) => (s.id === id ? { ...s, content: newContent } : s));
    cvActions.setMappedSections(ms);
  
    // Update the draft form using the compatibility mapping
    const updates = mapReviewerFieldToFormUpdates(prevSection.fieldKey, newContent);
    if (Object.keys(updates).length) updateForm(updates);
  
    void handleSave(false);
  }, [cvState?.mappedSections, cvActions, updateForm, handleSave]);

  const handleApplyRemaining = useCallback(async () => {
    const remaining = (cvState?.mappedSections ?? []).filter((s) => !s.dismissed);
    const prevForm = { ...form };
    try {
      setLastAppliedSnapshot({
        field: "bulk",
        previousForm: JSON.parse(JSON.stringify(prevForm)),
        acceptedValue: JSON.stringify(remaining),
        previousSuggestions: suggestions ? JSON.parse(JSON.stringify(suggestions)) : null,
      });
  
      for (const s of remaining) {
        const sectionContent = remirrorJsonToString(s.content);
        if (s.fieldKey) {
          const updates = mapReviewerFieldToFormUpdates(s.fieldKey, sectionContent);
          if (Object.keys(updates).length) updateForm(updates);
        }
      }
      setSuggestions(null);
      await handleSave(false);
      setReviewerVisible(false);
      showToast("Applied remaining sections and saved — Undo available", { variant: "success" });
    } catch (err) {
      setForm(prevForm);
      showToast("Failed to apply remaining sections", { variant: "error" });
    }
  }, [cvState?.mappedSections, form, handleSave, setSuggestions, showToast, updateForm]);

  const undoLastApplied = () => {
    if (lastAppliedSnapshot) {
      setForm(lastAppliedSnapshot.previousForm);
      if (lastAppliedSnapshot.previousSuggestions) {
        setSuggestions(lastAppliedSnapshot.previousSuggestions);
      }
      setLastAppliedSnapshot(null);
      showToast("Last change undone", { variant: "success" });
    }
  };

  const handleFileLoad = (parsed: INormalizedProfile) => {
    if (!parsed) return;
    setCanonicalProfile(parsed);
    try {
      cvActions.loadProfile(parsed as INormalizedProfile);
    } catch (_e) {
      // compatibility safe: some implementations may not support loadProfile
      try { (cvActions as any).updateManualInput(parsed as Partial<INormalizedProfile> & IDraftForm); } catch (_err) {}
    }
    setForm({
      name: parsed.name ?? "",
      email: parsed.email ?? "",
      summary: parsed.summary ?? "",
      skillsText: (parsed.skills || []).join(", "),
      experienceText: JSON.stringify(parsed.experience || [], null, 2),
      educationText: JSON.stringify(parsed.education || [], null, 2),
      achievementsText: Array.isArray(parsed.achievements) ? parsed.achievements.join("\n") : String(parsed.achievements ?? ""),
    });
    setRawTextLocal(parsed.rawText ?? "");
    setSuggestions(null);
    setReviewerVisible(true);
  };

  if (!visible) return null;
  if (!clerkLoaded) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><LoadingSpinner /></div>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-black w-full max-w-4xl mx-auto rounded-lg shadow-xl p-4 md:p-6 overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <ProfileReviewHeader onClose={onClose} />
        <div className="flex-grow pr-4 -mr-4 overflow-y-auto custom-scrollbar">
          <ProfileReviewForm
            form={form}
            suggestions={suggestions}
            updateForm={updateForm}
            setSuggestions={setSuggestions}
            scheduleCvStateUpdate={(updates) => { try { cvActions.updateManualInput(updates as IDraftForm); } catch (e) { /* noop */ } }}
            handleExperienceChange={handleExperienceChange}
            handleEducationChange={handleEducationChange}
          />
        </div>
        <ProfileReviewFooter
          status={persistenceStatus === 'saving' ? 'saving' : refinementStatus}
          isFormEmpty={isFormEmpty}
          lastAppliedSnapshot={lastAppliedSnapshot}
          onFileParsed={handleFileLoad}
          onError={setCvLoaderError}
          onRefineClick={handleRefineClick}
          onUndo={undoLastApplied}
        />
        <CVReviewerOverlay
          visible={reviewerVisible}
          cvState={cvState}
          cvActions={cvActions}
          displayedSections={displayedSections}
          onClose={() => setReviewerVisible(false)}
          onApplyRemaining={handleApplyRemaining}
          onReviewerEdit={handleReviewerEdit}
        />
      </div>
    </div>
  );
}
