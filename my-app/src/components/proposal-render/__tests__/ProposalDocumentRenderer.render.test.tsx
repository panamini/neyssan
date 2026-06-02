import React from "react";
import { fireEvent, render } from "@testing-library/react";
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

  it("renders plain-text bullet lines as document icon lists", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content={
          "Dear Hiring Team,\n\n- Audit the current proposal flow\n- Ship inline SVG export markers\n\nKind regards,\nJane Doe"
        }
        proposalType="cover_letter"
        templateId="swiss_margin"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        documentIconSettings={{
          defaultListMarkerKey: "asterisk-simple",
          listMarkerType: "icon",
          sectionHeadingIconMode: "none",
          sectionIconMap: {},
          color: "accent",
          sizePt: 12,
        }}
      />,
    );

    const list = container.querySelector(".dasti-proposal-document__list");

    expect(list).not.toBeNull();
    expect(list?.querySelectorAll("li")).toHaveLength(2);
    expect(list?.querySelector(".dasti-proposal-document__list-marker svg")).not.toBeNull();
    expect(container.textContent).toContain("Audit the current proposal flow");
    expect(container.textContent).toContain("Ship inline SVG export markers");
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
      templateId: "twoweeks-letterhead" as const,
      scope: ".proposal-cover-letter--twoweeks",
      recipientSelector: ".proposal-cover-letter__twoweeks-recipient",
      heading: "Jane Doe",
    },
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

  it("maps Film und Foto role to the light left kicker and name to the bold title", () => {
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
      header?.querySelector(".proposal-cover-letter__film-heading")?.textContent,
    ).toBe("Security Guard");
    expect(
      header?.querySelector(".proposal-cover-letter__film-title")?.textContent,
    ).toBe("Robert Cooper");
    expect(header?.querySelector(".proposal-cover-letter__film-company")).toBeNull();
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

  it("keeps Film und Foto contacts visible when the role is long", () => {
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
      root?.querySelector(".proposal-cover-letter__film-heading")?.textContent,
    ).toBe("Security Guard");
    expect(
      root?.querySelector(".proposal-cover-letter__film-title")?.textContent,
    ).toBe("Robert Cooper");
    expect(root?.querySelector(".proposal-cover-letter__film-company")).toBeNull();
    expect(root?.querySelector(".proposal-cover-letter__info-blocks")?.textContent)
      .toContain("LINKEDIN");
    expect(root?.querySelector(".proposal-cover-letter__info-block--phone")?.textContent)
      .toContain("+38686834400002");
    expect(
      root?.querySelector(".proposal-cover-letter__film-address-footer")
        ?.textContent,
    ).toBe("CA 90291 United States");
    const socialBlock = Array.from(
      root?.querySelectorAll(".proposal-cover-letter__info-blocks > div") ??
        [],
    ).find(
      (node) =>
        node.querySelector(".proposal-cover-letter__info-label")?.textContent ===
        "social",
    );
    const portfolioBlock = Array.from(
      root?.querySelectorAll(".proposal-cover-letter__info-blocks > div") ??
        [],
    ).find(
      (node) =>
        node.querySelector(".proposal-cover-letter__info-label")?.textContent ===
        "www",
    );
    expect(
      Array.from(socialBlock?.querySelectorAll("p") ?? []).map(
        (node) => node.textContent,
      ),
    ).toEqual(["social", "LINKEDIN"]);
    expect(
      root
        ?.querySelector(".proposal-cover-letter__info-blocks > div")
        ?.textContent,
    ).not.toContain("CA 90291");
    expect(
      Array.from(portfolioBlock?.querySelectorAll("p") ?? []).map(
        (node) => node.textContent,
      ),
    ).toEqual(["www", "PORTFOLIO.COM"]);
    expect(socialBlock?.textContent).not.toContain(" · ");
    expect(portfolioBlock?.textContent).not.toContain(" · ");
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
        ).toBe("Security Guard");
        expect(
          renderedPage?.querySelector(".proposal-cover-letter__film-title")
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
      ".proposal-cover-letter--director .proposal-cover-letter__contact-grid",
    );
    const contactGroups = Array.from(
      phoneBlock?.querySelectorAll(".proposal-cover-letter__contact-group") ??
        [],
    );

    expect(contactGroups).toHaveLength(2);
    expect(contactGroups[0]?.querySelector(".proposal-cover-letter__contact-mark")?.textContent)
      .toBe("T");
    expect(contactGroups[0]?.querySelector(".proposal-cover-letter__contact-lines")?.textContent)
      .toContain("09898777");
    expect(contactGroups[1]?.querySelector(".proposal-cover-letter__contact-mark")?.textContent)
      .toBe("@");
    expect(phoneBlock?.textContent).toContain("T");
    expect(phoneBlock?.textContent).toContain("09898777");
    expect(phoneBlock?.textContent).toContain("@");
    expect(phoneBlock?.textContent).toContain("zoe@loi.com");
    expect(phoneBlock?.textContent).toContain("zoe.com");
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
      ".proposal-cover-letter--director .proposal-cover-letter__contact-grid",
    );

    expect(phoneBlock?.textContent).toContain("@");
    expect(phoneBlock?.textContent).toContain("zoe@loi.com");
    expect(phoneBlock?.textContent).toContain("zoe.com");
    expect(phoneBlock?.textContent).not.toContain("T");
  });

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
    "renders recipient postal contact details in a compact block for $templateId",
    ({ templateId, scope }) => {
      const { container } = render(
        <ProposalDocumentRenderer
          content={[
            "Dear Hiring Manager,",
            "First body paragraph.",
            "Second body paragraph.",
          ].join("\n\n")}
          proposalType="cover_letter"
          templateId={templateId}
          railTitle="Robert Cooper"
          railMeta="Security Guard"
          contactLine="name@email.com · +321 08 98 43 23 43 · LINKEDIN · PORTFOLIO.COM"
          letterDate="May 12, 2026"
          recipientDetails={
            "Hiring Manager\nTalent Acquisition\nCompany Name\nrecipient@example.com\nStreet address\nCompany City"
          }
          documentTitle="Subject line"
          headerVisibility={{
            showSender: true,
            showDate: true,
            showSubject: true,
            showRecipient: true,
            showRecipientDetails: true,
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

      const root = container.querySelector(scope);
      const renderedPage = Array.from(
        root?.querySelectorAll(".dasti-proposal-document__page") ?? [],
      ).at(-1);
      const recipientBlock = renderedPage?.querySelector(
        ".proposal-cover-letter__recipient-block",
      );
      const subjectLabel = renderedPage?.querySelector(
        ".proposal-cover-letter__subject-label",
      );
      const metaItems = Array.from(
        renderedPage?.querySelectorAll(".proposal-cover-letter__meta-item") ??
          [],
      ).map((node) => node.textContent);
      const paragraphs = Array.from(
        renderedPage?.querySelectorAll(".dasti-proposal-document__paragraph") ??
          [],
      ).map((node) => node.textContent);

      expect(recipientBlock?.textContent).toContain("Street address");
      expect(recipientBlock?.textContent).toContain("Company City");
      expect(recipientBlock?.textContent).toContain("recipient@example.com");
      expect(recipientBlock?.textContent).not.toContain("Hiring Manager");
      expect(recipientBlock?.textContent).not.toContain("Company Name");
      expect(recipientBlock?.textContent).not.toContain("Talent Acquisition");
      expect(subjectLabel?.textContent).toBe(
        templateId === "film-foto-letterhead" ? "subject:" : "Subject:",
      );
      expect(metaItems).toEqual([
        "Hiring Manager",
        "Talent Acquisition",
        "Company Name",
        "May 12, 2026",
      ]);
      expect(paragraphs).toEqual([
        "First body paragraph.",
        "Second body paragraph.",
      ]);
      expect(renderedPage?.textContent).not.toContain("undefined");
      expect(renderedPage?.textContent).not.toContain("null");
      expect(renderedPage?.textContent).not.toContain("[object Object]");
    },
  );

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
    "does not fall back to recipient fields for the applicant company title in $templateId",
    ({ templateId, scope, secondarySelector }) => {
      const { container } = render(
        <ProposalDocumentRenderer
          content="Dear Hiring Manager,\n\nI can support the team."
          proposalType="cover_letter"
          templateId={templateId}
          railTitle="Robert Cooper"
          railMeta="Security Guard"
          contactLine="email@email.com · Los Angeles"
          letterDate="May 12, 2026"
          recipientDetails={
            "Hiring Manager\nTalent Acquisition\nUs Smart Tools\nrecipient@example.com\nStreet address\nParis"
          }
          documentTitle="Application for Security Guard"
          headerVisibility={{
            showSender: true,
            showDate: true,
            showSubject: true,
            showRecipient: true,
            showRecipientDetails: true,
          }}
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
            company: "",
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

      expect(root?.querySelector(secondarySelector)).toBeNull();
      expect(root?.textContent).toContain("Security Guard");
      expect(root?.querySelector(".proposal-cover-letter__recipient-block")?.textContent)
        .toContain("recipient@example.com");
    },
  );

  it.each([
    {
      templateId: "director-letterhead" as const,
      scope: ".proposal-cover-letter--director",
      recipientSelector: ".proposal-cover-letter__recipient-block",
    },
    {
      templateId: "volk-letterhead" as const,
      scope: ".proposal-cover-letter--volk",
      recipientSelector: ".proposal-cover-letter__recipient-block",
    },
    {
      templateId: "film-foto-letterhead" as const,
      scope: ".proposal-cover-letter--film-foto",
      recipientSelector: ".proposal-cover-letter__recipient-block",
    },
    {
      templateId: "moma-bauhaus-letterhead" as const,
      scope: ".proposal-cover-letter--moma-bauhaus",
      recipientSelector: ".proposal-cover-letter__bauhaus-recipient",
    },
    {
      templateId: "joella-frame-letterhead" as const,
      scope: ".proposal-cover-letter--joella",
      recipientSelector: ".proposal-cover-letter__joella-letter-block",
    },
    {
      templateId: "bayer-letterhead" as const,
      scope: ".proposal-cover-letter--bayer",
      recipientSelector: ".proposal-cover-letter__bayer-recipient",
    },
  ])(
    "routes every heading drawer field into $templateId letterhead",
    ({ templateId, scope, recipientSelector }) => {
      const { container } = render(
        <ProposalDocumentRenderer
          content="Dear Hiring Manager,\n\nI can support the team."
          proposalType="cover_letter"
          templateId={templateId}
          railTitle="Avery Stone"
          railMeta="Operations Lead"
          contactLine="avery@example.com · +33 6 01 02 03 04 · Paris / Remote · linkedin.com/in/avery · avery.work"
          letterDate="May 30, 2026"
          recipientDetails={
            "Hiring Manager\nHead of Talent\nNorthwind\nhiring@northwind.com\n12 Rue de la Paix\nParis\nAdditional address line"
          }
          documentTitle="Application for Operations Lead"
          headerVisibility={{
            showSender: true,
            showDate: true,
            showSubject: true,
            showRecipient: true,
            showRecipientDetails: true,
          }}
          documentTypography={{
            fontFamily: "Georgia, serif",
            fontSize: "14px",
            lineHeight: 1.5,
            fontWeight: 400,
            letterSpacing: "0em",
          }}
          applicantHeader={{
            name: "Avery Stone",
            role: "Operations Lead",
            company: "Stone Systems",
            email: "avery@example.com",
            phone: "+33 6 01 02 03 04",
            linkedin: "linkedin.com/in/avery",
            website: "avery.work",
            location: "Paris / Remote",
            tag: null,
          }}
        />,
      );

      const root = container.querySelector(scope);
      const renderedPage = Array.from(
        root?.querySelectorAll(".dasti-proposal-document__page") ?? [],
      ).at(-1);
      const pageText = renderedPage?.textContent ?? "";
      const recipientBlock = renderedPage?.querySelector(recipientSelector);
      const recipientText = recipientBlock?.textContent ?? "";

      const expectedPageValues = [
        "Avery Stone",
        "Operations Lead",
        "avery@example.com",
        "+33 6 01 02 03 04",
        "linkedin.com/in/avery",
        "avery.work",
        "Paris / Remote",
      ];
      if (scope !== ".proposal-cover-letter--film-foto") {
        expectedPageValues.push("Stone Systems");
      }
      expectedPageValues.forEach((value) => {
        expect(pageText).toContain(value);
      });

      if (recipientSelector === ".proposal-cover-letter__recipient-block") {
        const stack = renderedPage?.querySelector(
          ".proposal-cover-letter__recipient-subject-stack",
        );
        const subjectRow = renderedPage?.querySelector(
          ".proposal-cover-letter__subject-row",
        );
        const metaItems = Array.from(
          renderedPage?.querySelectorAll(".proposal-cover-letter__meta-item") ??
            [],
        ).map((node) => node.textContent);

        expect(stack).toBeTruthy();
        expect(stack?.querySelector(recipientSelector)).toBe(recipientBlock);
        expect(stack?.querySelector(".proposal-cover-letter__subject-row")).toBe(
          subjectRow,
        );
        expect(metaItems).toEqual([
          "Hiring Manager",
          "Head of Talent",
          "Northwind",
          "May 30, 2026",
        ]);
        ["hiring@northwind.com", "12 Rue de la Paix", "Paris", "Additional address line"].forEach((value) => {
          expect(recipientText).toContain(value);
        });
        ["Hiring Manager", "Head of Talent", "Northwind"].forEach((value) => {
          expect(recipientText).not.toContain(value);
        });
        if (scope === ".proposal-cover-letter--film-foto") {
          const labels = Array.from(
            renderedPage?.querySelectorAll(
              ".proposal-cover-letter__info-blocks .proposal-cover-letter__info-label",
            ) ?? [],
          ).map((node) => node.textContent);

          expect(labels).toEqual([
            "sender",
            "company",
            "phone",
            "social",
            "www",
          ]);
          expect(pageText).not.toContain("Stone Systems");
        }
      } else {
        [
          "Hiring Manager",
          "Head of Talent",
          "Northwind",
          "hiring@northwind.com",
          "12 Rue de la Paix",
          "Paris",
          "Additional address line",
        ].forEach((value) => {
          expect(recipientText).toContain(value);
        });
      }
    },
  );

  it("renders the Editorial template on the historical Brendon Mayer grid", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content={[
          "Dear Hiring Manager,",
          "First editorial body paragraph.",
          "Second editorial body paragraph.",
          "Sincerely,",
          "Avery Stone",
        ].join("\n\n")}
        proposalType="cover_letter"
        templateId="editorial_wide"
        railTitle="Avery Stone"
        railMeta="Operations Lead"
        contactLine="avery@example.com · +33 6 01 02 03 04 · Paris / Remote · linkedin.com/in/avery · avery.work"
        letterDate="May 30, 2026"
        recipientDetails={
          "Hiring Manager\nHead of Talent\nNorthwind\nhiring@northwind.com\n12 Rue de la Paix\nParis"
        }
        documentTitle="Application for Operations Lead"
        headerVisibility={{
          showSender: true,
          showDate: true,
          showSubject: true,
          showRecipient: true,
          showRecipientDetails: true,
        }}
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        applicantHeader={{
          name: "Avery Stone",
          role: "Operations Lead",
          company: "Stone Systems",
          email: "avery@example.com",
          phone: "+33 6 01 02 03 04",
          linkedin: "linkedin.com/in/avery",
          website: "avery.work",
          location: "Paris / Remote",
          tag: null,
        }}
      />,
    );

    const root = container.querySelector(".proposal-cover-letter--editorial");
    const renderedPage = Array.from(
      root?.querySelectorAll(".dasti-proposal-document__page") ?? [],
    ).at(-1);
    const wordmark = renderedPage?.querySelector(
      ".proposal-cover-letter__editorial-wordmark",
    );
    const subtitle = renderedPage?.querySelector(
      ".proposal-cover-letter__editorial-subtitle",
    );
    const bodyFlow = renderedPage?.querySelector(
      ".proposal-cover-letter__editorial-body-flow",
    );
    const recipientCopy = Array.from(
      renderedPage?.querySelectorAll(
        ".proposal-cover-letter__editorial-contact-copy",
      ) ?? [],
    )[0];
    const senderCopy = Array.from(
      renderedPage?.querySelectorAll(
        ".proposal-cover-letter__editorial-contact-copy",
      ) ?? [],
    )[1];

    expect(root?.getAttribute("data-proposal-template")).toBe("editorial_wide");
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__editorial-canvas"),
    ).toBeNull();
    const topAccent = renderedPage?.querySelector(
      ".proposal-cover-letter__editorial-top-ribbon",
    );
    const railRule = renderedPage?.querySelector(
      ".proposal-cover-letter__editorial-rail-rule",
    );
    const salutationRule = renderedPage?.querySelector(
      ".proposal-cover-letter__editorial-body-rule",
    );
    expect(topAccent).toBeTruthy();
    expect(railRule).toBeTruthy();
    expect(salutationRule).toBeTruthy();
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__editorial-header-rule"),
    ).toBeTruthy();
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__editorial-logo-mark"),
    ).toBeNull();
    const templateDecoration = renderedPage?.querySelector(
      ".dasti-proposal-document-decoration",
    );
    const templateDecorationImage = templateDecoration?.querySelector("img");
    expect(templateDecoration).toBeTruthy();
    expect(templateDecoration).toHaveAttribute("data-decoration-size-mm", "18");
    expect(templateDecoration?.getAttribute("style")).toContain("157");
    expect(templateDecoration?.getAttribute("style")).toContain("18");
    expect(templateDecorationImage?.getAttribute("src")).toContain(
      "data:image/svg+xml,",
    );
    expect(templateDecorationImage).toHaveAttribute(
      "alt",
      "Template flower mark",
    );
    expect(wordmark?.textContent).toBe("STONE SYSTEMS");
    expect(subtitle?.textContent).toBe("Operations Lead");
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__editorial-date")
        ?.textContent,
    ).toBe("May 30, 2026");
    expect(recipientCopy?.textContent).toContain("Hiring Manager");
    expect(recipientCopy?.textContent).toContain("Head of Talent");
    expect(recipientCopy?.textContent).toContain("Northwind");
    expect(recipientCopy?.textContent).toContain("hiring@northwind.com");
    expect(recipientCopy?.textContent).toContain("12 Rue de la Paix");
    expect(recipientCopy?.textContent).not.toContain("Re");
    expect(recipientCopy?.textContent).not.toContain(
      "Application for Operations Lead",
    );
    const recipientGroups = Array.from(
      recipientCopy?.querySelectorAll("p") ?? [],
    );
    expect(
      recipientGroups.map((group) => group.querySelector("b")?.textContent),
    ).toEqual(["Name", "Role", "Company", "Email", "Address", "City"]);
    expect(recipientGroups[0]?.textContent).toContain("Hiring Manager");
    expect(recipientGroups[1]?.textContent).toContain("Head of Talent");
    expect(recipientGroups[2]?.textContent).toContain("Northwind");
    expect(recipientGroups[3]?.textContent).toContain("hiring@northwind.com");
    expect(recipientGroups[4]?.textContent).toContain("12 Rue de la Paix");
    expect(recipientGroups[5]?.textContent).toContain("Paris");
    expect(senderCopy?.textContent).toContain("Avery Stone");
    expect(senderCopy?.textContent).toContain("Operations Lead");
    expect(senderCopy?.textContent).toContain("avery@example.com");
    expect(senderCopy?.textContent).toContain("+33 6 01 02 03 04");
    const senderGroups = Array.from(senderCopy?.querySelectorAll("p") ?? []);
    expect(senderGroups.map((group) => group.querySelector("b")?.textContent)).toEqual([
      "Avery Stone",
      "Company",
      "Location",
      "Phone",
      "Email",
      "Social",
      "WWW",
    ]);
    expect(senderGroups[0]?.textContent).toContain("Operations Lead");
    expect(senderGroups[5]?.textContent).toContain("linkedin.com/in/avery");
    expect(senderGroups[6]?.textContent).toContain("avery.work");
    expect(
      Array.from(
        renderedPage?.querySelectorAll(
          ".proposal-cover-letter__editorial-header-rule, .proposal-cover-letter__editorial-rail-rule, .proposal-cover-letter__editorial-body-rule, .proposal-cover-letter__editorial-date-rule, .proposal-cover-letter__editorial-label-rule",
        ) ?? [],
      ).length,
    ).toBeGreaterThanOrEqual(6);
    expect(senderCopy?.textContent).not.toContain(
      "Application for Operations Lead",
    );
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__editorial-subject")
        ?.textContent,
    ).toBe("Application for Operations Lead");
    expect(bodyFlow?.classList.contains(
      "proposal-cover-letter__editorial-body-flow--subject-heading",
    )).toBe(true);
    expect(bodyFlow?.querySelector(".dasti-proposal-document__salutation")?.textContent)
      .toBe("Dear Hiring Manager,");
    expect(
      Array.from(
        bodyFlow?.querySelectorAll(".dasti-proposal-document__paragraph") ?? [],
      ).map((node) => node.textContent),
    ).toEqual([
      "First editorial body paragraph.",
      "Second editorial body paragraph.",
    ]);
  });

  it("routes Editorial drawer title, meta, and contact line into left-column groups", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content="I can support the team."
        proposalType="cover_letter"
        templateId="editorial_wide"
        railTitle="Robert Cooper"
        railMeta="Security Guard"
        contactLine={
          "email@email.com · +33 6 88 24 40 52 · Boston · linkedin.com/in/robert · www.robert-of-my-company.com"
        }
        letterDate="12 May 2026"
        recipientDetails={
          "Hiring Manager\nSecurity Lead\nBoston Company\nemail@email.com\n12 Beacon Street\nBoston"
        }
        documentTitle="Application for the position of security guard"
        headerVisibility={{
          showSender: true,
          showDate: true,
          showSubject: true,
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
        applicantHeader={{
          name: "",
          role: "",
          company: "",
          email: "",
          phone: "",
          linkedin: "",
          website: "",
          location: "",
          tag: null,
        }}
      />,
    );

    const contactCopies = Array.from(
      container.querySelectorAll(".proposal-cover-letter__editorial-contact-copy"),
    );
    const recipientCopy = contactCopies[0];
    const senderCopy = contactCopies[1];
    const recipientGroups = Array.from(recipientCopy?.querySelectorAll("p") ?? []);
    const senderGroups = Array.from(senderCopy?.querySelectorAll("p") ?? []);

    expect(
      recipientGroups.map((group) => group.querySelector("b")?.textContent),
    ).toEqual(["Name", "Role", "Company", "Email", "Address", "City"]);
    expect(recipientGroups[3]?.textContent).toContain("email@email.com");
    expect(recipientGroups[4]?.textContent).toContain("12 Beacon Street");
    expect(recipientGroups[5]?.textContent).toContain("Boston");

    expect(senderGroups.map((group) => group.querySelector("b")?.textContent)).toEqual([
      "Robert Cooper",
      "Location",
      "Phone",
      "Email",
      "Social",
      "WWW",
    ]);
    expect(senderGroups[0]?.textContent).toContain("Security Guard");
    expect(senderGroups[1]?.textContent).toContain("Boston");
    expect(senderGroups[2]?.textContent).toContain("+33 6 88 24 40 52");
    expect(senderGroups[3]?.textContent).toContain("email@email.com");
    expect(senderGroups[4]?.textContent).toContain("linkedin.com/in/robert");
    expect(senderGroups[5]?.textContent).toContain(
      "www.robert-of-my-company.com",
    );
  });

  it("keeps Editorial left-rail metadata visible when generic heading toggles are off", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content="Dear Hiring Manager,\n\nI can support the team."
        proposalType="cover_letter"
        templateId="editorial_wide"
        railTitle="Robert Cooper"
        railMeta="Security Guard"
        contactLine={
          "email@email.com · +33 6 88 24 40 52 · Boston · linkedin.com/in/robert · www.robert-of-my-company.com"
        }
        letterDate="12 May 2026"
        recipientDetails={
          "Hiring Manager\nSecurity Lead\nBoston Company\nemail@email.com\n12 Beacon Street\nBoston"
        }
        documentTitle="Application for the position of security guard"
        headerVisibility={{
          showSender: false,
          showDate: true,
          showSubject: true,
          showRecipient: false,
          showRecipientDetails: false,
        }}
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        applicantHeader={{
          name: "",
          role: "",
          company: "",
          email: "",
          phone: "",
          linkedin: "",
          website: "",
          location: "",
          tag: null,
        }}
      />,
    );

    const [recipientCopy, senderCopy] = Array.from(
      container.querySelectorAll(".proposal-cover-letter__editorial-contact-copy"),
    );
    const recipientGroups = Array.from(recipientCopy?.querySelectorAll("p") ?? []);
    const senderGroups = Array.from(senderCopy?.querySelectorAll("p") ?? []);

    expect(
      recipientGroups.map((group) => group.querySelector("b")?.textContent),
    ).toEqual(["Name", "Role", "Company", "Email", "Address", "City"]);
    expect(recipientGroups[4]?.textContent).toContain("12 Beacon Street");
    expect(recipientGroups[5]?.textContent).toContain("Boston");
    expect(senderGroups.map((group) => group.querySelector("b")?.textContent)).toEqual([
      "Robert Cooper",
      "Location",
      "Phone",
      "Email",
      "Social",
      "WWW",
    ]);
    expect(senderGroups[4]?.textContent).toContain("linkedin.com/in/robert");
    expect(senderGroups[5]?.textContent).toContain(
      "www.robert-of-my-company.com",
    );
  });

  it("keeps the Editorial template usable with partial heading fields", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content="I can support the team."
        proposalType="cover_letter"
        templateId="editorial_wide"
        railTitle=""
        railMeta=""
        contactLine=""
        letterDate=""
        recipientDetails=""
        documentTitle=""
        headerVisibility={{
          showSender: true,
          showDate: true,
          showSubject: true,
          showRecipient: true,
          showRecipientDetails: true,
        }}
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        applicantHeader={{
          name: "",
          role: "",
          company: "",
          email: "",
          phone: "",
          linkedin: "",
          website: "",
          location: "",
          tag: null,
        }}
      />,
    );

    const root = container.querySelector(".proposal-cover-letter--editorial");
    const text = root?.textContent ?? "";

    expect(root?.getAttribute("data-proposal-template")).toBe("editorial_wide");
    expect(
      root?.querySelector(".proposal-cover-letter__editorial-canvas"),
    ).toBeNull();
    expect(
      root?.querySelector(".proposal-cover-letter__editorial-body-flow"),
    ).toBeTruthy();
    expect(text).toContain("I can support the team.");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("null");
    expect(
      root?.querySelector(".proposal-cover-letter__editorial-wordmark"),
    ).toBeNull();
  });

  it("renders the Twoweeks letterhead from drawer headings and design variables", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content={[
          "Dear Hiring Manager:",
          "First Twoweeks body paragraph.",
          "Second Twoweeks body paragraph.",
          "Kind regards,",
          "Avery Stone",
        ].join("\n\n")}
        proposalType="cover_letter"
        templateId="twoweeks-letterhead"
        railTitle="Avery Stone"
        railMeta="Operations Lead"
        contactLine="avery@example.com · +33 6 01 02 03 04 · Paris / Remote · linkedin.com/in/avery · avery.work"
        letterDate="May 30, 2026"
        recipientDetails={
          "Hiring Manager\nHead of Talent\nNorthwind\nhiring@northwind.com\n12 Rue de la Paix\nParis"
        }
        documentTitle="Application for Operations Lead"
        headerVisibility={{
          showSender: true,
          showDate: true,
          showSubject: true,
          showRecipient: true,
          showRecipientDetails: true,
        }}
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        documentThemeVars={{
          "--proposal-document-paper": "#fff7df",
          "--proposal-document-ink": "#14213d",
          "--proposal-document-accent-ink": "#385f8a",
          "--heading-font": '"Drawer Heading", sans-serif',
          "--body-font": '"Drawer Body", serif',
        }}
        applicantHeader={{
          name: "Avery Stone",
          role: "Operations Lead",
          company: "Stone Systems",
          email: "avery@example.com",
          phone: "+33 6 01 02 03 04",
          linkedin: "linkedin.com/in/avery",
          website: "avery.work",
          location: "Paris / Remote",
          tag: null,
        }}
      />,
    );

    const root = container.querySelector(".proposal-cover-letter--twoweeks");
    const renderedPage = Array.from(
      root?.querySelectorAll(".dasti-proposal-document__page") ?? [],
    ).at(-1);
    const railElement = renderedPage?.querySelector(
      ".proposal-cover-letter__twoweeks-rail",
    );
    const rail = railElement?.textContent ?? "";
    const senderLines = Array.from(railElement?.querySelectorAll("p") ?? []).map(
      (node) => node.textContent,
    );
    const twoweeksRole = railElement?.querySelector(
      ".proposal-cover-letter__twoweeks-role",
    );
    const contactLines = Array.from(
      railElement?.querySelectorAll(".proposal-cover-letter__twoweeks-contact p") ??
        [],
    ).map((node) => node.textContent);
    const contactGroups = Array.from(
      railElement?.querySelectorAll(
        ".proposal-cover-letter__twoweeks-contact-group",
      ) ?? [],
    ).map((group) =>
      Array.from(group.querySelectorAll("p")).map((node) => node.textContent),
    );
    const recipientLines = Array.from(
      renderedPage?.querySelectorAll(".proposal-cover-letter__twoweeks-recipient p") ??
        [],
    ).map((node) => node.textContent);
    const paragraphs = Array.from(
      renderedPage?.querySelectorAll(".dasti-proposal-document__paragraph") ??
        [],
    ).map((node) => node.textContent);

    expect(root?.getAttribute("data-proposal-template")).toBe("twoweeks-letterhead");
    expect(root?.getAttribute("style")).toContain(
      "--proposal-document-paper: #fff7df",
    );
    expect(root?.getAttribute("style")).toContain(
      "--proposal-document-accent-ink: #385f8a",
    );
    expect(rail).toContain("Avery");
    expect(rail).toContain("Stone");
    expect(rail).toContain("Operations Lead");
    expect(rail).toContain("avery@example.com");
    expect(rail).toContain("+33 6 01 02 03 04");
    expect(rail).toContain("Paris / Remote");
    expect(rail).toContain("linkedin.com/in/avery");
    expect(rail).toContain("avery.work");
    expect(rail).not.toContain("FROM");
    expect(rail).not.toContain("TO");
    expect(rail).not.toContain("Application for Operations Lead");
    expect(senderLines).toEqual([
      "Avery Stone",
      "Operations Lead",
      "Stone Systems",
      "+33 6 01 02 03 04",
      "avery@example.com",
      "linkedin.com/in/avery",
      "avery.work",
      "Paris / Remote",
    ]);
    expect(twoweeksRole?.textContent).toBe("Operations Lead");
    expect(contactLines).toEqual([
      "+33 6 01 02 03 04",
      "avery@example.com",
      "linkedin.com/in/avery",
      "avery.work",
      "Paris / Remote",
    ]);
    expect(contactGroups).toEqual([
      ["+33 6 01 02 03 04", "avery@example.com", "linkedin.com/in/avery"],
      ["avery.work"],
      ["Paris / Remote"],
    ]);
    expect(
      renderedPage?.querySelector(
        ".proposal-cover-letter__twoweeks-recipient-label",
      ),
    ).toBeNull();
    expect(recipientLines).toEqual([
      "Hiring Manager",
      "Head of Talent",
      "Northwind",
      "hiring@northwind.com",
      "12 Rue de la Paix",
      "Paris",
    ]);
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__twoweeks-date")
        ?.textContent,
    ).toBe("May 30, 2026");
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__twoweeks-subject")
        ?.textContent,
    ).toBe("Subject: Application for Operations Lead");
    expect(paragraphs).toEqual([
      "First Twoweeks body paragraph.",
      "Second Twoweeks body paragraph.",
    ]);
    expect(renderedPage?.textContent).toContain("Kind regards,");
    expect(renderedPage?.textContent).toContain("Avery Stone");
    expect(renderedPage?.textContent).not.toContain("undefined");
    expect(renderedPage?.textContent).not.toContain("null");
    expect(renderedPage?.textContent).not.toContain("[object Object]");
    expect(renderedPage?.textContent).not.toContain(" ·  · ");
  });

  it("renders the MoMA Bauhaus letterhead with real heading fields, ordered body, and closing", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content={[
          "Dear Morgan,",
          "First Bauhaus body paragraph.",
          "Second Bauhaus body paragraph.",
        ].join("\n\n")}
        proposalType="cover_letter"
        templateId="moma-bauhaus-letterhead"
        railTitle="Avery Stone"
        railMeta="Operations Lead"
        contactLine="avery@example.com · +33 6 01 02 03 04 · Paris · linkedin.com/in/avery · avery.work"
        letterDate="May 30, 2026"
        recipientDetails={
          "Morgan Lee\nTalent Director\nNorthwind Studio\nmorgan@northwind.example\n10 Gallery Road\nBerlin"
        }
        documentTitle="Application for Operations Lead"
        headerVisibility={{
          showSender: true,
          showDate: true,
          showSubject: true,
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
        applicantHeader={{
          name: "Avery Stone",
          role: "Operations Lead",
          company: "Stone Systems",
          email: "avery@example.com",
          phone: "+33 6 01 02 03 04",
          linkedin: "linkedin.com/in/avery",
          website: "avery.work",
          location: "Paris",
          tag: null,
        }}
        closing={{
          enabled: true,
          signOff: "Sincerely,",
          signatureName: "Avery Stone",
          source: "document",
        }}
      />,
    );

    const root = container.querySelector(".proposal-cover-letter--moma-bauhaus");
    const renderedPage = Array.from(
      root?.querySelectorAll(".dasti-proposal-document__page") ?? [],
    ).at(-1);
    const sender = renderedPage?.querySelector(
      ".proposal-cover-letter__bauhaus-sender",
    );
    const recipient = renderedPage?.querySelector(
      ".proposal-cover-letter__bauhaus-recipient",
    );
    const recipientLines = Array.from(
      recipient?.querySelectorAll("p") ?? [],
    ).map((node) => node.textContent);
    const paragraphs = Array.from(
      renderedPage?.querySelectorAll(".dasti-proposal-document__paragraph") ??
        [],
    ).map((node) => node.textContent);

    expect(root?.getAttribute("data-proposal-template")).toBe(
      "moma-bauhaus-letterhead",
    );
    expect(sender?.textContent).toContain("Avery Stone");
    expect(sender?.textContent).toContain("Stone Systems");
    expect(sender?.textContent).toContain("Operations Lead");
    expect(sender?.textContent).toContain("Paris");
    expect(sender?.textContent).not.toContain("avery@example.com");
    expect(sender?.textContent).not.toContain("+33 6 01 02 03 04");
    expect(sender?.textContent).not.toContain("linkedin.com/in/avery");
    expect(sender?.textContent).not.toContain("avery.work");
    expect(recipient?.textContent).toContain("Morgan Lee");
    expect(recipient?.textContent).toContain("Talent Director");
    expect(recipient?.textContent).toContain("Northwind Studio");
    expect(recipient?.textContent).not.toContain("Application for Operations Lead");
    expect(recipient?.textContent).toContain("10 Gallery Road");
    expect(recipient?.textContent).toContain("Berlin");
    expect(recipient?.textContent).toContain("morgan@northwind.example");
    expect(recipientLines).toEqual([
      "Morgan Lee",
      "Talent Director",
      "Northwind Studio",
      "morgan@northwind.example",
      "10 Gallery Road",
      "Berlin",
    ]);
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__bauhaus-logo")
        ?.textContent,
    ).toBe("Avery");
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__bauhaus-subtitle")
        ?.textContent,
    ).toBe("Operations Lead");
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__bauhaus-header")
        ?.textContent,
    ).not.toContain("Application for Operations Lead");
    expect(renderedPage?.textContent).toContain("May 30, 2026");
    expect(renderedPage?.textContent).toContain(
      "Subject: Application for Operations Lead",
    );
    expect(
      renderedPage
        ?.querySelector(".proposal-cover-letter__bauhaus-meta-item--subject")
        ?.textContent,
    ).toBe("Subject: Application for Operations Lead");
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__bauhaus-footer--left")
        ?.textContent,
    ).toContain("avery@example.com");
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__bauhaus-footer--left")
        ?.textContent,
    ).toContain("+33 6 01 02 03 04");
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__bauhaus-footer--right")
        ?.textContent,
    ).toContain("linkedin.com/in/avery");
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__bauhaus-footer--right")
        ?.textContent,
    ).toContain("avery.work");
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__bauhaus-footer--right")
        ?.textContent,
    ).not.toContain("Paris");
    expect(paragraphs).toEqual([
      "First Bauhaus body paragraph.",
      "Second Bauhaus body paragraph.",
    ]);
    expect(renderedPage?.textContent).toContain("Sincerely,");
    expect(renderedPage?.textContent).toContain("avery stone");
    expect(renderedPage?.textContent).not.toContain("undefined");
    expect(renderedPage?.textContent).not.toContain("null");
    expect(renderedPage?.textContent).not.toContain("[object Object]");
    expect(renderedPage?.textContent).not.toContain("Vorbereitungssekretariat");
    expect(renderedPage?.textContent).not.toContain("Institut für Auslandsbeziehungen");
    expect(renderedPage?.textContent).not.toContain(" ·  · ");
  });

  it("renders arbitrary MoMA Bauhaus profile and website text in the footer", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content="Dear Morgan,\n\nFirst Bauhaus body paragraph."
        proposalType="cover_letter"
        templateId="moma-bauhaus-letterhead"
        railTitle="Avery Stone"
        railMeta="Operations Lead"
        contactLine="avery@example.com · +33 6 01 02 03 04 · Paris · Profile: public profile on request · Website: portfolio on request"
        letterDate="May 30, 2026"
        recipientDetails="Morgan Lee\nTalent Director\nNorthwind Studio"
        documentTitle="Application for Operations Lead"
        headerVisibility={{
          showSender: true,
          showDate: true,
          showSubject: true,
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
        applicantHeader={{
          name: "Avery Stone",
          role: "Operations Lead",
          company: "Stone Systems",
          email: "avery@example.com",
          phone: "+33 6 01 02 03 04",
          linkedin: "",
          website: "",
          location: "Paris",
          tag: null,
        }}
      />,
    );

    const root = container.querySelector(".proposal-cover-letter--moma-bauhaus");
    const renderedPage = Array.from(
      root?.querySelectorAll(".dasti-proposal-document__page") ?? [],
    ).at(-1);
    const senderText =
      renderedPage?.querySelector(".proposal-cover-letter__bauhaus-sender")
        ?.textContent ?? "";
    const footerRightText =
      renderedPage?.querySelector(".proposal-cover-letter__bauhaus-footer--right")
        ?.textContent ?? "";

    expect(senderText).not.toContain("public profile on request");
    expect(senderText).not.toContain("portfolio on request");
    expect(footerRightText).toContain("public profile on request");
    expect(footerRightText).toContain("portfolio on request");
  });

  it("renders the Joella frame letterhead with historical content routing", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content={[
          "Dear Morgan,",
          "First Joella body paragraph.",
          "Second Joella body paragraph.",
          "Third Joella body paragraph.",
        ].join("\n\n")}
        proposalType="cover_letter"
        templateId="joella-frame-letterhead"
        railTitle="Avery Stone"
        railMeta="Operations Lead"
        contactLine="avery@example.com · +33 6 01 02 03 04 · Paris / Remote · linkedin.com/in/avery · avery.work"
        letterDate="May 30, 2026"
        recipientDetails={
          "Hiring Manager\nHead of Talent\nNorthwind\nhiring@northwind.com\n12 Rue de la Paix\nParis\nAdditional address line"
        }
        documentTitle="Application for Operations Lead"
        headerVisibility={{
          showSender: true,
          showDate: true,
          showSubject: true,
          showRecipient: true,
          showRecipientDetails: true,
        }}
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        applicantHeader={{
          name: "Avery Stone",
          role: "Operations Lead",
          company: "Stone Systems",
          email: "avery@example.com",
          phone: "+33 6 01 02 03 04",
          linkedin: "linkedin.com/in/avery",
          website: "avery.work",
          location: "Paris / Remote",
          tag: null,
        }}
        closing={{
          enabled: true,
          signOff: "Sincerely,",
          signatureName: "Avery Stone",
          source: "document",
        }}
      />,
    );

    const root = container.querySelector(".proposal-cover-letter--joella");
    const renderedPage = Array.from(
      root?.querySelectorAll(".dasti-proposal-document__page") ?? [],
    ).at(-1);
    const wordmark =
      renderedPage?.querySelector(".proposal-cover-letter__joella-wordmark")
        ?.textContent ?? "";
    const letterBlockLines = Array.from(
      renderedPage?.querySelectorAll(".proposal-cover-letter__joella-letter-block p") ??
        [],
    ).map((node) => node.textContent);
    const boldLetterBlockLines = Array.from(
      renderedPage?.querySelectorAll(
        ".proposal-cover-letter__joella-letter-block-line--strong",
      ) ?? [],
    ).map((node) => node.textContent);
    const underlinedSubject =
      renderedPage?.querySelector(
        ".proposal-cover-letter__joella-letter-block-subject-value",
      )?.textContent ?? "";
    const footerText =
      renderedPage?.querySelector(".proposal-cover-letter__joella-footer")
        ?.textContent ?? "";
    const paragraphs = Array.from(
      renderedPage?.querySelectorAll(".dasti-proposal-document__paragraph") ??
        [],
    ).map((node) => node.textContent);

    expect(root?.getAttribute("data-proposal-template")).toBe(
      "joella-frame-letterhead",
    );
    expect(wordmark).toBe("STONE SYSTEMS");
    expect(wordmark).not.toContain("Application for Operations Lead");
    expect(letterBlockLines).toEqual([
      "Avery Stone",
      "Operations Lead",
      "Stone Systems",
      "avery@example.com · +33 6 01 02 03 04 · linkedin.com/in/avery · avery.work",
      "Paris / Remote",
      "may 30, 2026",
      "Hiring Manager",
      "Head of Talent",
      "Northwind",
      "hiring@northwind.com",
      "12 Rue de la Paix",
      "Paris",
      "Additional address line",
      "Subject: Application for Operations Lead",
    ]);
    expect(boldLetterBlockLines).toEqual(["Avery Stone", "Hiring Manager"]);
    expect(underlinedSubject).toBe(" Application for Operations Lead");
    expect(renderedPage?.querySelector(".proposal-cover-letter__joella-recipient"))
      .toBeNull();
    expect(renderedPage?.querySelector(".proposal-cover-letter__joella-meta"))
      .toBeNull();
    expect(letterBlockLines.join(" ")).not.toContain("Date:");
    expect(letterBlockLines.join(" ")).not.toContain("Re:");
    expect(letterBlockLines.join(" ")).toContain("hiring@northwind.com");
    expect(footerText).toContain("PARIS / REMOTE");
    expect(footerText).toContain("AVERY@EXAMPLE.COM");
    expect(footerText).toContain("+33 6 01 02 03 04");
    expect(footerText).not.toContain("linkedin.com/in/avery");
    expect(footerText).not.toContain("avery.work");
    expect(footerText).not.toContain("Application for Operations Lead");
    expect(paragraphs).toEqual([
      "First Joella body paragraph.",
      "Second Joella body paragraph.",
      "Third Joella body paragraph.",
    ]);
    expect(renderedPage?.textContent).toContain("Sincerely,");
    expect(renderedPage?.textContent).toContain("avery stone");
    expect(renderedPage?.textContent).not.toContain("undefined");
    expect(renderedPage?.textContent).not.toContain("null");
    expect(renderedPage?.textContent).not.toContain("[object Object]");
  });

  it("keeps optional Joella fields empty without routing subject into the wordmark", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content="I can support the team with clear written execution."
        proposalType="cover_letter"
        templateId="joella-frame-letterhead"
        documentTitle="Long subject should not become a wordmark"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
      />,
    );

    const root = container.querySelector(".proposal-cover-letter--joella");
    const wordmark =
      root?.querySelector(".proposal-cover-letter__joella-wordmark")?.textContent ??
      "";
    const renderedPage = Array.from(
      root?.querySelectorAll(".dasti-proposal-document__page") ?? [],
    ).at(-1);

    expect(wordmark).toBe("");
    expect(root?.querySelector(".proposal-cover-letter__joella-recipient")).toBeNull();
    expect(root?.querySelector(".proposal-cover-letter__joella-meta")).toBeNull();
    expect(
      Array.from(
        renderedPage?.querySelectorAll(
          ".proposal-cover-letter__joella-letter-block p",
        ) ?? [],
      ).map((node) => node.textContent),
    ).toEqual(["Subject: Long subject should not become a wordmark"]);
    expect(root?.querySelector(".proposal-cover-letter__joella-footer")).toBeNull();
    expect(root?.textContent).toContain(
      "I can support the team with clear written execution.",
    );
    expect(root?.textContent).not.toContain("undefined");
    expect(root?.textContent).not.toContain("null");
    expect(root?.textContent).not.toContain("[object Object]");
  });

  it("renders the Bayer letterhead with recipient field routing and style variables", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content={[
          "Dear Hiring Manager,",
          "First Bayer body paragraph.",
          "Second Bayer body paragraph.",
        ].join("\n\n")}
        proposalType="cover_letter"
        templateId="bayer-letterhead"
        railTitle="Avery Stone"
        railMeta="Operations Lead"
        contactLine="avery@example.com · +33 6 01 02 03 04 · Paris / Remote · linkedin.com/in/avery · avery.work"
        letterDate="May 30, 2026"
        recipientDetails={
          "Hiring Manager\nHead of Talent\nNorthwind\nhiring@northwind.com\n12 Rue de la Paix\nParis"
        }
        documentTitle="Application for Operations Lead"
        headerVisibility={{
          showSender: true,
          showDate: true,
          showSubject: true,
          showRecipient: true,
          showRecipientDetails: true,
        }}
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        documentThemeVars={{
          "--proposal-document-paper": "#fff7df",
          "--proposal-document-ink": "#14213d",
          "--proposal-document-accent-ink": "#ba2d0b",
        }}
        applicantHeader={{
          name: "Avery Stone",
          role: "Operations Lead",
          company: "Stone Systems",
          email: "avery@example.com",
          phone: "+33 6 01 02 03 04",
          linkedin: "linkedin.com/in/avery",
          website: "avery.work",
          location: "Paris / Remote",
          tag: null,
        }}
        closing={{
          enabled: true,
          signOff: "Sincerely,",
          signatureName: "Avery Stone",
          source: "document",
        }}
      />,
    );

    const root = container.querySelector(".proposal-cover-letter--bayer");
    const renderedPage = Array.from(
      root?.querySelectorAll(".dasti-proposal-document__page") ?? [],
    ).at(-1);
    const header =
      renderedPage?.querySelector(".proposal-cover-letter__bayer-header")
        ?.textContent ?? "";
    const recipientLines = Array.from(
      renderedPage?.querySelectorAll(".proposal-cover-letter__bayer-recipient p") ??
        [],
    ).map((node) => node.textContent);
    const paragraphs = Array.from(
      renderedPage?.querySelectorAll(".dasti-proposal-document__paragraph") ??
        [],
    ).map((node) => node.textContent);
    const footerText =
      renderedPage?.querySelector(".proposal-cover-letter__bayer-footer")
        ?.textContent ?? "";

    expect(root?.getAttribute("data-proposal-template")).toBe("bayer-letterhead");
    expect(root?.getAttribute("style")).toContain(
      "--proposal-document-paper: #fff7df",
    );
    expect(root?.getAttribute("style")).toContain(
      "--proposal-document-accent-ink: #ba2d0b",
    );
    expect(header).toContain("Avery Stone");
    expect(header).toContain("Operations Lead");
    expect(header).toContain("Stone Systems");
    expect(header).toContain("avery@example.com");
    expect(header).not.toContain("Application for Operations Lead");
    expect(header).not.toContain("+33 6 01 02 03 04");
    expect(header).not.toContain("linkedin.com/in/avery");
    expect(recipientLines).toEqual([
      "TO",
      "Hiring Manager",
      "Head of Talent",
      "Northwind",
      "hiring@northwind.com",
      "12 Rue de la Paix · Paris",
    ]);
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__bayer-date")
        ?.textContent,
    ).toBe("DATEMay 30, 2026");
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__bayer-subject")
        ?.textContent,
    ).toBe("SUBJECTApplication for Operations Lead");
    expect(
      renderedPage?.querySelector(".proposal-cover-letter__bayer-subject-value")
        ?.textContent,
    ).toBe("Application for Operations Lead");
    expect(footerText).toBe(
      "+33 6 01 02 03 04 · Paris / Remote · linkedin.com/in/avery · avery.work",
    );
    expect(footerText).not.toContain("avery@example.com");
    expect(footerText).not.toContain("Stone Systems");
    expect(paragraphs).toEqual([
      "First Bayer body paragraph.",
      "Second Bayer body paragraph.",
    ]);
    expect(renderedPage?.textContent).toContain("Sincerely,");
    expect(renderedPage?.textContent).toContain("avery stone");
    expect(renderedPage?.textContent).not.toContain("undefined");
    expect(renderedPage?.textContent).not.toContain("null");
    expect(renderedPage?.textContent).not.toContain("[object Object]");
    expect(renderedPage?.textContent).not.toContain(" ·  · ");
  });

  it("keeps optional Bayer fields empty without routing subject into the sender block", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content="I can support the team with clear written execution."
        proposalType="cover_letter"
        templateId="bayer-letterhead"
        documentTitle="Long subject should remain in the subject row"
        headerVisibility={{
          showSender: true,
          showDate: true,
          showSubject: true,
          showRecipient: true,
          showRecipientDetails: true,
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

    const root = container.querySelector(".proposal-cover-letter--bayer");

    expect(root?.querySelector(".proposal-cover-letter__bayer-header")).toBeNull();
    expect(root?.querySelector(".proposal-cover-letter__bayer-recipient")).toBeNull();
    expect(root?.querySelector(".proposal-cover-letter__bayer-date")).toBeNull();
    expect(
      root?.querySelector(".proposal-cover-letter__bayer-subject")?.textContent,
    ).toBe("SUBJECTLong subject should remain in the subject row");
    expect(root?.querySelector(".proposal-cover-letter__bayer-footer")).toBeNull();
    expect(root?.textContent).toContain(
      "I can support the team with clear written execution.",
    );
    expect(root?.textContent).not.toContain("undefined");
    expect(root?.textContent).not.toContain("null");
    expect(root?.textContent).not.toContain("[object Object]");
  });

  it("omits optional MoMA Bauhaus heading slots when data is missing", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content="I can support the team with clear written execution."
        proposalType="cover_letter"
        templateId="moma-bauhaus-letterhead"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
      />,
    );

    const root = container.querySelector(".proposal-cover-letter--moma-bauhaus");

    expect(root?.querySelector(".proposal-cover-letter__bauhaus-sender")).toBeNull();
    expect(root?.querySelector(".proposal-cover-letter__bauhaus-recipient")).toBeNull();
    expect(root?.querySelector(".proposal-cover-letter__bauhaus-header")).toBeNull();
    expect(root?.querySelector(".proposal-cover-letter__bauhaus-meta")).toBeNull();
    expect(root?.textContent).toContain(
      "I can support the team with clear written execution.",
    );
    expect(root?.textContent).not.toContain("undefined");
    expect(root?.textContent).not.toContain("null");
    expect(root?.textContent).not.toContain("[object Object]");
  });

  it("renders uploaded document decoration without preview-only handles in readonly mode", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content="I can support the team with clear written execution."
        proposalType="cover_letter"
        templateId="swiss_margin"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        documentDecoration={{
          visible: true,
          source: "upload",
          dataUrl: "data:image/png;base64,AAAA",
          fileName: "mark.png",
          mimeType: "image/png",
          alt: "Company mark",
          sizePreset: 35,
          fit: "cover",
          placementMode: "custom",
          xMm: 17,
          yMm: 35,
        }}
      />,
    );

    const decoration = container.querySelector(".dasti-proposal-document-decoration");
    const image = decoration?.querySelector("img");

    expect(decoration).toBeTruthy();
    expect(decoration).toHaveAttribute("data-design-mode", "false");
    expect(decoration).toHaveAttribute("data-decoration-size-mm", "35");
    expect(decoration?.getAttribute("style")).toContain("17");
    expect(decoration?.getAttribute("style")).toContain("35");
    expect(decoration?.getAttribute("style")).toContain("cover");
    expect(image).toHaveAttribute("src", "data:image/png;base64,AAAA");
    expect(image).toHaveAttribute("alt", "Company mark");
    expect(
      container.querySelector(".dasti-proposal-document-decoration__resize-handle"),
    ).toBeNull();
    expect(
      container.querySelector(".dasti-proposal-document-decoration__toolbar"),
    ).toBeNull();
  });

  it("shows the preview bounding box handle and stores resized size as custom integer millimeters", () => {
    const onDocumentDecorationChange = vi.fn();
    const onDocumentDecorationCommit = vi.fn();
    const { container } = render(
      <ProposalDocumentRenderer
        content="I can support the team with clear written execution."
        proposalType="cover_letter"
        templateId="swiss_margin"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        documentDecoration={{
          visible: true,
          source: "upload",
          dataUrl: "data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%2010%2010%22%3E%3C/svg%3E",
          fileName: "mark.svg",
          mimeType: "image/svg+xml",
          alt: "Company mark",
          sizePreset: 35,
          fit: "contain",
          placementMode: "default",
        }}
        documentDecorationMode="design"
        onDocumentDecorationChange={onDocumentDecorationChange}
        onDocumentDecorationCommit={onDocumentDecorationCommit}
      />,
    );
    const page = Array.from(
      container.querySelectorAll(".dasti-proposal-document__page"),
    ).at(-1) as HTMLElement;
    vi.spyOn(page, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 2100,
      bottom: 2970,
      width: 2100,
      height: 2970,
      toJSON: () => ({}),
    } as DOMRect);
    const decoration = container.querySelector(
      ".dasti-proposal-document-decoration",
    ) as HTMLElement;
    const toolbar = container.querySelector(
      ".dasti-proposal-document-decoration__toolbar",
    ) as HTMLElement;
    const resizeHandle = container.querySelector(
      ".dasti-proposal-document-decoration__resize-handle",
    ) as HTMLElement;

    expect(decoration).toHaveAttribute("data-design-mode", "true");
    expect(decoration).toHaveAttribute("data-toolbar-placement", "side");
    expect(decoration).toHaveAttribute("data-toolbar-align", "right");
    expect(toolbar).toHaveAttribute("data-toolbar-placement", "side");
    expect(toolbar).toHaveAttribute("data-toolbar-align", "right");
    expect(resizeHandle).toBeTruthy();
    expect(
      container.querySelector("[aria-label='Upload decoration image from page']"),
    ).toHaveAttribute(
      "accept",
      ".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml",
    );

    fireEvent(resizeHandle, new MouseEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      clientX: 170,
      clientY: 350,
    }));
    fireEvent(resizeHandle, new MouseEvent("pointermove", {
      bubbles: true,
      cancelable: true,
      clientX: 309,
      clientY: 380,
    }));
    fireEvent(resizeHandle, new MouseEvent("pointerup", {
      bubbles: true,
      cancelable: true,
      clientX: 309,
      clientY: 380,
    }));

    expect(onDocumentDecorationChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sizePreset: "custom",
        customSizeMm: 49,
      }),
    );
    expect(onDocumentDecorationCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        sizePreset: "custom",
        customSizeMm: 49,
      }),
    );
  });

  it("commits on-page decoration hide and remove actions in design mode", () => {
    const onDocumentDecorationChange = vi.fn();
    const onDocumentDecorationCommit = vi.fn();
    const { container } = render(
      <ProposalDocumentRenderer
        content="I can support the team with clear written execution."
        proposalType="cover_letter"
        templateId="swiss_margin"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        documentDecoration={{
          visible: true,
          source: "upload",
          dataUrl: "data:image/png;base64,AAAA",
          fileName: "mark.png",
          mimeType: "image/png",
          alt: "Company mark",
          sizePreset: 35,
          fit: "contain",
          placementMode: "custom",
          xMm: 17,
          yMm: 35,
        }}
        documentDecorationMode="design"
        onDocumentDecorationChange={onDocumentDecorationChange}
        onDocumentDecorationCommit={onDocumentDecorationCommit}
      />,
    );

    const hideButton = container.querySelector(
      "[aria-label='Hide decoration image']",
    ) as HTMLButtonElement;
    const removeButton = container.querySelector(
      "[aria-label='Remove decoration image']",
    ) as HTMLButtonElement;

    fireEvent.click(hideButton);
    expect(onDocumentDecorationChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        visible: false,
        dataUrl: "data:image/png;base64,AAAA",
        fileName: "mark.png",
      }),
    );
    expect(onDocumentDecorationCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        visible: false,
        dataUrl: "data:image/png;base64,AAAA",
        fileName: "mark.png",
      }),
    );

    fireEvent.click(removeButton);
    const removedChange = onDocumentDecorationChange.mock.calls.at(-1)?.[0];
    const removedCommit = onDocumentDecorationCommit.mock.calls.at(-1)?.[0];
    expect(removedChange).toMatchObject({ visible: false });
    expect(removedChange?.dataUrl).toBeUndefined();
    expect(removedChange?.fileName).toBeUndefined();
    expect(removedCommit).toMatchObject({ visible: false });
    expect(removedCommit?.dataUrl).toBeUndefined();
    expect(removedCommit?.fileName).toBeUndefined();
  });

  it("flips the on-page decoration toolbar below when the image is near the top-right edge", () => {
    const { container } = render(
      <ProposalDocumentRenderer
        content="I can support the team with clear written execution."
        proposalType="cover_letter"
        templateId="swiss_margin"
        documentTypography={{
          fontFamily: "Georgia, serif",
          fontSize: "14px",
          lineHeight: 1.5,
          fontWeight: 400,
          letterSpacing: "0em",
        }}
        documentDecoration={{
          visible: true,
          source: "upload",
          dataUrl: "data:image/png;base64,AAAA",
          fileName: "mark.png",
          mimeType: "image/png",
          alt: "Company mark",
          sizePreset: 18,
          fit: "contain",
          placementMode: "custom",
          xMm: 188,
          yMm: 7,
        }}
        documentDecorationMode="design"
        onDocumentDecorationChange={vi.fn()}
        onDocumentDecorationCommit={vi.fn()}
      />,
    );

    const decoration = container.querySelector(
      ".dasti-proposal-document-decoration",
    ) as HTMLElement;
    const toolbar = container.querySelector(
      ".dasti-proposal-document-decoration__toolbar",
    ) as HTMLElement;

    expect(decoration).toHaveAttribute("data-toolbar-placement", "below");
    expect(decoration).toHaveAttribute("data-toolbar-align", "right");
    expect(toolbar).toHaveAttribute("data-toolbar-placement", "below");
    expect(toolbar).toHaveAttribute("data-toolbar-align", "right");
  });
});
