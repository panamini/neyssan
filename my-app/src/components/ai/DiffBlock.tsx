import React from "react";
import clsx from "clsx";

export type DiffMode = "add" | "remove" | "replace";

export interface DiffBlockProps {
  mode: DiffMode;
  before?: React.ReactNode;
  after?: React.ReactNode;
}

export function DiffBlock({ mode, before, after }: DiffBlockProps) {
  if (mode === "add") {
    return <div className="ds-diff-block ds-diff-block--added">{after}</div>;
  }

  if (mode === "remove") {
    return <div className="ds-diff-block ds-diff-block--removed">{before}</div>;
  }

  return (
    <div className="ds-diff-block">
      <span className="ds-diff-block__old">{before}</span>
      <span className={clsx("ds-diff-block__new")}>{after}</span>
    </div>
  );
}

export default DiffBlock;
