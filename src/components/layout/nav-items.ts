import {
  LayoutDashboard,
  Package,
  ClipboardCheck,
  FileBarChart,
  Upload,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const mainNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Assets", href: "/assets", icon: Package },
  { title: "Reconciliation", href: "/reconciliation", icon: ClipboardCheck },
  { title: "Reports", href: "/reports", icon: FileBarChart },
  { title: "Import / Export", href: "/import", icon: Upload },
  { title: "Admin", href: "/admin", icon: Settings, adminOnly: true },
];
