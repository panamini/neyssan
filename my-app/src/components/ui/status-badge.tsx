"use client";

import React from "react";
import clsx from "clsx";
import type { PillTone } from "./pill";

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  dot?: boolean;
  pulsing?: boolean;
}

export function StatusBadge({
  tone = "neutral",
  dot = true,
  pulsing = false,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={clsx("ds-status", `ds-status--${tone}`, className)}
      {...props}
    >
      {dot ? (
        <span
          className="ds-status__dot"
          data-pulsing={pulsing || undefined}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}
