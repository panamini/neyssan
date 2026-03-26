"use client";

import * as React from "react";
import { Sun, Moon } from "@/lib/icons";
import clsx from "clsx";

interface DarkModeToggleProps {
  /** When true, renders a bare 16×16 icon button (no padding, no hover bg)
   *  for embedding inside the sidebar's 16px icon slot. */
  compact?: boolean;
}

const DarkModeToggle = ({ compact = false }: DarkModeToggleProps) => {
  // Initialize state from localStorage, then system preference
  const [isDarkTheme, setIsDarkTheme] = React.useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "dark") {
      return true;
    } else if (storedTheme === "light") {
      return false;
    } else {
      // Check system preference if no stored theme
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
  });

  React.useEffect(() => {
    // Apply the correct theme based on the initialized state
    if (isDarkTheme) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkTheme]); // Add isDarkTheme as a dependency

  const onThemeChange = () => {
    const newTheme = !isDarkTheme;
    setIsDarkTheme(newTheme);
    if (newTheme) {
      localStorage.setItem("theme", "dark");
      document.documentElement.classList.add("dark");
    } else {
      localStorage.setItem("theme", "light");
      document.documentElement.classList.remove("dark");
    }
  };

  if (compact) {
    return (
      <button
        onClick={onThemeChange}
        className="dasti-icon-button dasti-icon-button--compact dasti-icon-button--bare"
        aria-pressed={isDarkTheme}
        aria-label={
          isDarkTheme ? "Switch to light mode" : "Switch to dark mode"
        }
      >
        {isDarkTheme ? (
          <Moon className="w-4 h-4" aria-hidden />
        ) : (
          <Sun className="w-4 h-4" aria-hidden />
        )}
        <span className="sr-only">Toggle Dark Mode</span>
      </button>
    );
  }

  return (
    <button
      onClick={onThemeChange}
      className={clsx(
        "dasti-theme-switch",
        isDarkTheme && "dasti-theme-switch--dark",
      )}
      aria-pressed={isDarkTheme}
      aria-label={isDarkTheme ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="dasti-theme-switch__rail" aria-hidden="true">
        <span className="dasti-theme-switch__thumb" />
      </span>
      <span className="dasti-theme-switch__label">
        {isDarkTheme ? "Dark" : "Light"}
      </span>
      {isDarkTheme ? (
        <Moon className="dasti-theme-switch__glyph" aria-hidden />
      ) : (
        <Sun className="dasti-theme-switch__glyph" aria-hidden />
      )}
      <span className="sr-only">Toggle Dark Mode</span>
    </button>
  );
};

export default DarkModeToggle;
