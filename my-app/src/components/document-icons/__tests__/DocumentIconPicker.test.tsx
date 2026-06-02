import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocumentIconPicker } from "../DocumentIconPicker";

describe("DocumentIconPicker", () => {
  it("renders categorized searchable local icons", () => {
    render(<DocumentIconPicker selectedIconKey="shield-check" onChange={vi.fn()} />);

    expect(screen.getByText("Security")).toBeInTheDocument();
    const shieldButton = screen.getByRole("button", { name: "Use Shield check icon" });
    expect(shieldButton).toBeInTheDocument();
    expect(shieldButton).toHaveAttribute("title", "Shield check");
    expect(shieldButton).not.toHaveTextContent("Shield check");
    expect(screen.getByTestId("document-icon-picker").innerHTML).toContain("<svg");
    expect(screen.getByTestId("document-icon-picker").innerHTML).not.toMatch(
      /(?:src|href|xlink:href)=["']https?:/i,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Search icons" }), {
      target: { value: "database" },
    });

    expect(screen.getByRole("button", { name: "Use Database icon" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use Shield check icon" })).toBeNull();
  });

  it("calls onChange with the selected icon key", () => {
    const onChange = vi.fn();
    render(<DocumentIconPicker selectedIconKey="dot" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Use Briefcase icon" }));

    expect(onChange).toHaveBeenCalledWith("briefcase");
  });
});
