import React from "react";
import { createPortal } from "react-dom";

interface BodyPortalProps {
  children: React.ReactNode;
}

export function BodyPortal({ children }: BodyPortalProps) {
  const [target, setTarget] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setTarget(document.body);
  }, []);

  if (!target) return null;

  return createPortal(children, target);
}

export default BodyPortal;
