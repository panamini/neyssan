import React from "react";

export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "system";

const THEME_STORAGE_KEY = "theme";
const THEME_CHANGED_EVENT = "twoweeks:theme-changed";

type ThemeChangedDetail = {
  preference: ThemePreference;
  mode: ThemeMode;
};

function resolveSystemTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function readInitialPreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light" || stored === "system") {
      return stored;
    }
  } catch {
    /* noop */
  }

  return "system";
}

function resolveThemePreference(preference: ThemePreference): ThemeMode {
  return preference === "system" ? resolveSystemTheme() : preference;
}

function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.dataset.theme = mode;
}

function emitThemeChanged(preference: ThemePreference, mode: ThemeMode): void {
  window.dispatchEvent(
    new CustomEvent<ThemeChangedDetail>(THEME_CHANGED_EVENT, {
      detail: { preference, mode },
    }),
  );
}

export function setStoredThemePreference(preference: ThemePreference): void {
  const mode = resolveThemePreference(preference);

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* noop */
  }

  applyTheme(mode);
  emitThemeChanged(preference, mode);
}

export function setStoredThemeMode(mode: ThemeMode): void {
  setStoredThemePreference(mode);
}

export function useThemeMode(): {
  mode: ThemeMode;
  preference: ThemePreference;
  setMode: (mode: ThemeMode) => void;
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
} {
  const [preference, setPreferenceState] = React.useState<ThemePreference>(
    readInitialPreference,
  );
  const [mode, setModeState] = React.useState<ThemeMode>(() =>
    resolveThemePreference(readInitialPreference()),
  );

  React.useEffect(() => {
    const resolvedMode = resolveThemePreference(preference);
    setModeState(resolvedMode);
    applyTheme(resolvedMode);
  }, [preference]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if (preference !== "system") {
        return;
      }

      const nextMode = resolveSystemTheme();
      setModeState(nextMode);
      applyTheme(nextMode);
      emitThemeChanged("system", nextMode);
    };

    mediaQuery.addEventListener?.("change", handleSystemThemeChange);
    return () => {
      mediaQuery.removeEventListener?.("change", handleSystemThemeChange);
    };
  }, [preference]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleThemeChanged = (event: Event) => {
      const detail = (event as CustomEvent<ThemeChangedDetail | ThemeMode>).detail;
      if (detail === "dark" || detail === "light") {
        setPreferenceState(detail);
        setModeState(detail);
        return;
      }
      if (
        detail &&
        typeof detail === "object" &&
        (detail.preference === "dark" ||
          detail.preference === "light" ||
          detail.preference === "system")
      ) {
        setPreferenceState(detail.preference);
        setModeState(detail.mode);
      }
    };

    window.addEventListener(THEME_CHANGED_EVENT, handleThemeChanged);
    return () => {
      window.removeEventListener(THEME_CHANGED_EVENT, handleThemeChanged);
    };
  }, []);

  const setPreference = React.useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    setStoredThemePreference(nextPreference);
  }, []);

  const setMode = React.useCallback(
    (nextMode: ThemeMode) => {
      setPreference(nextMode);
    },
    [setPreference],
  );

  const toggle = React.useCallback(() => {
    setPreference(mode === "dark" ? "light" : "dark");
  }, [mode, setPreference]);

  return { mode, preference, setMode, setPreference, toggle };
}
