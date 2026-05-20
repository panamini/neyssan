import React from "react";
import { Sheet } from "./ui";

type ComposerDrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  ariaLabel?: string;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function ComposerDrawer({
  open,
  title,
  description,
  ariaLabel,
  onOpenChange,
  children,
  footer,
}: ComposerDrawerProps): JSX.Element {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title={title}
      description={description}
      ariaLabel={ariaLabel}
      className="dasti-composer-drawer"
      overlayClassName="dasti-composer-drawer__overlay"
      bodyClassName="dasti-composer-drawer__body"
      footer={footer}
      footerClassName="dasti-composer-drawer__footer"
    >
      {children}
    </Sheet>
  );
}

export default ComposerDrawer;
