"use client";

import React from "react";
import clsx from "clsx";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Textarea({
  id,
  label,
  hint,
  error,
  className,
  ...props
}: TextareaProps) {
  const generatedId = React.useId();
  const textareaId = id ?? generatedId;
  const messageId = `${textareaId}-message`;
  const hasMessage = Boolean(error || hint);
  const textarea = (
    <textarea
      {...props}
      id={textareaId}
      aria-invalid={Boolean(error) || undefined}
      aria-describedby={hasMessage ? messageId : props["aria-describedby"]}
      className={clsx(
        "ds-field ds-field--textarea",
        error && "ds-field--error",
        className,
      )}
    />
  );

  if (!label && !hint && !error) {
    return textarea;
  }

  return (
    <div className="ds-field-group">
      {label ? (
        <label className="ds-field-label" htmlFor={textareaId}>
          {label}
        </label>
      ) : null}
      {textarea}
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
