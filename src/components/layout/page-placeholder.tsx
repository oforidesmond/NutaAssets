import { type LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PagePlaceholder({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This screen is a Phase 1 placeholder. Full functionality arrives in a
          later phase.
        </p>
      </CardContent>
    </Card>
  );
}
