import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
  sizePt: 8 as const,
};

const productCss = readFileSync(resolve(process.cwd(), "src/styles/product.css"), "utf8");

function getBulletStyleControlCss() {
  const start = productCss.indexOf(".bullet-style-control {");
  const end = productCss.indexOf(".document-icon-picker {", start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return productCss.slice(start, end);
}

describe("BulletStyleControl", () => {
  it("renders the summary card and opens presets and advanced tabs", () => {
    render(<BulletStyleControl settings={baseSettings} onChange={vi.fn()} />);

    expect(screen.getByText("Bullets")).toBeInTheDocument();
    expect(screen.getByText("Editorial Plus")).toBeInTheDocument();
    expect(screen.getByText("Accent • Small")).toBeInTheDocument();

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
        sizePt: 8,
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
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sizePt: 10 }));
  });

  it("keeps dark mode button surfaces on dark app tokens", () => {
    const controlCss = getBulletStyleControlCss();

    expect(controlCss).toMatch(
      /\.dark\s+\.bullet-style-control,[\s\S]*\.theme-dark\s+\.bullet-style-control,[\s\S]*\[data-theme="dark"\]\s+\.bullet-style-control\s*\{[\s\S]*--bullet-control-surface:\s*var\(--sf1\);[\s\S]*--bullet-control-surface-raised:\s*var\(--sf2\);[\s\S]*--bullet-control-track:\s*var\(--sf2\);/,
    );
    expect(controlCss).toMatch(
      /\.bullet-style-control__summary\s*\{[\s\S]*background:\s*var\(--bullet-control-surface\);/,
    );
    expect(controlCss).toMatch(
      /\.bullet-style-control__preset\s*\{[\s\S]*background:\s*var\(--bullet-control-surface\);/,
    );
    expect(controlCss).toMatch(
      /\.bullet-style-control__marker-grid button\s*\{[\s\S]*background:\s*var\(--bullet-control-surface\);/,
    );
    expect(controlCss).not.toMatch(/background:\s*(?:var\(--paper\)|white|#fff|#ffffff)/i);
  });

  it("keeps embedded document icon pickers on opaque app popup tokens", () => {
    const cvCss = readFileSync(resolve(process.cwd(), "src/styles/product-cv.css"), "utf8");
    const proposalCss = readFileSync(
      resolve(process.cwd(), "src/styles/product-proposal.css"),
      "utf8",
    );

    for (const css of [cvCss, proposalCss]) {
      expect(css).toContain("--document-icon-picker-popover-surface: var(--paper)");
      expect(css).toContain("--document-icon-picker-popover-track: color-mix(");
      expect(css).toContain("background: var(--document-icon-picker-surface);");
      expect(css).toContain("z-index: 4001;");
      expect(css).toContain("min-height: var(--control-sm);");
      expect(css).toContain('button[data-document-icon-picker-action="close"]');
      expect(css).not.toMatch(
        /--document-icon-picker-surface:\s*var\(--color-surface-raised\)/,
      );
    }
  });
});
