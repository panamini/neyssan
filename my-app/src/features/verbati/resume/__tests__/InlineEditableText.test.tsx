import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InlineEditableText } from "../InlineEditableText";

const editTarget = {
  sectionId: "experience-1",
  sectionType: "experience",
  fieldPath: "structuredContent.item:exp-1.responsibilities",
  fieldKind: "paragraph" as const,
};

describe("InlineEditableText", () => {
  it("renders its value as plain text, not rich markup", () => {
    render(
      <InlineEditableText
        value={'Owned <strong>launch</strong> and <em>growth</em>'}
        editable={false}
        editTarget={editTarget}
        onActivate={vi.fn()}
        ariaLabel="Edit responsibility"
        onPlainTextChange={vi.fn()}
      />,
    );

    const text = screen.getByText(/Owned <strong>launch<\/strong>/i);
    expect(text).toHaveTextContent("Owned <strong>launch</strong> and <em>growth</em>");
    expect(text.querySelector("strong, em, u")).toBeNull();
  });
});
