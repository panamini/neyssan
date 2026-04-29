import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddSectionBottomSheet } from "../AddSectionBottomSheet";

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    isV1Active: true,
    currentCv: { sections: [] },
  }),
}));

describe("AddSectionBottomSheet", () => {
  it("uses the DS bottom sheet and selects a section", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSelect = vi.fn();

    render(
      <AddSectionBottomSheet
        isOpen
        onClose={onClose}
        onSelect={onSelect}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Add section" });
    expect(dialog).toHaveClass("ds-bottom-sheet");
    expect(dialog.querySelector(".ds-bottom-sheet__handle")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Languages/i }));

    expect(onSelect).toHaveBeenCalledWith("languages");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
