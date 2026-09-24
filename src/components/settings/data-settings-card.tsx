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
  deleteOwnUserData,
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
      const response = await fetch("/api/account/delete", { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as {
        authUserDeleted?: boolean;
        dataDeleted?: boolean;
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to finish account delete.");
      }
      if (!body.dataDeleted) {
        await deleteOwnUserData(user.id);
      }
      await signOut();
      if (body.authUserDeleted) {
        setNote("Account deleted. Linked banks were disconnected first.");
      } else if (body.dataDeleted) {
        setNote(
          body.message ??
            "Account data was deleted and you are signed out. The auth user was not removed.",
        );
      } else {
        setNote(
          body.message ??
            "Your account data was deleted and you are signed out. Bank connections stay until the server can disconnect them.",
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
            Download your account data, or delete the account. The download
            leaves out bank access tokens. Deleting the account disconnects
            linked banks before those tokens are removed.
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
              Export data
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
              This deletes your account data, disconnects linked banks, and
              signs you out. It cannot be undone from this app.
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
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
