import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BulletStyleControl } from "../BulletStyleControl";

const baseSettings = {
  listMarkerType: "icon" as const,
  defaultListMarkerKey: "plus",
  sectionHeadingIconMode: "none" as const,
  sectionIconMap: {},
  color: "accent" as const,
  sizePt: 10 as const,
};

describe("BulletStyleControl", () => {
  it("renders the summary card and opens presets and advanced tabs", () => {
    render(<BulletStyleControl settings={baseSettings} onChange={vi.fn()} />);

    expect(screen.getByText("Bullets")).toBeInTheDocument();
    expect(screen.getByText("Editorial Plus")).toBeInTheDocument();
    expect(screen.getByText("Accent • Medium")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Bullets: Editorial Plus/i }));

    expect(screen.getByRole("tab", { name: "Presets" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("button", { name: "Classic Dot" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Advanced" }));

    expect(screen.getByText("Marker")).toBeInTheDocument();
    expect(screen.getByText("Tone")).toBeInTheDocument();
    expect(screen.getByText("Scale")).toBeInTheDocument();
  });

  it("selecting Classic Dot calls onChange with shared document icon settings", () => {
    const onChange = vi.fn();
    render(<BulletStyleControl settings={baseSettings} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Bullets: Editorial Plus/i }));
    fireEvent.click(screen.getByRole("button", { name: "Classic Dot" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        listMarkerType: "dot",
        defaultListMarkerKey: "dot",
        color: "ink",
        sizePt: 10,
      }),
    );
  });

  it("selecting Minimal Dash calls onChange with muted small stroke settings", () => {
    const onChange = vi.fn();
    render(<BulletStyleControl settings={baseSettings} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Bullets: Editorial Plus/i }));
    fireEvent.click(screen.getByRole("button", { name: "Minimal Dash" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        listMarkerType: "dash",
        defaultListMarkerKey: "minus",
        color: "muted",
        sizePt: 8,
      }),
    );
  });

  it("advanced marker, tone, and scale controls call onChange", () => {
    const onChange = vi.fn();
    render(<BulletStyleControl settings={baseSettings} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Bullets: Editorial Plus/i }));
    fireEvent.click(screen.getByRole("tab", { name: "Advanced" }));
    fireEvent.click(screen.getByRole("button", { name: "Diamond marker" }));
    fireEvent.click(screen.getByRole("button", { name: "Muted tone" }));
    fireEvent.click(screen.getByRole("button", { name: "Large scale" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        listMarkerType: "icon",
        defaultListMarkerKey: "diamond",
      }),
    );
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ color: "muted" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sizePt: 12 }));
  });
});
