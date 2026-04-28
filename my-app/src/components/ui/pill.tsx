"use client";

import React from "react";
import clsx from "clsx";

export type PillTone = "neutral" | "accent" | "success" | "warning" | "danger";

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
}

export function Pill({
  tone = "neutral",
  className,
  children,
  ...props
}: PillProps) {
  return (
    <span className={clsx("ds-pill", `ds-pill--${tone}`, className)} {...props}>
      {children}
    </span>
  );
}
