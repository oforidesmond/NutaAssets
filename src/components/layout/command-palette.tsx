"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  ClipboardCheck,
  FileBarChart,
  HelpCircle,
  LayoutDashboard,
  Package,
  Search,
  Settings,
  ShieldAlert,
  Upload,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { can, type AuthUser } from "@/lib/authorize";
import { searchAssetsAction } from "@/server/actions/search";

type AssetHit = {
  id: string;
  assetTag: string | null;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  category: { name: string };
  branch: { name: string };
};

const PAGES = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Assets", href: "/assets", icon: Package },
  { title: "Needs review", href: "/assets/needs-review", icon: ShieldAlert },
  { title: "Add asset", href: "/assets/new", icon: Package },
  { title: "Reconciliation", href: "/reconciliation", icon: ClipboardCheck },
  { title: "Reports", href: "/reports", icon: FileBarChart },
  { title: "Import / Export", href: "/import", icon: Upload },
  { title: "Help", href: "/help", icon: HelpCircle },
];

const ADMIN_PAGES = [
  { title: "Admin home", href: "/admin", icon: Settings },
  { title: "Branches", href: "/admin/branches", icon: Settings },
  { title: "Categories", href: "/admin/categories", icon: Settings },
  { title: "Statuses", href: "/admin/statuses", icon: Settings },
  { title: "Custom fields", href: "/admin/fields", icon: Settings },
  { title: "Users", href: "/admin/users", icon: Settings },
  { title: "Settings", href: "/admin/settings", icon: Settings },
];

export function CommandPalette({ user }: { user: AuthUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AssetHit[]>([]);
  const [pending, startTransition] = useTransition();
  const showAdmin = can(user, "admin");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounced asset search — setState only inside the async timeout callback
  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) return;

    const handle = setTimeout(() => {
      startTransition(async () => {
        const res = await searchAssetsAction(term);
        if (res.ok && res.data) setHits(res.data);
        else setHits([]);
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setHits([]);
    }
  }, []);

  const onQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setHits([]);
    }
  }, []);

  const go = useCallback(
    (href: string) => {
      handleOpenChange(false);
      router.push(href);
    },
    [router, handleOpenChange],
  );

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="hidden h-9 gap-2 text-muted-foreground md:inline-flex"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Control+K Meta+K"
        aria-label="Open command palette"
      >
        <span className="text-sm">Search…</span>
        <kbd className="pointer-events-none rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
          {isMac ? "⌘" : "Ctrl"}K
        </kbd>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Search"
      >
        <Search className="size-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <CommandInput
          placeholder="Search assets or jump to a page…"
          value={query}
          onValueChange={onQueryChange}
        />
        <CommandList>
          <CommandEmpty>
            {pending ? "Searching…" : "No results found."}
          </CommandEmpty>

          {hits.length > 0 ? (
            <CommandGroup heading="Assets">
              {hits.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`${a.assetTag ?? ""} ${a.serialNumber ?? ""} ${a.brand ?? ""} ${a.model ?? ""} ${a.id}`}
                  onSelect={() => go(`/assets/${a.id}`)}
                >
                  <Package className="size-4 shrink-0 opacity-70" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {a.assetTag ?? "No tag"} · {a.category.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.branch.name}
                      {a.serialNumber ? ` · ${a.serialNumber}` : ""}
                      {a.brand ? ` · ${a.brand}` : ""}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          <CommandGroup heading="Pages">
            {PAGES.map((p) => (
              <CommandItem
                key={p.href}
                value={p.title}
                onSelect={() => go(p.href)}
              >
                <p.icon className="size-4 opacity-70" />
                {p.title}
              </CommandItem>
            ))}
          </CommandGroup>

          {showAdmin ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Admin">
                {ADMIN_PAGES.map((p) => (
                  <CommandItem
                    key={p.href}
                    value={`admin ${p.title}`}
                    onSelect={() => go(p.href)}
                  >
                    <p.icon className="size-4 opacity-70" />
                    {p.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
