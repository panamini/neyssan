"use client";
 
import React from "react";
 
export interface ButtonProps {
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "success" | "danger" | "warning" | "accent";
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
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none";

  // Map sizes to the new design tokens. Heights are driven by CSS variables defined in globals.css.
  const heightMap: Record<string, string> = {
    sm: "var(--btn-height-tertiary)",
    md: "var(--btn-height-base)",
    lg: "var(--btn-height-primary)",
  };

  // Keep horizontal padding & font-size as utilities while height comes from token.
  const paddingMap: Record<string, string> = {
    sm: "px-2 text-sm",
    md: "px-3 text-base",
    lg: "px-4 text-lg",
  };

  const variantMap: Record<string, string> = {
    // Primary = emphasized dark grayscale CTA (uses --primary)
    primary: "bg-primary text-background border border-transparent hover:opacity-95",
    // Secondary = neutral / surface button (light background, dark text)
    secondary: "bg-background text-foreground border border-accent hover:bg-accent/10",
    // Ghost = inline link-style button
    ghost: "bg-transparent text-foreground hover:bg-accent/5",
    // Status variants map to in-house grayscale accent to stay within palette.
    // Use bg-accent (mid-gray) with text-background (white) for contrast on darker surfaces.
    success: "bg-accent text-background border border-transparent hover:opacity-90",
    danger: "bg-accent text-background border border-transparent hover:opacity-90",
    warning: "bg-accent text-background border border-transparent hover:opacity-90",
    accent: "bg-accent text-background border border-transparent hover:opacity-90",
  };

  const classes = `${base} ${paddingMap[size]} ${variantMap[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`;

  const style: React.CSSProperties = { height: heightMap[size], lineHeight: heightMap[size] };

  function handleClick(e?: React.MouseEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (onClick) onClick(e);
  }

  return (
    <button
      type={type}
      className={classes}
      style={style}
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
