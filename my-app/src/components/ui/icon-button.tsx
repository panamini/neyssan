"use client";

import React from "react";
import clsx from "clsx";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost";
  label: string;
  children: React.ReactNode;
}

export function IconButton({
  variant = "default",
  label,
  children,
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      aria-label={label}
      title={label}
      className={clsx(
        "ds-icon-btn",
        variant === "ghost" && "ds-icon-btn--ghost",
        className,
      )}
    >
      {children}
    </button>
  );
}
