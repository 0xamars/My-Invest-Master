"use client";

import { useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useGoToMarketingHome } from "@/lib/navigation/marketing-home";
import { buildAccountExportPayload } from "@/lib/account/export";
import {
  deleteOwnPlanRows,
  loadAccountExportRows,
} from "@/lib/supabase/user-data";

export function DataSettingsCard() {
  const { user, signOut } = useAuth();
  const goHome = useGoToMarketingHome();
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!user) return null;

  async function handleExport() {
    if (!user) return;
    setError(null);
    setNote(null);
    setBusy("export");
    try {
      const rows = await loadAccountExportRows(user.id);
      const payload = buildAccountExportPayload({
        exportedAt: new Date().toISOString(),
        userId: user.id,
        ...rows,
      });
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `investsalsa-export-${payload.exportedAt.slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to export plans.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!user) return;
    setError(null);
    setNote(null);
    setBusy("delete");
    try {
      await deleteOwnPlanRows(user.id);
      const response = await fetch("/api/account/delete", { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as {
        authUserDeleted?: boolean;
        message?: string;
        error?: string;
      };
      if (!response.ok && response.status !== 200) {
        throw new Error(body.error ?? "Unable to finish account delete.");
      }
      await signOut();
      if (body.authUserDeleted) {
        setNote("Account deleted.");
      } else {
        setNote(
          body.message ??
            "Plan rows deleted and you are signed out. Auth user was not removed (no service role on the server).",
        );
      }
      goHome();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to delete account.",
      );
    } finally {
      setBusy(null);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your data</CardTitle>
          <CardDescription>
            Export the three plan documents you can already read, or delete
            those rows and sign out. This does not invent balances.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void handleExport()}
              disabled={busy !== null}
            >
              {busy === "export" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Export plans
            </Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={busy !== null}
            >
              <Trash2 className="size-4" />
              Delete account
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This deletes your budget, retirement, and portfolio plan rows,
              then signs you out. It cannot be undone from this app.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={busy === "delete"}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={busy === "delete"}
            >
              {busy === "delete" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Delete plans and sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
