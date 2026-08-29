"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BudgetCategory, BudgetCategoryGroup } from "@/types/budget";

interface EditCategoryGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: BudgetCategoryGroup | null;
  onSave: (name: string) => void;
}

export function EditCategoryGroupDialog({
  open,
  onOpenChange,
  group,
  onSave,
}: EditCategoryGroupDialogProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open && group) setName(group.name);
  }, [open, group]);

  function handleSubmit() {
    if (!name.trim()) return;
    onSave(name);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Envelope Group</DialogTitle>
          <DialogDescription>Rename this envelope group.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-1">
          <Label htmlFor="edit-group-name">Group name</Label>
          <Input
            id="edit-group-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSubmit();
            }}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteCategoryGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: BudgetCategoryGroup | null;
  categoryCount: number;
  otherGroups: BudgetCategoryGroup[];
  onDeleteEmpty: () => void;
  onMoveCategories: (targetGroupId: string) => void;
  onDeleteWithCategories: () => void;
}

export function DeleteCategoryGroupDialog({
  open,
  onOpenChange,
  group,
  categoryCount,
  otherGroups,
  onDeleteEmpty,
  onMoveCategories,
  onDeleteWithCategories,
}: DeleteCategoryGroupDialogProps) {
  const [targetGroupId, setTargetGroupId] = useState("");

  useEffect(() => {
    if (open) {
      setTargetGroupId(otherGroups[0]?.id ?? "");
    }
  }, [open, otherGroups]);

  const hasCategories = categoryCount > 0;
  const canMove = otherGroups.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Envelope Group</DialogTitle>
          <DialogDescription>
            {hasCategories
              ? `"${group?.name}" contains ${categoryCount} envelope${categoryCount === 1 ? "" : "s"}. Choose what to do with them.`
              : `Delete "${group?.name}"? This cannot be undone.`}
          </DialogDescription>
        </DialogHeader>

        {hasCategories ? (
          <div className="space-y-4 py-1">
            {canMove && (
              <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3">
                <p className="text-sm font-medium text-foreground">
                  Move envelopes to another group
                </p>
                <Select
                  value={targetGroupId}
                  onValueChange={(value) => setTargetGroupId(value ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherGroups.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  className="w-full"
                  disabled={!targetGroupId}
                  onClick={() => {
                    if (!targetGroupId) return;
                    onMoveCategories(targetGroupId);
                    onOpenChange(false);
                  }}
                >
                  Move & Delete Group
                </Button>
              </div>
            )}

            <div className="space-y-2 rounded-lg border border-[var(--brand-red)]/30 bg-[var(--brand-red)]/8 p-3">
              <p className="text-sm font-medium text-foreground">
                Delete group and all envelopes
              </p>
              <p className="text-xs text-muted-foreground">
                Envelopes, goals, and assignments will be removed. Transactions
                will become unassigned.
              </p>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() => {
                  onDeleteWithCategories();
                  onOpenChange(false);
                }}
              >
                Delete Everything
              </Button>
            </div>
          </div>
        ) : (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onDeleteEmpty();
                onOpenChange(false);
              }}
            >
              Delete Group
            </Button>
          </DialogFooter>
        )}

        {hasCategories && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EditCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: BudgetCategory | null;
  categoryGroups: BudgetCategoryGroup[];
  onSave: (name: string, groupId: string) => void;
}

export function EditCategoryDialog({
  open,
  onOpenChange,
  category,
  categoryGroups,
  onSave,
}: EditCategoryDialogProps) {
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");

  const sortedGroups = useMemo(
    () => [...categoryGroups].sort((a, b) => a.sortOrder - b.sortOrder),
    [categoryGroups],
  );

  useEffect(() => {
    if (open && category) {
      setName(category.name);
      setGroupId(category.groupId);
    }
  }, [open, category]);

  function handleSubmit() {
    if (!name.trim() || !groupId) return;
    onSave(name, groupId);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Envelope</DialogTitle>
          <DialogDescription>
            Rename this envelope or move it to a different group.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="edit-category-name">Envelope name</Label>
            <Input
              id="edit-category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Envelope group</Label>
            <Select value={groupId} onValueChange={(value) => setGroupId(value ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {sortedGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: BudgetCategory | null;
  onConfirm: () => void;
}

export function DeleteCategoryDialog({
  open,
  onOpenChange,
  category,
  onConfirm,
}: DeleteCategoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Envelope</DialogTitle>
          <DialogDescription>
            Delete &ldquo;{category?.name}&rdquo;? Goals and assignments for this
            envelope will be removed. Linked transactions will become
            unassigned.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Delete Envelope
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
