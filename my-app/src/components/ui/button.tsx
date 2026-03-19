"use client";
 
import React from "react";
 
export interface ButtonProps {
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success" | "warning" | "accent";
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
  // §11 dasti — base : inline-flex, border 1px, radius rs, ts fw500, transition .12s ez
  const base = "inline-flex items-center justify-center border font-medium appearance-none [-webkit-appearance:none] focus:outline-none";
  const transition = "[transition:background-color_.12s_var(--ez),border-color_.12s_var(--ez),color_.12s_var(--ez),box-shadow_.12s_var(--ez),transform_.12s_var(--ez)]";

  // §4 Hauteurs interactives dasti (px fixes)
  const heightMap: Record<string, string> = {
    sm: "var(--hs)",  // 32px
    md: "var(--hm)",  // 40px
    lg: "var(--hb)",  // 44px — WCAG 2.5.5
  };

  // Padding + font-size + radius par taille
  const sizeClassMap: Record<string, string> = {
    sm: "px-3 text-ts rounded-rs",  // --rs=6px
    md: "px-4 text-tb rounded-rs",
    lg: "px-6 text-tb rounded-rm",  // --rm=12px sur CTA large
  };

  const variantMap: Record<string, string> = {
    // .bp — primary : accent-solid bg · on-primary color · sha · brightness hover
    primary:   "[background:var(--ac)] [color:var(--op)] [border-color:transparent] [box-shadow:var(--sha)] hover:brightness-110",
    // .bsec — secondary : sfr bg · bm border · sha · sf2 hover
    secondary: "[background:var(--sfr)] [color:var(--ti)] [border-color:var(--bm)] [box-shadow:var(--sha)] hover:[background:var(--sf2)]",
    // .bgh — ghost : transparent · tm2 · sf2 hover + ti color
    ghost:     "[background:transparent] [color:var(--tm2)] [border-color:transparent] hover:[background:var(--sf2)] hover:[color:var(--ti)]",
    // .bdn — danger : erb bg · er/28% border · ert color · er hover
    danger:    "[background:var(--erb)] [color:var(--ert)] [border-color:var(--er)] hover:[background:var(--er)] hover:[color:var(--op)]",
    // success / warning / accent → secondary (pas d'équivalent dasti primaire)
    success:   "[background:var(--sfr)] [color:var(--ti)] [border-color:var(--bm)] [box-shadow:var(--sha)] hover:[background:var(--sf2)]",
    warning:   "[background:var(--sfr)] [color:var(--ti)] [border-color:var(--bm)] [box-shadow:var(--sha)] hover:[background:var(--sf2)]",
    accent:    "[background:var(--sfr)] [color:var(--ti)] [border-color:var(--bm)] [box-shadow:var(--sha)] hover:[background:var(--sf2)]",
  };

  const classes = `${base} ${transition} ${sizeClassMap[size]} ${variantMap[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`;

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
