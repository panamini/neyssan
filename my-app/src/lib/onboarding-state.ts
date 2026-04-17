const COMPLETED_KEY = "twoweeks:quick-start-completed";
const TONE_KEY = "twoweeks:tone-preference";

export type TonePreference = "auto" | "natural" | "formal" | "warm";

export const TONE_OPTIONS: ReadonlyArray<{
  id: TonePreference;
  label: string;
  hint: string;
}> = [
  { id: "auto", label: "Auto", hint: "We pick what fits." },
  { id: "natural", label: "Natural", hint: "Sound like a real person." },
  { id: "formal", label: "Formal", hint: "Boardroom-ready, still sharp." },
  { id: "warm", label: "Warm", hint: "Human, generous, inviting." },
];

export function isQuickStartCompleted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(COMPLETED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markQuickStartCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMPLETED_KEY, "1");
  } catch {
    /* noop */
  }
}

export function readTonePreference(): TonePreference | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(TONE_KEY);
    if (
      value === "auto" ||
      value === "natural" ||
      value === "formal" ||
      value === "warm"
    ) {
      return value;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeTonePreference(tone: TonePreference): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TONE_KEY, tone);
  } catch {
    /* noop */
  }
}
