"use client";

import React from "react";
import clsx from "clsx";

export type ButtonSize = "sm" | "md" | "lg";
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "accent"
  | "danger"
  | "success"
  | "warning"
  | "dark";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  variant?: ButtonVariant;
  loading?: boolean;
  loadingLabel?: string;
  pill?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  ariaLabel?: string;
}

export function Button({
  children,
  disabled = false,
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel,
  pill = false,
  iconLeft,
  iconRight,
  className,
  type = "button",
  ariaLabel,
  onClick,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (isDisabled) return;
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      type={type}
      className={clsx(
        "ds-btn",
        `ds-btn--${size}`,
        `ds-btn--${variant}`,
        pill && "ds-btn--pill",
        className,
      )}
      onClick={handleClick}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-label={ariaLabel ?? rest["aria-label"]}
    >
      {loading ? (
        <>
          <span>{loadingLabel ?? children}</span>
          <span className="ds-btn__period" aria-hidden="true">
            .
          </span>
        </>
      ) : (
        <>
          {iconLeft ? <span aria-hidden="true">{iconLeft}</span> : null}
          {children}
          {iconRight ? <span aria-hidden="true">{iconRight}</span> : null}
        </>
      )}
    </button>
  );
}
