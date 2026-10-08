"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { autoMapColumns, IMPORT_FIELD_OPTIONS } from "@/lib/import/auto-map";
import { detectHeaderRow } from "@/lib/import/detect-header";
import { extractHeaderBlock } from "@/lib/import/header-block";
import { normaliseSheetRows } from "@/lib/import/normalise-row";
import { parseImportFile } from "@/lib/import/parse-workbook";
import type {
  ColumnMapping,
  DuplicatePolicy,
  DryRunReport,
  HeaderBlockMeta,
  ImportChunkRow,
  ParsedWorkbook,
} from "@/lib/import/types";
import { IMPORT_CHUNK_SIZE } from "@/lib/import/types";
import {
  buildLookupMaps,
  resolveRows,
  validateImportRows,
} from "@/lib/import/validate-rows";
import { cn } from "@/lib/utils";
import {
  findExistingForImportAction,
  getImportContextAction,
  importChunkAction,
  saveMappingTemplateAction,
  startImportJobAction,
} from "@/server/actions/import";
import type { ImportContext } from "@/server/services/import";

const STEPS = [
  "Upload",
  "Sheet",
  "Map",
  "Resolve",
  "Preview",
  "Import",
  "Done",
] as const;

type Step = (typeof STEPS)[number];

type DeptOption = { id: string; name: string; code: string };

type Props = {
  departments: DeptOption[];
  initialDepartmentId: string | null;
};

export function ImportWizard({ departments, initialDepartmentId }: Props) {
  const [step, setStep] = useState<Step>("Upload");
  const [pending, startTransition] = useTransition();

  const [departmentId, setDepartmentId] = useState(
    initialDepartmentId && initialDepartmentId !== "all"
      ? initialDepartmentId
      : (departments[0]?.id ?? ""),
  );
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [sheetName, setSheetName] = useState<string>("");
  const [headerMeta, setHeaderMeta] = useState<HeaderBlockMeta | null>(null);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [context, setContext] = useState<ImportContext | null>(null);
  const [branchOverrideId, setBranchOverrideId] = useState<string>("");
  const [categoryOverrides, setCategoryOverrides] = useState<
    Record<string, string>
  >({});
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, string>
  >({});
  const [duplicatePolicy, setDuplicatePolicy] =
    useState<DuplicatePolicy>("flag");
  const [report, setReport] = useState<DryRunReport | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    flagged: number;
  } | null>(null);
  const [templateName, setTemplateName] = useState("");

  const sheet = useMemo(
    () => workbook?.sheets.find((s) => s.name === sheetName) ?? null,
    [workbook, sheetName],
  );

  const loadContext = useCallback(async (deptId: string) => {
    const res = await getImportContextAction(deptId);
    if (!res.ok || !res.data) {
      toast.error(res.error ?? "Could not load import context");
      return null;
    }
    setContext(res.data);
    return res.data;
  }, []);

  const onFile = async (file: File | null) => {
    if (!file) return;
    try {
      const parsed = await parseImportFile(file);
      setWorkbook(parsed);
      const first = parsed.sheets[0]?.name ?? "";
      setSheetName(first);
      setStep("Sheet");
      toast.success(`Loaded ${parsed.sheets.length} sheet(s)`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not parse file",
      );
    }
  };

  const prepareSheet = async () => {
    if (!sheet || !departmentId) return;
    const detected = detectHeaderRow(sheet.rows);
    setHeaderRowIndex(detected.headerRowIndex);
    setHeaders(detected.headers);
    setHeaderMeta(extractHeaderBlock(sheet.rows, detected.headerRowIndex));
    setMapping(autoMapColumns(detected.headers));

    const ctx = context?.departmentId === departmentId
      ? context
      : await loadContext(departmentId);
    if (!ctx) return;

    // Match header-block branch name if present
    if (headerMeta?.branchName || extractHeaderBlock(sheet.rows, detected.headerRowIndex).branchName) {
      const name =
        extractHeaderBlock(sheet.rows, detected.headerRowIndex).branchName;
      if (name) {
        const match = ctx.branches.find(
          (b) => b.name.toUpperCase() === name.toUpperCase(),
        );
        if (match) setBranchOverrideId(match.id);
      }
    }

    setStep("Map");
  };

  const runPreview = async () => {
    if (!sheet || !context) return;
    startTransition(async () => {
      const dataRows = sheet.rows.slice(headerRowIndex + 1);
      const { rows: normalised, blankSkipped } = normaliseSheetRows({
        dataRows,
        headerRowIndex,
        headers,
        mapping,
        categoryAliases: {
          ...context.categoryAliases,
          ...Object.fromEntries(
            Object.entries(categoryOverrides).map(([raw, id]) => {
              const name =
                context.categories.find((c) => c.id === id)?.name ?? raw;
              return [raw.toUpperCase(), name];
            }),
          ),
        },
        statusAliases: {
          ...context.statusAliases,
          ...Object.fromEntries(
            Object.entries(statusOverrides).map(([raw, id]) => {
              const name =
                context.statuses.find((s) => s.id === id)?.name ?? raw;
              return [raw.toUpperCase(), name];
            }),
          ),
        },
        knownCategories: context.categories.map((c) => c.name),
        knownStatuses: context.statuses.map((s) => s.name),
      });

      const lookups = buildLookupMaps({
        categories: context.categories,
        statuses: context.statuses,
        branches: context.branches,
        locations: context.locations,
        categoryAliases: {
          ...context.categoryAliases,
          ...Object.fromEntries(
            Object.entries(categoryOverrides).map(([raw, id]) => {
              const name =
                context.categories.find((c) => c.id === id)?.name ?? raw;
              return [raw.toUpperCase(), name];
            }),
          ),
        },
        statusAliases: {
          ...context.statusAliases,
          ...Object.fromEntries(
            Object.entries(statusOverrides).map(([raw, id]) => {
              const name =
                context.statuses.find((s) => s.id === id)?.name ?? raw;
              return [raw.toUpperCase(), name];
            }),
          ),
        },
      });

      const defaultBranch = context.branches.find(
        (b) => b.id === branchOverrideId,
      );

      const { resolved, unknownCategories, unknownStatuses, unknownBranches } =
        resolveRows(
          normalised,
          lookups,
          branchOverrideId || null,
          defaultBranch?.name ?? headerMeta?.branchName ?? null,
        );

      if (
        unknownCategories.length > 0 ||
        unknownStatuses.length > 0
      ) {
        setReport({
          totalDetected: normalised.length + blankSkipped,
          blankSkipped,
          toCreate: 0,
          toUpdate: 0,
          toSkip: 0,
          flagged: 0,
          errors: [],
          unknownCategories,
          unknownStatuses,
          unknownBranches,
          rows: [],
        });
        setStep("Resolve");
        return;
      }

      const tags = normalised
        .map((r) => r.assetTag)
        .filter(Boolean) as string[];
      const serials = normalised
        .map((r) => r.serialNumber)
        .filter(Boolean) as string[];

      const existingRes = await findExistingForImportAction({
        departmentId,
        tags,
        serials,
      });
      if (!existingRes.ok) {
        toast.error(existingRes.error ?? "Could not check duplicates");
        return;
      }

      const dry = validateImportRows({
        rows: resolved,
        existing: existingRes.data ?? [],
        duplicatePolicy,
        blankSkipped,
        unknownCategories,
        unknownStatuses,
        unknownBranches,
      });
      setReport(dry);
      setStep("Preview");
    });
  };

  const collectUnknownsAndResolve = () => {
    if (!sheet || !context) return;
    const dataRows = sheet.rows.slice(headerRowIndex + 1);
    const { rows: normalised, blankSkipped } = normaliseSheetRows({
      dataRows,
      headerRowIndex,
      headers,
      mapping,
      categoryAliases: context.categoryAliases,
      statusAliases: context.statusAliases,
      knownCategories: context.categories.map((c) => c.name),
      knownStatuses: context.statuses.map((s) => s.name),
    });
    const lookups = buildLookupMaps({
      categories: context.categories,
      statuses: context.statuses,
      branches: context.branches,
      locations: context.locations,
      categoryAliases: context.categoryAliases,
      statusAliases: context.statusAliases,
    });
    const defaultBranch = context.branches.find(
      (b) => b.id === branchOverrideId,
    );
    const { unknownCategories, unknownStatuses, unknownBranches } = resolveRows(
      normalised,
      lookups,
      branchOverrideId || null,
      defaultBranch?.name ?? headerMeta?.branchName ?? null,
    );
    setReport({
      totalDetected: normalised.length + blankSkipped,
      blankSkipped,
      toCreate: 0,
      toUpdate: 0,
      toSkip: 0,
      flagged: 0,
      errors: [],
      unknownCategories,
      unknownStatuses,
      unknownBranches,
      rows: [],
    });
    setStep("Resolve");
  };

  const runImport = async () => {
    if (!report || !workbook || !context) return;
    const actionable = report.rows.filter(
      (r) =>
        r.action !== "error" &&
        r.action !== "skip" &&
        r.categoryId &&
        r.statusId &&
        r.branchId,
    );

    const chunks: ImportChunkRow[][] = [];
    for (let i = 0; i < actionable.length; i += IMPORT_CHUNK_SIZE) {
      chunks.push(
        actionable.slice(i, i + IMPORT_CHUNK_SIZE).map((r) => ({
          sourceRow: r.sourceRow,
          assetTag: r.assetTag,
          serialNumber: r.serialNumber,
          brand: r.brand,
          model: r.model,
          assignedToText: r.assignedToText,
          remarks: r.remarks,
          categoryId: r.categoryId!,
          statusId: r.statusId!,
          branchId: r.branchId!,
          locationId: r.locationId,
          customFields: r.customFields,
          reviewReasons: r.reviewReasons,
          action: r.action === "update" ? "update" : "create",
          matchAssetId: r.matchAssetId,
        })),
      );
    }

    // Include skip rows count in job total
    const totalRows = report.rows.filter((r) => r.action !== "error").length;

    setStep("Import");
    setProgress({ done: 0, total: chunks.length });

    startTransition(async () => {
      const start = await startImportJobAction({
        departmentId,
        fileName: workbook.fileName,
        mapping,
        totalRows,
        duplicatePolicy,
      });
      if (!start.ok || !start.data) {
        toast.error(start.error ?? "Could not start import");
        setStep("Preview");
        return;
      }
      setJobId(start.data.jobId);

      let created = 0;
      let updated = 0;
      let skipped = report.toSkip;
      let flagged = 0;

      for (let i = 0; i < chunks.length; i++) {
        const res = await importChunkAction({
          jobId: start.data.jobId,
          departmentId,
          rows: chunks[i],
          isLast: i === chunks.length - 1,
        });
        if (!res.ok || !res.data) {
          toast.error(res.error ?? `Chunk ${i + 1} failed`);
          break;
        }
        created += res.data.created;
        updated += res.data.updated;
        skipped += res.data.skipped;
        flagged += res.data.flagged;
        setProgress({ done: i + 1, total: chunks.length });
      }

      // Also register skips on empty import
      if (chunks.length === 0) {
        await importChunkAction({
          jobId: start.data.jobId,
          departmentId,
          rows: [],
          isLast: true,
        });
      }

      setResult({ created, updated, skipped, flagged });
      setStep("Done");
      toast.success("Import finished");
    });
  };

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={cn(
              "rounded-full px-2.5 py-1",
              i === stepIndex
                ? "bg-primary text-primary-foreground"
                : i < stepIndex
                  ? "bg-muted text-foreground"
                  : "bg-muted/50 text-muted-foreground",
            )}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === "Upload" && (
        <div className="space-y-4 rounded-lg border border-dashed p-8 text-center">
          <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Upload Excel or CSV</p>
            <p className="text-sm text-muted-foreground">
              Files are parsed in your browser — nothing is uploaded raw.
            </p>
          </div>
          <div className="mx-auto max-w-sm space-y-3 text-left">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select
                value={departmentId}
                onValueChange={(v) => {
                  setDepartmentId(v);
                  setContext(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              disabled={!departmentId}
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
      )}

      {step === "Sheet" && workbook && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4" />
            {workbook.fileName}
          </div>
          <div className="space-y-1.5">
            <Label>Sheet</Label>
            <Select value={sheetName} onValueChange={setSheetName}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workbook.sheets.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    {s.name} ({s.rows.length} rows)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("Upload")}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button onClick={() => void prepareSheet()} disabled={pending}>
              Continue <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === "Map" && (
        <div className="space-y-4 rounded-lg border p-4">
          {headerMeta && (
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <p>
                <span className="text-muted-foreground">Branch: </span>
                {headerMeta.branchName ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Date: </span>
                {headerMeta.inventoryDate ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Prepared by: </span>
                {headerMeta.preparedBy ?? "—"}
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Default branch (if Location column missing / for whole sheet)</Label>
            <Select
              value={branchOverrideId || "__none__"}
              onValueChange={(v) =>
                setBranchOverrideId(v === "__none__" ? "" : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Use column / header —</SelectItem>
                {(context?.branches ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">Spreadsheet column</th>
                  <th className="p-2">Maps to</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h, i) => {
                  const key = h.trim() || `col_${i}`;
                  const value = mapping[key] ?? "skip";
                  return (
                    <tr key={`${key}-${i}`} className="border-b border-border/50">
                      <td className="p-2 font-medium">{h || `(column ${i + 1})`}</td>
                      <td className="p-2">
                        <Select
                          value={value}
                          onValueChange={(v) =>
                            setMapping((m) => ({ ...m, [key]: v as ColumnMapping[string] }))
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {IMPORT_FIELD_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                            {(context?.fieldDefs ?? []).map((f) => (
                              <SelectItem key={f.key} value={`cf:${f.key}`}>
                                Custom: {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label>Save mapping as</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Nwabiagya ICT"
                className="w-48"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!templateName.trim() || pending}
              onClick={() => {
                startTransition(async () => {
                  const res = await saveMappingTemplateAction({
                    name: templateName.trim(),
                    mapping,
                  });
                  if (!res.ok) toast.error(res.error);
                  else toast.success("Mapping template saved");
                });
              }}
            >
              Save template
            </Button>
            {(context?.mappingTemplates ?? []).length > 0 && (
              <Select
                onValueChange={(id) => {
                  const t = context?.mappingTemplates.find((x) => x.id === id);
                  if (t) {
                    setMapping(t.mapping);
                    toast.success(`Loaded “${t.name}”`);
                  }
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Load template" />
                </SelectTrigger>
                <SelectContent>
                  {context!.mappingTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("Sheet")}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button
              variant="secondary"
              onClick={() => collectUnknownsAndResolve()}
            >
              Check unknowns
            </Button>
            <Button onClick={() => void runPreview()} disabled={pending}>
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Preview <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === "Resolve" && report && context && (
        <div className="space-y-4 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            Map unknown values to existing categories or statuses, then preview again.
          </p>
          {report.unknownCategories.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Unknown asset types</h3>
              {report.unknownCategories.map((raw) => (
                <div key={raw} className="flex items-center gap-2">
                  <span className="w-40 truncate text-sm">{raw}</span>
                  <Select
                    value={categoryOverrides[raw] ?? ""}
                    onValueChange={(v) =>
                      setCategoryOverrides((o) => ({ ...o, [raw]: v }))
                    }
                  >
                    <SelectTrigger className="max-w-xs">
                      <SelectValue placeholder="Map to category" />
                    </SelectTrigger>
                    <SelectContent>
                      {context.categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
          {report.unknownStatuses.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Unknown statuses</h3>
              {report.unknownStatuses.map((raw) => (
                <div key={raw} className="flex items-center gap-2">
                  <span className="w-40 truncate text-sm">{raw}</span>
                  <Select
                    value={statusOverrides[raw] ?? ""}
                    onValueChange={(v) =>
                      setStatusOverrides((o) => ({ ...o, [raw]: v }))
                    }
                  >
                    <SelectTrigger className="max-w-xs">
                      <SelectValue placeholder="Map to status" />
                    </SelectTrigger>
                    <SelectContent>
                      {context.statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
          {report.unknownBranches.length > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Unknown branches: {report.unknownBranches.join(", ")}. Set a
              default branch above or fix the Location column.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("Map")}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button onClick={() => void runPreview()} disabled={pending}>
              Preview again
            </Button>
          </div>
        </div>
      )}

      {step === "Preview" && report && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Rows detected" value={report.totalDetected} />
            <Stat label="Blank skipped" value={report.blankSkipped} />
            <Stat label="To create" value={report.toCreate} />
            <Stat label="To update" value={report.toUpdate} />
            <Stat label="To skip" value={report.toSkip} />
            <Stat label="Flagged" value={report.flagged} />
            <Stat label="Errors" value={report.errors.length} />
          </div>
          <div className="space-y-1.5">
            <Label>Duplicate handling</Label>
            <Select
              value={duplicatePolicy}
              onValueChange={(v) => {
                setDuplicatePolicy(v as DuplicatePolicy);
              }}
            >
              <SelectTrigger className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flag">
                  Import anyway and flag for review (default)
                </SelectItem>
                <SelectItem value="skip">Skip existing matches</SelectItem>
                <SelectItem value="update">Update existing matches</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-xs"
              onClick={() => void runPreview()}
            >
              Re-run validation with this policy
            </Button>
          </div>
          {report.errors.length > 0 && (
            <div className="max-h-40 overflow-auto rounded border bg-muted/40 p-2 text-xs">
              {report.errors.slice(0, 50).map((e, i) => (
                <p key={`${e.sourceRow}-${i}`}>
                  Row {e.sourceRow}: {e.message}
                </p>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("Map")}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button
              onClick={() => void runImport()}
              disabled={pending || report.toCreate + report.toUpdate === 0}
            >
              Import {report.toCreate + report.toUpdate} rows
            </Button>
          </div>
        </div>
      )}

      {step === "Import" && (
        <div className="space-y-4 rounded-lg border p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="font-medium">Importing…</p>
          <div className="mx-auto h-2 max-w-md overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width:
                  progress.total === 0
                    ? "100%"
                    : `${(progress.done / progress.total) * 100}%`,
              }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Chunk {progress.done} of {progress.total || 1}
          </p>
        </div>
      )}

      {step === "Done" && result && (
        <div className="space-y-4 rounded-lg border p-6">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="font-medium">Import complete</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Created" value={result.created} />
            <Stat label="Updated" value={result.updated} />
            <Stat label="Skipped" value={result.skipped} />
            <Stat label="Flagged" value={result.flagged} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/assets?needsReview=1">View needs review</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/assets">Open assets</Link>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setStep("Upload");
                setWorkbook(null);
                setReport(null);
                setResult(null);
                setJobId(null);
              }}
            >
              Import another file
            </Button>
          </div>
          {jobId && (
            <p className="text-xs text-muted-foreground">
              Job id: {jobId} — you can undo from Recent imports below.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
