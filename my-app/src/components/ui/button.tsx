"use client";

import React from "react";
import clsx from "clsx";

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  variant?:
    | "primary"
    | "secondary"
    | "ghost"
    | "danger"
    | "success"
    | "warning"
    | "accent";
  size?: "sm" | "md" | "lg";
  className?: string;
  type?: "button" | "submit" | "reset";
  title?: string;
  ariaLabel?: string;
}

/**
 * Token-aware Button primitive.
 * - Uses semantic tokens defined in globals and index.css
 * - Exposes variants and sizes for consistent usage across the app
 */
export function Button({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  title,
  ariaLabel,
}: ButtonProps) {
  const sizeClassMap: Record<NonNullable<ButtonProps["size"]>, string> = {
    sm: "dasti-button--sm",
    md: "dasti-button--md",
    lg: "dasti-button--lg",
  };

  const variantClassMap: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary: "dasti-button--primary",
    secondary: "dasti-button--secondary",
    ghost: "dasti-button--ghost",
    danger: "dasti-button--danger",
    success: "dasti-button--success",
    warning: "dasti-button--warning",
    accent: "dasti-button--accent",
  };

  const classes = clsx(
    "dasti-button",
    sizeClassMap[size],
    variantClassMap[variant],
    className,
  );

  function handleClick(e?: React.MouseEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (onClick) onClick(e);
  }

  return (
    <button
      type={type}
      className={classes}
      onClick={handleClick}
      disabled={disabled}
      aria-disabled={disabled}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
