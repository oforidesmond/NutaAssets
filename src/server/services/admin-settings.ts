import type { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { SettingsUpdateInput } from "@/schemas/admin";

export type SettingsSnapshot = {
  orgName: string;
  orgLogoUrl: string | null;
  tagFormat: string;
  placeholders: string[];
  attachmentsEnabled: boolean;
};

export async function getSettingsSnapshot(): Promise<SettingsSnapshot> {
  const rows = await prisma.setting.findMany({
    where: {
      key: { in: ["org", "tag_format", "placeholders", "attachments"] },
    },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const org = (map.org ?? {}) as { name?: string; logoUrl?: string };
  const tag = (map.tag_format ?? {}) as { template?: string };
  const placeholders = (map.placeholders ?? {}) as { emptyValues?: string[] };
  const attachments = (map.attachments ?? {}) as { enabled?: boolean };

  return {
    orgName: org.name ?? "AssetTrack",
    orgLogoUrl: org.logoUrl ?? null,
    tagFormat: tag.template ?? "NRB/{BRANCH}/EQ/{SEQ:4}",
    placeholders: placeholders.emptyValues ?? [
      "*",
      "N/A",
      "NA",
      "none",
      "-",
    ],
    attachmentsEnabled: attachments.enabled ?? false,
  };
}

export async function updateSettings(
  input: SettingsUpdateInput,
  userId: string,
) {
  const before = await getSettingsSnapshot();

  const emptyValues = input.placeholders
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: "org" },
      create: {
        key: "org",
        value: {
          name: input.orgName,
          logoUrl: input.orgLogoUrl || null,
        } as Prisma.InputJsonValue,
      },
      update: {
        value: {
          name: input.orgName,
          logoUrl: input.orgLogoUrl || null,
        } as Prisma.InputJsonValue,
      },
    }),
    prisma.setting.upsert({
      where: { key: "tag_format" },
      create: {
        key: "tag_format",
        value: { template: input.tagFormat } as Prisma.InputJsonValue,
      },
      update: {
        value: { template: input.tagFormat } as Prisma.InputJsonValue,
      },
    }),
    prisma.setting.upsert({
      where: { key: "placeholders" },
      create: {
        key: "placeholders",
        value: { emptyValues } as Prisma.InputJsonValue,
      },
      update: {
        value: { emptyValues } as Prisma.InputJsonValue,
      },
    }),
    prisma.setting.upsert({
      where: { key: "attachments" },
      create: {
        key: "attachments",
        value: {
          enabled: input.attachmentsEnabled,
        } as Prisma.InputJsonValue,
      },
      update: {
        value: {
          enabled: input.attachmentsEnabled,
        } as Prisma.InputJsonValue,
      },
    }),
  ]);

  const after = await getSettingsSnapshot();

  await writeAuditLog({
    userId,
    action: "SETTINGS_UPDATE",
    entityType: "Setting",
    entityId: "org",
    before,
    after,
  });

  return after;
}
