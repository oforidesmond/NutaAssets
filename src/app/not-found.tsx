import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="font-[family-name:var(--font-source-serif)] text-3xl font-semibold">
        Page not found
      </h1>
      <p className="max-w-md text-muted-foreground">
        That link doesn’t lead anywhere in AssetTrack. Head back to the
        dashboard.
      </p>
      <Button asChild>
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </div>
  );
}
