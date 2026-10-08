"use client";

import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ReconExercisePicker({
  exercises,
  selectedId,
}: {
  exercises: { id: string; name: string }[];
  selectedId: string | null;
}) {
  const router = useRouter();

  return (
    <div className="print:hidden flex flex-wrap items-center gap-2">
      <Select
        value={selectedId ?? undefined}
        onValueChange={(id) => {
          router.push(`/reports/reconciliation?exerciseId=${id}`);
        }}
        disabled={exercises.length === 0}
      >
        <SelectTrigger className="w-[260px]">
          <SelectValue placeholder="Select exercise" />
        </SelectTrigger>
        <SelectContent>
          {exercises.map((ex) => (
            <SelectItem key={ex.id} value={ex.id}>
              {ex.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => window.print()}
      >
        <Printer className="size-4" />
        Print
      </Button>
    </div>
  );
}
