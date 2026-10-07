"use client";

import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setDepartmentAction } from "@/server/actions/department";

type Dept = { id: string; name: string; code: string };

export function DepartmentSwitcher({
  departments,
  selected,
}: {
  departments: Dept[];
  selected: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const label =
    selected === "all"
      ? "All my departments"
      : (departments.find((d) => d.id === selected)?.name ?? "Department");

  function select(value: string) {
    startTransition(async () => {
      await setDepartmentAction(value);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="max-w-[220px] justify-between gap-2"
          disabled={pending}
        >
          <Building2 className="size-4 shrink-0" />
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Department</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => select("all")}>
          <span className="flex-1">All my departments</span>
          {selected === "all" && <Check className="size-4" />}
        </DropdownMenuItem>
        {departments.map((dept) => (
          <DropdownMenuItem key={dept.id} onClick={() => select(dept.id)}>
            <span className="flex-1">
              {dept.name}{" "}
              <span className="text-muted-foreground">({dept.code})</span>
            </span>
            {selected === dept.id && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
