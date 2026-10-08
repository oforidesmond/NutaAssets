export const IMPORT_CHUNK_SIZE = 200;

export type ImportCoreField =
  | "assetTag"
  | "category"
  | "brand"
  | "model"
  | "serialNumber"
  | "assignedToText"
  | "status"
  | "branch"
  | "location"
  | "remarks"
  | "skip";

export type ColumnMapping = Record<string, ImportCoreField | `cf:${string}`>;

export type DuplicatePolicy = "skip" | "update" | "flag";

export type HeaderBlockMeta = {
  branchName: string | null;
  inventoryDate: string | null;
  preparedBy: string | null;
};

export type ParsedSheet = {
  name: string;
  rows: string[][];
};

export type ParsedWorkbook = {
  fileName: string;
  sheets: ParsedSheet[];
};

export type DetectedHeader = {
  headerRowIndex: number;
  headers: string[];
  confidence: number;
};

export type NormalisedImportRow = {
  sourceRow: number;
  assetTag: string | null;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  assignedToText: string | null;
  remarks: string | null;
  categoryRaw: string | null;
  statusRaw: string | null;
  branchRaw: string | null;
  locationRaw: string | null;
  categoryName: string | null;
  statusName: string | null;
  branchName: string | null;
  customFields: Record<string, unknown>;
  reviewReasons: string[];
  isBlank: boolean;
};

export type ResolvedImportRow = NormalisedImportRow & {
  categoryId: string | null;
  statusId: string | null;
  branchId: string | null;
  locationId: string | null;
  errors: string[];
};

export type ImportRowAction = "create" | "update" | "skip" | "error";

export type ValidatedImportRow = ResolvedImportRow & {
  action: ImportRowAction;
  matchAssetId: string | null;
  inFileDuplicate: boolean;
};

export type DryRunReport = {
  totalDetected: number;
  blankSkipped: number;
  toCreate: number;
  toUpdate: number;
  toSkip: number;
  flagged: number;
  errors: { sourceRow: number; message: string }[];
  unknownCategories: string[];
  unknownStatuses: string[];
  unknownBranches: string[];
  rows: ValidatedImportRow[];
};

export type ImportChunkRow = {
  sourceRow: number;
  assetTag: string | null;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  assignedToText: string | null;
  remarks: string | null;
  categoryId: string;
  statusId: string;
  branchId: string;
  locationId: string | null;
  customFields: Record<string, unknown>;
  reviewReasons: string[];
  action: "create" | "update" | "skip";
  matchAssetId: string | null;
};

export type MappingTemplate = {
  id: string;
  name: string;
  mapping: ColumnMapping;
  createdAt: string;
};
