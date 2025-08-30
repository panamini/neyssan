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
  } = props;

  const base =
    "inline-flex items-center w-full rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";

  const sizeMap: Record<string, string> = {
    sm: "px-2 py-1 text-sm",
    md: "px-3 py-2 text-base",
    lg: "px-4 py-3 text-lg",
  };

  const variantMap: Record<string, string> = {
    default: "bg-background text-foreground border border-accent",
    ghost: "bg-transparent text-foreground border border-transparent",
    error: "bg-background text-foreground border border-danger",
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
      className={classes}
    />
  );
}