"use client";

import React from "react";
import clsx from "clsx";

export interface SkeletonProps {
  className?: string;
  height?: number | string;
  width?: number | string;
}

export function Skeleton({ className, height, width }: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (height) style.height = typeof height === "number" ? `${height}px` : height;
  if (width) style.width = typeof width === "number" ? `${width}px` : width;

  return (
    <div
      className={clsx(
        "animate-pulse rounded-md bg-accent/20",
        className
      )}
      style={style}
    />
  );
}