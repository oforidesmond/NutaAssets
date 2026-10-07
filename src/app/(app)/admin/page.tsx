import Link from "next/link";
import {
  Building2,
  FolderTree,
  ListChecks,
  Trash2,
} from "lucide-react";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin" };

const cards = [
  {
    href: "/admin/branches",
    title: "Branches & locations",
    description: "Manage branch codes and sub-locations used on assets.",
    icon: Building2,
  },
  {
    href: "/admin/categories",
    title: "Categories",
    description: "Asset types for the current department (Laptop, Printer…).",
    icon: FolderTree,
  },
  {
    href: "/admin/statuses",
    title: "Statuses",
    description: "Active, Faulty, Disposed, and other lifecycle statuses.",
    icon: ListChecks,
  },
  {
    href: "/admin/recycle-bin",
    title: "Recycle bin",
    description: "Restore soft-deleted assets.",
    icon: Trash2,
  },
];

export default function AdminPage() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="group rounded-lg border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/40"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <card.icon className="h-5 w-5" />
          </div>
          <h2 className="font-medium group-hover:text-primary">{card.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {card.description}
          </p>
        </Link>
      ))}
    </div>
  );
}
