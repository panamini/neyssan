import React from "react";
import { PROPOSAL_PALETTE_OPTIONS } from "./proposal-style-display";
import {
  ENABLED_UI_LOCALES,
  LOCALE_REGISTRY,
  resolveUiLocale,
  syncDocumentLocale,
  type ProductionUiLocale,
  type UiLocalePreference,
} from "./locale-registry";

export type UiLanguageId = UiLocalePreference;

export type UiAccentId =
  | "default"
  | "cobalt"
  | "sauge"
  | "plum"
  | "ochre"
  | "ink"
  | "custom";

export type UiAccentPreference =
  | { id: Exclude<UiAccentId, "custom">; customHex?: null }
  | { id: "custom"; customHex: string };

const UI_LANGUAGE_STORAGE_KEY = "twoweeks:ui-language";
const UI_ACCENT_STORAGE_KEY = "twoweeks:ui-accent";
const UI_CUSTOM_ACCENT_STORAGE_KEY = "twoweeks:ui-custom-accent";
const UI_LANGUAGE_CHANGE_EVENT = "twoweeks:ui-language-change";

const NAMED_UI_ACCENTS: Exclude<UiAccentId, "default" | "custom">[] = [
  "cobalt",
  "sauge",
  "plum",
  "ochre",
  "ink",
];

export const UI_LANGUAGE_OPTIONS: Array<{
  id: UiLanguageId;
  label: string;
  nativeLabel: string;
}> = [
  { id: "auto", label: "Auto", nativeLabel: "Auto" },
  ...ENABLED_UI_LOCALES.map((id) => ({
    id,
    label:
      id === "en"
        ? "English"
        : id === "fr"
          ? "French"
          : id === "es"
            ? "Spanish"
            : id,
    nativeLabel: LOCALE_REGISTRY[id].nativeName,
  })),
];

export const UI_ACCENT_OPTIONS: Array<{
  id: UiAccentId;
  label: string;
  swatch: string;
}> = [
  { id: "default", label: "Default", swatch: "#A84E2E" },
  ...NAMED_UI_ACCENTS.map((id) => {
    const palette = PROPOSAL_PALETTE_OPTIONS.find((option) => option.id === id);
    return {
      id,
      label: palette?.label ?? id,
      swatch: palette?.color ?? "#A84E2E",
    };
  }),
  { id: "custom", label: "Custom", swatch: "#8A8176" },
];

export const UI_CUSTOM_ACCENT_STARTER_HEX = "#8A8176";

function normalizeHex(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : null;
}

function isUiLanguageId(value: string | null): value is UiLanguageId {
  return UI_LANGUAGE_OPTIONS.some((option) => option.id === value);
}

function isUiAccentId(value: string | null): value is UiAccentId {
  return UI_ACCENT_OPTIONS.some((option) => option.id === value);
}

export function readStoredUiLanguagePreference(): UiLanguageId {
  if (typeof window === "undefined") return "auto";
  const stored = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
  return isUiLanguageId(stored) ? stored : "auto";
}

function subscribeUiLanguagePreference(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === UI_LANGUAGE_STORAGE_KEY) {
      onStoreChange();
    }
  };
  const handleLocalChange = () => onStoreChange();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(UI_LANGUAGE_CHANGE_EVENT, handleLocalChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(UI_LANGUAGE_CHANGE_EVENT, handleLocalChange);
  };
}

function notifyUiLanguagePreferenceChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(UI_LANGUAGE_CHANGE_EVENT));
}

function readStoredAccent(): UiAccentPreference {
  if (typeof window === "undefined") return { id: "default" };
  const stored = window.localStorage.getItem(UI_ACCENT_STORAGE_KEY);
  const customHex =
    normalizeHex(window.localStorage.getItem(UI_CUSTOM_ACCENT_STORAGE_KEY)) ??
    UI_CUSTOM_ACCENT_STARTER_HEX.toLowerCase();

  if (stored === "custom") {
    return { id: "custom", customHex };
  }

  return isUiAccentId(stored) && stored !== "custom"
    ? { id: stored }
    : { id: "default" };
}

function clearUiAccentOverrides(root: HTMLElement): void {
  UI_ACCENT_OPTIONS.forEach((option) => {
    if (option.id !== "default" && option.id !== "custom") {
      root.classList.remove(`pal-${option.id}`);
    }
  });
  root.style.removeProperty("--ac");
  root.style.removeProperty("--am");
  root.style.removeProperty("--fr");
  root.style.removeProperty("--ap");
  root.style.removeProperty("--as");
  root.style.removeProperty("--color-on-accent");
  root.style.removeProperty("--op");
}

export function applyStoredUiAccent(preference = readStoredAccent()): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  clearUiAccentOverrides(root);
  root.dataset.uiAccent = preference.id;

  if (preference.id === "default") return;

  if (preference.id === "custom") {
    const customHex =
      normalizeHex(preference.customHex) ?? UI_CUSTOM_ACCENT_STARTER_HEX;
    root.style.setProperty("--ac", customHex);
    root.style.setProperty(
      "--am",
      `color-mix(in srgb, ${customHex} 76%, white 24%)`,
    );
    root.style.setProperty("--fr", customHex);
    root.style.setProperty(
      "--ap",
      `color-mix(in srgb, ${customHex} 12%, transparent)`,
    );
    root.style.setProperty(
      "--as",
      `color-mix(in srgb, ${customHex} 18%, transparent)`,
    );
    root.style.setProperty("--color-on-accent", "#FAF9F5");
    root.style.setProperty("--op", "var(--color-on-accent)");
    return;
  }

  root.classList.add(`pal-${preference.id}`);
}

export function useUiLanguagePreference(): {
  language: UiLanguageId;
  resolvedLanguage: ProductionUiLocale;
  setLanguage: (language: UiLanguageId) => void;
} {
  const language = React.useSyncExternalStore<UiLanguageId>(
    subscribeUiLanguagePreference,
    readStoredUiLanguagePreference,
    () => "auto",
  );
  const resolvedLanguage = resolveUiLocale(language);

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.uiLanguagePreference = language;
      document.documentElement.dataset.uiLanguage = resolvedLanguage;
      syncDocumentLocale(resolvedLanguage);
    }
  }, [language, resolvedLanguage]);

  const setLanguage = React.useCallback((nextLanguage: UiLanguageId) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, nextLanguage);
    notifyUiLanguagePreferenceChange();
  }, []);

  return { language, resolvedLanguage, setLanguage };
}

export function applyStoredUiLanguage(): void {
  const language = readStoredUiLanguagePreference();
  const resolvedLanguage = resolveUiLocale(language);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.uiLanguagePreference = language;
    document.documentElement.dataset.uiLanguage = resolvedLanguage;
    syncDocumentLocale(resolvedLanguage);
  }
}

export function useUiAccentPreference(): {
  accent: UiAccentPreference;
  setAccent: (accent: UiAccentPreference) => void;
} {
  const [accent, setAccentState] =
    React.useState<UiAccentPreference>(readStoredAccent);

  React.useEffect(() => {
    applyStoredUiAccent(accent);
  }, [accent]);

  const setAccent = React.useCallback((nextAccent: UiAccentPreference) => {
    setAccentState(nextAccent);
    window.localStorage.setItem(UI_ACCENT_STORAGE_KEY, nextAccent.id);
    if (nextAccent.id === "custom") {
      window.localStorage.setItem(
        UI_CUSTOM_ACCENT_STORAGE_KEY,
        nextAccent.customHex,
      );
    }
    applyStoredUiAccent(nextAccent);
  }, []);

  return { accent, setAccent };
}
