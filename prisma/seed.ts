import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaClient, type FieldType, type StatusKind } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for seeding");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const BRANCHES = [
  { name: "Barekese", code: "BK", type: "BRANCH" as const, sortOrder: 1 },
  { name: "Bohyen", code: "BH", type: "BRANCH" as const, sortOrder: 2 },
  { name: "Sagoe Lane", code: "SG", type: "BRANCH" as const, sortOrder: 3 },
  { name: "Abuakwa", code: "ABK", type: "BRANCH" as const, sortOrder: 4 },
  { name: "Asuofia", code: "AS", type: "BRANCH" as const, sortOrder: 5 },
  { name: "Offinso", code: "OFF", type: "BRANCH" as const, sortOrder: 6 },
  { name: "Anwiam", code: "AN", type: "BRANCH" as const, sortOrder: 7 },
  { name: "Magazine", code: "MG", type: "BRANCH" as const, sortOrder: 8 },
  { name: "Head Office", code: "HO", type: "HEAD_OFFICE" as const, sortOrder: 9 },
  { name: "Data Center", code: "DC", type: "DATA_CENTER" as const, sortOrder: 10 },
  // Code "TJ" is provisional — confirm in docs/DECISIONS.md
  { name: "Tech", code: "TJ", type: "OTHER" as const, sortOrder: 11 },
];

const STATUSES: Array<{
  name: string;
  color: string;
  kind: StatusKind;
  isDefault?: boolean;
  sortOrder: number;
}> = [
  { name: "Active", color: "#16a34a", kind: "IN_USE", isDefault: true, sortOrder: 1 },
  { name: "Faulty", color: "#dc2626", kind: "NEEDS_ATTENTION", sortOrder: 2 },
  { name: "In Repair", color: "#d97706", kind: "NEEDS_ATTENTION", sortOrder: 3 },
  { name: "Inactive", color: "#6b7280", kind: "NOT_IN_USE", sortOrder: 4 },
  { name: "Retired", color: "#64748b", kind: "END_OF_LIFE", sortOrder: 5 },
  { name: "Disposed", color: "#475569", kind: "END_OF_LIFE", sortOrder: 6 },
  { name: "Lost", color: "#7f1d1d", kind: "END_OF_LIFE", sortOrder: 7 },
];

const CATEGORIES = [
  { name: "Laptop", code: "LT", icon: "Laptop" },
  { name: "Desktop/System Unit", code: "SU", icon: "PcCase" },
  { name: "Monitor", code: "MN", icon: "Monitor" },
  { name: "Printer", code: "PR", icon: "Printer" },
  { name: "Server", code: "SV", icon: "Server" },
  { name: "Core Router", code: "CR", icon: "Router" },
  { name: "Switch", code: "SW", icon: "Network" },
  { name: "UPS", code: "UPS", icon: "BatteryCharging" },
  { name: "External Backup", code: "EB", icon: "HardDrive" },
  { name: "Satellite/Starlink", code: "ST", icon: "Satellite" },
  { name: "Other Network Device", code: "NW", icon: "Cable" },
];

const CATEGORY_ALIASES: Record<string, string> = {
  "SYSTEM UNIT": "Desktop/System Unit",
  DESKTOP: "Desktop/System Unit",
  LAPTOP: "Laptop",
  MONITOR: "Monitor",
  PRINTER: "Printer",
  UPS: "UPS",
  "CORE ROUTER": "Core Router",
  "CISCO SWITCH": "Switch",
  "TP LINK SWITCH": "Switch",
  "POE - SWITCH": "Switch",
  "POE SWITCH": "Switch",
  "MTN - POE": "Switch",
  "STAR LINK": "Satellite/Starlink",
  STARLINK: "Satellite/Starlink",
  "EXTERNAL BACKUP": "External Backup",
  "SERVER R730": "Server",
  "SERVER R630": "Server",
  "SERVER T320": "Server",
  "SERVER R320": "Server",
  SERVER: "Server",
};

const STATUS_ALIASES: Record<string, string> = {
  ACTIVE: "Active",
  FAULTY: "Faulty",
  "IN REPAIR": "In Repair",
  INREPAIR: "In Repair",
  INACTIVE: "Inactive",
  RETIRED: "Retired",
  DISPOSED: "Disposed",
  LOST: "Lost",
};

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@assettrack.local")
    .toLowerCase()
    .trim();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMeNow1!";

  if (adminPassword.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters");
  }

  console.log("Seeding AssetTrack…");

  const ict = await prisma.department.upsert({
    where: { code: "ICT" },
    update: { name: "ICT", isActive: true, deletedAt: null },
    create: {
      name: "ICT",
      code: "ICT",
      description: "Information & Communication Technology",
      isActive: true,
    },
  });

  await prisma.department.upsert({
    where: { code: "OPS" },
    update: {},
    create: {
      name: "Operations",
      code: "OPS",
      description: "Demo department (inactive) for multi-department behaviour",
      isActive: false,
    },
  });

  for (const branch of BRANCHES) {
    await prisma.branch.upsert({
      where: { code: branch.code },
      update: {
        name: branch.name,
        type: branch.type,
        sortOrder: branch.sortOrder,
        isActive: true,
        deletedAt: null,
      },
      create: branch,
    });
  }

  const magazine = await prisma.branch.findUniqueOrThrow({ where: { code: "MG" } });
  const headOffice = await prisma.branch.findUniqueOrThrow({ where: { code: "HO" } });
  const dataCenter = await prisma.branch.findUniqueOrThrow({ where: { code: "DC" } });

  const starterLocations = [
    { branchId: magazine.id, name: "Magazine" },
    { branchId: headOffice.id, name: "Cash Office" },
    { branchId: headOffice.id, name: "Manager's Office" },
    { branchId: dataCenter.id, name: "Server Room" },
    { branchId: dataCenter.id, name: "Data Center" },
  ];

  for (const loc of starterLocations) {
    await prisma.location.upsert({
      where: {
        branchId_name: { branchId: loc.branchId, name: loc.name },
      },
      update: { deletedAt: null },
      create: loc,
    });
  }

  for (const status of STATUSES) {
    await prisma.status.upsert({
      where: {
        departmentId_name: { departmentId: ict.id, name: status.name },
      },
      update: {
        color: status.color,
        kind: status.kind,
        isDefault: status.isDefault ?? false,
        sortOrder: status.sortOrder,
        deletedAt: null,
      },
      create: {
        departmentId: ict.id,
        ...status,
        isDefault: status.isDefault ?? false,
      },
    });
  }

  const categoryIds: Record<string, string> = {};
  for (const category of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: {
        departmentId_name: { departmentId: ict.id, name: category.name },
      },
      update: {
        code: category.code,
        icon: category.icon,
        isActive: true,
        deletedAt: null,
      },
      create: {
        departmentId: ict.id,
        ...category,
      },
    });
    categoryIds[category.name] = row.id;
  }

  type FieldSeed = {
    key: string;
    label: string;
    type: FieldType;
    categoryNames: string[];
    options?: { value: string; label: string }[];
    showInList?: boolean;
    sortOrder: number;
  };

  const fields: FieldSeed[] = [
    {
      key: "operating_system",
      label: "Operating System",
      type: "SELECT",
      categoryNames: ["Laptop", "Desktop/System Unit"],
      options: [
        { value: "windows_10", label: "Windows 10" },
        { value: "windows_11", label: "Windows 11" },
        { value: "linux", label: "Linux" },
        { value: "macos", label: "macOS" },
        { value: "other", label: "Other" },
      ],
      showInList: true,
      sortOrder: 1,
    },
    {
      key: "ram_gb",
      label: "RAM (GB)",
      type: "NUMBER",
      categoryNames: ["Laptop", "Desktop/System Unit"],
      sortOrder: 2,
    },
    {
      key: "storage_gb",
      label: "Storage (GB)",
      type: "NUMBER",
      categoryNames: ["Laptop", "Desktop/System Unit"],
      sortOrder: 3,
    },
    {
      key: "hostname",
      label: "Hostname",
      type: "TEXT",
      categoryNames: ["Laptop", "Desktop/System Unit"],
      showInList: true,
      sortOrder: 4,
    },
    {
      key: "processor",
      label: "Processor",
      type: "TEXT",
      categoryNames: ["Laptop", "Desktop/System Unit"],
      sortOrder: 5,
    },
    {
      key: "printer_type",
      label: "Printer Type",
      type: "SELECT",
      categoryNames: ["Printer"],
      options: [
        { value: "laser", label: "Laser" },
        { value: "inkjet", label: "Inkjet" },
        { value: "multifunction", label: "Multifunction" },
      ],
      sortOrder: 1,
    },
    {
      key: "ip_address",
      label: "IP Address",
      type: "TEXT",
      categoryNames: [
        "Printer",
        "Server",
        "Core Router",
        "Switch",
        "Other Network Device",
        "Satellite/Starlink",
      ],
      showInList: true,
      sortOrder: 10,
    },
    {
      key: "firmware_version",
      label: "Firmware Version",
      type: "TEXT",
      categoryNames: [
        "Server",
        "Core Router",
        "Switch",
        "Other Network Device",
        "Satellite/Starlink",
      ],
      sortOrder: 11,
    },
  ];

  for (const field of fields) {
    for (const categoryName of field.categoryNames) {
      const categoryId = categoryIds[categoryName];
      if (!categoryId) continue;

      const key = `${field.key}__${CATEGORIES.find((c) => c.name === categoryName)?.code.toLowerCase()}`;

      await prisma.fieldDefinition.upsert({
        where: {
          departmentId_key: { departmentId: ict.id, key },
        },
        update: {
          label: field.label,
          type: field.type,
          options: field.options ?? undefined,
          showInList: field.showInList ?? false,
          sortOrder: field.sortOrder,
          categoryId,
          isActive: true,
        },
        create: {
          departmentId: ict.id,
          categoryId,
          key,
          label: field.label,
          type: field.type,
          options: field.options ?? undefined,
          showInList: field.showInList ?? false,
          sortOrder: field.sortOrder,
        },
      });
    }
  }

  await prisma.setting.upsert({
    where: { key: "org" },
    update: {
      value: {
        name: "Nuta Community Bank",
        logoUrl: null,
        locale: "en-GH",
        timezone: "Africa/Accra",
        currency: "GHS",
      },
    },
    create: {
      key: "org",
      value: {
        name: "Nuta Community Bank",
        logoUrl: null,
        locale: "en-GH",
        timezone: "Africa/Accra",
        currency: "GHS",
      },
    },
  });

  await prisma.setting.upsert({
    where: { key: "tag_format" },
    update: { value: { template: "NRB/{BRANCH}/EQ/{SEQ:4}" } },
    create: {
      key: "tag_format",
      value: { template: "NRB/{BRANCH}/EQ/{SEQ:4}" },
    },
  });

  await prisma.setting.upsert({
    where: { key: "placeholders" },
    update: {
      value: { emptyValues: ["*", "N/A", "NA", "-", "none", "null"] },
    },
    create: {
      key: "placeholders",
      value: { emptyValues: ["*", "N/A", "NA", "-", "none", "null"] },
    },
  });

  await prisma.setting.upsert({
    where: { key: "category_aliases" },
    update: { value: CATEGORY_ALIASES },
    create: { key: "category_aliases", value: CATEGORY_ALIASES },
  });

  await prisma.setting.upsert({
    where: { key: "status_aliases" },
    update: { value: STATUS_ALIASES },
    create: { key: "status_aliases", value: STATUS_ALIASES },
  });

  await prisma.setting.upsert({
    where: { key: "import_mappings" },
    update: {},
    create: { key: "import_mappings", value: [] },
  });

  await prisma.setting.upsert({
    where: { key: "attachments" },
    update: { value: { enabled: false } },
    create: { key: "attachments", value: { enabled: false } },
  });

  const passwordHash = await hash(adminPassword, 12);
  // CI/e2e can skip forced password change for a stable smoke login
  const mustChangePassword = process.env.E2E_SKIP_PASSWORD_CHANGE !== "1";
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Super Admin",
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
      mustChangePassword,
      failedLogins: 0,
      lockedUntil: null,
      deletedAt: null,
    },
    create: {
      name: "Super Admin",
      email: adminEmail,
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
      mustChangePassword,
    },
  });

  await prisma.userDepartment.upsert({
    where: {
      userId_departmentId: { userId: admin.id, departmentId: ict.id },
    },
    update: {},
    create: { userId: admin.id, departmentId: ict.id },
  });

  console.log(`Seed complete. Super Admin: ${adminEmail}`);
  console.log(
    mustChangePassword
      ? "Set a new password on first login (mustChangePassword=true)."
      : "E2E_SKIP_PASSWORD_CHANGE=1 — admin can sign in without password change.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
