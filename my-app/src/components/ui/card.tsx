"use client";

import React from "react";
import clsx from "clsx";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "muted" | "elevated";
  interactive?: boolean;
  as?: "div" | "section" | "article";
  asChild?: boolean;
}

export function Card({
  children,
  className,
  variant = "default",
  interactive = false,
  as = "div",
  asChild = false,
  ...props
}: CardProps) {
  const classes = clsx(
    "ds-card",
    variant !== "default" && `ds-card--${variant}`,
    className,
  );

  if (asChild && React.isValidElement<{ className?: string }>(children)) {
    return React.cloneElement(children, {
      className: clsx(children.props.className, classes),
      "data-interactive": interactive || undefined,
      ...props,
    });
  }

  const Tag = as;
  return (
    <Tag className={classes} data-interactive={interactive || undefined} {...props}>
      {children}
    </Tag>
  );
}

export function CardTitle({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("ds-card__title", className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("ds-card__body", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("ds-card__footer", className)} {...props}>
      {children}
    </div>
  );
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  display?: boolean;
}

export function CardHeader({
  children,
  className,
  display = false,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={clsx(
        "ds-card__title",
        display && "ds-card__title--display",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("ds-card__content", className)} {...props}>
      {children}
    </div>
  );
}
