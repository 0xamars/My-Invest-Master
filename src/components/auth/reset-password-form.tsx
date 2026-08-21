"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { APP_HOME_PATH, LOGIN_PATH } from "@/lib/routes";

export function ResetPasswordForm() {
  const { user, isLoading, isConfigured, updatePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    const result = await updatePassword(password);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(APP_HOME_PATH);
  }

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-white/55">
        <Loader2 className="size-4 animate-spin" />
        Checking reset link…
      </p>
    );
  }

  if (!isConfigured) {
    return (
      <p className="text-sm text-white/55">
        Cloud auth is not configured.
      </p>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Reset link expired</h1>
        <p className="text-sm text-white/60">
          Request a new password reset from the sign-in page. The email link
          lands here after `/auth/callback` exchanges the code.
        </p>
        <Button render={<Link href={LOGIN_PATH} />}>Back to sign in</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Set a new password</h1>
        <p className="text-sm text-white/60">
          Signed in as {user.email}. Choose a new password, then continue to Invest.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-password">New password</Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            className="h-11 border-white/15 bg-white/5 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reset-confirm">Confirm password</Label>
          <Input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
            minLength={6}
            className="h-11 border-white/15 bg-white/5 text-white"
          />
        </div>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Update password
        </Button>
      </form>
    </div>
  );
}
