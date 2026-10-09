import Link from "next/link";
import {
  Building2,
  FolderTree,
  ListChecks,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Users,
  Network,
} from "lucide-react";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin" };

const cards = [
  {
    href: "/admin/departments",
    title: "Departments",
    description: "Add departments and clone categories, statuses, and fields.",
    icon: Network,
  },
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
    href: "/admin/fields",
    title: "Custom fields",
    description: "Dynamic fields for forms, filters, table columns, and export.",
    icon: SlidersHorizontal,
  },
  {
    href: "/admin/users",
    title: "Users & roles",
    description: "Invite users, set roles, and scope departments or branches.",
    icon: Users,
  },
  {
    href: "/admin/settings",
    title: "Settings",
    description: "Organisation name, tag template, and placeholder values.",
    icon: Settings2,
  },
  {
    href: "/admin/recycle-bin",
    title: "Recycle bin",
    description: "Restore deleted assets.",
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
