import React from "react";
import { Button } from "../../ui/button";

interface AddChildButtonProps {
  onAdd: () => void;
}

// Secondary action: adding a child (uses shared Button component styling)
export const AddChildButton: React.FC<AddChildButtonProps> = ({ onAdd }) => {
  return (
    <Button
      type="button"
      onClick={onAdd}
      variant="secondary"
      size="lg"
      aria-label="Dodaj nowe dziecko"
      data-testid="parent-dashboard-add-child-button"
    >
      Dodaj dziecko
    </Button>
  );
};
