import { Badge } from "@/components/ui/badge";

const LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Returned",
};

const VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  NOT_STARTED: "outline",
  IN_PROGRESS: "secondary",
  SUBMITTED: "default",
  APPROVED: "default",
  REJECTED: "destructive",
};

export function EntryStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={VARIANTS[status] ?? "outline"}>
      {LABELS[status] ?? status}
    </Badge>
  );
}

export function ExerciseStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    DRAFT: "outline",
    IN_PROGRESS: "secondary",
    COMPLETED: "default",
    CANCELLED: "destructive",
  };
  return (
    <Badge variant={variants[status] ?? "outline"}>
      {labels[status] ?? status}
    </Badge>
  );
}
