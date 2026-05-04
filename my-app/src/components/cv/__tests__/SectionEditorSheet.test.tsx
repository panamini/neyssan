import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SectionEditorSheet } from "../SectionEditorSheet";
import type { CvSection } from "../../../types/cvDocument";

function buildProfileSection(name: string, desiredPosition: string): CvSection {
  return {
    id: "profile",
    type: "profile",
    title: "Profile",
    blocks: [],
    structuredContent: [
      {
        id: "profile-item",
        name,
        desiredPosition,
      },
    ],
  } as CvSection;
}

describe("SectionEditorSheet", () => {
  it("refreshes profile fields when the selected CV changes but section ids are reused", () => {
    const { rerender } = render(
      <SectionEditorSheet
        open
        section={buildProfileSection("Ada Lovelace", "Product Designer")}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Ada Lovelace");
    expect(screen.getByLabelText("Target Role")).toHaveValue("Product Designer");

    rerender(
      <SectionEditorSheet
        open
        section={buildProfileSection("Grace Hopper", "Engineering Manager")}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Grace Hopper");
    expect(screen.getByLabelText("Target Role")).toHaveValue("Engineering Manager");
  });
});
