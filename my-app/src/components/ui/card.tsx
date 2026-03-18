"use client";

import React from "react";
import clsx from "clsx";

export interface CardProps {
  children?: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}

export function Card({ children, className, as = "div" }: CardProps) {
  const Tag = as as any;
  return (
    <Tag
      className={clsx(
        "rounded-rm [background:var(--sfr)] border border-bo [box-shadow:var(--sha)] p-4",
        className
      )}
    >
      {children}
    </Tag>
  );
}

export interface CardHeaderProps {
  children?: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return <div className={clsx("mb-2 font-semibold text-foreground", className)}>{children}</div>;
}

export interface CardContentProps {
  children?: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={clsx("text-foreground text-sm", className)}>{children}</div>;
}