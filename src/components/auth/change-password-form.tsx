"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { changePasswordAction, type ActionResult } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionResult = { ok: false };

export function ChangePasswordForm() {
  const router = useRouter();
  const { update } = useSession();
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initial,
  );

  useEffect(() => {
    if (state?.ok) {
      void update({ mustChangePassword: false }).then(() => {
        router.replace("/dashboard");
        router.refresh();
      });
    }
  }, [state, router, update]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
        <p className="text-xs text-muted-foreground">At least 10 characters.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="text-sm text-green-700 dark:text-green-400">
          Password updated. Redirecting…
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending || state?.ok}>
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
