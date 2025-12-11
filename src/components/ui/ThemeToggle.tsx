"use client";

import React from "react";

interface ThemeToggleProps {
  variant?: "primary" | "secondary";
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = "primary" }) => {
  const [isDark, setIsDark] = React.useState<boolean>(false);

  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    const prefersDark =
      typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldDark = stored ? stored === "dark" : prefersDark;
    setIsDark(shouldDark);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", shouldDark);
    }
  }, []);

  const toggleTheme = React.useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", next);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("theme", next ? "dark" : "light");
      }
      return next;
    });
  }, []);

  const baseClasses =
    "h-8 w-8 rounded-fullM border px-0 text-sm font-medium flex items-center justify-center transition-colors";
  const variantClasses =
    variant === "secondary"
      ? "border-secondary-foreground/20 bg-secondary/40 hover:bg-secondary/60 text-secondary-foreground"
      : "border-primary-foreground/20 bg-primary/40 hover:bg-primary/60 text-primary-foreground";

  return (
    <button
      type="button"
      className={`${baseClasses} ${variantClasses}`}
      aria-label={isDark ? "Przełącz na jasny motyw" : "Przełącz na ciemny motyw"}
      aria-pressed={isDark}
      onClick={toggleTheme}
    >
      <span aria-hidden="true" className="text-lg leading-none">
        {isDark ? "🌙" : "☀️"}
      </span>
    </button>
  );
};

export default ThemeToggle;
