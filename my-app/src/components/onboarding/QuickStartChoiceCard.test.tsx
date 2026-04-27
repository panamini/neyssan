import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QuickStartChoiceCard } from "./QuickStartChoiceCard";

describe("QuickStartChoiceCard", () => {
  it("renders the centered helper as an overlay without growing the card flow", () => {
    const onClick = vi.fn();

    const { container } = render(
      <QuickStartChoiceCard
        label="Capture the role"
        hint="Pull it in from a supported site."
        onClick={onClick}
        selected={true}
        expandedPlacement="centered"
        expandedContent={
          <div>
            <a href="https://example.com">Install extension</a>
          </div>
        }
      />,
    );

    expect(
      screen.getByRole("button", { name: /^Capture the role\b/i }),
    ).toHaveAttribute("aria-pressed", "true");
    const dialog = screen.getByRole("dialog", { name: "Capture the role" });
    expect(within(dialog).getByRole("link", { name: "Install extension" })).toBeInTheDocument();
    expect(container.querySelector(".dasti-quick-start-choice__expanded")).toBeNull();
  });
});
