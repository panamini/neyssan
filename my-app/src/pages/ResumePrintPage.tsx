/* eslint-disable @typescript-eslint/no-misused-promises -- Existing async UI handlers are preserved for this release-gate cleanup; convert to explicit void wrappers in a focused follow-up. */
import React from "react";

import { buildVerbatiThemeVars } from "../features/verbati/style";
import ResumePage from "../features/verbati/resume/ResumePage";
import ResumeTemplateRenderer from "../features/verbati/resume/ResumeTemplateRenderer";
import type { DocumentStageLayout } from "../hooks/use-document-stage-layout";
import {
  type ResumePrintRoutePayload,
} from "../lib/document-export-models";
import {
  buildDocumentPageSizePrintCss,
  resolveDocumentPageSize,
  type DocumentPageSize,
} from "../lib/document-page-size";
import { isWorkshopResumeTemplateId } from "../lib/layout/resumeTemplates";
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

function buildPrintStageLayout(pageSize: DocumentPageSize): DocumentStageLayout {
  return {
    fitScale: 1,
    availableWidth: pageSize.widthPx,
    availableHeight: pageSize.heightPx,
    stageWidth: pageSize.widthPx,
    stageHeight: pageSize.heightPx,
    pageWidth: pageSize.widthPx,
    pageHeight: pageSize.heightPx,
    overflowX: false,
    overflowY: false,
    isFit: true,
  };
}

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

function workshopPrintPayloadHasCommittedPages(
  payload: ResumePrintRoutePayload,
): boolean {
  return (
    !isWorkshopResumeTemplateId(payload.resumeTemplateId) ||
    (Array.isArray(payload.committedPages) && payload.committedPages.length > 0)
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
  const pageSize = React.useMemo(
    () => resolveDocumentPageSize({ pageSize: payload?.pageSize }),
    [payload?.pageSize],
  );
  const printStageLayout = React.useMemo(
    () => buildPrintStageLayout(pageSize),
    [pageSize],
  );
  const themeVars = React.useMemo(
    () => (payload ? buildVerbatiThemeVars(payload.stylePreset) : {}),
    [payload],
  );
  const pageSizeVars = React.useMemo(
    () =>
      ({
        "--page-width": `${pageSize.widthMm}mm`,
        "--page-height": `${pageSize.heightMm}mm`,
      }) as React.CSSProperties,
    [pageSize],
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

    if (!workshopPrintPayloadHasCommittedPages(payload)) {
      setPrintStatus(
        "error",
        true,
        "Committed workshop print pages are required for Workshop resume templates.",
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

  if (!workshopPrintPayloadHasCommittedPages(payload)) {
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
        Committed workshop print pages are required.
      </main>
    );
  }

  return (
    <>
      <style data-document-page-size>
        {buildDocumentPageSizePrintCss(pageSize)}
      </style>
    <main
      ref={routeRootRef}
      className="theme-resume-calm theme-resume-calm--single dasti-resume-print-route"
      data-document-print-route="resume"
      data-style-layout={payload.stylePreset.layout}
      data-style-typography={payload.stylePreset.typography}
      data-renderer-variant={payload.rendererVariantId}
      style={{ ...themeVars, ...pageSizeVars }}
    >
      {isWorkshopResumeTemplateId(payload.resumeTemplateId) ? (
        <ResumeTemplateRenderer
          data={payload.resumeData}
          stylePreset={payload.stylePreset}
          resumeTemplateId={payload.resumeTemplateId}
          committedPages={payload.committedPages}
          pageSize={pageSize}
          stageLayout={printStageLayout}
          documentIconSettings={payload.documentIconSettings}
        />
      ) : (
        <ResumePage
          data={payload.resumeData}
          mode={payload.rendererVariantId}
          stylePreset={payload.stylePreset}
          pageSize={pageSize}
          stageLayout={printStageLayout}
          userZoom={1}
        />
      )}
    </main>
    </>
  );
}

export default ResumePrintPage;
