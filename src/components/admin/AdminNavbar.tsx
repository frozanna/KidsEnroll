import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/auth/LogoutButton";

interface AdminNavbarProps {
  activeLabel?: string;
}

export const AdminNavbar: React.FC<AdminNavbarProps> = ({ activeLabel }) => {
  const [isDark, setIsDark] = React.useState<boolean>(false);

  React.useEffect(() => {
    // Initialize from localStorage or system preference
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

  return (
    <header
      className={cn("sticky top-0 z-30 w-full border-b border-border bg-secondary text-secondary-foreground shadow-sm")}
      role="banner"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="px-0 text-base font-semibold text-secondary-foreground hover:bg-secondary/90 hover:text-secondary-foreground"
            asChild
          >
            <a href="/admin/activities" aria-label="Przejdź do panelu administratora">
              EnrollKids Admin
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full border border-secondary-foreground/20 bg-secondary/40 hover:bg-secondary/60"
            aria-label={isDark ? "Przełącz na jasny motyw" : "Przełącz na ciemny motyw"}
            aria-pressed={isDark}
            onClick={toggleTheme}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              {isDark ? "🌙" : "☀️"}
            </span>
          </Button>
        </div>
        <nav className="flex items-center gap-2" aria-label="Nawigacja administracyjna">
          <Button variant="ghost" className="text-sm font-medium" asChild>
            <a
              href="/admin/activities"
              aria-label="Zarządzaj zajęciami"
              aria-current={activeLabel === "Zajęcia" ? "page" : undefined}
            >
              Zajęcia
            </a>
          </Button>
          <Button variant="ghost" className="text-sm font-medium" asChild>
            <a
              href="/admin/workers"
              aria-label="Zarządzaj opiekunami"
              aria-current={activeLabel === "Opiekunowie" ? "page" : undefined}
            >
              Opiekunowie
            </a>
          </Button>
          <Button variant="ghost" className="text-sm font-medium" asChild>
            <a
              href="/admin/parents"
              aria-label="Zarządzaj rodzicami"
              aria-current={activeLabel === "Rodzice" ? "page" : undefined}
            >
              Rodzice
            </a>
          </Button>
          <LogoutButton redirectTo="/auth/login" />
        </nav>
      </div>
    </header>
  );
};

export default AdminNavbar;
