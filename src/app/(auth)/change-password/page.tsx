import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Change password",
};

export default function ChangePasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-100 via-background to-background px-4 py-10 dark:from-amber-950/30">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl">Choose a new password</CardTitle>
          <CardDescription>
            For security, you must set your own password before using AssetTrack.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
