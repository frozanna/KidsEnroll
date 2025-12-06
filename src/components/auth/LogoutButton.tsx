import * as React from "react";
import { Button } from "@/components/ui/button";

export const LogoutButton: React.FC<{ redirectTo?: string; className?: string }> = ({
  redirectTo = "/auth/login",
  className,
}) => {
  const [loading, setLoading] = React.useState(false);

  async function onClick() {
    try {
      setLoading(true);
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore error in MVP
    } finally {
      setLoading(false);
      window.location.href = redirectTo;
    }
  }

  return (
    <Button variant="outline" onClick={onClick} className={className} disabled={loading}>
      Wyloguj
    </Button>
  );
};

export default LogoutButton;
