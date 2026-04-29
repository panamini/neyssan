import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillsDrawer } from "../structured-blocks/SkillsDrawer";

describe("SkillsDrawer", () => {
  it("uses the DS right sheet and preserves skill selection controls", () => {
    const onClose = vi.fn();

    render(
      <SkillsDrawer
        open
        onClose={onClose}
        items={[
          {
            id: "react",
            name: "React",
            level: "Advanced",
            bucket: "core",
          },
          {
            id: "postgres",
            name: "Postgres",
            level: "Intermediate",
            bucket: "secondary",
          },
        ]}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Manage skills" });
    expect(dialog).toHaveClass("ds-sheet");
    expect(screen.getByRole("tab", { name: "Manage" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select React" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
