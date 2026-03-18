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
    <div className="p-3 mt-2 bg-white border rounded-md dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">{title}</label>
          <pre className="p-2 overflow-auto text-sm whitespace-pre-wrap border border-gray-200 rounded-md bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
            {suggestion}
          </pre>
        </div>
        <div className="flex flex-col gap-2 ml-3">
          <Button type="button" onClick={onApply} className="px-3 py-1 text-sm text-white rounded-md bg-success hover:bg-green-700">Load</Button>
          <Button type="button" onClick={onDiscard} className="px-3 py-1 text-sm rounded-md bg-surface-muted dark:bg-gray-700">Discard</Button>
        </div>
      </div>
    </div>
  );
}
