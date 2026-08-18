"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { APP_HOME_PATH, SIGNUP_PATH, safeAuthNextPath } from "@/lib/routes";

export function LoginForm() {
  const { isConfigured, signIn, requestPasswordReset } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeAuthNextPath(searchParams.get("next"));
  const authError = searchParams.get("error") === "auth";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    authError ? "That sign-in link expired or failed. Try again." : null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    const result = await signIn(email, password);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(next);
  }

  async function handleReset() {
    setError(null);
    setMessage(null);
    if (!email.trim()) {
      setError("Enter your email, then request a reset.");
      return;
    }
    setIsResetting(true);
    const result = await requestPasswordReset(email.trim());
    setIsResetting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage("If that account exists, a reset email is on its way.");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-white/60">
          Email and password. After you sign in you land on Home.
        </p>
      </div>

      {!isConfigured ? (
        <p className="text-sm text-white/55">
          Cloud auth is not configured. Add Supabase credentials to{" "}
          <code className="text-xs">.env.local</code>.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="h-11 border-white/15 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="h-11 border-white/15 bg-white/5 text-white"
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {message ? <p className="text-sm text-white/70">{message}</p> : null}

          <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Sign in
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-white/55 hover:text-white"
            onClick={() => void handleReset()}
            disabled={isResetting}
          >
            {isResetting ? "Sending reset…" : "Forgot password?"}
          </button>
        </form>
      )}

      <p className="text-sm text-white/50">
        Need an account?{" "}
        <Link href={SIGNUP_PATH} className="text-primary hover:underline">
          Start
        </Link>
      </p>
    </div>
  );
}
