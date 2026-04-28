"use client";

import React from "react";
import clsx from "clsx";

export type ToneBadgeTone = "warm" | "formal" | "natural";

export interface ToneBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: ToneBadgeTone;
}

export function ToneBadge({
  tone = "warm",
  className,
  children,
  ...props
}: ToneBadgeProps) {
  return (
    <span className={clsx("ds-tone", `ds-tone--${tone}`, className)} {...props}>
      {children}
    </span>
  );
}
