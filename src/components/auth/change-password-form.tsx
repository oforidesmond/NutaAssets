"use client";

import { useActionState, useEffect } from "react";
import { signOut } from "next-auth/react";

import { changePasswordAction, type ActionResult } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionResult = { ok: false };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initial,
  );

  useEffect(() => {
    if (state?.ok) {
      // Sign out so the JWT is rebuilt on the next login with mustChangePassword=false.
      // Avoids the session-update race that could bounce back to this page.
      void signOut({ callbackUrl: "/login?passwordChanged=1" });
    }
  }, [state]);

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
          minLength={8}
          required
        />
        <p className="text-xs text-muted-foreground">
          At least 8 characters, and different from your current password.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
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
          Password updated. Please sign in with your new password…
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending || state?.ok}>
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
