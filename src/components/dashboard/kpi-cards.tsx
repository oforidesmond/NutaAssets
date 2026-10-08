import Link from "next/link";
import {
  AlertTriangle,
  ClipboardList,
  Package,
  ShieldAlert,
  Tag,
  Hash,
  Archive,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Kpis = {
  total: number;
  inUse: number;
  needsAttention: number;
  endOfLife: number;
  needsReview: number;
  missingTag: number;
  missingSerial: number;
  warrantyExpiring: number;
};

const items: {
  key: keyof Kpis;
  label: string;
  href: string;
  icon: typeof Package;
  accent?: string;
}[] = [
  {
    key: "total",
    label: "Total assets",
    href: "/assets",
    icon: Package,
  },
  {
    key: "inUse",
    label: "In use",
    href: "/assets",
    icon: ClipboardList,
    accent: "text-emerald-700 dark:text-emerald-400",
  },
  {
    key: "needsAttention",
    label: "Needs attention",
    href: "/reports/needs-attention",
    icon: AlertTriangle,
    accent: "text-amber-700 dark:text-amber-400",
  },
  {
    key: "endOfLife",
    label: "End of life",
    href: "/reports/needs-attention",
    icon: Archive,
    accent: "text-slate-600 dark:text-slate-300",
  },
  {
    key: "needsReview",
    label: "Needs review",
    href: "/assets/needs-review",
    icon: ShieldAlert,
    accent: "text-rose-700 dark:text-rose-400",
  },
  {
    key: "missingTag",
    label: "Without tag",
    href: "/assets?hasTag=0",
    icon: Tag,
  },
  {
    key: "missingSerial",
    label: "Without serial",
    href: "/assets?hasSerial=0",
    icon: Hash,
  },
];

export function KpiCards({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {items.map(({ key, label, href, icon: Icon, accent }) => (
        <Link key={key} href={href} className="group">
          <Card className="transition-colors group-hover:border-primary/40 group-hover:bg-accent/40">
            <CardContent className="flex items-start gap-3 p-4">
              <div className="rounded-md bg-muted p-2">
                <Icon className={cn("size-4", accent)} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn("text-2xl font-semibold tabular-nums", accent)}>
                  {formatNumber(kpis[key])}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
