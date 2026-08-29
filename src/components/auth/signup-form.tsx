"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { APP_HOME_PATH, LOGIN_PATH, PRIVACY_PATH, TERMS_PATH } from "@/lib/routes";

export function SignupForm() {
  const { isConfigured, signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    const result = await signUp(email, password);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.error == null) {
      setMessage(
        "Account created. If email confirmation is on, check your inbox, then sign in.",
      );
      window.setTimeout(() => {
        router.push(APP_HOME_PATH);
      }, 400);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-white/60">
          Budget, Invest, and Freedom are included. Not investment advice.
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
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="h-11 border-white/15 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password">Password</Label>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="h-11 border-white/15 bg-white/5 text-white"
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {message ? <p className="text-sm text-white/70">{message}</p> : null}

          <Button type="submit" className="premium-cta w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Create account
          </Button>
        </form>
      )}

      <p className="text-sm text-white/50">
        Already have an account?{" "}
        <Link href={LOGIN_PATH} className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
      <p className="text-xs text-white/40">
        By creating an account you agree to the{" "}
        <Link href={TERMS_PATH} className="hover:text-white/70">
          Terms
        </Link>{" "}
        and{" "}
        <Link href={PRIVACY_PATH} className="hover:text-white/70">
          Privacy
        </Link>{" "}
        pages. This is not investment advice.
      </p>
    </div>
  );
}
