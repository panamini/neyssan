export const OPEN_ONBOARDING_REPLAY_EVENT = "twoweeks:open-onboarding-replay";

export type OnboardingReplayTargetStep =
  | "intro"
  | "style"
  | "tone"
  | "cv"
  | "jobs"
  | "done";

export type OpenOnboardingReplayEventDetail = {
  stepId?: OnboardingReplayTargetStep;
};

export function openOnboardingReplay(
  detail: OpenOnboardingReplayEventDetail = {},
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<OpenOnboardingReplayEventDetail>(
      OPEN_ONBOARDING_REPLAY_EVENT,
      { detail },
    ),
  );
}
