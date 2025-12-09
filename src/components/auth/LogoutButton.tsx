import * as React from "react";
import { Button } from "@/components/ui/button";

export const LogoutButton: React.FC<{ redirectTo?: string; className?: string }> = ({
  redirectTo = "/auth/login",
  className,
}) => {
  const [loading, setLoading] = React.useState(false);

  async function onClick() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Niezależnie od wyniku próbujemy przenieść użytkownika na ekran logowania
      setLoading(false);
      window.location.href = redirectTo;
    }
  }

  return (
    <Button variant="destructive" onClick={onClick} className={className} disabled={loading}>
      Wyloguj
    </Button>
  );
};

export default LogoutButton;
