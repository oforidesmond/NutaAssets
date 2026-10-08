"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  Columns3,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/assets/status-badge";
import { DynamicField } from "@/components/forms/dynamic-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cfColumnId, readCustomFieldsJson } from "@/lib/custom-fields";
import { buildAssetsCsv, downloadCsv } from "@/lib/export/csv";
import { downloadLabelSheet } from "@/lib/export/labels";
import { downloadAssetsPdf } from "@/lib/export/pdf";
import { downloadAssetsXlsx } from "@/lib/export/xlsx";
import { ALL_ASSET_COLUMNS } from "@/schemas/asset";
import {
  assignAssetAction,
  bulkAssetsAction,
  changeStatusAction,
  deleteAssetAction,
  deleteViewAction,
  duplicateAssetAction,
  exportAssetsAction,
  saveViewAction,
  transferAssetAction,
} from "@/server/actions/assets";
import type { FieldType } from "@prisma/client";
import { Download } from "lucide-react";

export type AssetRow = {
  id: string;
  assetTag: string | null;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  assignedToText: string | null;
  condition: string | null;
  remarks: string | null;
  needsReview: boolean;
  updatedAt: string | Date;
  customFields?: unknown;
  category: { id: string; name: string };
  branch: { id: string; name: string };
  location: { id: string; name: string } | null;
  status: { id: string; name: string; color: string };
};

export type TableFieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options: unknown;
  showInList: boolean;
  searchable: boolean;
  categoryId: string | null;
};

type FilterOption = { id: string; name: string };
type SavedView = {
  id: string;
  name: string;
  filters: unknown;
  columns: unknown;
  sort: unknown;
};

type Props = {
  rows: AssetRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  columns: string[];
  canMutate: boolean;
  canExport?: boolean;
  branches: FilterOption[];
  categories: FilterOption[];
  statuses: (FilterOption & { color: string })[];
  fieldDefs?: TableFieldDef[];
  savedViews: SavedView[];
  departmentId: string | null;
};

const COLUMN_LABELS: Record<string, string> = {
  assetTag: "Tag",
  category: "Category",
  brand: "Brand",
  model: "Model",
  serialNumber: "Serial",
  status: "Status",
  branch: "Branch",
  location: "Location",
  assignedToText: "Assigned to",
  condition: "Condition",
  remarks: "Remarks",
  needsReview: "Review",
  updatedAt: "Updated",
};

export function AssetsTable({
  rows,
  total,
  page,
  pageSize,
  pageCount,
  columns: visibleColumns,
  canMutate,
  canExport = true,
  branches,
  categories,
  statuses,
  fieldDefs = [],
  savedViews,
  departmentId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [bulkOpen, setBulkOpen] = useState<
    null | "status" | "transfer" | "assign" | "category" | "remark" | "delete"
  >(null);
  const [bulkStatusId, setBulkStatusId] = useState("");
  const [bulkBranchId, setBulkBranchId] = useState("");
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [bulkRemark, setBulkRemark] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [rowAction, setRowAction] = useState<{
    id: string;
    type: "status" | "transfer" | "assign";
  } | null>(null);

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "" || value === "__all") params.delete(key);
      else params.set(key, value);
    }
    if (!("page" in updates)) params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  const selectedIds = useMemo(
    () =>
      Object.keys(rowSelection)
        .filter((k) => rowSelection[k])
        .map((index) => rows[Number(index)]?.id)
        .filter(Boolean) as string[],
    [rowSelection, rows],
  );

  const columnDefs = useMemo<ColumnDef<AssetRow>[]>(() => {
    const cols: ColumnDef<AssetRow>[] = [];
    if (canMutate) {
      cols.push({
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
      });
    }

    const map: Record<string, ColumnDef<AssetRow>> = {
      assetTag: {
        accessorKey: "assetTag",
        header: "Tag",
        cell: ({ row }) => (
          <Link
            href={`/assets/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.assetTag ?? "—"}
          </Link>
        ),
      },
      category: {
        id: "category",
        header: "Category",
        cell: ({ row }) => row.original.category.name,
      },
      brand: { accessorKey: "brand", header: "Brand", cell: ({ getValue }) => (getValue() as string) ?? "—" },
      model: { accessorKey: "model", header: "Model", cell: ({ getValue }) => (getValue() as string) ?? "—" },
      serialNumber: {
        accessorKey: "serialNumber",
        header: "Serial",
        cell: ({ getValue }) => (getValue() as string) ?? "—",
      },
      status: {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            name={row.original.status.name}
            color={row.original.status.color}
          />
        ),
      },
      branch: {
        id: "branch",
        header: "Branch",
        cell: ({ row }) => row.original.branch.name,
      },
      location: {
        id: "location",
        header: "Location",
        cell: ({ row }) => row.original.location?.name ?? "—",
      },
      assignedToText: {
        accessorKey: "assignedToText",
        header: "Assigned to",
        cell: ({ getValue }) => (getValue() as string) ?? "—",
      },
      condition: {
        accessorKey: "condition",
        header: "Condition",
        cell: ({ getValue }) => (getValue() as string) ?? "—",
      },
      remarks: {
        accessorKey: "remarks",
        header: "Remarks",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          if (!v) return "—";
          return v.length > 40 ? `${v.slice(0, 40)}…` : v;
        },
      },
      needsReview: {
        accessorKey: "needsReview",
        header: "Review",
        cell: ({ getValue }) =>
          getValue() ? (
            <Badge variant="destructive">Needs review</Badge>
          ) : (
            "—"
          ),
      },
      updatedAt: {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ getValue }) =>
          new Date(getValue() as string).toLocaleDateString("en-GB"),
      },
    };

    for (const def of fieldDefs) {
      const colId = cfColumnId(def.key);
      map[colId] = {
        id: colId,
        header: def.label,
        cell: ({ row }) => {
          const cf = readCustomFieldsJson(row.original.customFields);
          return (
            <DynamicField
              field={def}
              value={cf[def.key]}
              mode="cell"
            />
          );
        },
      };
    }

    for (const key of visibleColumns) {
      if (map[key]) cols.push(map[key]);
    }

    cols.push({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/assets/${row.original.id}`}>View</Link>
            </DropdownMenuItem>
            {canMutate && (
              <>
                <DropdownMenuItem asChild>
                  <Link href={`/assets/${row.original.id}/edit`}>Edit</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    startTransition(async () => {
                      const res = await duplicateAssetAction(row.original.id);
                      if (!res.ok) toast.error(res.error);
                      else {
                        toast.success("Duplicated");
                        router.push(`/assets/${res.data?.id}/edit`);
                      }
                    })
                  }
                >
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    setRowAction({ id: row.original.id, type: "status" })
                  }
                >
                  Change status
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setRowAction({ id: row.original.id, type: "transfer" })
                  }
                >
                  Transfer
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setRowAction({ id: row.original.id, type: "assign" })
                  }
                >
                  Assign
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => {
                    if (!confirm("Move this asset to the recycle bin?")) return;
                    startTransition(async () => {
                      const res = await deleteAssetAction(row.original.id);
                      if (!res.ok) toast.error(res.error);
                      else {
                        toast.success("Moved to recycle bin");
                        router.refresh();
                      }
                    });
                  }}
                >
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    });

    return cols;
  }, [canMutate, visibleColumns, fieldDefs, router]);

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
  });

  function runBulk() {
    if (selectedIds.length === 0 || !bulkOpen) return;
    const mode = bulkOpen;
    startTransition(async () => {
      if (mode === "delete") {
        const res = await bulkAssetsAction({
          ids: selectedIds,
          action: "soft_delete",
        });
        if (!res.ok) toast.error(res.error);
        else {
          toast.success(`Deleted ${res.data?.processed} asset(s)`);
          setRowSelection({});
          setBulkOpen(null);
          router.refresh();
        }
        return;
      }

      const actionMap = {
        status: "change_status",
        transfer: "transfer",
        assign: "assign",
        category: "set_category",
        remark: "add_remark",
      } as const;

      const res = await bulkAssetsAction({
        ids: selectedIds,
        action: actionMap[mode],
        statusId: bulkStatusId || undefined,
        branchId: bulkBranchId || undefined,
        categoryId: bulkCategoryId || undefined,
        assignedToText: bulkAssignee,
        remark: bulkRemark,
        note: bulkNote,
      });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(`Updated ${res.data?.processed} asset(s)`);
        setBulkOpen(null);
        setRowSelection({});
        router.refresh();
      }
    });
  }

  function runRowAction() {
    if (!rowAction) return;
    startTransition(async () => {
      let res;
      if (rowAction.type === "status") {
        res = await changeStatusAction({
          assetId: rowAction.id,
          statusId: bulkStatusId,
          note: bulkNote,
        });
      } else if (rowAction.type === "transfer") {
        res = await transferAssetAction({
          assetId: rowAction.id,
          branchId: bulkBranchId,
          note: bulkNote,
        });
      } else {
        res = await assignAssetAction({
          assetId: rowAction.id,
          assignedToText: bulkAssignee,
          note: bulkNote,
        });
      }
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Updated");
        setRowAction(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search tag, serial, brand…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") updateParams({ q: search || null });
              }}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => updateParams({ q: search || null })}
          >
            Search
          </Button>
          <Select
            value={searchParams.get("branchId") ?? "__all"}
            onValueChange={(v) => updateParams({ branchId: v })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={searchParams.get("categoryId") ?? "__all"}
            onValueChange={(v) => updateParams({ categoryId: v })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={searchParams.get("statusId") ?? "__all"}
            onValueChange={(v) => updateParams({ statusId: v })}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={searchParams.get("needsReview") ?? "__all"}
            onValueChange={(v) => updateParams({ needsReview: v })}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Review" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Any review</SelectItem>
              <SelectItem value="1">Needs review</SelectItem>
              <SelectItem value="0">Clean</SelectItem>
            </SelectContent>
          </Select>
          {fieldDefs.slice(0, 4).map((def) => (
            <div key={def.key} className="min-w-[140px] max-w-[180px]">
              <DynamicField
                field={def}
                mode="filter"
                value={searchParams.get(`cf_${def.key}`) ?? ""}
                onChange={(v) =>
                  updateParams({
                    [`cf_${def.key}`]:
                      v == null || v === "" ? null : String(v),
                  })
                }
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={pending}>
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>
                  {selectedIds.length > 0
                    ? `Selection (${selectedIds.length})`
                    : "Current filters"}
                </DropdownMenuLabel>
                {(
                  [
                    ["csv", "CSV"],
                    ["xlsx", "Excel (.xlsx)"],
                    ["pdf", "PDF"],
                    ["labels", "QR label sheet"],
                  ] as const
                ).map(([fmt, label]) => (
                  <DropdownMenuItem
                    key={fmt}
                    onClick={() =>
                      startTransition(async () => {
                        const filters: Record<string, string> = {};
                        searchParams.forEach((v, k) => {
                          if (
                            k !== "page" &&
                            k !== "pageSize" &&
                            k !== "columns"
                          ) {
                            filters[k] = v;
                          }
                        });
                        const res = await exportAssetsAction({
                          filters,
                          columns: visibleColumns,
                          ids:
                            selectedIds.length > 0 ? selectedIds : undefined,
                        });
                        if (!res.ok || !res.data) {
                          toast.error(res.error ?? "Export failed");
                          return;
                        }
                        const stamp = new Date().toISOString().slice(0, 10);
                        try {
                          if (fmt === "csv") {
                            downloadCsv(
                              `assets-${stamp}.csv`,
                              buildAssetsCsv(
                                res.data.rows,
                                res.data.columns,
                                res.data.fieldDefs,
                              ),
                            );
                          } else if (fmt === "xlsx") {
                            await downloadAssetsXlsx(
                              `assets-${stamp}.xlsx`,
                              res.data.rows,
                              res.data.columns,
                              res.data.fieldDefs,
                            );
                          } else if (fmt === "pdf") {
                            downloadAssetsPdf(
                              `assets-${stamp}.pdf`,
                              res.data.rows,
                              res.data.columns,
                              res.data.fieldDefs,
                            );
                          } else {
                            await downloadLabelSheet(
                              `labels-${stamp}.pdf`,
                              res.data.rows,
                              { baseUrl: window.location.origin },
                            );
                          }
                          toast.success(
                            `Exported ${res.data.rows.length} row(s)`,
                          );
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Export failed",
                          );
                        }
                      })
                    }
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Views
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Saved views</DropdownMenuLabel>
              {savedViews.length === 0 && (
                <DropdownMenuItem disabled>No saved views</DropdownMenuItem>
              )}
              {savedViews.map((view) => (
                <DropdownMenuItem
                  key={view.id}
                  onClick={() => {
                    const filters = (view.filters ?? {}) as Record<
                      string,
                      string
                    >;
                    const cols = Array.isArray(view.columns)
                      ? (view.columns as string[]).join(",")
                      : null;
                    const params = new URLSearchParams();
                    for (const [k, v] of Object.entries(filters)) {
                      if (v) params.set(k, String(v));
                    }
                    if (cols) params.set("columns", cols);
                    router.push(`${pathname}?${params.toString()}`);
                  }}
                >
                  {view.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSaveViewOpen(true)}>
                Save current view…
              </DropdownMenuItem>
              {savedViews.map((view) => (
                <DropdownMenuItem
                  key={`del-${view.id}`}
                  className="text-destructive"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteViewAction(view.id);
                      toast.success("View deleted");
                      router.refresh();
                    })
                  }
                >
                  Delete “{view.name}”
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 w-52 overflow-y-auto">
              {ALL_ASSET_COLUMNS.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col}
                  checked={visibleColumns.includes(col)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...visibleColumns, col]
                      : visibleColumns.filter((c) => c !== col);
                    updateParams({
                      columns: next.length ? next.join(",") : null,
                    });
                  }}
                >
                  {COLUMN_LABELS[col] ?? col}
                </DropdownMenuCheckboxItem>
              ))}
              {fieldDefs.filter((f) => f.showInList).length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Custom fields</DropdownMenuLabel>
                  {fieldDefs
                    .filter((f) => f.showInList)
                    .map((def) => {
                      const colId = cfColumnId(def.key);
                      return (
                        <DropdownMenuCheckboxItem
                          key={colId}
                          checked={visibleColumns.includes(colId)}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...visibleColumns, colId]
                              : visibleColumns.filter((c) => c !== colId);
                            updateParams({
                              columns: next.length ? next.join(",") : null,
                            });
                          }}
                        >
                          {def.label}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {canMutate && (
            <Button size="sm" asChild>
              <Link href="/assets/new">
                <Plus className="h-4 w-4" />
                Add asset
              </Link>
            </Button>
          )}
        </div>
      </div>

      {selectedIds.length > 0 && canMutate && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{selectedIds.length} selected</span>
          <Button size="sm" variant="outline" onClick={() => setBulkOpen("status")}>
            Status
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBulkOpen("transfer")}>
            Transfer
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBulkOpen("assign")}>
            Assign
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBulkOpen("category")}>
            Category
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBulkOpen("remark")}>
            Remark
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setBulkOpen("delete")}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnDefs.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No assets match these filters.{" "}
                  {canMutate && (
                    <Link href="/assets/new" className="text-primary underline">
                      Add the first one
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            No assets found.
          </p>
        ) : (
          rows.map((asset) => (
            <Link
              key={asset.id}
              href={`/assets/${asset.id}`}
              className="block rounded-lg border p-4 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {asset.assetTag ?? "No tag"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {asset.category.name}
                    {asset.brand ? ` · ${asset.brand}` : ""}
                  </div>
                </div>
                <StatusBadge
                  name={asset.status.name}
                  color={asset.status.color}
                />
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {asset.branch.name}
                {asset.assignedToText ? ` · ${asset.assignedToText}` : ""}
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {total} asset{total === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => updateParams({ page: String(page - 1) })}
          >
            Previous
          </Button>
          <span>
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => updateParams({ page: String(page + 1) })}
          >
            Next
          </Button>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => updateParams({ pageSize: v, page: "1" })}
          >
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}/page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk dialog */}
      <Dialog
        open={!!bulkOpen}
        onOpenChange={(v) => {
          if (!v) setBulkOpen(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkOpen === "delete"
                ? `Delete ${selectedIds.length} asset(s)?`
                : `Bulk ${bulkOpen}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {bulkOpen === "status" && (
              <>
                <Label>Status</Label>
                <Select value={bulkStatusId} onValueChange={setBulkStatusId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label>Note (required for Faulty / Disposed / etc.)</Label>
                <Input
                  value={bulkNote}
                  onChange={(e) => setBulkNote(e.target.value)}
                />
              </>
            )}
            {bulkOpen === "transfer" && (
              <>
                <Label>Branch</Label>
                <Select value={bulkBranchId} onValueChange={setBulkBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            {bulkOpen === "assign" && (
              <>
                <Label>Assigned to</Label>
                <Input
                  value={bulkAssignee}
                  onChange={(e) => setBulkAssignee(e.target.value)}
                />
              </>
            )}
            {bulkOpen === "category" && (
              <>
                <Label>Category</Label>
                <Select
                  value={bulkCategoryId}
                  onValueChange={setBulkCategoryId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            {bulkOpen === "remark" && (
              <>
                <Label>Remark</Label>
                <Input
                  value={bulkRemark}
                  onChange={(e) => setBulkRemark(e.target.value)}
                />
              </>
            )}
            {bulkOpen === "delete" && (
              <p className="text-sm text-muted-foreground">
                Assets will be moved to the recycle bin and can be restored.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(null)}>
              Cancel
            </Button>
            <Button onClick={runBulk} disabled={pending}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Row action dialog */}
      <Dialog
        open={!!rowAction}
        onOpenChange={(v) => {
          if (!v) setRowAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rowAction?.type === "status"
                ? "Change status"
                : rowAction?.type === "transfer"
                  ? "Transfer"
                  : "Assign"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {rowAction?.type === "status" && (
              <>
                <Select value={bulkStatusId} onValueChange={setBulkStatusId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Note"
                  value={bulkNote}
                  onChange={(e) => setBulkNote(e.target.value)}
                />
              </>
            )}
            {rowAction?.type === "transfer" && (
              <Select value={bulkBranchId} onValueChange={setBulkBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {rowAction?.type === "assign" && (
              <Input
                placeholder="Assigned to"
                value={bulkAssignee}
                onChange={(e) => setBulkAssignee(e.target.value)}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRowAction(null)}>
              Cancel
            </Button>
            <Button onClick={runRowAction} disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Name</Label>
            <Input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="Faulty laptops at Barekese"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveViewOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || !viewName.trim()}
              onClick={() =>
                startTransition(async () => {
                  const filters: Record<string, string> = {};
                  for (const key of [
                    "q",
                    "branchId",
                    "categoryId",
                    "statusId",
                    "needsReview",
                    "hasTag",
                    "hasSerial",
                    "brand",
                    "assignedTo",
                    "condition",
                  ]) {
                    const v = searchParams.get(key);
                    if (v) filters[key] = v;
                  }
                  const res = await saveViewAction({
                    name: viewName,
                    departmentId,
                    filters,
                    columns: visibleColumns,
                    sort: {
                      id: searchParams.get("sort") ?? "updatedAt",
                      desc: searchParams.get("sortDir") !== "asc",
                    },
                  });
                  if (!res.ok) toast.error(res.error);
                  else {
                    toast.success("View saved");
                    setSaveViewOpen(false);
                    setViewName("");
                    router.refresh();
                  }
                })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
