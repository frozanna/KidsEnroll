import React from "react";
import { Button } from "../../ui/button";

interface EnrollActivityButtonProps {
  onNavigate?: () => void; // optional override; defaults to href navigation
}

// Primary CTA for navigating to the activities listing.
export const EnrollActivityButton: React.FC<EnrollActivityButtonProps> = ({ onNavigate }) => {
  const handleClick = () => {
    if (onNavigate) {
      onNavigate();
    } else {
      window.location.href = "/app/zajecia";
    }
  };
  return (
    <Button
      type="button"
      onClick={handleClick}
      variant="default"
      size="lg"
      aria-label="Przejdź do listy zajęć, aby zapisać dziecko"
      data-testid="enroll-activity-button"
    >
      Zapisz na zajęcia
    </Button>
  );
};
