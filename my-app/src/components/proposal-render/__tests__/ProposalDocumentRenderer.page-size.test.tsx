import React from "react";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_VERBATI_STYLE } from "../../../features/verbati/style";
import {
  DOCUMENT_PAGE_SIZES,
  documentPageSizeToPx,
} from "../../../lib/document-page-size";
import { getProposalDocumentTypography } from "../../../lib/proposal-document-typography";
import { ProposalDocumentRenderer } from "../ProposalDocumentRenderer";

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

describe("ProposalDocumentRenderer page sizing", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("derives proposal mm runtime vars from resolved Letter width, not A4 width", () => {
    const letterPx = documentPageSizeToPx(DOCUMENT_PAGE_SIZES.letter);
    const { container } = render(
      <ProposalDocumentRenderer
        content="Dear team,\n\nProposal body."
        proposalType="cover_letter"
        templateId="two_column_rail"
        stylePreset={DEFAULT_VERBATI_STYLE}
        documentTypography={getProposalDocumentTypography(
          "signature",
          DEFAULT_VERBATI_STYLE,
        )}
        pageSize={DOCUMENT_PAGE_SIZES.letter}
        pageWidth={letterPx.widthPx}
      />,
    );

    const root = container.querySelector<HTMLElement>(
      ".dasti-proposal-document",
    );

    expect(root?.style.getPropertyValue("--proposal-page-width-mm")).toBe(
      "215.9",
    );
    expect(root?.style.getPropertyValue("--proposal-page-height-mm")).toBe(
      "279.4",
    );
    expect(root?.style.getPropertyValue("--proposal-inline-mm")).toBe(
      `${96 / 25.4}px`,
    );
    expect(root?.style.getPropertyValue("--proposal-block-mm")).toBe(
      `${96 / 25.4}px`,
    );
  });
});
