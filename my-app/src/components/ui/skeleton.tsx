"use client";

import React from "react";
import clsx from "clsx";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  radius?: "1" | "2" | "3" | "pill";
}

function toCssSize(value: number | string | undefined, fallback?: string) {
  if (typeof value === "number") return `${value}px`;
  return value ?? fallback;
}

export function Skeleton({
  className,
  height = 12,
  width = "100%",
  radius = "1",
  style,
  ...props
}: SkeletonProps) {
  const radiusValue =
    radius === "pill" ? "var(--radius-pill)" : `var(--radius-${radius})`;

  return (
    <div
      className={clsx("ds-skeleton", className)}
      style={{
        width: toCssSize(width),
        height: toCssSize(height),
        borderRadius: radiusValue,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}
