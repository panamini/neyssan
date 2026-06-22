/* eslint-disable react-refresh/only-export-components -- Existing mixed component/helper exports are outside this release-gate cleanup; split exports in a focused follow-up. */
"use client";

import React, { useState, useMemo } from "react";
import { TrashSimple } from "@/lib/icons";
import { Button } from "./ui/button";
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
  // Called when user toggles from Edit -> Preview (should trigger immediate persist).
  onPreview?: () => void;
  // How to render the preview: 'text' = plain text, 'chips' = comma-separated chips,
  // 'list' = JSON array -> human list.
  displayMode?: "text" | "chips" | "list";
  // fieldKey helps the parent identify which field this instance represents for undo
  fieldKey?: "summary" | "skills" | "experience" | "education" | "achievements";
  // Optional per-field undo handler provided by parent (if available)
  onUndo?: () => void;
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
        const title =
          item.title ||
          item.degree ||
          item.company ||
          item.institution ||
          item.name ||
          "";
        const details = [
          item.company || item.institution || "",
          item.startDate || "",
          item.endDate || "",
        ]
          .filter(Boolean)
          .join(" • ");
        let human = title ? `• ${title}` : `•`;
        if (details) human += `\n  ${details}`;
        if (item.description)
          human += `\n  ${String(item.description).replace(/\n/g, "\n  ")}`;
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
  const items = String(text || "")
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length === 0) return [];
  return items.map((item) => {
    // If item starts with a bullet, remove it and unindent
    const normalized = item
      .replace(/^\s*[\-\*\•]\s*/, "")
      .replace(/\n\s{2}/g, "\n");
    // Heuristic: first line may be title, subsequent lines are details/description.
    const lines = normalized
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
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
  onPreview,
  displayMode = "text",
  onUndo,
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
      if (onPreview) onPreview();
      return;
    }
    try {
      if (displayMode === "chips") {
        // normalize chips into comma-separated string and propagate immediately
        const normalized = localText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ");
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
      if (onPreview) onPreview();
    } catch (e) {
      // swallow - parent should validate on save
      setIsEditing(false);
      if (onPreview) onPreview();
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-medium text-muted">{label}</h4>
        <div className="flex items-center gap-2">
          {onChange && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                if (isEditing) applyEdit();
                else setIsEditing(true);
              }}
              ariaLabel={
                isEditing ? `Show preview for ${label}` : `Edit ${label}`
              }
              className="px-2 py-1 text-xs rounded text-muted bg-surface-muted"
            >
              {isEditing ? "Preview" : "Edit"}
            </Button>
          )}
          <button
            aria-label={`Clear ${label}`}
            title={`Clear ${label}`}
            onClick={onClear}
            className="p-1 rounded [color:var(--tm2)] hover:[background:var(--sf2)]"
          >
            <TrashSimple className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
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
                aria-label={`${label} edit`}
                value={localText}
                onChange={(e) => setLocalText(e.target.value)}
                rows={6}
                className="w-full p-2 font-sans text-sm [color:var(--ti)] border [border-color:var(--color-border)] rounded-md [background:var(--sf1)] focus:outline-none focus:[box-shadow:0_0_0_3px_var(--fr)]"
              />
            )
          ) : displayMode === "chips" ? (
            <div className="flex flex-wrap gap-2">
              {String(value || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .map((chip, idx) => (
                  <span key={idx} className="chip">
                    {chip}
                  </span>
                ))}
            </div>
          ) : displayMode === "list" ? (
            <div className="h-full min-h-[96px] overflow-auto text-sm [color:var(--ti)] whitespace-pre-wrap">
              {jsonToHumanList(String(value ?? "[]"))}
            </div>
          ) : (
            <div className="h-full min-h-[96px] overflow-auto text-sm [color:var(--ti)] whitespace-pre-wrap">
              {String(value ?? "")}
            </div>
          )}
        </Card>

        {/* Right: Suggestion */}
        <Card className="relative flex-1 bg-background">
          <label className="sr-only">{label} (Suggestion)</label>

          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner />
              <span className="ml-2 text-sm text-muted">Refining...</span>
            </div>
          ) : (
            <>
              {/* Suggestion rendering varies by displayMode for consistent token styling */}
              {suggestion ? (
                displayMode === "chips" ? (
                  <div className="flex flex-wrap gap-2 h-full min-h-[96px] overflow-auto">
                    {String(suggestion || "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((chip, idx) => (
                        <span key={idx} className="chip">
                          {chip}
                        </span>
                      ))}
                  </div>
                ) : (
                  <div className="h-full min-h-[96px] overflow-auto text-sm text-foreground whitespace-pre-wrap [transition:opacity_.22s_var(--ez)]">
                    {suggestion}
                  </div>
                )
              ) : (
                <div className="h-full min-h-[96px] flex items-center justify-center text-sm text-muted">
                  No suggestion
                </div>
              )}

              <div className="absolute flex flex-col gap-2 top-2 right-2">
                <Button
                  ariaLabel={`Accept suggestion for ${label}`}
                  title="Accept suggestion (will replace your draft)"
                  onClick={onAccept}
                  disabled={!suggestion}
                  className="px-2 py-1 text-sm rounded-md text-background bg-surface hover:opacity-95 focus:outline-none focus:[box-shadow:0_0_0_3px_var(--fr)]"
                >
                  Accept
                </Button>
                <Button
                  ariaLabel={`Discard suggestion for ${label}`}
                  title="Discard suggestion"
                  onClick={onDiscard}
                  disabled={!suggestion}
                  className="px-2 py-1 text-sm rounded-md bg-surface-muted hover:opacity-95 focus:outline-none"
                >
                  Discard
                </Button>
                {onUndo && (
                  <Button
                    ariaLabel={`Undo last applied suggestion for ${label}`}
                    title="Undo last applied suggestion (per-field)"
                    onClick={onUndo}
                    className="px-2 py-1 text-sm rounded-md bg-surface text-muted hover:opacity-95 focus:outline-none focus:[box-shadow:0_0_0_3px_var(--fr)]"
                  >
                    Undo
                  </Button>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Editing footer actions */}
      {isEditing && (
        <div className="flex justify-end gap-2 mt-2">
          <Button
            type="button"
            onClick={() => {
              // cancel: revert local text to the computed initialHuman
              setLocalText(initialHuman);
              setIsEditing(false);
            }}
            className="px-3 py-1 text-sm rounded-md bg-surface-muted"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={applyEdit}
            className="px-3 py-1 text-sm rounded-md text-background bg-accent hover:opacity-95 focus:outline-none focus:[box-shadow:0_0_0_3px_var(--fr)]"
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
