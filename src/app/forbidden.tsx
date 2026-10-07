import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">403</p>
      <h1 className="font-[family-name:var(--font-source-serif)] text-3xl font-semibold">
        You don’t have access
      </h1>
      <p className="max-w-md text-muted-foreground">
        Your role or assigned departments don’t allow this action. Ask an admin
        if you need access.
      </p>
      <Button asChild>
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </div>
  );
}
