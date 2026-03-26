"use client";

import React from 'react';
import { Button } from "../ui/button";
import CVLoader from "../CVLoader";

interface ProfileReviewFooterProps {
  status: 'idle' | 'loading_cv' | 'refining' | 'saving' | 'completed' | 'failed' | 'enqueued' | 'running' | null;
  isFormEmpty: () => boolean;
  lastAppliedSnapshot: any;
  onFileParsed: (parsed: {
    id?: string;
    name?: string | null;
    email?: string | null;
    summary?: string | null;
    skills?: string[] | null;
    experience?: any[] | null;
    education?: any[] | null;
    achievements?: string[] | null;
    rawText?: string | null;
    confidence?: number;
    metadata?: Record<string, unknown> | null;
    version?: number;
  }) => void;
  onError: (text: string | null) => void;
  onRefineClick: () => void;
  onUndo: () => void;
}

export function ProfileReviewFooter({
  status,
  isFormEmpty,
  lastAppliedSnapshot,
  onFileParsed,
  onError,
  onRefineClick,
  onUndo,
}: ProfileReviewFooterProps) {
  return (
    <div className="flex items-center justify-between pt-4 mt-6 border-t [border-color:var(--color-border)]">
      <div className="flex gap-2">
        <CVLoader
          onFileParsed={(parsed) => onFileParsed(parsed)}
          onError={onError}
          label="Charger CV"
        />
        {lastAppliedSnapshot && (
          <Button onClick={onUndo} className="px-2 py-1 text-sm rounded bg-surface-muted">
            Undo
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3 ml-4">
        <Button
          variant="primary"
          onClick={onRefineClick}
          disabled={status !== 'idle' || isFormEmpty()}
        >
          Raffiner AI
        </Button>
      </div>
    </div>
  );
}