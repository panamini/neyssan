"use client";

import React from "react";
import { Dialog, DialogActions, DialogContent } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

interface ProposalSaveDialogProps {
  open: boolean;
  currentTitle: string;
  onClose: () => void;
  onSave: (nextTitle: string) => void;
}

export function ProposalSaveDialog({
  open,
  currentTitle,
  onClose,
  onSave,
}: ProposalSaveDialogProps) {
  const [titleValue, setTitleValue] = React.useState(currentTitle);

  React.useEffect(() => {
    if (open) {
      setTitleValue(currentTitle);
    }
  }, [currentTitle, open]);

  const trimmedTitleValue = React.useMemo(() => titleValue.trim(), [titleValue]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedTitleValue) {
      return;
    }
    onSave(trimmedTitleValue);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Save proposal to Library">
      <form onSubmit={handleSubmit}>
        <DialogContent className="space-y-3">
          <p
            style={{
              margin: 0,
              color: "var(--tm2)",
              fontSize: "var(--ts)",
              lineHeight: "var(--ls)",
            }}
          >
            Confirm the saved title now, or rename it before sending this proposal
            to the Library.
          </p>
          <Input
            value={titleValue}
            onChange={(event) => setTitleValue(event.target.value)}
            placeholder="Proposal title"
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={!trimmedTitleValue}>
            Save to Library
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default ProposalSaveDialog;
