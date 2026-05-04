import React from "react";

export type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "theme";
const THEME_CHANGED_EVENT = "twoweeks:theme-changed";

function readInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      return stored;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.dataset.theme = mode;
}

export function setStoredThemeMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* noop */
  }

  applyTheme(mode);
  window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT, { detail: mode }));
}

export function useThemeMode(): {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
} {
  const [mode, setModeState] = React.useState<ThemeMode>(readInitialTheme);

  React.useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleThemeChanged = (event: Event) => {
      const detail = (event as CustomEvent<ThemeMode>).detail;
      if (detail === "dark" || detail === "light") {
        setModeState(detail);
      }
    };

    window.addEventListener(THEME_CHANGED_EVENT, handleThemeChanged);
    return () => {
      window.removeEventListener(THEME_CHANGED_EVENT, handleThemeChanged);
    };
  }, []);

  const setMode = React.useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    setStoredThemeMode(nextMode);
  }, []);

  const toggle = React.useCallback(() => {
    setModeState((current) => {
      const nextMode = current === "dark" ? "light" : "dark";
      setStoredThemeMode(nextMode);
      return nextMode;
    });
  }, []);

  return { mode, setMode, toggle };
}
