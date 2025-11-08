import { useEffect, useState, useCallback } from "react";
import type { ChildDTO, ChildrenListResponseDTO } from "../../types";
import type { ChildViewModel } from "./types";

// Derive human readable age from birth_date (YYYY-MM-DD). For now simple year diff; can refine later.
function calculateAgeLabel(birthDateIso: string): string {
  if (!birthDateIso) return "";
  const birth = new Date(birthDateIso);
  if (isNaN(birth.getTime())) return "";
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) years -= 1;
  return `${years} ${years === 1 ? "rok" : years >= 2 && years <= 4 ? "lata" : "lat"}`;
}

function mapChildDto(dto: ChildDTO): ChildViewModel {
  return {
    id: dto.id,
    fullName: `${dto.first_name} ${dto.last_name}`.trim(),
    age: calculateAgeLabel(dto.birth_date),
    description: dto.description ?? null,
  };
}

interface UseChildrenResult {
  children: ChildViewModel[];
  loading: boolean;
  error?: string;
  refetch: () => void;
}

export function useChildren(): UseChildrenResult {
  const [children, setChildren] = useState<ChildViewModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>();

  const fetchChildren = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch("/api/children");
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Brak uprawnień do pobrania listy dzieci");
        }
        throw new Error("Nie udało się pobrać listy dzieci");
      }
      const data: ChildrenListResponseDTO = await res.json();
      const mapped = data.children.map(mapChildDto);
      setChildren(mapped);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Nieznany błąd");
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  return { children, loading, error, refetch: fetchChildren };
}

// Export helpers for testing.
export const __internal = { calculateAgeLabel, mapChildDto };
