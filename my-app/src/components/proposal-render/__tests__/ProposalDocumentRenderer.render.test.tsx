import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProposalDocumentRenderer } from "../ProposalDocumentRenderer";

function countTextOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}

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

  it.each([
    {
      templateId: "director-letterhead" as const,
      scope: ".proposal-cover-letter--director",
      heading: "Jane Doe",
    },
    {
      templateId: "volk-letterhead" as const,
      scope: ".proposal-cover-letter--volk",
      heading: "Jane Doe",
    },
    {
      templateId: "film-foto-letterhead" as const,
      scope: ".proposal-cover-letter--film-foto",
      heading: "Northwind",
    },
  ])(
    "renders real proposal data in order for $templateId",
    ({ templateId, scope, heading }) => {
      const { container } = render(
        <ProposalDocumentRenderer
          content={[
            "Dear Hiring Manager,",
            "First body paragraph for the live proposal.",
            "Second body paragraph keeps the order stable.",
            "Third body paragraph closes the argument.",
            "Best regards,\nJane Doe",
          ].join("\n\n")}
          proposalType="cover_letter"
          templateId={templateId}
          railTitle="Jane Doe"
          railMeta="Operations Specialist"
          contactLine="jane@example.com · Paris"
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
          applicantHeader={{
            name: "Jane Doe",
            role: "Operations Specialist",
            email: "jane@example.com",
            phone: "+33 6 00 00 00 00",
            linkedin: null,
            website: "janedoe.dev",
            location: "Paris",
            tag: null,
          }}
        />,
      );

      const root = container.querySelector(scope);
      const visibleBody = Array.from(
        container.querySelectorAll(".proposal-cover-letter__body"),
      ).at(-1);
      const paragraphs = Array.from(
        visibleBody?.querySelectorAll(".dasti-proposal-document__paragraph") ??
          [],
      ).map((node) => node.textContent);
      const text = root?.textContent ?? "";

      expect(root).toBeTruthy();
      expect(text).toContain(heading);
      expect(text).toContain("Jane Doe");
      expect(
        root?.querySelector(".proposal-cover-letter__film-kicker"),
      ).toBeNull();
      expect(text).toContain("Northwind");
      expect(text).toContain("Application for Operations Specialist");
      expect(paragraphs).toEqual([
        "First body paragraph for the live proposal.",
        "Second body paragraph keeps the order stable.",
        "Third body paragraph closes the argument.",
      ]);
      expect(text).not.toContain("undefined");
      expect(text).not.toContain("null");
      expect(text).not.toContain("[object Object]");
      expect(text).not.toMatch(
        /Graphische|Berufsschule|volksverband|Werkbund|Postcheckkonto|Bankkonto|tschichold/i,
      );
    },
  );

  it("does not fall back to the applicant role in recipient metadata", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content="Dear Hiring Manager,\n\nI can support the team."
        proposalType="cover_letter"
        templateId="film-foto-letterhead"
        railTitle="Robert Cooper"
        railMeta="Security Guard"
        contactLine="email@email.com · Los Angeles"
        letterDate="May 12, 2026"
        recipientDetails={"Hiring Manager\n\nUs Smart Tools\n\n\nParis"}
        documentTitle="Application for Security Guard"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        applicantHeader={{
          name: "Robert Cooper",
          role: "Security Guard",
          company: "Acme",
          email: "email@email.com",
          phone: "3868683442",
          linkedin: "linkedin.in",
          website: "",
          location: "Los Angeles",
          tag: null,
        }}
      />,
    );

    const metaRow = container.querySelector(
      ".proposal-cover-letter--film-foto .proposal-cover-letter__meta-row",
    );
    const metaItems = Array.from(
      metaRow?.querySelectorAll(".proposal-cover-letter__meta-item") ?? [],
    ).map((node) => node.textContent);

    expect(metaItems).toEqual([
      "Hiring Manager",
      "Us Smart Tools",
      "",
      "May 12, 2026",
    ]);
  });

  it("keeps Film und Foto applicant company visible beside a long role", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content="Dear Hiring Manager,\n\nI can support the team."
        proposalType="cover_letter"
        templateId="film-foto-letterhead"
        railTitle="Robert Cooper"
        railMeta="Security Guard"
        contactLine="email@email.com · Los Angeles"
        letterDate="May 12, 2026"
        recipientDetails={"Hiring Manager\n\nUs Smart Tools"}
        documentTitle="Application for Security Guard"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        applicantHeader={{
          name: "Robert Cooper",
          role: "Security Guard",
          company: "Acme",
          email: "email@email.com",
          phone: "3868683442",
          linkedin: "linkedin.in",
          website: "",
          location: "Los Angeles",
          tag: null,
        }}
      />,
    );

    const header = container.querySelector(
      ".proposal-cover-letter--film-foto .proposal-cover-letter__film-header",
    );

    expect(
      header?.querySelector(".proposal-cover-letter__film-company")?.textContent,
    ).toBe("Acme");
    expect(
      header?.querySelector(".proposal-cover-letter__film-title")?.textContent,
    ).toBe("Security Guard");
    expect(container.textContent).toContain("Us Smart Tools");
  });

  it.each([
    {
      templateId: "director-letterhead" as const,
      scope: ".proposal-cover-letter--director",
      secondarySelector: ".proposal-cover-letter__masthead-secondary",
    },
    {
      templateId: "volk-letterhead" as const,
      scope: ".proposal-cover-letter--volk",
      secondarySelector: ".proposal-cover-letter__volk-title--right",
    },
    {
      templateId: "film-foto-letterhead" as const,
      scope: ".proposal-cover-letter--film-foto",
      secondarySelector: ".proposal-cover-letter__film-company",
    },
  ])(
    "renders applicant company as the optional letterhead title for $templateId",
    ({ templateId, scope, secondarySelector }) => {
      const { container } = render(
        <ProposalDocumentRenderer
          content="Dear Hiring Manager,\n\nI can support the team."
          proposalType="cover_letter"
          templateId={templateId}
          railTitle="Robert Cooper"
          railMeta="Designer"
          contactLine="email@email.com · Los Angeles"
          letterDate="May 12, 2026"
          recipientDetails="Hiring Manager"
          documentTitle="Application for Security Guard"
          documentTypography={{
            fontFamily: "Georgia, serif",
            fontSize: "14px",
            lineHeight: 1.5,
            fontWeight: 400,
            letterSpacing: "0em",
          }}
          applicantHeader={{
            name: "Robert Cooper",
            role: "Designer",
            company: "Cooper Studio",
            email: "email@email.com",
            phone: "",
            linkedin: null,
            website: "",
            location: "Los Angeles",
            tag: null,
          }}
        />,
      );
      const root = container.querySelector(scope);

      expect(root?.querySelector(secondarySelector)?.textContent).toBe(
        "Cooper Studio",
      );
      expect(root?.textContent).toContain("Designer");
    },
  );

  it("keeps applicant company visible in Film und Foto when the role is long", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content="Dear Hiring Manager,\n\nI can support the team."
        proposalType="cover_letter"
        templateId="film-foto-letterhead"
        railTitle="Robert Cooper"
        railMeta="Security Guard"
        contactLine="email@email.com · +38686834400002 · CA 90291 United States · LINKEDIN · PORTFOLIO.COM"
        letterDate="May 12, 2026"
        recipientDetails="Hiring Manager"
        documentTitle="Application for Security Guard"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        applicantHeader={{
          name: "Robert Cooper",
          role: "Security Guard",
          company: "Companii",
          email: "",
          phone: "",
          linkedin: null,
          website: "",
          location: "",
          tag: null,
        }}
      />,
    );

    const root = container.querySelector(".proposal-cover-letter--film-foto");
    expect(
      root?.querySelector(".proposal-cover-letter__film-company")?.textContent,
    ).toBe("Companii");
    expect(
      root?.querySelector(".proposal-cover-letter__film-title")?.textContent,
    ).toBe("Security Guard");
    expect(root?.querySelector(".proposal-cover-letter__info-blocks")?.textContent)
      .toContain("LINKEDIN");
    expect(root?.querySelector(".proposal-cover-letter__info-block--phone")?.textContent)
      .toContain("+38686834400002");
  });

  it.each([
    {
      templateId: "director-letterhead" as const,
      scope: ".proposal-cover-letter--director",
      headerSelector: ".proposal-cover-letter__masthead",
    },
    {
      templateId: "volk-letterhead" as const,
      scope: ".proposal-cover-letter--volk",
      headerSelector: ".proposal-cover-letter__volk-header",
    },
    {
      templateId: "film-foto-letterhead" as const,
      scope: ".proposal-cover-letter--film-foto",
      headerSelector: ".proposal-cover-letter__film-header",
    },
  ])(
    "keeps the long generated subject out of short title regions for $templateId",
    ({ templateId, scope, headerSelector }) => {
      const longSubject =
        "Application for the position of Security Guard Full Time Airport Unarmed at Us Smart Tools";
      const { container } = render(
        <ProposalDocumentRenderer
          content="Dear Hiring Manager,\n\nI can support the team."
          proposalType="cover_letter"
          templateId={templateId}
          railTitle="Robert Cooper"
          railMeta="Security Guard"
          contactLine="email@email.com · CA 90291 United States"
          letterDate="May 12, 2026"
          recipientDetails={"Hiring Manager\nSecurity Guard\nUs Smart Tools"}
          documentTitle={longSubject}
          documentTypography={{
            fontFamily: "Georgia, serif",
            fontSize: "14px",
            lineHeight: 1.5,
            fontWeight: 400,
            letterSpacing: "0em",
          }}
          applicantHeader={{
            name: "Robert Cooper",
            role: "Security Guard",
            email: "email@email.com",
            phone: "+3586853442",
            linkedin: null,
            website: "",
            location: "CA 90291 United States",
            tag: null,
          }}
        />,
      );
      const root = container.querySelector(scope);
      const renderedPage = Array.from(
        root?.querySelectorAll(".dasti-proposal-document__page") ?? [],
      ).at(-1);
      const header = renderedPage?.querySelector(headerSelector);
      const metaRow = renderedPage?.querySelector(".proposal-cover-letter__meta-row");

      expect(countTextOccurrences(renderedPage?.textContent ?? "", longSubject)).toBe(1);
      expect(header?.textContent).not.toContain(longSubject);
      expect(metaRow?.textContent).not.toContain(longSubject);
      expect(renderedPage?.textContent).toContain("Security Guard");
      expect(renderedPage?.textContent).toContain("Us Smart Tools");
    },
  );

  it.each([
    {
      templateId: "director-letterhead" as const,
      scope: ".proposal-cover-letter--director",
      headerSelector: ".proposal-cover-letter__masthead",
    },
    {
      templateId: "volk-letterhead" as const,
      scope: ".proposal-cover-letter--volk",
      headerSelector: ".proposal-cover-letter__volk-header",
    },
    {
      templateId: "film-foto-letterhead" as const,
      scope: ".proposal-cover-letter--film-foto",
      headerSelector: ".proposal-cover-letter__film-header",
    },
  ])(
    "keeps full postal addresses out of the top title row for $templateId",
    ({ templateId, scope, headerSelector }) => {
      const { container } = render(
        <ProposalDocumentRenderer
          content="Dear Hiring Manager,\n\nI can support the team."
          proposalType="cover_letter"
          templateId={templateId}
          railTitle="Robert Cooper"
          railMeta="Security Guard"
          contactLine="email@email.com · 1515 Pacific Ave Los Angeles · CA 90291 United States"
          letterDate="May 12, 2026"
          recipientDetails="Hiring Manager"
          documentTitle="Application for Security Guard"
          documentTypography={{
            fontFamily: "Georgia, serif",
            fontSize: "14px",
            lineHeight: 1.5,
            fontWeight: 400,
            letterSpacing: "0em",
          }}
        />,
      );
      const root = container.querySelector(scope);
      const header = Array.from(
        root?.querySelectorAll(headerSelector) ?? [],
      ).at(-1);

      expect(header?.textContent).not.toContain("1515 Pacific Ave");
      expect(header?.textContent).not.toContain("CA 90291");
      expect(header?.textContent).not.toContain("United States");
    },
  );

  it.each([
    {
      templateId: "director-letterhead" as const,
      scope: ".proposal-cover-letter--director",
    },
    {
      templateId: "volk-letterhead" as const,
      scope: ".proposal-cover-letter--volk",
    },
    {
      templateId: "film-foto-letterhead" as const,
      scope: ".proposal-cover-letter--film-foto",
    },
  ])(
    "keeps sender contact fields de-duplicated for $templateId",
    ({ templateId, scope }) => {
      const { container } = render(
        <ProposalDocumentRenderer
          content="Dear Hiring Manager,\n\nI can support the team."
          proposalType="cover_letter"
          templateId={templateId}
          railTitle="Zoe Lund"
          railMeta="Security Guard"
          contactLine="Letter · 09898777 · Paris · zoe.com"
          letterDate="May 12, 2026"
          recipientDetails={"Abel Ferrarra\nCinema\nNew York"}
          documentTitle="Killer job"
          documentMeta="Letter"
          documentTypography={{
            fontFamily: "Georgia, serif",
            fontSize: "14px",
            lineHeight: 1.5,
            fontWeight: 400,
            letterSpacing: "0em",
          }}
          applicantHeader={{
            name: "Zoe Lund",
            role: "Security Guard",
            email: "zoe@loi.com",
            phone: "09898777",
            linkedin: null,
            website: "zoe.com",
            location: "Paris",
            tag: null,
          }}
        />,
      );
      const root = container.querySelector(scope);
      const renderedPage = Array.from(
        root?.querySelectorAll(".dasti-proposal-document__page") ?? [],
      ).at(-1);
      const text = renderedPage?.textContent ?? "";

      expect(text).toContain("Zoe Lund");
      expect(text).toContain("zoe@loi.com");
      expect(text).toContain("09898777");
      expect(text).toContain("Paris");
      expect(text).toContain("zoe.com");
      expect(text).not.toContain("Letter");
      expect(countTextOccurrences(text, "09898777")).toBe(1);
      expect(countTextOccurrences(text, "Paris")).toBe(1);
      expect(countTextOccurrences(text, "zoe.com")).toBe(1);

      if (templateId === "film-foto-letterhead") {
        expect(
          renderedPage?.querySelector(".proposal-cover-letter__film-heading")
            ?.textContent,
        ).toBe("Zoe Lund");
      }
    },
  );

  it("tolerates missing optional letterhead metadata without placeholder leaks", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content={"I can support the team with clear written execution."}
        proposalType="cover_letter"
        templateId="director-letterhead"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
      />,
    );

    expect(container.textContent).toContain(
      "I can support the team with clear written execution.",
    );
    expect(container.textContent).not.toContain("undefined");
    expect(container.textContent).not.toContain("null");
    expect(container.textContent).not.toContain("[object Object]");
  });

  it("maps phone typed in the combined contact line into the director T block", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content="Dear Hiring Manager,\n\nI can support the team."
        proposalType="cover_letter"
        templateId="director-letterhead"
        railTitle="Zoe Lund"
        railMeta="Security Guard"
        contactLine="zoe@loi.com · 09898777 · Paris · @zoe.com"
        documentTitle="Security Guard"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
      />,
    );

    const phoneBlock = container.querySelector(
      ".proposal-cover-letter--director .proposal-cover-letter__phone-block",
    );

    expect(phoneBlock?.textContent).toContain("T");
    expect(phoneBlock?.textContent).toContain("09898777");
    expect(phoneBlock?.textContent).not.toContain("zoe@loi.com");
  });

  it("uses a digital @ contact block in the director letterhead when no phone exists", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content="Dear Hiring Manager,\n\nI can support the team."
        proposalType="cover_letter"
        templateId="director-letterhead"
        railTitle="Zoe Lund"
        railMeta="Security Guard"
        contactLine="zoe@loi.com · Paris · zoe.com"
        documentTitle="Security Guard"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
      />,
    );

    const phoneBlock = container.querySelector(
      ".proposal-cover-letter--director .proposal-cover-letter__phone-block",
    );

    expect(phoneBlock?.textContent).toContain("@");
    expect(phoneBlock?.textContent).toContain("zoe@loi.com");
    expect(phoneBlock?.textContent).toContain("zoe.com");
    expect(phoneBlock?.textContent).not.toContain("T");
  });
});
