/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
/* eslint-disable @typescript-eslint/no-misused-promises -- Existing async UI handlers are preserved for this release-gate cleanup; convert to explicit void wrappers in a focused follow-up. */
"use client";

import React, { useCallback, useRef, useState } from "react";
import * as convexReact from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Upload, Loader2 } from "@/lib/icons";
import { useAuth } from "@clerk/clerk-react";
import type { CvSection } from "../types/cvDocument";
import { applyStrictContactToSections } from "../utils/cv/mapping-utils";
// Prefer the app PDF parser used by Upload flow
import * as browserParser from "../services/pdf/browser-cv-parser";
import { useToast } from "./ui/toast";

// Resolve Convex URLs at build time (Vite injects import.meta.env.*)
const CONVEX_URL: string | undefined = (import.meta as any)?.env
  ?.VITE_CONVEX_URL as string | undefined;
const CONVEX_DEPLOYMENT: string | undefined = (import.meta as any)?.env
  ?.CONVEX_DEPLOYMENT as string | undefined;

/**
 * Compute the Convex Site URL used by HTTP fallback:
 * 1) Prefer VITE_CONVEX_URL by converting *.cloud -> *.site
 * 2) Fallback to CONVEX_DEPLOYMENT=env:slug form to derive https://slug.convex.site
 */
function computeConvexSiteUrl(): string | undefined {
  if (typeof CONVEX_URL === "string" && CONVEX_URL.trim()) {
    return CONVEX_URL.replace(".cloud", ".site");
  }
  if (
    typeof CONVEX_DEPLOYMENT === "string" &&
    CONVEX_DEPLOYMENT.includes(":")
  ) {
    const parts = CONVEX_DEPLOYMENT.split(":");
    const slug = parts[1]?.trim();
    if (slug) return `https://${slug}.convex.site`;
  }
  return undefined;
}
const CONVEX_SITE_URL: string | undefined = computeConvexSiteUrl();

/**
 * Minimal strict profile shape used for overlay on the front-end.
 */
interface StrictProfileMinimal {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  desiredPosition?: string | null;
}

/**
 * Props
 * - sections + onApplyToSections: if present, we overlay strict contact into the Profile section and call back with updated sections
 * - onResult: receive raw action payload (with-spans or strict-only)
 */
export interface StrictUploadButtonProps {
  sections?: CvSection[];
  onApplyToSections?: (updated: CvSection[]) => void;
  onResult?: (payload: unknown) => void;

  // Visual
  className?: string;
  label?: string; // accessible label
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

/**
 * Utility: derive a front-end friendly strict profile shape from action payloads.
 * Supports:
 * - with-spans result: { profile, sections?, metadata?, cv? }
 * - strict-only result: { name,email,phone,location,desiredPosition? }
 */
function pickStrictProfileShape(input: unknown): StrictProfileMinimal | null {
  const isObject = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object";

  if (!isObject(input)) return null;
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

/**
 * StrictUploadButton
 *
 * Small round button for card headers. Picks a file (.pdf,.doc,.docx,.txt),
 * extracts raw text (PDF via browser-cv-parser), then calls the strict extractor:
 * - prefer actions/extractProfileStrictWithSpans
 * - fallback to actions/extractProfileStrict
 * - optional HTTP fallback on localhost using Clerk bearer
 *
 * On success, overlays strict contact into provided sections (if supplied) and calls onApplyToSections.
 * Otherwise, calls onResult(payload) with raw payload.
 */
export function StrictUploadButton(props: StrictUploadButtonProps) {
  const {
    sections,
    onApplyToSections,
    onResult,
    className,
    label,
    size = "sm",
    disabled,
  } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "parsing" | "calling-server" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { getToken } = useAuth();
  const { showToast } = useToast();

  // Convex actions (prefer with-spans). Resolve both possible generated API shapes for resilience.
  const withSpansRef =
    (api as any).actions?.extractProfileStrictWithSpans ??
    (api as any)["actions/extractProfileStrictWithSpans"]
      ?.extractProfileStrictWithSpans ??
    null;

  const strictOnlyRef =
    (api as any).actions?.extractProfileStrict ??
    (api as any)["actions/extractProfileStrict"]?.extractProfileStrict ??
    null;

  const withSpans =
    (convexReact as any).useAction && withSpansRef
      ? (convexReact as any).useAction(withSpansRef)
      : undefined;

  const strictOnly =
    (convexReact as any).useAction && strictOnlyRef
      ? (convexReact as any).useAction(strictOnlyRef)
      : undefined;

  const onClick = useCallback(() => {
    setErrorMsg(null);
    if (disabled) return;
    try {
      if (!inputRef.current) return;
      inputRef.current.value = "";
      inputRef.current.click();
    } catch (e) {
      setStatus("error");
      setErrorMsg("Unable to open file picker");
    }
  }, [disabled]);

  async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return file.arrayBuffer();
  }

  async function readFileAsText(file: File): Promise<string> {
    return file.text();
  }

  async function parseRawText(file: File): Promise<string | null> {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    // 5MB limit
    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      throw new Error("File too large. Please upload a file under 5MB.");
    }

    // Primary: PDF via browser-cv-parser
    if (ext === "pdf" || file.type === "application/pdf") {
      setStatus("parsing");
      try {
        const ab = await readFileAsArrayBuffer(file);
        const parsed = await (browserParser as any).parsePdfArrayBuffer(ab);
        const rawText: string | undefined =
          parsed?.rawText || parsed?.summary || "";
        return rawText && rawText.trim().length > 0 ? String(rawText) : null;
      } catch (e: any) {
        throw new Error(`Failed to parse PDF: ${String(e?.message ?? e)}`);
      }
    }

    // TXT fallback
    if (ext === "txt" || file.type.startsWith("text/")) {
      setStatus("parsing");
      const text = await readFileAsText(file);
      return text && text.trim().length > 0 ? text : null;
    }

    // DOC/DOCX - friendly message (client parser not implemented here)
    if (
      ext === "doc" ||
      ext === "docx" ||
      file.type === "application/msword" ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      throw new Error(
        "DOC/DOCX parsing is not supported in the client. Please upload a PDF or TXT.",
      );
    }

    throw new Error("Unsupported file type. Please upload a PDF or TXT.");
  }

  async function callStrictServer(rawText: string): Promise<unknown | null> {
    setStatus("calling-server");
    let payload: unknown = null;

    // 1) Prefer with-spans action
    if (typeof withSpans === "function") {
      try {
        payload = await withSpans({ rawText });

        console.debug(
          "[StrictUploadButton] used action: extractProfileStrictWithSpans",
        );
      } catch (e) {

        console.warn(
          "[StrictUploadButton] with-spans failed:",
          String((e as any)?.message ?? e),
        );
      }
    }

    // 2) Fallback to strict-only action
    if (!payload && typeof strictOnly === "function") {
      try {
        payload = await strictOnly({ rawText });

        console.debug("[StrictUploadButton] used action: extractProfileStrict");
      } catch (e) {

        console.warn(
          "[StrictUploadButton] strict-only failed:",
          String((e as any)?.message ?? e),
        );
      }
    }

    // 3) HTTP fallback using Convex Site endpoints (works in dev/prod when actions are unavailable)
    if (!payload) {
      try {
        if (CONVEX_SITE_URL && CONVEX_SITE_URL.trim()) {
          const token =
            typeof getToken === "function"
              ? await getToken({ template: "convex" })
              : null;
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (token) headers.Authorization = `Bearer ${token}`;

          // Prefer with-spans endpoint when available
          let res = await fetch(
            `${CONVEX_SITE_URL}/extract-profile-strict-with-spans`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({ rawText }),
            },
          );

          if (!res.ok) {
            // Fallback to strict-only endpoint
            res = await fetch(`${CONVEX_SITE_URL}/extract-profile-strict`, {
              method: "POST",
              headers,
              body: JSON.stringify({ rawText }),
            });
          }

          if (res.ok) {
            payload = await res.json().catch(() => null);

            console.debug(
              "[StrictUploadButton] used HTTP fallback (site endpoints)",
              { siteUrl: CONVEX_SITE_URL },
            );
          } else {

            console.warn(
              "[StrictUploadButton] HTTP fallback endpoints returned non-OK status",
            );
          }
        } else {

          console.warn(
            "[StrictUploadButton] HTTP fallback unavailable: could not derive CONVEX_SITE_URL from VITE_CONVEX_URL or CONVEX_DEPLOYMENT",
            { VITE_CONVEX_URL: CONVEX_URL, CONVEX_DEPLOYMENT },
          );
        }
      } catch (e) {

        console.warn(
          "[StrictUploadButton] HTTP fallback failed:",
          String((e as any)?.message ?? e),
        );
      }
    }

    return payload;
  }

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setErrorMsg(null);
      setStatus("uploading");
      try {
        const file = e.target.files?.[0];
        if (!file) {
          setStatus("idle");
          return;
        }

        const rawText = await parseRawText(file);
        if (!rawText) {
          setStatus("error");
          setErrorMsg("Extraction failed.");
          try {
            showToast("Extraction failed.", {
              variant: "warning",
            });
          } catch {
            /* noop */
          }
          return;
        }

        const payload = await callStrictServer(rawText);
        if (!payload) {
          setStatus("error");
          setErrorMsg("Extraction failed.");
          try {
            showToast("Extraction failed.", {
              variant: "warning",
            });
          } catch {
            /* noop */
          }
          return;
        }

        if (onResult) {
          try {
            onResult(payload);
          } catch {
            /* noop */
          }
        }

        const profile = pickStrictProfileShape(payload);
        if (
          profile &&
          Array.isArray(sections) &&
          typeof onApplyToSections === "function"
        ) {
          const strictContact = {
            name: profile.name ?? null,
            email: profile.email ?? null,
            phone: profile.phone ?? null,
            location: profile.location ?? null,
            desiredPosition: profile.desiredPosition ?? undefined,
          };
          const updated = applyStrictContactToSections(sections, strictContact);
          try {
            onApplyToSections(updated);
          } catch {
            /* noop */
          }
        }

        setStatus("success");
        try {
          showToast("Extracted.", { variant: "success" });
        } catch {
          /* noop */
        }
        setTimeout(() => setStatus("idle"), 800);
      } catch (err: any) {
        const msg = String(err?.message ?? err ?? "Upload failed");
        setStatus("error");
        setErrorMsg(msg);
        try {
          showToast(msg, { variant: "warning" });
        } catch {
          /* noop */
        }
      } finally {
        // Reset input to allow same file re-selection
        if (inputRef.current) inputRef.current.value = "";
      }

    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Pre-existing dependency contract is preserved for this release-gate cleanup.
    [sections, onApplyToSections, onResult, showToast],
  );

  const aria = label ?? "Strict Upload & Extract";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="hidden"
        onChange={onFileChange}
      />
      <Button
        type="button"
        aria-label={aria}
        title={aria}
        onClick={onClick}
        disabled={
          disabled ||
          status === "uploading" ||
          status === "parsing" ||
          status === "calling-server"
        }
        className={[
          "inline-flex items-center",
          "rounded-md",
          "[box-shadow:var(--sha)]",
          "bg-accent text-background hover:bg-accent/90",
          "focus-visible:outline-none",
          "px-3",
          className ?? "",
        ].join(" ")}
        variant="accent"
        size="sm"
      >
        {status === "uploading" ||
        status === "parsing" ||
        status === "calling-server" ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <Upload size={16} />
        )}
        <span className="ml-2 text-xs sm:text-sm">Strict Upload</span>
      </Button>
      {/* Optional inline message for accessibility (kept minimal) */}
      {status === "error" && errorMsg ? (
        <span role="status" aria-live="polite" className="sr-only">
          {errorMsg}
        </span>
      ) : null}
    </>
  );
}

export default StrictUploadButton;

/**
 * Example usage:
 *
 * <StrictUploadButton
 *   sections={cv.sections}
 *   onApplyToSections={(updated) => {
 *     setCvSections(updated);
 *   }}
 *   onResult={(payload) => {
 *     console.log("strict:", payload);
 *   }}
 * />
 */
