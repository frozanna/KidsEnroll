import type { ParentListItemDTO } from "@/types";
import { Button } from "@/components/ui/button";

interface ParentRowProps {
  item: ParentListItemDTO;
}

export default function ParentRow({ item }: ParentRowProps) {
  const onDetails = () => {
    window.location.href = `/admin/parents/${item.id}`;
  };

  return (
    <tr className="border-t">
      <td className="px-3 py-2">{item.email ?? "—"}</td>
      <td className="px-3 py-2">{item.first_name}</td>
      <td className="px-3 py-2">{item.last_name}</td>
      <td className="px-3 py-2">{item.children_count}</td>
      <td className="px-3 py-2">{new Date(item.created_at).toLocaleString()}</td>
      <td className="px-3 py-2 text-right">
        <Button size="sm" onClick={onDetails}>
          Szczegóły
        </Button>
      </td>
    </tr>
  );
}
