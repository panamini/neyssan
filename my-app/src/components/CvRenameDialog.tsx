"use client";

import React from "react";
import { Dialog, DialogActions, DialogContent } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

interface CvRenameDialogProps {
  open: boolean;
  currentTitle: string;
  onClose: () => void;
  onSave: (nextTitle: string) => void;
  title?: string;
  placeholder?: string;
  saveLabel?: string;
}

export function CvRenameDialog({
  open,
  currentTitle,
  onClose,
  onSave,
  title = "Rename CV",
  placeholder = "CV title",
  saveLabel = "Save",
}: CvRenameDialogProps) {
  const [renameValue, setRenameValue] = React.useState(currentTitle);

  React.useEffect(() => {
    if (open) {
      setRenameValue(currentTitle);
    }
  }, [open, currentTitle]);

  const trimmedRenameValue = React.useMemo(() => renameValue.trim(), [renameValue]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!trimmedRenameValue) return;
    if (trimmedRenameValue === currentTitle.trim()) {
      onClose();
      return;
    }
    onSave(trimmedRenameValue);
  }

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit}>
        <DialogContent className="space-y-3">
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={!trimmedRenameValue}>
            {saveLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default CvRenameDialog;
