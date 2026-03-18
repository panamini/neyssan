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
  /**
   * display=true : titre de section card (Fraunces tl/26px fw600 — .sct §11 dasti-spec-v1)
   * display=false (défaut) : Source Sans semibold standard
   */
  display?: boolean;
}

export function CardHeader({ children, className, display = false }: CardHeaderProps) {
  if (display) {
    return (
      <div
        className={clsx("text-ti", className)}
        style={{
          fontFamily: '"Fraunces", serif',
          fontSize: "var(--tl)",
          fontWeight: 600,
          letterSpacing: "-.01em",
          color: "var(--ti)",
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div className={clsx("mb-2 font-semibold text-foreground", className)}>
      {children}
    </div>
  );
}

export interface CardContentProps {
  children?: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={clsx("text-foreground text-sm", className)}>{children}</div>;
}
