import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SettingsForm } from "@/components/admin/settings-form";
import { auth } from "@/lib/auth";
import { can } from "@/lib/authorize";
import { getSettingsSnapshot } from "@/server/services/admin-settings";

export const metadata: Metadata = { title: "Settings — Admin" };

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user, "manage_settings")) {
    return (
      <p className="text-sm text-muted-foreground">
        Only Super Admins can change organisation settings.
      </p>
    );
  }

  const settings = await getSettingsSnapshot();

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-medium">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Organisation name, asset tag template, and placeholder values.
        </p>
      </div>
      <SettingsForm initial={settings} />
    </div>
  );
}
