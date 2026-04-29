"use client";

import React from "react";
import clsx from "clsx";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  hint?: string;
  error?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "ghost" | "error";
}

export function Input({
  id,
  label,
  hint,
  error,
  size,
  variant = "default",
  className,
  ...props
}: InputProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const hasMessage = Boolean(error || hint);
  const input = (
    <input
      {...props}
      id={inputId}
      aria-invalid={Boolean(error) || undefined}
      aria-describedby={hasMessage ? messageId : props["aria-describedby"]}
      className={clsx(
        "ds-field",
        size && `ds-field--${size}`,
        (error || variant === "error") && "ds-field--error",
        variant === "ghost" && "ds-field--ghost",
        className,
      )}
    />
  );

  if (!label && !hint && !error) {
    return input;
  }

  return (
    <div className="ds-field-group">
      {label ? (
        <label className="ds-field-label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      {input}
      {error ? (
        <span id={messageId} className="ds-field-error">
          {error}
        </span>
      ) : hint ? (
        <span id={messageId} className="ds-field-hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
