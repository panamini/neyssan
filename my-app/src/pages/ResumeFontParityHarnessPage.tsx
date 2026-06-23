/* eslint-disable @typescript-eslint/no-misused-promises -- Existing async UI handlers are preserved for this release-gate cleanup; convert to explicit void wrappers in a focused follow-up. */
import React from "react";
import { useLocation } from "react-router-dom";

import { VerbatiResumePreview } from "../features/verbati/VerbatiResumePreview";
import { buildResumeFontParityPreviewSource } from "../features/verbati/resume/resumeFontParity.fixture";
import { resolveVerbatiStyle } from "../features/verbati/style";
import type { ResumePreviewPrintSource } from "../lib/document-export-models";
import {
  collectResumeFontDebugSnapshot,
  type ResumeFontDebugSnapshot,
} from "../lib/resume-font-debug";

type ResumeFontParityStatus =
  | "booting"
  | "payload-ready"
  | "mounted"
  | "fonts-ready"
  | "ready"
  | "error";

declare global {
  interface Window {
    __DASTI_RESUME_FONT_PARITY_PAYLOAD__?: ResumePreviewPrintSource;
    __DASTI_RESUME_FONT_PARITY_STATUS__?: {
      status: ResumeFontParityStatus;
      payloadReadable: boolean;
      error?: string;
      snapshot?: ResumeFontDebugSnapshot;
      timestamp: number;
    };
  }
}

function setParityStatus(
  status: ResumeFontParityStatus,
  payloadReadable: boolean,
  error?: string,
  snapshot?: ResumeFontDebugSnapshot,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.__DASTI_RESUME_FONT_PARITY_STATUS__ = {
    status,
    payloadReadable,
    ...(error ? { error } : {}),
    ...(snapshot ? { snapshot } : {}),
    timestamp: Date.now(),
  };
}

function isResumePreviewPrintSource(
  value: unknown,
): value is ResumePreviewPrintSource {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.kind === "resume" &&
    record.renderSource === "preview" &&
    record.schemaVersion === 1 &&
    typeof record.resumeData === "object" &&
    record.resumeData !== null &&
    typeof record.stylePreset === "object" &&
    record.stylePreset !== null &&
    typeof record.rendererVariantId === "string"
  );
}

function readPayloadFromSearch(search: string): ResumePreviewPrintSource {
  const params = new URLSearchParams(search);
  return buildResumeFontParityPreviewSource(
    resolveVerbatiStyle({
      layout: params.get("layout") ?? undefined,
      typography: params.get("typography") ?? undefined,
      palette: params.get("palette") ?? undefined,
      accentHex: params.get("accentHex") ?? undefined,
    }),
  );
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export function ResumeFontParityHarnessPage(): JSX.Element {
  const location = useLocation();
  const payload = React.useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const injected = window.__DASTI_RESUME_FONT_PARITY_PAYLOAD__;
    if (isResumePreviewPrintSource(injected)) {
      return injected;
    }

    return readPayloadFromSearch(location.search);
  }, [location.search]);
  const routeRootRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!payload) {
      setParityStatus(
        "error",
        false,
        "Resume font parity payload is missing or invalid.",
      );
      return undefined;
    }

    let cancelled = false;
    setParityStatus("payload-ready", true);

    const markReady = async () => {
      setParityStatus("mounted", true);

      try {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
      } catch {
        // Continue even if font readiness is unavailable in this browser.
      }

      if (cancelled) {
        return;
      }

      setParityStatus("fonts-ready", true);
      await nextAnimationFrame();
      await nextAnimationFrame();

      if (cancelled) {
        return;
      }

      const snapshot = collectResumeFontDebugSnapshot({
        root: routeRootRef.current,
        stylePreset: payload.stylePreset,
        rendererVariantId: payload.rendererVariantId,
      });
      setParityStatus("ready", true, undefined, snapshot);
    };

    void markReady();

    return () => {
      cancelled = true;
    };
  }, [payload]);

  if (!payload) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f7f4ec",
          color: "#1f1d1a",
          fontFamily: '"Source Sans 3", "Helvetica Neue", Helvetica, sans-serif',
        }}
      >
        Resume font parity payload is missing.
      </main>
    );
  }

  return (
    <main
      ref={routeRootRef}
      className="dasti-resume-font-parity-route"
      data-font-parity-layout={payload.stylePreset.layout}
      data-font-parity-typography={payload.stylePreset.typography}
      data-font-parity-variant={payload.rendererVariantId}
      style={{
        minHeight: "100vh",
        padding: "24px",
        overflow: "auto",
        background: "var(--bg, #f0ece5)",
      }}
    >
      <VerbatiResumePreview
        data={payload.resumeData}
        stylePreset={payload.stylePreset}
        hostMode="workspace"
      />
    </main>
  );
}

export default ResumeFontParityHarnessPage;
