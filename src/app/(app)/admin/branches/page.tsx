import type { Metadata } from "next";

import { BranchesManager } from "@/components/admin/branches-manager";
import { listBranchesWithLocations } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Branches — Admin" };

export default async function AdminBranchesPage() {
  const branches = await listBranchesWithLocations();

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Branches & locations</h2>
      <BranchesManager initial={branches} />
    </div>
  );
}
