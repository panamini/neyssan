"use client";

import React from "react";
import clsx from "clsx";

export interface CardProps {
  children?: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}

export function Card({ children, className, as = "div" }: CardProps) {
  const Tag = as as React.ElementType;
  return (
    <Tag className={clsx("dasti-card dasti-card--md", className)}>
      {children}
    </Tag>
  );
}

export interface CardHeaderProps {
  children?: React.ReactNode;
  className?: string;
  /**
   * display=true : titre de section card (Baskervville tl/26px fw600 - .sct §11 dasti-spec-v1)
   * display=false (défaut) : Source Sans semibold standard
   */
  display?: boolean;
}

export function CardHeader({
  children,
  className,
  display = false,
}: CardHeaderProps) {
  return (
    <div
      className={clsx(
        display
          ? "dasti-card__title dasti-card__title--display"
          : "dasti-card__header dasti-card__title",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface CardContentProps {
  children?: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return (
    <div className={clsx("dasti-card__content", className)}>{children}</div>
  );
}
