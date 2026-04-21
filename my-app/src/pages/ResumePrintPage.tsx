import React from "react";

import { buildVerbatiThemeVars } from "../features/verbati/style";
import ResumePage from "../features/verbati/resume/ResumePage";
import ResumeTemplateRenderer, {
  WORKSHOP_TEMPLATE_RENDERER_ID,
} from "../features/verbati/resume/ResumeTemplateRenderer";
import type { DocumentStageLayout } from "../hooks/use-document-stage-layout";
import {
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_WIDTH_PX,
} from "../lib/document-stage";
import {
  type ResumePrintRoutePayload,
} from "../lib/document-export-models";
import {
  collectResumeFontDebugSnapshot,
  type ResumeFontDebugSnapshot,
} from "../lib/resume-font-debug";

type ResumePrintStatus =
  | "booting"
  | "payload-ready"
  | "mounted"
  | "fonts-ready"
  | "ready"
  | "error";

declare global {
  interface Window {
    __DASTI_RESUME_PRINT_PAYLOAD__?: ResumePrintRoutePayload;
    __DASTI_RESUME_PRINT_BOOTSTRAP__?: ResumePrintRoutePayload;
    __DASTI_RESUME_PRINT_STATUS__?: {
      status: ResumePrintStatus;
      payloadReadable: boolean;
      error?: string;
      pageCount?: number;
      snapshot?: ResumeFontDebugSnapshot;
      timestamp: number;
    };
  }
}

const PRINT_STAGE_LAYOUT: DocumentStageLayout = {
  fitScale: 1,
  availableWidth: A4_PAGE_WIDTH_PX,
  availableHeight: A4_PAGE_HEIGHT_PX,
  stageWidth: A4_PAGE_WIDTH_PX,
  stageHeight: A4_PAGE_HEIGHT_PX,
  pageWidth: A4_PAGE_WIDTH_PX,
  pageHeight: A4_PAGE_HEIGHT_PX,
  overflowX: false,
  overflowY: false,
  isFit: true,
};

function setPrintStatus(
  status: ResumePrintStatus,
  payloadReadable: boolean,
  error?: string,
  pageCount?: number,
  snapshot?: ResumeFontDebugSnapshot,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.__DASTI_RESUME_PRINT_STATUS__ = {
    status,
    payloadReadable,
    ...(error ? { error } : {}),
    ...(typeof pageCount === "number" ? { pageCount } : {}),
    ...(snapshot ? { snapshot } : {}),
    timestamp: Date.now(),
  };
}

function readRenderedResumePageCount(root: ParentNode | null | undefined): number {
  if (!root) {
    return 1;
  }

  const workshopPages = root.querySelectorAll?.('[data-testid="resume-template-page"]')
    ?.length;
  if (workshopPages && workshopPages > 0) {
    return workshopPages;
  }

  const legacyPages = root.querySelectorAll?.(
    ".resume-page[data-resume-page-index]",
  )?.length;
  if (legacyPages && legacyPages > 0) {
    return legacyPages;
  }

  return 1;
}

function isResumePrintRoutePayload(
  value: unknown,
): value is ResumePrintRoutePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.kind === "resume_print_route" &&
    record.schemaVersion === 1 &&
    typeof record.resumeData === "object" &&
    record.resumeData !== null &&
    typeof record.stylePreset === "object" &&
    record.stylePreset !== null &&
    typeof record.rendererVariantId === "string"
  );
}

function readPrintPayload(): ResumePrintRoutePayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  const payload = window.__DASTI_RESUME_PRINT_PAYLOAD__;
  return isResumePrintRoutePayload(payload) ? payload : null;
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export function ResumePrintPage(): JSX.Element {
  const payload = React.useMemo(() => readPrintPayload(), []);
  const themeVars = React.useMemo(
    () => (payload ? buildVerbatiThemeVars(payload.stylePreset) : {}),
    [payload],
  );
  const routeRootRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!payload) {
      setPrintStatus(
        "error",
        false,
        "Resume print payload is missing or invalid.",
        undefined,
        undefined,
      );
      return undefined;
    }

    let cancelled = false;
    window.__DASTI_RESUME_PRINT_BOOTSTRAP__ = payload;
    setPrintStatus("payload-ready", true);

    const markReady = async () => {
      setPrintStatus("mounted", true);
      try {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
      } catch {
        // Continue even if the browser cannot expose font readiness.
      }

      if (cancelled) {
        return;
      }

      setPrintStatus("fonts-ready", true);
      await nextAnimationFrame();
      await nextAnimationFrame();

      if (!cancelled) {
        const pageCount = readRenderedResumePageCount(routeRootRef.current);
        const snapshot = collectResumeFontDebugSnapshot({
          root: routeRootRef.current,
          stylePreset: payload.stylePreset,
          rendererVariantId: payload.rendererVariantId,
        });
        setPrintStatus("ready", true, undefined, pageCount, snapshot);
      }
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
        Resume print payload is missing.
      </main>
    );
  }

  return (
    <main
      ref={routeRootRef}
      className="theme-resume-calm theme-resume-calm--single dasti-resume-print-route"
      data-document-print-route="resume"
      data-style-layout={payload.stylePreset.layout}
      data-style-typography={payload.stylePreset.typography}
      data-renderer-variant={payload.rendererVariantId}
      style={themeVars}
    >
      {payload.resumeTemplateId === WORKSHOP_TEMPLATE_RENDERER_ID ? (
        <ResumeTemplateRenderer
          data={payload.resumeData}
          stylePreset={payload.stylePreset}
          resumeTemplateId={payload.resumeTemplateId}
          committedPages={payload.committedPages}
          stageLayout={PRINT_STAGE_LAYOUT}
        />
      ) : (
        <ResumePage
          data={payload.resumeData}
          mode={payload.rendererVariantId}
          stylePreset={payload.stylePreset}
          stageLayout={PRINT_STAGE_LAYOUT}
          userZoom={1}
        />
      )}
    </main>
  );
}

export default ResumePrintPage;
