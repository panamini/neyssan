"use client";

import React from 'react';
import { RefinementField } from "../RefinementField";
import { IDraftForm } from '../../types/cv';
import { RefinedContent } from '../../utils/parseRefinedMarkdown';

interface ProfileReviewFormProps {
  form: IDraftForm;
  suggestions: RefinedContent | null;
  updateForm: (updates: Partial<IDraftForm>) => void;
  setSuggestions: React.Dispatch<React.SetStateAction<RefinedContent | null>>;
  scheduleCvStateUpdate: (updates: Partial<IDraftForm>) => void;
  handleExperienceChange: (val: string) => void;
  handleEducationChange: (val: string) => void;
}

export function ProfileReviewForm({
  form,
  suggestions,
  updateForm,
  setSuggestions,
  scheduleCvStateUpdate,
  handleExperienceChange,
  handleEducationChange,
}: ProfileReviewFormProps) {
  return (
    <div className="space-y-4">
      <RefinementField
        label="Name"
        value={form.name ?? ""}
        suggestion={null}
        onChange={(val: string) => { updateForm({ name: val }); scheduleCvStateUpdate({ name: val }); }}
        onAccept={() => { if (suggestions?.identity) { updateForm({ name: suggestions.identity }); setSuggestions(p => (p ? { ...p, identity: undefined } : null)); scheduleCvStateUpdate({ name: suggestions.identity }); } }}
      />
      <RefinementField
        label="Email"
        value={form.email ?? ""}
        suggestion={null}
        onChange={(val: string) => { updateForm({ email: val }); scheduleCvStateUpdate({ email: val }); }}
        onAccept={() => { if (suggestions?.contact) { updateForm({ email: suggestions.contact }); setSuggestions(p => (p ? { ...p, contact: undefined } : null)); scheduleCvStateUpdate({ email: suggestions.contact }); }}}
      />
      <RefinementField
        label="Summary"
        value={form.summary ?? ""}
        suggestion={suggestions?.summary}
        onChange={(val: string) => { updateForm({ summary: val }); scheduleCvStateUpdate({ summary: val }); }}
        onAccept={() => { if (suggestions?.summary) { updateForm({ summary: suggestions.summary }); setSuggestions(p => (p ? { ...p, summary: undefined } : null)); scheduleCvStateUpdate({ summary: suggestions.summary }); } }}
      />
      <RefinementField
        label="Skills"
        value={form.skillsText ?? ""}
        suggestion={suggestions?.skills}
        onChange={(val: string) => { updateForm({ skillsText: val }); scheduleCvStateUpdate({ skillsText: val }); }}
        onAccept={() => { if (suggestions?.skills) { updateForm({ skillsText: suggestions.skills }); setSuggestions(p => (p ? { ...p, skills: undefined } : null)); scheduleCvStateUpdate({ skillsText: suggestions.skills }); } }}
      />
      <RefinementField
        label="Achievements"
        value={form.achievementsText ?? ""}
        suggestion={suggestions?.achievements}
        onChange={(val: string) => { updateForm({ achievementsText: val }); scheduleCvStateUpdate({ achievementsText: val }); }}
        onAccept={() => { if (suggestions?.achievements) { updateForm({ achievementsText: suggestions.achievements }); setSuggestions(p => (p ? { ...p, achievements: undefined } : null)); scheduleCvStateUpdate({ achievementsText: suggestions.achievements }); } }}
      />
      <RefinementField
        label="Experience"
        value={form.experienceText ?? "[]"}
        suggestion={suggestions?.experience}
        onChange={handleExperienceChange}
        onAccept={() => { if (suggestions?.experience) { handleExperienceChange(suggestions.experience); setSuggestions(p => (p ? { ...p, experience: undefined } : null)); } }}
      />
      <RefinementField
        label="Education"
        value={form.educationText ?? "[]"}
        suggestion={suggestions?.education}
        onChange={handleEducationChange}
        onAccept={() => { if (suggestions?.education) { handleEducationChange(suggestions.education); setSuggestions(p => (p ? { ...p, education: undefined } : null)); } }}
      />
    </div>
  );
}