import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ParentNavbarProps {
  activeTabLabel?: string;
}

export const ParentNavbar: React.FC<ParentNavbarProps> = ({ activeTabLabel }) => {
  return (
    <header
      className={cn("sticky top-0 z-30 w-full border-b border-border bg-primary text-primary-foreground shadow-sm")}
      role="banner"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Button
          variant="ghost"
          className="px-0 text-base font-semibold text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
          asChild
        >
          <a href="/app/dashboard" aria-label="Przejdź do panelu rodzica">
            EnrollKids
          </a>
        </Button>
        <div className="flex items-center gap-3">
          {activeTabLabel ? (
            <p className="text-sm font-medium opacity-90" aria-live="polite">
              {activeTabLabel}
            </p>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full border border-primary-foreground/20 bg-primary/40 hover:bg-primary/60"
            asChild
          >
            <a href="/app/profil" aria-label="Przejdź do profilu rodzica">
              <span aria-hidden="true" className="text-lg leading-none">
                👤
              </span>
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default ParentNavbar;
