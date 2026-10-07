import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { redirect } from "next/navigation";

import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { auth } from "@/lib/auth";
import { can } from "@/lib/authorize";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
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
          Departments, branches, categories, statuses, users, settings — Phases
          2–3.
        </p>
      </div>
      <PagePlaceholder
        title="Admin console coming soon"
        description="Configure the system from the UI — no code deploys for new fields or branches."
        icon={Settings}
      />
    </div>
  );
}
