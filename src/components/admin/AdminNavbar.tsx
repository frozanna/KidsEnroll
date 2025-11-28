import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminNavbarProps {
  activeLabel?: string;
}

export const AdminNavbar: React.FC<AdminNavbarProps> = ({ activeLabel }) => {
  return (
    <header
      className={cn("sticky top-0 z-30 w-full border-b border-border bg-secondary text-secondary-foreground shadow-sm")}
      role="banner"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Button
          variant="ghost"
          className="px-0 text-base font-semibold text-secondary-foreground hover:bg-secondary/90 hover:text-secondary-foreground"
          asChild
        >
          <a href="/app/admin/activities" aria-label="Przejdź do panelu administratora">
            EnrollKids Admin
          </a>
        </Button>
        <div className="flex items-center gap-3">
          {activeLabel ? (
            <p className="text-sm font-medium opacity-90" aria-live="polite">
              {activeLabel}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default AdminNavbar;
