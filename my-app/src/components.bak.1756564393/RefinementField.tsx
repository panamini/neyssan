"use client";

import React, { useState, useMemo } from "react";
import LoadingSpinner from "./LoadingSpinner";
import { Input } from "./ui/input";
import { Card } from "./ui/card";

export interface RefinementFieldProps {
  label: string;
  // `value` is the canonical string stored in parent. For JSON-backed fields this
  // remains a JSON string; this component will show a human-friendly preview.
  value: string;
  suggestion?: string | null;
  isLoading?: boolean;
  onAccept?: () => void;
  onClear?: () => void;
  onDiscard?: () => void;
  // Called when the user edits the left side content. The argument should be a
  // JSON string for JSON-backed fields (parent decides how to interpret).
  onChange?: (newValue: string) => void;
  // How to render the preview: 'text' = plain text, 'chips' = comma-separated chips,
  // 'list' = JSON array -> human list.
  displayMode?: "text" | "chips" | "list";
}

/**
 * Lightweight helpers to convert JSON arrays into human-readable lists and back.
 * jsonToHumanList: given a JSON array string, returns a readable bullet list.
 * humanListToJson: given human-editable text (items separated by blank lines),
 *                 return an array of simple objects [{ description: "..." }, ...]
 *
 * These converters are intentionally conservative: they don't try to guess rich
 * structure, they preserve user text in a description field to avoid loss.
 */

export function jsonToHumanList(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) return String(jsonString);
    return parsed
      .map((item: any) => {
        const title = item.title || item.degree || item.company || item.institution || item.name || "";
        const details = [item.company || item.institution || "", item.startDate || "", item.endDate || ""]
          .filter(Boolean)
          .join(" • ");
        let human = title ? `• ${title}` : `•`;
        if (details) human += `\n  ${details}`;
        if (item.description) human += `\n  ${String(item.description).replace(/\n/g, "\n  ")}`;
        // If no structured fields present, but the object is a string or has no known keys,
        // stringify the object as a fallback description.
        if (!title && !details && !item.description) {
          return `• ${JSON.stringify(item)}`;
        }
        return human;
      })
      .join("\n\n");
  } catch {
    return String(jsonString);
  }
}

export function humanListToJson(text: string): any[] {
  // Split on blank lines to get items
  const items = String(text || "").split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  if (items.length === 0) return [];
  return items.map(item => {
    // If item starts with a bullet, remove it and unindent
    const normalized = item.replace(/^\s*[\-\*\•]\s*/, "").replace(/\n\s{2}/g, "\n");
    // Heuristic: first line may be title, subsequent lines are details/description.
    const lines = normalized.split(/\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 1) {
      return { description: lines[0] };
    }
    const [first, ...rest] = lines;
    return { title: first, description: rest.join("\n") };
  });
}

export function RefinementField({
  label,
  value,
  suggestion = null,
  isLoading = false,
  onAccept,
  onClear,
  onDiscard,
  onChange,
  displayMode = "text",
}: RefinementFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  // local editable text (human-readable)
  const initialHuman = useMemo(() => {
    if (displayMode === "chips") {
      // For chips, value is expected to be a comma-separated string
      return String(value ?? "");
    }
    if (displayMode === "list") {
      return jsonToHumanList(String(value ?? "[]"));
    }
    return String(value ?? "");
  }, [value, displayMode]);

  const [localText, setLocalText] = useState<string>(initialHuman);

  // keep localText in sync when value changes externally (but avoid clobber while editing)
  React.useEffect(() => {
    if (!isEditing) setLocalText(initialHuman);
  }, [initialHuman, isEditing]);

  function applyEdit() {
    if (!onChange) {
      setIsEditing(false);
      return;
    }
    try {
      if (displayMode === "chips") {
        // normalize chips into comma-separated string and propagate immediately
        const normalized = localText.split(",").map(s => s.trim()).filter(Boolean).join(", ");
        onChange(normalized);
        // ensure localText reflects the normalized value so preview is stable
        setLocalText(normalized);
      } else if (displayMode === "list") {
        const arr = humanListToJson(localText);
        const json = JSON.stringify(arr, null, 2);
        onChange(json);
        // update localText to the canonical human-readable representation
        setLocalText(jsonToHumanList(json));
      } else {
        onChange(localText);
      }
      setIsEditing(false);
    } catch (e) {
      // swallow - parent should validate on save
      setIsEditing(false);
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</h4>
        <div className="flex items-center gap-2">
          {onChange && (
            <button
              type="button"
              onClick={() => setIsEditing(e => !e)}
              className="px-2 py-1 text-xs text-gray-600 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
              aria-label={isEditing ? `Show preview for ${label}` : `Edit ${label}`}
            >
              {isEditing ? "Preview" : "Edit"}
            </button>
          )}
          <button
            aria-label={`Clear ${label}`}
            title={`Clear ${label}`}
            onClick={onClear}
            className="p-1 text-gray-500 rounded hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 3h8l1 4H7l1-4z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex items-stretch gap-4">
        {/* Left: Draft / Original */}
        <Card className="flex-1">
          <label className="sr-only">{label} (Draft)</label>

          {isEditing ? (
            // For 'chips' mode we render a simple inline input and update parent live.
            displayMode === "chips" ? (
              <Input
                value={localText}
                onChange={(e) => {
                  const next = e.target.value;
                  setLocalText(next);
                  if (onChange) {
                    const normalized = String(next ?? "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .join(", ");
                    try {
                      onChange(normalized);
                    } catch {
                      /* swallow */
                    }
                  }
                }}
                placeholder="Enter skills, separated by commas"
                className="w-full"
                size="sm"
                variant="default"
                aria-label={`${label} edit`}
              />
            ) : (
              <textarea
                value={localText}
                onChange={e => setLocalText(e.target.value)}
                rows={6}
                className="w-full p-2 font-sans text-sm text-gray-900 border rounded-md bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            )
          ) : displayMode === "chips" ? (
            <div className="flex flex-wrap gap-2">
              {String(value || "")
                .split(",")
                .map(s => s.trim())
                .filter(Boolean)
                .map((chip, idx) => (
                  <span key={idx} className="px-2 py-1 text-xs text-purple-800 bg-purple-100 rounded-full dark:bg-purple-900 dark:text-purple-200">
                    {chip}
                  </span>
                ))}
            </div>
          ) : displayMode === "list" ? (
            <div className="h-full min-h-[96px] overflow-auto text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
              {jsonToHumanList(String(value ?? "[]"))}
            </div>
          ) : (
            <div className="h-full min-h-[96px] overflow-auto text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
              {String(value ?? "")}
            </div>
          )}
      </Card>

        {/* Right: Suggestion */}
        <Card className="relative flex-1 bg-gray-50 dark:bg-gray-800">
          <label className="sr-only">{label} (Suggestion)</label>

          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">Refining...</span>
            </div>
          ) : suggestion ? (
            <>
              <div className="h-full min-h-[96px] overflow-auto text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap transition-opacity duration-300 ease-in">
                {suggestion}
              </div>

              <div className="absolute flex flex-col gap-2 top-2 right-2">
                <button
                  aria-label={`Accept suggestion for ${label}`}
                  title="Accept suggestion (will replace your draft)"
                  onClick={onAccept}
                  className="px-2 py-1 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Accept
                </button>
                <button
                  aria-label={`Discard suggestion for ${label}`}
                  title="Discard suggestion"
                  onClick={onDiscard}
                  className="px-2 py-1 text-sm bg-gray-200 rounded-md dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none"
                >
                  Discard
                </button>
              </div>
            </>
          ) : (
            <div className="h-full min-h-[96px] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              No suggestion
            </div>
          )}
        </Card>
      </div>

      {/* Editing footer actions */}
      {isEditing && (
        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={() => {
              // cancel: revert local text to the computed initialHuman
              setLocalText(initialHuman);
              setIsEditing(false);
            }}
            className="px-3 py-1 text-sm bg-gray-200 rounded-md"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={applyEdit}
            className="px-3 py-1 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}