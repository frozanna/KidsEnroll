import React from "react";

export const EmptyState: React.FC<{ message?: string }> = ({ message }) => (
  <div role="status" className="py-10 text-center text-sm text-muted-foreground">
    {message || "Brak dostępnych zajęć"}
  </div>
);
