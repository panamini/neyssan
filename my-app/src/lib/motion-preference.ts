import React from "react";

export type MotionPreference = "system" | "reduced";

const MOTION_STORAGE_KEY = "twoweeks:motion-preference";
const MOTION_CHANGED_EVENT = "twoweeks:motion-preference-changed";

export function readStoredMotionPreference(): MotionPreference {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    return window.localStorage.getItem(MOTION_STORAGE_KEY) === "reduced"
      ? "reduced"
      : "system";
  } catch {
    return "system";
  }
}

export function applyMotionPreference(preference: MotionPreference): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.reduceMotion =
    preference === "reduced" ? "true" : "false";
}

export function setStoredMotionPreference(preference: MotionPreference): void {
  try {
    window.localStorage.setItem(MOTION_STORAGE_KEY, preference);
  } catch {
    /* noop */
  }

  applyMotionPreference(preference);
  window.dispatchEvent(
    new CustomEvent<MotionPreference>(MOTION_CHANGED_EVENT, { detail: preference }),
  );
}

export function useMotionPreference(): {
  preference: MotionPreference;
  setPreference: (preference: MotionPreference) => void;
} {
  const [preference, setPreferenceState] = React.useState<MotionPreference>(
    readStoredMotionPreference,
  );

  React.useEffect(() => {
    applyMotionPreference(preference);
  }, [preference]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleMotionChanged = (event: Event) => {
      const detail = (event as CustomEvent<MotionPreference>).detail;
      if (detail === "system" || detail === "reduced") {
        setPreferenceState(detail);
      }
    };

    window.addEventListener(MOTION_CHANGED_EVENT, handleMotionChanged);
    return () => window.removeEventListener(MOTION_CHANGED_EVENT, handleMotionChanged);
  }, []);

  const setPreference = React.useCallback((nextPreference: MotionPreference) => {
    setPreferenceState(nextPreference);
    setStoredMotionPreference(nextPreference);
  }, []);

  return { preference, setPreference };
}
