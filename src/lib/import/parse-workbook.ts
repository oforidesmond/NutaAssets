import { parse as parseCsv } from "papaparse";
import * as XLSX from "xlsx";

import type { ParsedSheet, ParsedWorkbook } from "@/lib/import/types";

function sheetToRows(sheet: XLSX.WorkSheet): string[][] {
  const raw = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
    sheet,
    {
      header: 1,
      defval: "",
      raw: false,
      blankrows: true,
    },
  );
  return raw.map((row) =>
    (row ?? []).map((cell) => (cell == null ? "" : String(cell).trim())),
  );
}

export function parseExcelArrayBuffer(
  buffer: ArrayBuffer,
  fileName: string,
): ParsedWorkbook {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheets: ParsedSheet[] = workbook.SheetNames.map((name) => ({
    name,
    rows: sheetToRows(workbook.Sheets[name]!),
  }));
  return { fileName, sheets };
}

export function parseCsvText(text: string, fileName: string): ParsedWorkbook {
  const result = parseCsv<string[]>(text, {
    header: false,
    skipEmptyLines: false,
  });
  const rows = (result.data ?? []).map((row) =>
    (Array.isArray(row) ? row : []).map((c) => String(c ?? "").trim()),
  );
  return {
    fileName,
    sheets: [{ name: "Sheet1", rows }],
  };
}

export async function parseImportFile(file: File): Promise<ParsedWorkbook> {
  const name = file.name;
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const text = await file.text();
    return parseCsvText(text, name);
  }
  const buffer = await file.arrayBuffer();
  return parseExcelArrayBuffer(buffer, name);
}

/** Node/test helper: parse from Buffer. */
export function parseExcelBuffer(
  buffer: Buffer,
  fileName: string,
): ParsedWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheets: ParsedSheet[] = workbook.SheetNames.map((name) => ({
    name,
    rows: sheetToRows(workbook.Sheets[name]!),
  }));
  return { fileName, sheets };
}
