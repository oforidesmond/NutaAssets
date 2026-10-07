import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-100 via-background to-background px-4 py-10 dark:from-sky-950/40">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <p className="font-[family-name:var(--font-source-serif)] text-3xl font-semibold tracking-tight text-primary">
            AssetTrack
          </p>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>
            Track ICT assets across branches — simple enough for a branch
            officer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
