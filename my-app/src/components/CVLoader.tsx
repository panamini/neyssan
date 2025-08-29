"use client";

import { useState, useEffect, useRef } from "react";
import { parsePdfArrayBuffer } from "../services/pdf/browser-cv-parser";
import LoadingSpinner from "./LoadingSpinner";

type NormalizedProfile = { id?: string; name?: string | null; email?: string | null; summary?: string | null; skills?: string[] | null; experience?: any[] | null; education?: any[] | null; achievements?: string[] | null; rawText?: string | null; confidence?: number; metadata?: Record<string, unknown> | null; version?: number; };

type Props = {
  onFileParsed: (parsedProfile: NormalizedProfile) => void;
  onError: (message: string | null) => void;
  onSuccess?: (message: string | null) => void;
  label?: string;
};

export default function CVLoader({ onFileParsed, onError, onSuccess, label = "Load CV" }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [parsing, setParsing] = useState(false);
  const [sessionDataExists, setSessionDataExists] = useState(false);
  const [localMsg, setLocalMsg] = useState<string | null>(null);

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
    onSuccess && onSuccess(null);

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
      onSuccess && onSuccess("CV parsed successfully");
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
      onSuccess && onSuccess("Restored previously parsed CV.");
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
    const msg = "Cleared cached CV";
    onSuccess && onSuccess(msg);
    setLocalMsg(msg);
    setTimeout(() => setLocalMsg(null), 3000);
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
        <button
          type="button"
          onClick={() => {
            if (parsing) return;
            if (sessionDataExists) {
              reuseCached();
            } else {
              inputRef.current?.click();
            }
          }}
          disabled={parsing}
          className={`flex items-center gap-2 px-3 py-1 text-sm rounded transition-colors ${
            sessionDataExists ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
          } hover:bg-opacity-90 disabled:bg-gray-200 disabled:text-gray-500`}
          aria-label={sessionDataExists ? "Reuse last parsed CV" : "Load CV"}
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
        </button>

        {/* Clear cached CV control (small, less intrusive than a full button) */}
        {sessionDataExists && (
          <button
            type="button"
            onClick={clearCache}
            disabled={parsing}
            className="px-2 py-1 text-sm text-red-800 bg-red-100 rounded hover:bg-red-200 disabled:bg-gray-200 disabled:text-gray-500"
            aria-label="Clear cached CV"
            title="Clear cached CV"
          >
            ×
          </button>
        )}
      </div>
 
      {/* local inline status (temporary) */}
      {localMsg && <div className="ml-2 text-xs text-gray-600">{localMsg}</div>}
    </div>
  );
};
