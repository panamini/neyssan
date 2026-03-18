"use client";

import React from "react";
import clsx from "clsx";

export interface InputProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "ghost" | "error";
  className?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}

export function Input(props: InputProps) {
  const {
    id,
    name,
    value,
    defaultValue,
    placeholder,
    disabled,
    type = "text",
    size = "md",
    variant = "default",
    className,
    onChange,
    onBlur,
    onKeyDown,
    autoFocus,
  } = props;

  // §11 dasti .field : w:100% h:hm · rs · sf1 bg · bm border · ts
  // focus: ac border + fr ring 3px (pas de ring-offset)
  const base =
    "inline-flex items-center w-full rounded-rs text-ts [background:var(--sf1)] [color:var(--ti)] placeholder:[color:var(--tg2)] [transition:all_.12s_var(--ez)] focus:outline-none focus:[border-color:var(--ac)] focus:[box-shadow:0_0_0_3px_var(--fr)]";

  const sizeMap: Record<string, string> = {
    sm: "px-2 py-1",
    md: "px-3 py-2",
    lg: "px-4 py-3",
  };

  const variantMap: Record<string, string> = {
    default: "border [border-color:var(--bm)]",
    ghost:   "border border-transparent [background:transparent]",
    error:   "border [border-color:var(--er)]",
  };

  const classes = clsx(
    base,
    // index signature safe access
    // @ts-ignore
    sizeMap[size],
    // @ts-ignore
    variantMap[variant],
    disabled && "opacity-50 cursor-not-allowed",
    className
  );

  return (
    <input
      id={id}
      name={name}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      disabled={disabled}
      type={type}
      onChange={onChange}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      autoFocus={autoFocus}
      className={classes}
    />
  );
}