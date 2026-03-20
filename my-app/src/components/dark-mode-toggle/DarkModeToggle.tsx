"use client";

import * as React from "react";
import { Sun, MoonStar } from "lucide-react";

interface DarkModeToggleProps {
  /** When true, renders a bare 16×16 icon button (no padding, no hover bg)
   *  for embedding inside the sidebar's 16px icon slot. */
  compact?: boolean;
}

const DarkModeToggle = ({ compact = false }: DarkModeToggleProps) => {
  // Initialize state from localStorage, then system preference
  const [isDarkTheme, setIsDarkTheme] = React.useState(() => {
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
        className="w-4 h-4 p-0 flex items-center justify-center bg-transparent border-0 cursor-pointer focus:outline-none"
        style={{ color: "var(--tg2)" }}
        aria-pressed={isDarkTheme}
      >
        {isDarkTheme ? (
          <MoonStar className="w-4 h-4" aria-hidden />
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
      className="p-2 rounded-rs focus:outline-none hover:[background:var(--sf2)] [transition:all_.12s_var(--ez)]"
      aria-pressed={isDarkTheme}
    >
      {isDarkTheme ? (
        <MoonStar className="w-4 h-4 text-tg2" />
      ) : (
        <Sun className="w-4 h-4 text-tg2" />
      )}
      <span className="sr-only">Toggle Dark Mode</span>
    </button>
  );
};

export default DarkModeToggle;
