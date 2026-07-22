"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: "sign-in" | "sign-up";
  onSuccess?: () => void;
}

export function AuthDialog({
  open,
  onOpenChange,
  defaultMode = "sign-in",
  onSuccess,
}: AuthDialogProps) {
  const { isConfigured, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setError(null);
      setMessage(null);
    }
  }, [open, defaultMode]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    const result =
      mode === "sign-in"
        ? await signIn(email, password)
        : await signUp(email, password);

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (mode === "sign-up") {
      setMessage(
        "Account created. If email confirmation is required, check your inbox, then sign in.",
      );
      setMode("sign-in");
      return;
    }

    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "sign-in" ? "Sign in" : "Create account"}
          </DialogTitle>
          <DialogDescription>
            {mode === "sign-in"
              ? "Sign in to access your portfolio and options. Credentials are stored securely by Supabase Auth."
              : "Create an account to store portfolio and options in Supabase. Access your holdings from any browser or device."}
          </DialogDescription>
        </DialogHeader>

        {!isConfigured ? (
          <p className="text-sm text-muted-foreground">
            Cloud auth is not configured. Add Supabase credentials to{" "}
            <code className="text-xs">.env.local</code> and run the database
            migration.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">Password</Label>
              <Input
                id="auth-password"
                type="password"
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && (
              <p className="text-sm text-muted-foreground">{message}</p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {mode === "sign-in" ? "Sign in" : "Create account"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                  setError(null);
                  setMessage(null);
                }}
              >
                {mode === "sign-in"
                  ? "Need an account? Sign up"
                  : "Already have an account? Sign in"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
