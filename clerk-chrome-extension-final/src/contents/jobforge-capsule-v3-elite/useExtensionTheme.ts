import { useEffect, useState } from "react";
import type { ExtensionThemeMode } from "./types";

type ThemePreference = ExtensionThemeMode | "system";

const THEME_STORAGE_KEYS = [
  "twoweeksThemePreference",
  "twoweeks:theme",
  "theme",
] as const;

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function getSystemTheme(): ExtensionThemeMode {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveThemePreference(preference: ThemePreference | null): ExtensionThemeMode {
  if (preference === "light" || preference === "dark") return preference;
  return getSystemTheme();
}

function readLocalThemePreference(): ThemePreference | null {
  try {
    const localTheme = window.localStorage.getItem("theme");
    return isThemePreference(localTheme) ? localTheme : null;
  } catch {
    return null;
  }
}

export function useExtensionTheme(): ExtensionThemeMode {
  const [themeMode, setThemeMode] = useState<ExtensionThemeMode>(() =>
    resolveThemePreference(readLocalThemePreference()),
  );

  useEffect(() => {
    document.documentElement.dataset.twJobforgeCapsule = "mounted";
    return () => {
      delete document.documentElement.dataset.twJobforgeCapsule;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const applyPreference = (preference: ThemePreference | null) => {
      if (!active) return;
      setThemeMode(resolveThemePreference(preference));
    };

    const loadPreference = () => {
      const localPreference = readLocalThemePreference();
      if (localPreference) {
        applyPreference(localPreference);
        return;
      }

      chrome.storage.local.get([...THEME_STORAGE_KEYS], (result) => {
        if (!active) return;
        const storedPreference = THEME_STORAGE_KEYS
          .map((key) => result?.[key])
          .find(isThemePreference);
        applyPreference(storedPreference ?? null);
      });
    };

    loadPreference();

    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    const handleSystemChange = () => loadPreference();
    mediaQuery?.addEventListener?.("change", handleSystemChange);

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== "local") return;
      const changedThemeKey = THEME_STORAGE_KEYS.find((key) => changes[key]);
      if (!changedThemeKey) return;
      const nextValue = changes[changedThemeKey].newValue;
      applyPreference(isThemePreference(nextValue) ? nextValue : null);
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    window.addEventListener("storage", loadPreference);

    return () => {
      active = false;
      mediaQuery?.removeEventListener?.("change", handleSystemChange);
      chrome.storage.onChanged.removeListener(handleStorageChange);
      window.removeEventListener("storage", loadPreference);
    };
  }, []);

  return themeMode;
}
