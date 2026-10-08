import type { Condition, FieldType, Prisma } from "@prisma/client";

import type { AuthUser } from "@/lib/authorize";
import {
  scopedBranchIds,
  scopedDepartmentIds,
} from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { DEFAULT_ASSET_COLUMNS } from "@/schemas/asset";
import { getSelectedDepartmentId } from "@/server/queries/org";

export type AssetListParams = {
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  sortDir?: "asc" | "desc";
  branchId?: string;
  locationId?: string;
  categoryId?: string;
  statusId?: string;
  brand?: string;
  assignedTo?: string;
  condition?: Condition;
  needsReview?: boolean;
  hasTag?: boolean;
  hasSerial?: boolean;
  columns?: string[];
  /** Custom field filters keyed by FieldDefinition.key */
  cf?: Record<string, string>;
};

export function parseAssetListParams(
  searchParams: Record<string, string | string[] | undefined>,
): AssetListParams {
  const get = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const page = Math.max(1, Number(get("page") ?? 1) || 1);
  // Cap at 2000 for export; list UI typically uses ≤100
  const pageSize = Math.min(
    2000,
    Math.max(10, Number(get("pageSize") ?? 25) || 25),
  );
  const sortDir = get("sortDir") === "asc" ? "asc" : "desc";
  const columnsRaw = get("columns");
  const columns = columnsRaw
    ? columnsRaw.split(",").filter(Boolean)
    : [...DEFAULT_ASSET_COLUMNS];

  const needsReview =
    get("needsReview") === "1"
      ? true
      : get("needsReview") === "0"
        ? false
        : undefined;
  const hasTag =
    get("hasTag") === "1" ? true : get("hasTag") === "0" ? false : undefined;
  const hasSerial =
    get("hasSerial") === "1"
      ? true
      : get("hasSerial") === "0"
        ? false
        : undefined;

  const condition = get("condition") as Condition | undefined;

  const cf: Record<string, string> = {};
  for (const [key, raw] of Object.entries(searchParams)) {
    if (!key.startsWith("cf_")) continue;
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (v != null && v !== "") cf[key.slice(3)] = v;
  }

  return {
    q: get("q")?.trim() || undefined,
    page,
    pageSize,
    sort: get("sort") || "updatedAt",
    sortDir,
    branchId: get("branchId") || undefined,
    locationId: get("locationId") || undefined,
    categoryId: get("categoryId") || undefined,
    statusId: get("statusId") || undefined,
    brand: get("brand")?.trim() || undefined,
    assignedTo: get("assignedTo")?.trim() || undefined,
    condition: condition && ["NEW", "GOOD", "FAIR", "POOR"].includes(condition)
      ? condition
      : undefined,
    needsReview,
    hasTag,
    hasSerial,
    columns,
    cf: Object.keys(cf).length > 0 ? cf : undefined,
  };
}

function customFieldFilter(
  key: string,
  value: string,
  type: FieldType,
): Prisma.AssetWhereInput {
  if (type === "BOOLEAN") {
    const bool = value === "true" || value === "1";
    return { customFields: { path: [key], equals: bool } };
  }
  if (type === "NUMBER" || type === "DECIMAL") {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      return { customFields: { path: [key], equals: n } };
    }
  }
  if (type === "SELECT" || type === "DATE") {
    return { customFields: { path: [key], equals: value } };
  }
  return {
    customFields: { path: [key], string_contains: value },
  };
}

export async function listAssets(user: AuthUser, params: AssetListParams) {
  const cookieDept = await getSelectedDepartmentId();
  const deptScope = scopedDepartmentIds(user, cookieDept);
  const branchScope = scopedBranchIds(user, params.branchId);

  const fieldDefs = await prisma.fieldDefinition.findMany({
    where: {
      isActive: true,
      ...(deptScope ? { departmentId: { in: deptScope } } : {}),
      ...(cookieDept ? { departmentId: cookieDept } : {}),
    },
    select: {
      key: true,
      label: true,
      type: true,
      options: true,
      showInList: true,
      searchable: true,
      categoryId: true,
    },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });

  const andParts: Prisma.AssetWhereInput[] = [];

  if (params.hasTag === true) {
    andParts.push({ assetTag: { not: null } }, { NOT: { assetTag: "" } });
  } else if (params.hasTag === false) {
    andParts.push({
      OR: [{ assetTag: null }, { assetTag: "" }],
    });
  }

  if (params.hasSerial === true) {
    andParts.push(
      { serialNumber: { not: null } },
      { NOT: { serialNumber: "" } },
    );
  } else if (params.hasSerial === false) {
    andParts.push({
      OR: [{ serialNumber: null }, { serialNumber: "" }],
    });
  }

  if (params.cf) {
    for (const [key, value] of Object.entries(params.cf)) {
      const def = fieldDefs.find((f) => f.key === key);
      if (!def) continue;
      andParts.push(customFieldFilter(key, value, def.type));
    }
  }

  if (params.q) {
    const searchOr: Prisma.AssetWhereInput[] = [
      { assetTag: { contains: params.q, mode: "insensitive" } },
      { serialNumber: { contains: params.q, mode: "insensitive" } },
      { brand: { contains: params.q, mode: "insensitive" } },
      { model: { contains: params.q, mode: "insensitive" } },
      { assignedToText: { contains: params.q, mode: "insensitive" } },
      { remarks: { contains: params.q, mode: "insensitive" } },
    ];
    for (const def of fieldDefs.filter((f) => f.searchable)) {
      searchOr.push({
        customFields: { path: [def.key], string_contains: params.q },
      });
    }
    andParts.push({ OR: searchOr });
  }

  const where: Prisma.AssetWhereInput = {
    deletedAt: null,
    ...(deptScope ? { departmentId: { in: deptScope } } : {}),
    ...(branchScope ? { branchId: { in: branchScope } } : {}),
    ...(params.locationId ? { locationId: params.locationId } : {}),
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params.statusId ? { statusId: params.statusId } : {}),
    ...(params.brand
      ? { brand: { contains: params.brand, mode: "insensitive" } }
      : {}),
    ...(params.assignedTo
      ? {
          assignedToText: {
            contains: params.assignedTo,
            mode: "insensitive",
          },
        }
      : {}),
    ...(params.condition ? { condition: params.condition } : {}),
    ...(params.needsReview !== undefined
      ? { needsReview: params.needsReview }
      : {}),
    ...(andParts.length > 0 ? { AND: andParts } : {}),
  };

  const sortField = params.sort ?? "updatedAt";
  const orderBy: Prisma.AssetOrderByWithRelationInput =
    sortField === "category"
      ? { category: { name: params.sortDir } }
      : sortField === "branch"
        ? { branch: { name: params.sortDir } }
        : sortField === "status"
          ? { status: { name: params.sortDir } }
          : sortField === "assetTag"
            ? { assetTag: params.sortDir }
            : sortField === "brand"
              ? { brand: params.sortDir }
              : sortField === "serialNumber"
                ? { serialNumber: params.sortDir }
                : sortField === "assignedToText"
                  ? { assignedToText: params.sortDir }
                  : { updatedAt: params.sortDir };

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const [total, rows] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      include: {
        category: { select: { id: true, name: true, code: true, icon: true } },
        branch: { select: { id: true, name: true, code: true } },
        location: { select: { id: true, name: true } },
        status: {
          select: { id: true, name: true, color: true, kind: true },
        },
      },
    }),
  ]);

  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    columns: params.columns ?? [...DEFAULT_ASSET_COLUMNS],
    fieldDefs,
  };
}

export async function getAssetFilterOptions(user: AuthUser) {
  const cookieDept = await getSelectedDepartmentId();
  const deptScope = scopedDepartmentIds(user, cookieDept);
  const deptFilter = deptScope ? { departmentId: { in: deptScope } } : {};

  const [branches, categories, statuses] = await Promise.all([
    prisma.branch.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true },
    }),
    prisma.category.findMany({
      where: { deletedAt: null, isActive: true, ...deptFilter },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, departmentId: true },
    }),
    prisma.status.findMany({
      where: { deletedAt: null, ...deptFilter },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        color: true,
        kind: true,
        isDefault: true,
        departmentId: true,
      },
    }),
  ]);

  return { branches, categories, statuses, departmentId: cookieDept };
}

export async function getAssetDetail(user: AuthUser, id: string) {
  const cookieDept = await getSelectedDepartmentId();
  const deptScope = scopedDepartmentIds(user, cookieDept);
  const branchScope = scopedBranchIds(user);

  const asset = await prisma.asset.findFirst({
    where: {
      id,
      ...(deptScope ? { departmentId: { in: deptScope } } : {}),
      ...(branchScope ? { branchId: { in: branchScope } } : {}),
    },
    include: {
      category: true,
      branch: true,
      location: true,
      status: true,
      department: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
      events: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (!asset) return null;

  const [sameAssignee, sameTag, sameSerial] = await Promise.all([
    asset.assignedToText
      ? prisma.asset.findMany({
          where: {
            deletedAt: null,
            id: { not: asset.id },
            departmentId: asset.departmentId,
            assignedToText: {
              equals: asset.assignedToText,
              mode: "insensitive",
            },
          },
          take: 10,
          select: {
            id: true,
            assetTag: true,
            brand: true,
            model: true,
            category: { select: { name: true } },
            status: { select: { name: true, color: true } },
          },
        })
      : Promise.resolve([]),
    asset.assetTag
      ? prisma.asset.findMany({
          where: {
            deletedAt: null,
            id: { not: asset.id },
            departmentId: asset.departmentId,
            assetTag: { equals: asset.assetTag, mode: "insensitive" },
          },
          take: 10,
          select: {
            id: true,
            assetTag: true,
            serialNumber: true,
            brand: true,
            model: true,
            branch: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    asset.serialNumber
      ? prisma.asset.findMany({
          where: {
            deletedAt: null,
            id: { not: asset.id },
            departmentId: asset.departmentId,
            serialNumber: {
              equals: asset.serialNumber,
              mode: "insensitive",
            },
          },
          take: 10,
          select: {
            id: true,
            assetTag: true,
            serialNumber: true,
            brand: true,
            model: true,
            branch: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return { asset, sameAssignee, sameTag, sameSerial };
}

export async function getAssetFormOptions(user: AuthUser) {
  return getAssetFilterOptions(user);
}
