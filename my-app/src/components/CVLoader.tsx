/* eslint-disable @typescript-eslint/no-misused-promises -- Existing async UI handlers are preserved for this release-gate cleanup; convert to explicit void wrappers in a focused follow-up. */
"use client";

import { useState, useEffect, useRef } from "react";
import { parsePdfArrayBuffer } from "../services/pdf/browser-cv-parser";
import LoadingSpinner from "./LoadingSpinner";
import { Button } from "./ui/button";

type NormalizedProfile = { id?: string; name?: string | null; email?: string | null; summary?: string | null; skills?: string[] | null; experience?: any[] | null; education?: any[] | null; achievements?: string[] | null; rawText?: string | null; confidence?: number; metadata?: Record<string, unknown> | null; version?: number; };

type Props = {
  onFileParsed: (parsedProfile: NormalizedProfile) => void;
  onError: (message: string | null) => void;
  label?: string;
};

export default function CVLoader({ onFileParsed, onError, label = "Load CV" }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [parsing, setParsing] = useState(false);
  const [sessionDataExists, setSessionDataExists] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("pdf_ingest_last_parsed")) {
        setSessionDataExists(true);
      }
    } catch (e) {
      console.error("Error accessing sessionStorage:", e);
    }
  }, []);


  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    onError(null);
    // Intentionally do not call onSuccess here to avoid transient toasts

    try {
      const arrayBuffer = await file.arrayBuffer();
      const parsed = await parsePdfArrayBuffer(arrayBuffer);

      try {
        sessionStorage.setItem("pdf_ingest_last_parsed", JSON.stringify(parsed));
        setSessionDataExists(true);
      } catch (err) {
        console.error("Failed to save to sessionStorage:", err);
      }

      onFileParsed(parsed as NormalizedProfile);
      // Do not trigger onSuccess toast here; parent handles explicit messaging.
    } catch (err: any) {
      onError(err?.message ?? "Failed to parse CV");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
      setParsing(false);
    }
  };

  // reuse cached parsed CV from sessionStorage and call callbacks
  const reuseCached = () => {
    try {
      const raw = sessionStorage.getItem("pdf_ingest_last_parsed");
      if (!raw) {
        setSessionDataExists(false);
        onError("No cached CV available");
        return;
      }
      const parsed = JSON.parse(raw);
      console.debug("CVLoader: reuseCached parsed =", parsed);

      // basic validation of the cached object to avoid no-op restores
      const hasContent =
        parsed &&
        (parsed.name ||
          parsed.email ||
          parsed.rawText ||
          (Array.isArray(parsed.skills) && parsed.skills.length > 0) ||
          (Array.isArray(parsed.experience) && parsed.experience.length > 0));
      if (!hasContent) {
        console.warn("CVLoader: cached CV appears empty or invalid — clearing cache");
        clearCache();
        onError("Cached CV was invalid and has been cleared");
        return;
      }

      onError(null);
      // Do not trigger onSuccess toast here; parent handles explicit messaging.
      onFileParsed(parsed as NormalizedProfile);
    } catch (e) {
      console.error("Failed to reuse cached CV:", e);
      onError("Failed to restore cached CV");
    }
  };

  // clear cached parsed CV
  const clearCache = () => {
    try {
      sessionStorage.removeItem("pdf_ingest_last_parsed");
    } catch (e) {
      console.error("Failed to clear sessionStorage:", e);
    }
    setSessionDataExists(false);
    // Let parent handle showing any toasts to avoid duplicates.
    // onSuccess intentionally not called to avoid extra toasts.
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.doc,.docx"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden
      />

      {/* Main action: reuse cached parse when available, otherwise open file picker */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => {
            if (parsing) return;
            if (sessionDataExists) {
              reuseCached();
            } else {
              inputRef.current?.click();
            }
          }}
          disabled={parsing}
          className="px-3 py-1"
          ariaLabel={sessionDataExists ? "Reuse last parsed CV" : "Load CV"}
          title={sessionDataExists ? "Reuse previously parsed CV" : label}
        >
          {parsing ? (
            <>
              <LoadingSpinner />
              <span className="text-xs">Parsing…</span>
            </>
          ) : (
            <span className="text-sm">
              {sessionDataExists ? "Reuse last CV" : label}
            </span>
          )}
        </Button>

        {/* Clear cached CV control (small, less intrusive than a full button) */}
        {sessionDataExists && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={clearCache}
            disabled={parsing}
            className="flex items-center justify-center w-8 h-8 rounded"
            aria-label="Clear cached CV"
            title="Clear cached CV"
          >
            <span className="text-sm">×</span>
          </Button>
        )}
      </div>

      {/* local inline status removed in favor of global toasts */}
    </div>
  );
}
