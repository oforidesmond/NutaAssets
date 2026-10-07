import { Badge } from "@/components/ui/badge";

export function StatusBadge({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  return (
    <Badge
      className="font-normal"
      style={{
        backgroundColor: color,
        color: "#fff",
        borderColor: "transparent",
      }}
    >
      {name}
    </Badge>
  );
}
