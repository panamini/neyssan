"use client";

import React from "react";
import clsx from "clsx";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-foreground/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={clsx(
        "relative bg-background border border-accent rounded-lg shadow-lg max-w-md w-full mx-4",
        className
      )}>
        {title && (
          <div className="px-6 py-4 border-b border-accent">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogContent({ children, className }: DialogContentProps) {
  return (
    <div className={clsx("px-6 py-4 text-foreground", className)}>
      {children}
    </div>
  );
}

export interface DialogActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogActions({ children, className }: DialogActionsProps) {
  return (
    <div className={clsx("px-6 py-4 border-t border-accent flex gap-3 justify-end", className)}>
      {children}
    </div>
  );
}