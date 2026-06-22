/* eslint-disable @typescript-eslint/no-misused-promises -- Existing async UI handlers are preserved for this release-gate cleanup; convert to explicit void wrappers in a focused follow-up. */
import React, { useCallback, useMemo, useState } from "react";
import * as convexReact from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Wand2, Loader2 } from "@/lib/icons";
import type { CvSection } from "../types/cvDocument";
import { applyStrictContactToSections } from "../utils/cv/mapping-utils";
import type { StrictContact } from "../utils/cv/mapping-utils";
import { useAuth } from "@clerk/clerk-react";

/**
 * StrictExtractButton
 *
 * A compact, round button that calls the server-side strict extractor (LLM + heuristics + optional spaCy NER)
 * to obtain robust contact fields and per-slot confidences from raw resume text. When sections are provided,
 * it applies a contact overlay to the Profile section using applyStrictContactToSections and returns the
 * updated sections via onApplyToSections.
 *
 * Usage:
 *   - Place this on the profile view card header area, pass a getRawText function that returns the resume raw text.
 *   - Optionally pass current sections and onApplyToSections to overlay strict contact into the document.
 *
 * Example:
 *   <StrictExtractButton
 *     getRawText={() => rawTextFromState}
 *     sections={cv.sections}
 *     onApplyToSections={(updated) => setCvSections(updated)}
 *   />
 */
export interface StrictExtractButtonProps {
  // Function returning raw resume text (string or null). Can be async.
  getRawText: () => Promise<string | null> | string | null;

  // Optional current typed sections (Profile section will be overlaid when strict contact is returned).
  sections?: CvSection[];

  // Optional callback to receive updated sections after overlay is applied.
  onApplyToSections?: (updated: CvSection[]) => void;

  // Optional callback to receive the raw strict result payload for custom handling.
  onResult?: (payload: unknown) => void;

  // Visual customization
  className?: string;
  label?: string; // Accessible label text (defaults to "Strict Extract")
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

interface StrictProfileMinimal {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  // desiredPosition is optional; if present we also forward it.
  desiredPosition?: string | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function pickStrictProfileShape(input: unknown): StrictProfileMinimal | null {
  if (!isObject(input)) return null;
  // Case A: richer with-spans shape { profile, sections?, metadata?, cv? }
  if (isObject((input as any).profile)) {
    const p = (input as any).profile as Record<string, unknown>;
    return {
      name:
        typeof p.name === "string" || p.name === null
          ? (p.name as string | null)
          : null,
      email:
        typeof p.email === "string" || p.email === null
          ? (p.email as string | null)
          : null,
      phone:
        typeof p.phone === "string" || p.phone === null
          ? (p.phone as string | null)
          : null,
      location:
        typeof p.location === "string" || p.location === null
          ? (p.location as string | null)
          : null,
      desiredPosition:
        typeof p.desiredPosition === "string" || p.desiredPosition === null
          ? (p.desiredPosition as string | null)
          : undefined,
    };
  }
  // Case B: strict-only shape is the profile itself at root
  const root = input as Record<string, unknown>;
  const hasSlots =
    ("name" in root ||
      "email" in root ||
      "phone" in root ||
      "location" in root) &&
    (typeof root.name === "string" ||
      root.name === null ||
      typeof root.email === "string" ||
      root.email === null);
  if (hasSlots) {
    return {
      name:
        typeof root.name === "string" || root.name === null
          ? (root.name as string | null)
          : null,
      email:
        typeof root.email === "string" || root.email === null
          ? (root.email as string | null)
          : null,
      phone:
        typeof root.phone === "string" || root.phone === null
          ? (root.phone as string | null)
          : null,
      location:
        typeof root.location === "string" || root.location === null
          ? (root.location as string | null)
          : null,
      desiredPosition:
        typeof root.desiredPosition === "string" ||
        root.desiredPosition === null
          ? (root.desiredPosition as string | null)
          : undefined,
    };
  }
  return null;
}

export function StrictExtractButton(props: StrictExtractButtonProps) {
  const {
    getRawText,
    sections,
    onApplyToSections,
    onResult,
    className,
    label,
    size = "md",
    disabled,
  } = props;
  const [isLoading, setIsLoading] = useState(false);
  const { getToken } = useAuth();

  // Prefer richer with-spans action; provide strict-only fallback
  // These dynamic lookups mirror existing patterns in the codebase to tolerate missing exports in dev.
  const extractWithSpans = (convexReact as any).useAction
    ? (convexReact as any).useAction(
        (api as any)["actions/extractProfileStrictWithSpans"]
          ?.extractProfileStrictWithSpans,
      )
    : undefined;

  const extractStrictOnly = (convexReact as any).useAction
    ? (convexReact as any).useAction(
        (api as any)["actions/extractProfileStrict"]?.extractProfileStrict,
      )
    : undefined;

  // Round button sizing using Tailwind while keeping shadcn/ui Button semantics
  const sizeClasses = useMemo(() => {
    switch (size) {
      case "sm":
        return "h-9 w-9";
      case "lg":
        return "h-12 w-12";
      case "md":
      default:
        return "h-10 w-10";
    }
  }, [size]);

  const hasAction =
    typeof extractWithSpans === "function" ||
    typeof extractStrictOnly === "function";

  const handleClick = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      // Resolve rawText from prop
      const raw = await (typeof getRawText === "function"
        ? getRawText()
        : getRawText);
      if (!raw || typeof raw !== "string" || raw.trim().length === 0) {
        setIsLoading(false);
        return;
      }

      let payload: unknown = null;

      // 1) Prefer Convex action with spans
      if (typeof extractWithSpans === "function") {
        try {

          payload = await extractWithSpans({ rawText: String(raw) });
        } catch (_err) {
          // fall back
        }
      }

      // 2) Fallback to strict-only Convex action
      if (!payload && typeof extractStrictOnly === "function") {
        try {

          const strictOnly = await extractStrictOnly({ rawText: String(raw) });
          if (strictOnly && typeof strictOnly === "object") {
            payload = strictOnly;
          }
        } catch (_err) {
          // fall through
        }
      }

      // 3) Optional HTTP fallback (best-effort) if both actions unavailable (auth via Clerk)
      if (!payload) {
        try {
          const CONVEX_URL = (import.meta as any)?.env?.VITE_CONVEX_URL ?? "";
          const CONVEX_SITE_URL: string =
            typeof CONVEX_URL === "string"
              ? CONVEX_URL.replace(".cloud", ".site")
              : "";
          if (CONVEX_SITE_URL) {
            const token =
              typeof getToken === "function"
                ? await getToken({ template: "convex" })
                : null;
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
            };
            if (token) headers.Authorization = `Bearer ${token}`;
            // Prefer with-spans endpoint if the project exposes matching HTTP handlers
            const res = await fetch(
              `${CONVEX_SITE_URL}/extract-profile-strict-with-spans`,
              {
                method: "POST",
                headers,
                body: JSON.stringify({ rawText: String(raw) }),
              },
            ).catch(async () => {
              // fallback endpoint name
              return fetch(`${CONVEX_SITE_URL}/extract-profile-strict`, {
                method: "POST",
                headers,
                body: JSON.stringify({ rawText: String(raw) }),
              });
            });
            if (res.ok) {
              payload = await res.json().catch(() => null);
            }
          }
        } catch {
          // ignore HTTP fallback failures
        }
      }

      if (onResult) {
        onResult(payload);
      }

      const profile = pickStrictProfileShape(payload);
      if (!profile) {
        setIsLoading(false);
        return;
      }

      // Apply overlay when sections + callback are provided
      if (Array.isArray(sections) && typeof onApplyToSections === "function") {
        const strictContact: StrictContact = {
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          location: profile.location,
          desiredPosition: profile.desiredPosition ?? undefined,
        };
        const updated = applyStrictContactToSections(sections, strictContact);
        onApplyToSections(updated);
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    getRawText,
    isLoading,
    extractWithSpans,
    extractStrictOnly,
    sections,
    onApplyToSections,
    onResult,
    getToken,
  ]);

  const aria = label ?? "Strict Extract";

  return (
    <Button
      type="button"
      aria-label={aria}
      title={aria}
      onClick={handleClick}
      disabled={disabled || isLoading || !hasAction}
      className={[
        "rounded-full",
        "[box-shadow:var(--sha)]",
        // Use theme variables via Tailwind utilities
        "bg-accent text-background hover:bg-accent/90",
        "focus-visible:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]",
        sizeClasses,
        className ?? "",
      ].join(" ")}
      variant="accent"
      size="sm"
    >
      {isLoading ? (
        <Loader2 className="animate-spin" size={18} />
      ) : (
        <Wand2 size={18} />
      )}
    </Button>
  );
}

export default StrictExtractButton;
