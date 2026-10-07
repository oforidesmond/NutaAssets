import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { auth } from "@/lib/auth";
import { can } from "@/lib/authorize";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || !can(session.user, "admin")) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
          Admin
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure branches, categories, statuses, and the recycle bin.
        </p>
      </div>
      <AdminNav />
      {children}
    </div>
  );
}
