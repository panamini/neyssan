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

  const sizeMap: Record<NonNullable<InputProps["size"]>, string> = {
    sm: "dasti-field--sm",
    md: "dasti-field--md",
    lg: "dasti-field--lg",
  };

  const variantMap: Record<NonNullable<InputProps["variant"]>, string> = {
    default: "",
    ghost: "dasti-field--ghost",
    error: "dasti-field--error",
  };

  const classes = clsx(
    "dasti-field",
    sizeMap[size],
    variantMap[variant],
    disabled && "opacity-50 cursor-not-allowed",
    className,
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
