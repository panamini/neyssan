import React from "react";
import { createPortal } from "react-dom";

type ProposalColorPickerPopoverProps = {
  currentHex: string | null;
  onHexChange: (hex: string) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;
};

const COLOR_POPOVER_ESTIMATED_SIZE = 176;
const COLOR_POPOVER_VIEWPORT_GUTTER = 12;
const ATTACHED_SURFACE_SELECTOR = [
  ".dasti-artifact-inspector",
  ".styleforge-preview-toolbar",
  ".dasti-proposal-rail-cluster",
  ".dasti-compose-toolbar__bar",
  ".dasti-compose-toolbar__collapsed-shell",
  ".dasti-cv-workbench-toggle",
].join(", ");

function normalizeHex(value: string): string | null {
  const normalized = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readAttachedSurfaceGap(surface: HTMLElement | null): number {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return 2;
  }

  const styles = window.getComputedStyle(surface ?? document.documentElement);
  const value =
    styles.getPropertyValue("--toolbar-attached-surface-gap").trim() ||
    styles.getPropertyValue("--anchored-surface-gap").trim();
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 2;
}

function getAttachedSurface(anchor: HTMLElement): HTMLElement | null {
  return anchor.closest<HTMLElement>(ATTACHED_SURFACE_SELECTOR);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const value = Number.parseInt(normalized.slice(1), 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function rgbToHsv(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; v: number } {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
  }

  return {
    h: ((hue * 60) + 360) % 360,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

function hsvToRgb(
  h: number,
  s: number,
  v: number,
): { r: number; g: number; b: number } {
  const hue = ((h % 360) + 360) % 360;
  const chroma = v * s;
  const segment = hue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment >= 0 && segment < 1) {
    red = chroma;
    green = x;
  } else if (segment < 2) {
    red = x;
    green = chroma;
  } else if (segment < 3) {
    green = chroma;
    blue = x;
  } else if (segment < 4) {
    green = x;
    blue = chroma;
  } else if (segment < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const match = v - chroma;
  return {
    r: (red + match) * 255,
    g: (green + match) * 255,
    b: (blue + match) * 255,
  };
}

export function ProposalColorPickerPopover({
  currentHex,
  onHexChange,
  anchorRef,
  isOpen,
  onClose,
}: ProposalColorPickerPopoverProps): JSX.Element | null {
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const fieldRef = React.useRef<HTMLDivElement>(null);
  const hueRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const [dragTarget, setDragTarget] = React.useState<"field" | "hue" | null>(
    null,
  );

  React.useLayoutEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const anchorRect = anchor.getBoundingClientRect();
      const attachedSurface = getAttachedSurface(anchor);
      const surfaceRect =
        attachedSurface?.getBoundingClientRect() ?? anchorRect;
      const anchoredGap = readAttachedSurfaceGap(attachedSurface);
      const popoverWidth =
        popoverRef.current?.offsetWidth ?? COLOR_POPOVER_ESTIMATED_SIZE;
      const centeredLeft =
        anchorRect.left + anchorRect.width / 2 - popoverWidth / 2;
      const maxLeft =
        window.innerWidth - popoverWidth - COLOR_POPOVER_VIEWPORT_GUTTER;
      setPosition({
        top: surfaceRect.bottom + anchoredGap,
        left: clamp(centeredLeft, COLOR_POPOVER_VIEWPORT_GUTTER, maxLeft),
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        !popoverRef.current?.contains(target) &&
        !anchorRef.current?.contains(target)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [anchorRef, isOpen, onClose]);

  const previewHex = normalizeHex(currentHex ?? "") ?? "#556D60";
  const previewRgb = hexToRgb(previewHex) ?? { r: 85, g: 109, b: 96 };
  const previewHsv = rgbToHsv(previewRgb.r, previewRgb.g, previewRgb.b);

  const commitHsvSelection = React.useCallback(
    (hue: number, saturation: number, value: number) => {
      const nextRgb = hsvToRgb(clamp(hue, 0, 360), clamp(saturation, 0, 1), clamp(value, 0, 1));
      onHexChange(rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b));
    },
    [onHexChange],
  );

  const commitFieldSelection = React.useCallback(
    (clientX: number, clientY: number) => {
      const field = fieldRef.current;
      if (!field) return;
      const rect = field.getBoundingClientRect();
      const saturation = clamp((clientX - rect.left) / rect.width, 0, 1);
      const value = 1 - clamp((clientY - rect.top) / rect.height, 0, 1);
      commitHsvSelection(previewHsv.h, saturation, value);
    },
    [commitHsvSelection, previewHsv.h],
  );

  const commitHueSelection = React.useCallback(
    (clientX: number) => {
      const hueTrack = hueRef.current;
      if (!hueTrack) return;
      const rect = hueTrack.getBoundingClientRect();
      const hue = clamp((clientX - rect.left) / rect.width, 0, 1) * 360;
      commitHsvSelection(hue, previewHsv.s, previewHsv.v);
    },
    [commitHsvSelection, previewHsv.s, previewHsv.v],
  );

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="dasti-color-popover"
      style={
        {
          top: `${position.top}px`,
          left: `${position.left}px`,
          "--picker-hue-color": `hsl(${previewHsv.h} 78% 62%)`,
        } as React.CSSProperties
      }
      role="dialog"
      aria-label="Custom accent color"
    >
      <div
        ref={fieldRef}
        className="dasti-color-popover__field"
        role="group"
        aria-label="Accent color field"
        tabIndex={0}
        style={
          {
            "--marker-x": `${previewHsv.s * 100}%`,
            "--marker-y": `${(1 - previewHsv.v) * 100}%`,
            "--marker-color": previewHex,
          } as React.CSSProperties
        }
        onPointerDown={(event) => {
          event.preventDefault();
          setDragTarget("field");
          fieldRef.current?.setPointerCapture?.(event.pointerId);
          commitFieldSelection(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (dragTarget !== "field") return;
          commitFieldSelection(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          setDragTarget(null);
          fieldRef.current?.releasePointerCapture?.(event.pointerId);
        }}
        onPointerCancel={(event) => {
          setDragTarget(null);
          fieldRef.current?.releasePointerCapture?.(event.pointerId);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            commitHsvSelection(previewHsv.h, previewHsv.s + 0.03, previewHsv.v);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            commitHsvSelection(previewHsv.h, previewHsv.s - 0.03, previewHsv.v);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            commitHsvSelection(previewHsv.h, previewHsv.s, previewHsv.v + 0.03);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            commitHsvSelection(previewHsv.h, previewHsv.s, previewHsv.v - 0.03);
          }
        }}
      >
        <span className="dasti-color-popover__field-fill" aria-hidden="true">
          <span
            className="dasti-color-popover__field-layer dasti-color-popover__field-layer--light"
          />
          <span
            className="dasti-color-popover__field-layer dasti-color-popover__field-layer--shade"
          />
        </span>
        <span
          className="dasti-color-popover__field-marker"
          aria-hidden="true"
        />
      </div>

      <div className="dasti-color-popover__footer">
        <div
          ref={hueRef}
          className="dasti-color-popover__hue"
          role="slider"
          aria-label="Accent hue"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(previewHsv.h)}
          tabIndex={0}
          style={
            {
              "--hue-marker-x": `${(previewHsv.h / 360) * 100}%`,
            } as React.CSSProperties
          }
          onPointerDown={(event) => {
            event.preventDefault();
            setDragTarget("hue");
            hueRef.current?.setPointerCapture?.(event.pointerId);
            commitHueSelection(event.clientX);
          }}
          onPointerMove={(event) => {
            if (dragTarget !== "hue") return;
            commitHueSelection(event.clientX);
          }}
          onPointerUp={(event) => {
            setDragTarget(null);
            hueRef.current?.releasePointerCapture?.(event.pointerId);
          }}
          onPointerCancel={(event) => {
            setDragTarget(null);
            hueRef.current?.releasePointerCapture?.(event.pointerId);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowUp") {
              event.preventDefault();
              commitHsvSelection(previewHsv.h + 6, previewHsv.s, previewHsv.v);
            } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
              event.preventDefault();
              commitHsvSelection(previewHsv.h - 6, previewHsv.s, previewHsv.v);
            }
          }}
        >
          <span className="dasti-color-popover__hue-marker" aria-hidden="true" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
