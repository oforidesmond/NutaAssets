import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AssetForm } from "@/components/assets/asset-form";
import { auth } from "@/lib/auth";
import { can } from "@/lib/authorize";
import {
  getAssetDetail,
  getAssetFormOptions,
} from "@/server/queries/assets";

export const metadata: Metadata = { title: "Edit asset" };

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditAssetPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user, "update")) redirect("/assets");

  const { id } = await params;
  const [detail, options] = await Promise.all([
    getAssetDetail(session.user, id),
    getAssetFormOptions(session.user),
  ]);

  if (!detail || detail.asset.deletedAt) notFound();

  const asset = detail.asset;
  const departmentId = asset.departmentId;

  const categories = options.categories.filter(
    (c) => !("departmentId" in c) || c.departmentId === departmentId,
  );
  const statuses = options.statuses.filter(
    (s) => !("departmentId" in s) || s.departmentId === departmentId,
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
          Edit asset
        </h1>
        <p className="text-sm text-muted-foreground">
          {asset.assetTag ?? "Untitled"} · {asset.category.name}
        </p>
      </div>
      <AssetForm
        mode="edit"
        assetId={asset.id}
        departmentId={departmentId}
        updatedAt={asset.updatedAt.toISOString()}
        categories={categories}
        branches={options.branches}
        statuses={statuses}
        defaults={{
          departmentId,
          categoryId: asset.categoryId,
          branchId: asset.branchId,
          locationId: asset.locationId,
          assetTag: asset.assetTag,
          serialNumber: asset.serialNumber,
          brand: asset.brand,
          model: asset.model,
          statusId: asset.statusId,
          assignedToText: asset.assignedToText,
          purchaseDate: asset.purchaseDate
            ? asset.purchaseDate.toISOString().slice(0, 10)
            : "",
          purchaseCost: asset.purchaseCost?.toString() ?? "",
          warrantyExpiry: asset.warrantyExpiry
            ? asset.warrantyExpiry.toISOString().slice(0, 10)
            : "",
          condition: asset.condition,
          remarks: asset.remarks,
        }}
      />
    </div>
  );
}
