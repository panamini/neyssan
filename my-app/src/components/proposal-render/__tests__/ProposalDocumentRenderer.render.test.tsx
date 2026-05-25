import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProposalDocumentRenderer } from "../ProposalDocumentRenderer";

describe("ProposalDocumentRenderer volk register layout", () => {
  beforeEach(() => {
    class ResizeObserverMock {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    });

    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        ready: Promise.resolve(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  it("renders applicant header lines with date and recipient details in the meta rail", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content={
          "Dear Hiring Manager,\n\nI support day-to-day HR operations and keep communication clear.\n\nBest regards,\nJane Doe"
        }
        proposalType="cover_letter"
        templateId="volk_register"
        railTitle="Jane Doe"
        railMeta="Human Resources Administrator"
        letterDate="April 5, 2026"
        recipientDetails={"Elena Marlowe\nHead of People\nModine\nelena@modine.com"}
        documentTitle="Human Resources Administrator"
        applicantHeader={{
          name: "Jane Doe",
          role: "Human Resources Administrator",
          email: "jane@example.com",
          phone: "+33 6 00 00 00 00",
          linkedin: null,
          website: "janedoe.dev",
          location: "Paris",
          tag: null,
        }}
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
      />,
    );

    const subjectRow = container.querySelector(
      ".dasti-proposal-document__volk-subject-row",
    );
    const header = container.querySelector(".dasti-proposal-document__volk-header");
    const metaRail = container.querySelectorAll(
      ".dasti-proposal-document__volk-register-label",
    );

    expect(header?.textContent).toContain("Jane Doe");
    expect(header?.textContent).toContain("Human Resources Administrator");
    expect(header?.textContent).toContain("+33 6 00 00 00 00");
    expect(header?.textContent).toContain("jane@example.com");
    expect(header?.textContent).toContain("janedoe.dev");
    expect(Array.from(metaRail).map((node) => node.textContent)).toEqual(
      expect.arrayContaining([
        "date: April 5, 2026",
        "to: Elena Marlowe",
      ]),
    );
    expect(subjectRow?.textContent).toContain(
      "subject:Human Resources Administrator",
    );
  });

  it("renders a structured header for non-volk templates", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content={
          "Dear Hiring Manager,\n\nI support delivery operations with careful written communication.\n\nBest regards,\nJane Doe"
        }
        proposalType="cover_letter"
        templateId="swiss_margin"
        railTitle="Jane Doe"
        railMeta="Operations Specialist"
        letterDate="April 6, 2026"
        recipientDetails={"Avery Stone\nHiring Manager\nNorthwind"}
        documentTitle="Application for Operations Specialist"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
      />,
    );

    const structuredHeader = container.querySelector(
      ".dasti-proposal-document__structured-header",
    );
    const senderHeader = container.querySelector(
      ".dasti-proposal-document__sender-header",
    );

    expect(senderHeader?.textContent).toContain("From:");
    expect(senderHeader?.textContent).toContain("Jane Doe");
    expect(senderHeader?.textContent).toContain("Operations Specialist");
    expect(structuredHeader?.textContent).toContain("Date");
    expect(structuredHeader?.textContent).toContain("April 6, 2026");
    expect(structuredHeader?.textContent).toContain("To");
    expect(structuredHeader?.textContent).toContain("Avery Stone");
    expect(structuredHeader?.textContent).toContain("Hiring Manager");
    expect(structuredHeader?.textContent).toContain("Northwind");
    expect(structuredHeader?.textContent).toContain("Subject");
    expect(structuredHeader?.textContent).toContain(
      "Application for Operations Specialist",
    );
    expect(container.textContent).not.toContain("35 mm register");
  });

  it("can render a header-only draft preview without injecting body text", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content=""
        proposalType="cover_letter"
        templateId="swiss_margin"
        railTitle="Jane Doe"
        railMeta="Operations Specialist"
        contactLine="jane@example.com · Paris"
        documentTitle="Application for Operations Specialist"
        emptyBodyPlaceholder="No draft yet. Add a job offer to generate, or start blank."
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
      />,
    );

    const senderHeader = container.querySelector(
      ".dasti-proposal-document__sender-header",
    );
    const rawBody = container.querySelector(
      ".dasti-proposal-document__raw-body",
    );

    expect(senderHeader?.textContent).toContain("Jane Doe");
    expect(senderHeader?.textContent).toContain("Operations Specialist");
    expect(senderHeader?.textContent).toContain("jane@example.com · Paris");
    expect(rawBody?.textContent).toContain("No draft yet.");
    expect(rawBody?.textContent).not.toContain("Dear Hiring Manager");
  });

  it("does not render preview-only empty body placeholders by default", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content=""
        proposalType="cover_letter"
        templateId="swiss_margin"
        railTitle="Jane Doe"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
      />,
    );

    expect(container.textContent).not.toContain("No draft yet.");
    expect(container.textContent).not.toContain("Add a job offer");
  });

  it("renders structured closing when body text has no sign-off", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content="I support delivery operations with careful written communication."
        proposalType="cover_letter"
        templateId="swiss_margin"
        railTitle="Jane Doe"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        signatureSettings={{
          mode: "font",
          fontId: "fd-garamond",
          imageDataUrl: null,
        }}
        closing={{
          enabled: true,
          signOff: "Sincerely,",
          signatureName: "Jane Doe",
          source: "settings",
        }}
      />,
    );

    const closing = container.querySelector(
      ".dasti-proposal-document__closing",
    );
    const signature = container.querySelector(
      ".dasti-proposal-document__signature",
    );

    expect(closing?.textContent).toContain("Sincerely,");
    expect(signature?.textContent).toBe("jane doe");
    expect(signature?.getAttribute("style")).toContain("FD Garamond");
  });

  it("keeps the sign-off when the structured signature is disabled", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content="I support delivery operations with careful written communication."
        proposalType="cover_letter"
        templateId="swiss_margin"
        railTitle="Jane Doe"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        signatureSettings={{
          mode: "font",
          fontId: "fd-garamond",
          imageDataUrl: null,
        }}
        closing={{
          enabled: false,
          signOff: "Sincerely,",
          signatureName: "Jane Doe",
          source: "settings",
        }}
      />,
    );

    const closing = container.querySelector(
      ".dasti-proposal-document__closing",
    );
    const signature = container.querySelector(
      ".dasti-proposal-document__signature",
    );

    expect(closing?.textContent).toContain("Sincerely,");
    expect(signature).toBeNull();
  });

  it("renders hand-drawn signature above the typed signature when enabled", () => {
    const imageDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARQAHAQGByp7K7wAAAABJRU5ErkJggg==";
    const { container } = render(
      <ProposalDocumentRenderer
        content="I support delivery operations with careful written communication."
        proposalType="cover_letter"
        templateId="swiss_margin"
        railTitle="Jane Doe"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        signatureSettings={{
          mode: "image",
          fontId: null,
          imageDataUrl,
        }}
        closing={{
          enabled: true,
          signOff: "Sincerely,",
          signatureName: "Jane Doe",
          source: "settings",
          handwrittenSignatureEnabled: true,
        }}
      />,
    );

    const closing = container.querySelector(
      ".dasti-proposal-document__closing",
    );
    const image = closing?.querySelector(
      ".dasti-proposal-document__signature-image",
    );
    const typed = closing?.querySelector(".dasti-proposal-document__signature");

    expect(image?.getAttribute("src")).toBe(imageDataUrl);
    expect(typed?.textContent).toBe("jane doe");
    expect(
      image?.compareDocumentPosition(typed as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
  });

  it("renders typed signature without image when hand-drawn is disabled", () => {
    const imageDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARQAHAQGByp7K7wAAAABJRU5ErkJggg==";
    const { container } = render(
      <ProposalDocumentRenderer
        content="I support delivery operations with careful written communication."
        proposalType="cover_letter"
        templateId="swiss_margin"
        railTitle="Jane Doe"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        signatureSettings={{
          mode: "image",
          fontId: null,
          imageDataUrl,
        }}
        closing={{
          enabled: true,
          signOff: "Sincerely,",
          signatureName: "Jane Doe",
          source: "settings",
          handwrittenSignatureEnabled: false,
        }}
      />,
    );

    expect(
      container.querySelector(".dasti-proposal-document__signature-image"),
    ).toBeNull();
    expect(
      container.querySelector(".dasti-proposal-document__signature")?.textContent,
    ).toBe("jane doe");
  });

  it("renders latest applicant name for stale settings-owned structured signatures", () => {
    const imageDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARQAHAQGByp7K7wAAAABJRU5ErkJggg==";
    const { container } = render(
      <ProposalDocumentRenderer
        content="I support delivery operations with careful written communication."
        proposalType="cover_letter"
        templateId="swiss_margin"
        railTitle="john"
        applicantHeader={{
          name: "john",
          role: "",
          email: "",
          phone: "",
          linkedin: "",
          website: "",
          location: "",
          tag: "",
        }}
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        signatureSettings={{
          mode: "image",
          fontId: null,
          imageDataUrl,
        }}
        closing={{
          enabled: true,
          signOff: "Sincerely,",
          signatureName: "b",
          source: "settings",
          handwrittenSignatureEnabled: true,
        }}
      />,
    );

    const closing = container.querySelector(
      ".dasti-proposal-document__closing",
    );
    const signoff = closing?.querySelector(".dasti-proposal-document__signoff");
    const image = closing?.querySelector(
      ".dasti-proposal-document__signature-image",
    );
    const typed = closing?.querySelector(".dasti-proposal-document__signature");

    expect(container.textContent).toContain("john");
    expect(typed?.textContent).toBe("john");
    expect(container.textContent).not.toContain("b");
    expect(
      signoff?.compareDocumentPosition(image as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(
      image?.compareDocumentPosition(typed as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
  });

  it("respects header visibility flags in non-volk templates", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content={
          "Dear Hiring Manager,\n\nI support delivery operations with careful written communication.\n\nBest regards,\nJane Doe"
        }
        proposalType="cover_letter"
        templateId="swiss_margin"
        railTitle="Jane Doe"
        railMeta="Operations Specialist"
        letterDate="April 6, 2026"
        recipientDetails={"Avery Stone\nHiring Manager\nNorthwind"}
        documentTitle="Application for Operations Specialist"
        headerVisibility={{
          showSender: true,
          showDate: false,
          showSubject: false,
          showRecipient: true,
          showRecipientDetails: false,
        }}
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
      />,
    );

    const structuredHeader = container.querySelector(
      ".dasti-proposal-document__structured-header",
    );

    expect(structuredHeader?.textContent).toContain("To");
    expect(structuredHeader?.textContent).toContain("Avery Stone");
    expect(structuredHeader?.textContent).toContain("Hiring Manager");
    expect(structuredHeader?.textContent).toContain("Northwind");
    expect(structuredHeader?.textContent).not.toContain("Date");
    expect(structuredHeader?.textContent).not.toContain("April 6, 2026");
    expect(structuredHeader?.textContent).not.toContain("Subject");
    expect(structuredHeader?.textContent).not.toContain(
      "Application for Operations Specialist",
    );
  });
});
