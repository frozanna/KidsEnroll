import { useEffect, useState } from "react";
import type { ParentDetailDTO } from "@/types";
import { Button } from "@/components/ui/button";

interface ParentDetailPageProps {
  parentId: string;
}

export default function ParentDetailPage({ parentId }: ParentDetailPageProps) {
  const [data, setData] = useState<ParentDetailDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    fetch(`/api/admin/parents/${parentId}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message || `Błąd ${res.status}`);
        }
        return res.json() as Promise<ParentDetailDTO>;
      })
      .then((detail) => setData(detail))
      .catch((e) => {
        if (!controller.signal.aborted) setError(e?.message || "Nieznany błąd");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [parentId]);

  if (loading) return <div className="text-sm text-muted-foreground">Ładowanie...</div>;
  if (error) return <div className="text-sm text-red-600">Błąd: {error}</div>;
  if (!data) return <div className="text-sm">Rodzic nie znaleziony</div>;

  return (
    <section className="space-y-4">
      <Button variant="link" onClick={() => (window.location.href = "/admin/parents")}>
        ← Wróć do listy
      </Button>
      <div className="border rounded-md p-4">
        <h2 className="text-xl font-semibold">
          {data.first_name} {data.last_name}
        </h2>
        <p className="text-sm text-muted-foreground">Email: {data.email ?? "—"}</p>
        <p className="text-sm text-muted-foreground">Utworzono: {new Date(data.created_at).toLocaleString()}</p>
        <h3 className="mt-4 font-medium">Dzieci</h3>
        <ul className="mt-2 space-y-2">
          {data.children?.length ? (
            data.children.map((c) => (
              <li className="border rounded-md p-3" key={c.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {c.first_name} {c.last_name}
                    </div>
                    <div className="text-sm text-muted-foreground">Data urodzenia: {c.birth_date}</div>
                  </div>
                  <div className="text-sm">Ilość zapisów na zajęcia: {c.enrollments_count ?? 0}</div>
                </div>
              </li>
            ))
          ) : (
            <li className="text-sm">Brak dzieci</li>
          )}
        </ul>
      </div>
    </section>
  );
}
