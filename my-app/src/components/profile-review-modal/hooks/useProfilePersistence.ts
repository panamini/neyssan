import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import * as convexReact from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { IDraftForm } from '../../../types/cv';
import { INormalizedProfile, IExperienceItem, IEducationItem } from '../../../types/profile';
import { RefinedContent } from '../../../utils/parseRefinedMarkdown';

export function useProfilePersistence(
  form: IDraftForm,
  rawTextLocal: string,
  suggestions: RefinedContent | null,
  savedProfileId: string | null,
  profileVersion: number | null,
  onSaved?: (res: any) => void
) {
  const [status, setStatus] = useState<'idle' | 'saving'>('idle');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [localSavedProfileId, setLocalSavedProfileId] = useState(savedProfileId);
  const [localProfileVersion, setLocalProfileVersion] = useState(profileVersion);
  const [canonicalProfile, setCanonicalProfile] = useState<Partial<INormalizedProfile> | null>(null);

  const { isSignedIn, isLoaded: clerkLoaded } = useAuth();
  const saveProfileMutation = (convexReact as any).useMutation(api.profiles.patch);

  const handleSave = async (notifyParent = true) => {
    if (!clerkLoaded || !isSignedIn) {
      setMessage({ type: 'error', text: "You must be signed in to save profiles." });
      return null;
    }

    setStatus('saving');
    setMessage(null);

    const skills: string[] = form.skillsText?.split(",").map((s: string) => s.trim()).filter(Boolean) ?? [];
    let experience: IExperienceItem[] = [];
    try {
      experience = JSON.parse(form.experienceText || "[]");
    } catch (e) {
      experience = [];
    }
    let education: IEducationItem[] = [];
    try {
      education = JSON.parse(form.educationText || "[]");
    } catch (e) {
      education = [];
    }
    const achievements = form.achievementsText?.split("\n").map((s: string) => s.trim()).filter(Boolean) ?? [];

    const profileObj = {
      name: form.name ?? undefined,
      email: form.email ?? "",
      summary: form.summary ?? undefined,
      skills: skills.length ? skills : undefined,
      experience: experience.length ? experience : undefined,
      education: education.length ? education : undefined,
      achievements: achievements.length ? achievements : undefined,
      raw_text: rawTextLocal ?? undefined,
      confidence: form.confidence ?? 0,
      metadata: { ...form.metadata, reviewedAt: Date.now(), reviewedBy: "frontend_review", refined: suggestions ?? undefined },
    };

    try {
      const profileId = localSavedProfileId ?? (crypto as any).randomUUID();
      const idempotencyKey = (crypto as any).randomUUID();

      const res = await saveProfileMutation({
        profileId,
        idempotencyKey,
        source: "frontend_confirm_save",
        version: localProfileVersion ?? 1,
        profile: profileObj,
      });

      if (!res || !res.profileId) throw new Error("Failed to save profile");

      const convexId = (res).convexId ?? res.profileId;
      setLocalSavedProfileId(convexId);
      if (res.updatedAt) {
        setLocalProfileVersion(typeof res.updatedAt === 'number' ? Math.floor(res.updatedAt / 1000) : localProfileVersion);
      }

      setCanonicalProfile({
        id: convexId,
        name: profileObj.name ?? "",
        email: profileObj.email ?? "",
        summary: profileObj.summary ?? undefined,
        skills: profileObj.skills ?? undefined,
        experience: profileObj.experience ?? undefined,
        education: profileObj.education ?? undefined,
        achievements: profileObj.achievements ?? undefined,
        rawText: profileObj.raw_text ?? undefined,
        version: localProfileVersion ?? undefined,
      });

      setMessage({ type: 'success', text: "Profile saved" });
      if (notifyParent && onSaved) {
        onSaved(res);
      }
      return convexId;
    } catch (e) {
      setMessage({ type: 'error', text: (e as Error).message || "Save failed" });
      console.error('[useProfilePersistence] handleSave error:', e);
      return null;
    } finally {
      setStatus('idle');
    }
  };

  return {
    status,
    message,
    handleSave,
    canonicalProfile,
    savedProfileId: localSavedProfileId,
    profileVersion: localProfileVersion,
    setCanonicalProfile,
    setMessage,
  };
}