"use client";

import { useEffect, useState } from "react";
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

interface AddCategoryGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string) => void;
}

export function AddCategoryGroupDialog({
  open,
  onOpenChange,
  onAdd,
}: AddCategoryGroupDialogProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  function handleSubmit() {
    if (!name.trim()) return;
    onAdd(name);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Envelope Group</DialogTitle>
          <DialogDescription>
            Group related envelopes together (e.g. Living Expenses).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-1">
          <Label htmlFor="group-name">Group name</Label>
          <Input
            id="group-name"
            placeholder="Future Goals"
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
            Add Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AddCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName?: string;
  groups?: Array<{ id: string; name: string }>;
  defaultGroupId?: string | null;
  onAdd: (name: string, groupId?: string) => void;
}

export function AddCategoryDialog({
  open,
  onOpenChange,
  groupName,
  groups,
  defaultGroupId,
  onAdd,
}: AddCategoryDialogProps) {
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState(defaultGroupId ?? groups?.[0]?.id ?? "");

  useEffect(() => {
    if (open) {
      setName("");
      setGroupId(defaultGroupId ?? groups?.[0]?.id ?? "");
    }
  }, [open, defaultGroupId, groups]);

  function handleSubmit() {
    if (!name.trim()) return;
    if (groups && groups.length > 0 && !groupId) return;
    onAdd(name, groupId || undefined);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Envelope</DialogTitle>
          <DialogDescription>
            {groupName
              ? `Add an envelope under ${groupName}.`
              : "Create a new spending envelope."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          {groups && groups.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="envelope-group">Group</Label>
              <Select
                value={groupId}
                onValueChange={(value) => setGroupId(value ?? "")}
              >
                <SelectTrigger id="envelope-group" className="w-full">
                  <SelectValue placeholder="Choose a group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Envelope name</Label>
            <Input
              id="category-name"
              placeholder="Groceries"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSubmit();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Add Envelope
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
