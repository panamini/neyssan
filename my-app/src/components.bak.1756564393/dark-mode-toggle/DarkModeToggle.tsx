"use client";

import * as React from "react";
import { Sun, MoonStar } from "lucide-react";

const DarkModeToggle = () => {
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

  return (
    <button
      onClick={onThemeChange}
      className="p-2 mt-4 transition-colors rounded-lg focus:outline-none hover:bg-gray-100 dark:hover:bg-gray-700"
      aria-pressed={isDarkTheme}
    >
      {isDarkTheme ? (
        <MoonStar className="w-5 h-5 text-gray-100" />
      ) : (
        <Sun className="w-5 h-5 text-gray-800" />
      )}
      <span className="sr-only">Toggle Dark Mode</span>
    </button>
  );
};

export default DarkModeToggle;
