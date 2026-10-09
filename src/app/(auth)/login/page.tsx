import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { OrgLogo } from "@/components/layout/org-logo";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getOrg } from "@/server/queries/org";

export const metadata: Metadata = {
  title: "Sign in",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const passwordChanged = params.passwordChanged === "1";
  const org = await getOrg();
  const hasLogo = Boolean(org.logoUrl);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-100 via-background to-background px-4 py-10 dark:from-sky-950/40">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-2 text-center">
          {hasLogo ? (
            <div className="flex flex-col items-center gap-2">
              <OrgLogo src={org.logoUrl} alt={org.name} size="md" />
              {/* <p className="text-sm text-muted-foreground">{org.name}</p> */}
              <p className="font-[family-name:var(--font-source-serif)] text-3xl font-semibold tracking-tight text-primary">
              AssetTrack
            </p>
            </div>
          ) : (
            <p className="font-[family-name:var(--font-source-serif)] text-3xl font-semibold tracking-tight text-primary">
              AssetTrack
            </p>
          )}
          <CardTitle className="text-xl">Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm passwordChanged={passwordChanged} />
        </CardContent>
      </Card>
    </div>
  );
}
