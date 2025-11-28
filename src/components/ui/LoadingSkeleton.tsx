import React from "react";

export const LoadingSkeleton: React.FC = () => {
  return (
    <div className="space-y-2" aria-label="Ładowanie">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-8 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
      ))}
    </div>
  );
};
