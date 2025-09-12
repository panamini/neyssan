"use client";

import React from 'react';
import { Button } from '../ui/button';
import { CVDocumentReviewer } from '../CVDocumentReviewer';
import { IReviewerSection } from '../../types/profile';
import { useCvState } from '../../hooks/useCvState';
import { remirrorJsonToString } from '../../lib/utils';
import { useToast } from '../ui/toast';

type CvState = ReturnType<typeof useCvState>[0];
type CvActions = ReturnType<typeof useCvState>[1];

interface CVReviewerOverlayProps {
  visible: boolean;
  cvState: CvState;
  cvActions: CvActions;
  displayedSections: IReviewerSection[];
  onClose: () => void;
  onApplyRemaining: () => void;
  onReviewerEdit: (id: string, newContent: string) => void;
}

export function CVReviewerOverlay({
  visible,
  cvState,
  cvActions,
  displayedSections,
  onClose,
  onApplyRemaining,
  onReviewerEdit,
}: CVReviewerOverlayProps) {
  const { showToast } = useToast();

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-60 bg-black/50">
      <div className="w-full max-w-5xl bg-[var(--background)] dark:bg-[var(--background)] rounded-lg shadow-lg p-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Review parsed CV</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted">
              <input
                id="show-raw-sections-checkbox"
                type="checkbox"
                className="form-checkbox"
                checked={cvState?.controls?.showRaw ?? false}
                onChange={(e) => { const v = e.target.checked; cvActions.setControls({ showRaw: v }); }}
                aria-label="Show raw sections"
              />
              <label htmlFor="show-raw-sections-checkbox" className="ml-1 text-sm">Show raw sections</label>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted">
              <input
                id="use-mapper-stripping-checkbox"
                type="checkbox"
                className="form-checkbox"
                checked={cvState?.controls?.useMapperStripping ?? true}
                onChange={(e) => { const v = e.target.checked; cvActions.setControls({ useMapperStripping: v }); }}
                aria-label="Use mapper stripping"
              />
              <label htmlFor="use-mapper-stripping-checkbox" className="ml-1 text-sm">Use mapper stripping</label>
            </div>

            <Button onClick={() => { onClose(); try { showToast("Closed reviewer — no changes applied", { variant: "warning" }); } catch (e) {} }} className="px-3 py-1 rounded bg-surface-muted">Close</Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <CVDocumentReviewer
            sections={displayedSections}
            onDismiss={(id) => {
              const ms = cvState?.mappedSections ?? [];
              cvActions.setMappedSections(ms.map(s => s.id === id ? { ...s, dismissed: true } : s));
            }}
            onUndo={(id) => {
              const ms = cvState?.mappedSections ?? [];
              cvActions.setMappedSections(ms.map(s => s.id === id ? { ...s, dismissed: false } : s));
            }}
            onEdit={onReviewerEdit}
          />
        </div>

        <div className="flex justify-end gap-2 mt-3">
          <Button onClick={onApplyRemaining} className="px-3 py-2 rounded-md bg-accent text-background">Use remaining</Button>
        </div>
      </div>
    </div>
  );
}