import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileModal } from "../structured-blocks/ProfileModal";

const mockUpdateStructuredItem = vi.fn();

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    updateStructuredItem: mockUpdateStructuredItem,
  }),
}));

describe("ProfileModal", () => {
  afterEach(() => {
    mockUpdateStructuredItem.mockReset();
  });

  it("preserves an explicit desiredPosition clear when saving a blank field", () => {
    render(
      <ProfileModal
        open
        sectionId="profile-section"
        item={{
          id: "profile-item",
          name: "Jane Doe",
          desiredPosition: "Product Manager",
          email: "jane@example.com",
        }}
        onClose={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText("Desired position"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mockUpdateStructuredItem).toHaveBeenCalledTimes(1);
    expect(mockUpdateStructuredItem).toHaveBeenCalledWith(
      "profile-section",
      "profile-item",
      expect.any(Object),
    );

    const patch = mockUpdateStructuredItem.mock.calls[0][2];
    expect(Object.prototype.hasOwnProperty.call(patch, "desiredPosition")).toBe(
      true,
    );
    expect(patch.desiredPosition).toBeUndefined();
    expect(patch.name).toBe("Jane Doe");
    expect(patch.email).toBe("jane@example.com");
  });
});
