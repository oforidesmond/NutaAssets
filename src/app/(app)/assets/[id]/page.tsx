import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AssetDetail } from "@/components/assets/asset-detail";
import { auth } from "@/lib/auth";
import { can } from "@/lib/authorize";
import {
  getAssetDetail,
  getAssetFilterOptions,
} from "@/server/queries/assets";

export const metadata: Metadata = { title: "Asset" };

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AssetDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const [detail, options] = await Promise.all([
    getAssetDetail(session.user, id),
    getAssetFilterOptions(session.user),
  ]);

  if (!detail) notFound();

  return (
    <AssetDetail
      asset={{
        ...detail.asset,
        purchaseCost: detail.asset.purchaseCost,
        createdAt: detail.asset.createdAt.toISOString(),
        updatedAt: detail.asset.updatedAt.toISOString(),
        deletedAt: detail.asset.deletedAt?.toISOString() ?? null,
        purchaseDate: detail.asset.purchaseDate?.toISOString() ?? null,
        warrantyExpiry: detail.asset.warrantyExpiry?.toISOString() ?? null,
        events: detail.asset.events.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
        })),
      }}
      sameAssignee={detail.sameAssignee}
      sameTag={detail.sameTag}
      sameSerial={detail.sameSerial}
      canMutate={can(session.user, "update")}
      statuses={options.statuses}
      branches={options.branches}
    />
  );
}
