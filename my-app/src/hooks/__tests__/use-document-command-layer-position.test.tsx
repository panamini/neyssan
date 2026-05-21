import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentCommandLayerPosition } from "../use-document-command-layer-position";

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function encodeRect(left: number, top: number, width: number, height: number) {
  return [left, top, width, height].join(",");
}

function rectFromDataset(element: Element) {
  const rawRect = (element as HTMLElement).dataset.rect;
  if (!rawRect) return rect(0, 0, 0, 0);
  const [left, top, width, height] = rawRect
    .split(",")
    .map((value) => Number.parseFloat(value));
  return rect(left, top, width, height);
}

function CommandLayerHarness({
  anchorKey,
  anchorLeft,
  anchorWidth,
  refreshKey,
}: {
  anchorKey: string;
  anchorLeft: number;
  anchorWidth: number;
  refreshKey?: string;
}) {
  const stageRef = React.useRef<HTMLElement | null>(null);
  const paperRef = React.useRef<HTMLDivElement | null>(null);
  const commandLayer = useDocumentCommandLayerPosition({
    stageRef,
    paperRef,
    paperAnchorSelector: ".paper-anchor",
    commandCanvasSelector: ".command-canvas",
    cssVarPrefix: "proposal",
    toolbarSelector: "[data-testid='cv-toolbar']",
    toolbarNaturalWidth: 520,
    toolbarMinWidth: 300,
    toolbarHeight: 44,
    askHandle: {
      iconWidth: 32,
      height: 32,
    },
    safeMargin: 12,
    gap: 12,
    askOffsetFromPaperTop: 16,
    refreshKey,
  });

  return (
    <div
      className="command-canvas"
      data-rect={encodeRect(0, 0, 1280, 720)}
    >
      <section ref={stageRef} data-rect={encodeRect(0, 0, 1280, 720)}>
        <div data-testid="cv-toolbar" data-rect={encodeRect(0, 0, 520, 44)} />
        <div ref={paperRef}>
          <div
            key={anchorKey}
            className="paper-anchor"
            data-rect={encodeRect(anchorLeft, 134, anchorWidth, 382)}
          />
        </div>
        <output data-testid="ask-inline-start">
          {commandLayer.style["--proposal-ask-handle-inline-start"] ?? ""}
        </output>
      </section>
    </div>
  );
}

describe("useDocumentCommandLayerPosition", () => {
  let rectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.documentElement.style.setProperty("--header-height", "54px");
    document.documentElement.style.setProperty("--space-2", "12px");
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1280,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 720,
    });
    rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function getMockRect(this: Element) {
        return rectFromDataset(this);
      });
  });

  afterEach(() => {
    rectSpy.mockRestore();
    document.documentElement.style.removeProperty("--header-height");
    document.documentElement.style.removeProperty("--space-2");
  });

  it("remeasures a replaced CV paper anchor after zoom remounts the page", async () => {
    const { rerender } = render(
      <CommandLayerHarness
        anchorKey="zoom-45"
        anchorLeft={461}
        anchorWidth={357}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("ask-inline-start")).toHaveTextContent("830px");
    });

    rerender(
      <CommandLayerHarness
        anchorKey="zoom-15"
        anchorLeft={218}
        anchorWidth={119}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("ask-inline-start")).toHaveTextContent(
        "439.5px",
      );
    });
  });

  it("remeasures the current CV paper anchor when zoom changes without replacing the node", async () => {
    const { rerender } = render(
      <CommandLayerHarness
        anchorKey="stable-page"
        anchorLeft={461}
        anchorWidth={357}
        refreshKey="zoom:45"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("ask-inline-start")).toHaveTextContent("830px");
    });

    rerender(
      <CommandLayerHarness
        anchorKey="stable-page"
        anchorLeft={218}
        anchorWidth={119}
        refreshKey="zoom:15"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("ask-inline-start")).toHaveTextContent(
        "439.5px",
      );
    });
  });
});
