import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_VERBATI_STYLE } from "../../features/verbati/style";
import type { ProposalPrintRoutePayload } from "../../lib/document-export-models";
import { ProposalPrintPage } from "../ProposalPrintPage";

function buildPayload(): ProposalPrintRoutePayload {
  return {
    schemaVersion: 1,
    kind: "proposal_print_route",
    locale: "en",
    content:
      "Dear Hiring Manager,\n\nI lead delivery operations across cross-functional teams and keep proposal work coherent through final review.\n\nKind regards,\nAlex Martin",
    proposalType: "cover_letter",
    voicePreset: "signature",
    railTitle: "Alex Martin",
    railMeta: "Operations Lead",
    contactLine: "alex@example.com · +33 6 00 00 00 00",
    letterDate: "Paris, April 16, 2026",
    recipientDetails: "Hiring Manager\nStudio North",
    documentTitle: "Proposal",
    documentMeta: "alex@example.com",
    applicantHeader: {
      name: "Alex Martin",
      role: "Operations Lead",
      email: "alex@example.com",
      phone: "+33 6 00 00 00 00",
      linkedin: "",
      website: "",
      location: "Paris",
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
    stylePreset: {
      ...DEFAULT_VERBATI_STYLE,
      layout: "two-column",
      typography: "quiet-editorial",
    },
  };
}

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

describe("ProposalPrintPage", () => {
  beforeEach(() => {
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        ready: Promise.resolve(),
        status: "loaded",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        [Symbol.iterator]: function* iterator() {
          yield { family: "Fraunces" };
          yield { family: "Syne" };
        },
      },
    });
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get() {
        return 794;
      },
    });
    HTMLElement.prototype.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 794,
      bottom: 1123,
      width: 794,
      height: 1123,
      toJSON: () => ({}),
    })) as unknown as typeof HTMLElement.prototype.getBoundingClientRect;
  });

  afterEach(() => {
    delete window.__DASTI_PROPOSAL_PRINT_PAYLOAD__;
    delete window.__DASTI_PROPOSAL_PRINT_BOOTSTRAP__;
    delete window.__DASTI_PROPOSAL_PRINT_STATUS__;
  });

  it("renders the real proposal document tree for the injected payload and marks the route ready", async () => {
    window.__DASTI_PROPOSAL_PRINT_PAYLOAD__ = buildPayload();

    render(<ProposalPrintPage />);

    expect(screen.getAllByText("Alex Martin").length).toBeGreaterThan(0);
    expect(document.querySelector(".dasti-proposal-document")).toBeTruthy();
    expect(
      document
        .querySelector(".dasti-proposal-print-route")
        ?.getAttribute("data-template-id"),
    ).toBe("two_column_rail");
    expect(
      document
        .querySelector(".dasti-proposal-print-route")
        ?.getAttribute("data-style-typography"),
    ).toBe("quiet-editorial");

    await waitFor(() => {
      expect(window.__DASTI_PROPOSAL_PRINT_STATUS__?.status).toBe("ready");
    });

    expect(window.__DASTI_PROPOSAL_PRINT_BOOTSTRAP__).toEqual(buildPayload());
    expect(window.__DASTI_PROPOSAL_PRINT_STATUS__?.snapshot).toEqual(
      expect.objectContaining({
        layout: "workshop",
        typography: "quiet-editorial",
        templateId: "two_column_rail",
        expectedBodyFontFamily: expect.stringContaining("Syne"),
        bodyFontFamilyComputed: expect.any(String),
        titleFontFamilyComputed: expect.any(String),
        contactFontFamilyComputed: expect.any(String),
      }),
    );
  });

  it.each([
    ["twoweeks-letterhead", "proposal-cover-letter--twoweeks"],
    ["director-letterhead", "proposal-cover-letter--director"],
    ["volk-letterhead", "proposal-cover-letter--volk"],
    ["film-foto-letterhead", "proposal-cover-letter--film-foto"],
    ["moma-bauhaus-letterhead", "proposal-cover-letter--moma-bauhaus"],
    ["bayer-letterhead", "proposal-cover-letter--bayer"],
  ] as const)(
    "renders the %s letterhead template through the print route",
    async (templateId, scope) => {
      window.__DASTI_PROPOSAL_PRINT_PAYLOAD__ = {
        ...buildPayload(),
        templateId,
      };

      render(<ProposalPrintPage />);

      expect(
        document
          .querySelector(".dasti-proposal-print-route")
          ?.getAttribute("data-template-id"),
      ).toBe(templateId);
      expect(document.querySelector(`.${scope}`)).toBeTruthy();
      expect(document.querySelector(".dasti-proposal-document__page")).toBeTruthy();

      await waitFor(() => {
        expect(window.__DASTI_PROPOSAL_PRINT_STATUS__?.status).toBe("ready");
      });
      expect(window.__DASTI_PROPOSAL_PRINT_STATUS__?.snapshot).toEqual(
        expect.objectContaining({
          templateId,
        }),
      );
    },
  );

  it("renders French correspondence labels from the print payload locale", () => {
    window.__DASTI_PROPOSAL_PRINT_PAYLOAD__ = {
      ...buildPayload(),
      locale: "fr",
      templateId: "modernist_signal",
    };

    const { container } = render(<ProposalPrintPage />);

    expect(
      container.querySelector(".dasti-proposal-document__sender-header")
        ?.textContent,
    ).toContain("Expéditeur :");
    expect(
      container.querySelector(".dasti-proposal-document__structured-header")
        ?.textContent,
    ).toContain("Destinataire");
    expect(
      container.querySelector(".dasti-proposal-document__structured-header")
        ?.textContent,
    ).toContain("Objet");
  });

  it("reports an explicit error when the print payload is missing", async () => {
    render(<ProposalPrintPage />);

    expect(
      screen.getByText("Proposal print payload is missing."),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(window.__DASTI_PROPOSAL_PRINT_STATUS__?.status).toBe("error");
    });
  });
});
