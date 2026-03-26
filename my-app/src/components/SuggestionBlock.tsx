"use client";
import { Button } from "./ui/button";
 
export interface SuggestionBlockProps {
  title: string;
  suggestion?: string | null;
  onApply: () => void;
  onDiscard: () => void;
}

export function SuggestionBlock({ title, suggestion, onApply, onDiscard }: SuggestionBlockProps) {
  if (!suggestion || String(suggestion).trim().length === 0) return null;

  return (
    <div className="p-3 mt-2 border rounded-md bg-surface">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <label className="block mb-1 text-sm font-medium text-muted">{title}</label>
          <pre className="p-2 overflow-auto text-sm whitespace-pre-wrap border [border-color:var(--color-border)] rounded-md [background:var(--sf1)]">
            {suggestion}
          </pre>
        </div>
        <div className="flex flex-col gap-2 ml-3">
          <Button type="button" onClick={onApply} className="px-3 py-1 text-sm rounded-md text-background bg-accent hover:opacity-95">Load</Button>
          <Button type="button" onClick={onDiscard} className="px-3 py-1 text-sm rounded-md bg-surface-muted">Discard</Button>
        </div>
      </div>
    </div>
  );
}
