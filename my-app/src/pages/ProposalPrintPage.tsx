import React from "react";

import { ProposalDocumentRenderer } from "../components/proposal-render/ProposalDocumentRenderer";
import { buildVerbatiProposalDocumentVars } from "../features/verbati/style";
import {
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_WIDTH_PX,
} from "../lib/document-stage";
import type { ProposalPrintRoutePayload } from "../lib/document-export-models";
import {
  collectProposalFontDebugSnapshot,
  type ProposalFontDebugSnapshot,
} from "../lib/proposal-font-debug";
import { getProposalDocumentTypography } from "../lib/proposal-document-typography";

type ProposalPrintStatus =
  | "booting"
  | "payload-ready"
  | "mounted"
  | "fonts-ready"
  | "ready"
  | "error";

declare global {
  interface Window {
    __DASTI_PROPOSAL_PRINT_PAYLOAD__?: ProposalPrintRoutePayload;
    __DASTI_PROPOSAL_PRINT_BOOTSTRAP__?: ProposalPrintRoutePayload;
    __DASTI_PROPOSAL_PRINT_STATUS__?: {
      status: ProposalPrintStatus;
      payloadReadable: boolean;
      error?: string;
      snapshot?: ProposalFontDebugSnapshot;
      timestamp: number;
    };
  }
}

function setPrintStatus(
  status: ProposalPrintStatus,
  payloadReadable: boolean,
  error?: string,
  snapshot?: ProposalFontDebugSnapshot,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.__DASTI_PROPOSAL_PRINT_STATUS__ = {
    status,
    payloadReadable,
    ...(error ? { error } : {}),
    ...(snapshot ? { snapshot } : {}),
    timestamp: Date.now(),
  };
}

function isProposalPrintRoutePayload(
  value: unknown,
): value is ProposalPrintRoutePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.kind === "proposal_print_route" &&
    record.schemaVersion === 1 &&
    typeof record.content === "string" &&
    typeof record.stylePreset === "object" &&
    record.stylePreset !== null &&
    typeof record.templateId === "string"
  );
}

function readPrintPayload(): ProposalPrintRoutePayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  const payload = window.__DASTI_PROPOSAL_PRINT_PAYLOAD__;
  return isProposalPrintRoutePayload(payload) ? payload : null;
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export function ProposalPrintPage(): JSX.Element {
  const payload = React.useMemo(() => readPrintPayload(), []);
  const routeRootRef = React.useRef<HTMLElement | null>(null);
  const [pageCount, setPageCount] = React.useState(1);
  const themeVars = React.useMemo(
    () => (payload ? buildVerbatiProposalDocumentVars(payload.stylePreset) : {}),
    [payload],
  );
  const documentTypography = React.useMemo(
    () =>
      payload
        ? getProposalDocumentTypography(payload.voicePreset, payload.stylePreset)
        : null,
    [payload],
  );
  const stageLayoutVars = React.useMemo(
    () =>
      ({
        "--document-stage-width": `${A4_PAGE_WIDTH_PX}px`,
        "--document-stage-height": `${A4_PAGE_HEIGHT_PX * Math.max(1, pageCount)}px`,
        "--document-page-width": `${A4_PAGE_WIDTH_PX}px`,
        "--document-page-height": `${A4_PAGE_HEIGHT_PX}px`,
      }) as React.CSSProperties,
    [pageCount],
  );

  React.useEffect(() => {
    if (!payload || !documentTypography) {
      setPrintStatus(
        "error",
        false,
        "Proposal print payload is missing or invalid.",
      );
      return undefined;
    }

    let cancelled = false;
    window.__DASTI_PROPOSAL_PRINT_BOOTSTRAP__ = payload;
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

      if (cancelled) {
        return;
      }

      const snapshot = collectProposalFontDebugSnapshot({
        root: routeRootRef.current,
        stylePreset: payload.stylePreset,
        templateId: payload.templateId,
        voicePreset: payload.voicePreset,
      });
      setPrintStatus("ready", true, undefined, snapshot);
    };

    void markReady();

    return () => {
      cancelled = true;
    };
  }, [documentTypography, payload]);

  if (!payload || !documentTypography) {
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
        Proposal print payload is missing.
      </main>
    );
  }

  return (
    <main
      ref={routeRootRef}
      className="dasti-proposal-print-route"
      data-document-print-route="proposal"
      data-style-layout={payload.stylePreset.layout}
      data-style-typography={payload.stylePreset.typography}
      data-template-id={payload.templateId}
      style={{
        margin: 0,
        padding: 0,
        width: `${A4_PAGE_WIDTH_PX}px`,
        minHeight: `${A4_PAGE_HEIGHT_PX * Math.max(1, pageCount)}px`,
        overflow: "hidden",
        background: "#fff",
        ...themeVars,
      }}
    >
      <div style={stageLayoutVars}>
        <ProposalDocumentRenderer
          content={payload.content}
          proposalType={payload.proposalType}
          templateId={payload.templateId}
          stylePreset={payload.stylePreset}
          railTitle={payload.railTitle}
          railMeta={payload.railMeta}
          contactLine={payload.contactLine}
          letterDate={payload.letterDate}
          recipientDetails={payload.recipientDetails}
          documentTitle={payload.documentTitle}
          documentMeta={payload.documentMeta}
          applicantHeader={payload.applicantHeader}
          headerVisibility={payload.headerVisibility}
          documentTypography={documentTypography}
          pageWidth={A4_PAGE_WIDTH_PX}
          pageGapPx={0}
          onPageCountChange={setPageCount}
        />
      </div>
    </main>
  );
}

export default ProposalPrintPage;
