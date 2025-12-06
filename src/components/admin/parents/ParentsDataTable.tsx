import type { ParentListItemDTO } from "@/types";
import ParentRow from "./ParentRow";

interface ParentsDataTableProps {
  data: ParentListItemDTO[];
  loading: boolean;
  error?: string;
}

export default function ParentsDataTable({ data, loading, error }: ParentsDataTableProps) {
  if (loading) {
    return <div className="text-sm text-muted-foreground">Ładowanie...</div>;
  }
  if (error) {
    return <div className="text-sm text-red-600">Błąd: {error}</div>;
  }
  if (!data.length) {
    return <div className="text-sm">Brak wyników</div>;
  }

  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-3 py-2">Email</th>
            <th className="text-left px-3 py-2">Imię</th>
            <th className="text-left px-3 py-2">Nazwisko</th>
            <th className="text-left px-3 py-2">Dzieci</th>
            <th className="text-left px-3 py-2">Data utworzenia</th>
            <th className="text-right px-3 py-2">Akcje</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <ParentRow key={item.id} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
