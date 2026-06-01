import React from "react";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_VERBATI_STYLE } from "../../features/verbati/style";
import { resumeMock } from "../../features/verbati/resume/resume.mock";
import { DOCUMENT_PAGE_SIZES } from "../../lib/document-page-size";
import type {
  ProposalPrintRoutePayload,
  ResumePrintRoutePayload,
} from "../../lib/document-export-models";
import { ProposalPrintPage } from "../ProposalPrintPage";
import { ResumePrintPage } from "../ResumePrintPage";

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

function buildResumePayload(): ResumePrintRoutePayload {
  return {
    schemaVersion: 1,
    kind: "resume_print_route",
    locale: "en",
    resumeData: resumeMock,
    stylePreset: {
      ...DEFAULT_VERBATI_STYLE,
      familyId: "two-column",
      layout: "two-column",
    },
    resumeTemplateId: "two_column_resume_legacy",
    rendererVariantId: "robial",
    pageSize: DOCUMENT_PAGE_SIZES.letter,
  };
}

function buildProposalPayload(): ProposalPrintRoutePayload {
  return {
    schemaVersion: 1,
    kind: "proposal_print_route",
    locale: "en",
    content: "Dear Hiring Manager,\n\nProposal body.",
    proposalType: "cover_letter",
    voicePreset: "signature",
    railTitle: "Alex Martin",
    railMeta: "Operations Lead",
    contactLine: "alex@example.com",
    letterDate: "Paris, April 16, 2026",
    recipientDetails: "Hiring Manager",
    documentTitle: "Proposal",
    documentMeta: "alex@example.com",
    applicantHeader: {
      name: "Alex Martin",
      role: "Operations Lead",
      email: "alex@example.com",
      phone: "",
      linkedin: "",
      website: "",
      location: "",
      tag: "",
    },
    headerVisibility: {
      showSender: true,
      showDate: true,
      showRecipient: true,
      showRecipientDetails: true,
      showSubject: true,
    },
    templateId: "two_column_rail",
    stylePreset: DEFAULT_VERBATI_STYLE,
    pageSize: DOCUMENT_PAGE_SIZES.letter,
  };
}

describe("print route page sizing", () => {
  beforeEach(() => {
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        ready: Promise.resolve(),
        status: "loaded",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        [Symbol.iterator]: function* iterator() {},
      },
    });
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    });
  });

  afterEach(() => {
    delete window.__DASTI_RESUME_PRINT_PAYLOAD__;
    delete window.__DASTI_RESUME_PRINT_BOOTSTRAP__;
    delete window.__DASTI_RESUME_PRINT_STATUS__;
    delete window.__DASTI_PROPOSAL_PRINT_PAYLOAD__;
    delete window.__DASTI_PROPOSAL_PRINT_BOOTSTRAP__;
    delete window.__DASTI_PROPOSAL_PRINT_STATUS__;
  });

  it("injects Letter @page CSS and Letter stage sizing into resume print route", () => {
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = buildResumePayload();

    render(<ResumePrintPage />);

    expect(document.querySelector("style[data-document-page-size]")?.textContent).toContain(
      "size: 215.9mm 279.4mm;",
    );
    expect(
      document
        .querySelector<HTMLElement>(".dasti-resume-print-route")
        ?.style.getPropertyValue("--page-width"),
    ).toBe("215.9mm");
    expect(
      document
        .querySelector<HTMLElement>(".dasti-resume-print-route")
        ?.style.getPropertyValue("--page-height"),
    ).toBe("279.4mm");
  });

  it("injects Letter @page CSS and Letter stage sizing into proposal print route", () => {
    window.__DASTI_PROPOSAL_PRINT_PAYLOAD__ = buildProposalPayload();

    render(<ProposalPrintPage />);

    expect(document.querySelector("style[data-document-page-size]")?.textContent).toContain(
      "size: 215.9mm 279.4mm;",
    );
    expect(
      document
        .querySelector<HTMLElement>(".dasti-proposal-print-route")
        ?.style.width,
    ).toBe(`${DOCUMENT_PAGE_SIZES.letter.widthPx}px`);
    expect(
      document
        .querySelector<HTMLElement>(".dasti-proposal-print-route")
        ?.style.getPropertyValue("--proposal-page-width-mm"),
    ).toBe("215.9");
  });
});
