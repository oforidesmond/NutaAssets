import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Short QR target: `/a/{assetId}` → asset detail (auth required).
 */
export default async function AssetShortLinkPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/a/${id}`)}`);
  }

  const asset = await prisma.asset.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!asset) notFound();

  redirect(`/assets/${asset.id}`);
}
