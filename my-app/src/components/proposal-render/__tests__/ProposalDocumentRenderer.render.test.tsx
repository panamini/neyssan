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
