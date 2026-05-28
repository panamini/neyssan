import React from "react";
import clsx from "clsx";
import { Card } from "../ui";
import { FilePlus, FileText, FileUser } from "../../lib/icons";

export type DocumentSpecimenTypeLabel = "CV" | "LETTER" | "PROPOSAL" | "PACK";

export type DocumentSpecimenSize = "full" | "compact";

export interface DocumentSpecimenCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "title"> {
  as?: "div" | "article" | "section";
  className?: string;
  typeChipClassName?: string;
  title: string;
  context: string;
  updatedLabel: string;
  typeLabel: DocumentSpecimenTypeLabel;
  size?: DocumentSpecimenSize;
  selected?: boolean;
  showUpdatedLabel?: boolean;
  selector?: React.ReactNode;
  actions?: React.ReactNode;
  onCardClick?: React.MouseEventHandler<HTMLDivElement>;
  previewRef?: React.Ref<HTMLButtonElement>;
  onPreviewFocusCapture?: React.FocusEventHandler<HTMLButtonElement>;
  onPreviewPointerEnter?: React.PointerEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
  onOpen: () => void;
}

export function DocumentSpecimenCard({
  as = "div",
  className,
  typeChipClassName,
  title,
  context,
  updatedLabel,
  typeLabel,
  size = "compact",
  selected = false,
  showUpdatedLabel = true,
  selector,
  actions,
  onCardClick,
  previewRef,
  onPreviewFocusCapture,
  onPreviewPointerEnter,
  children,
  onOpen,
  ...cardProps
}: DocumentSpecimenCardProps): JSX.Element {
  const isPack = typeLabel === "PACK";
  const TypeIcon =
    typeLabel === "CV" ? FileUser : typeLabel === "PACK" ? FilePlus : FileText;
  const previewStageRef = React.useRef<HTMLSpanElement | null>(null);
  const hasMeta = Boolean(context) || showUpdatedLabel;

  React.useLayoutEffect(() => {
    const stage = previewStageRef.current;
    if (!stage || typeof window === "undefined") return undefined;

    const updateScale = () => {
      const { width } = stage.getBoundingClientRect();
      if (width > 0) {
        const nextScale =
          stage.dataset.size === "full"
            ? Math.min(1, (width * 0.78) / 794)
            : Math.min(1, width / 794);
        stage.style.setProperty(
          "--specimen-fit-width-scale",
          String(nextScale),
        );
      }
    };

    updateScale();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateScale);
      observer.observe(stage);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return (
    <Card
      as={as}
      interactive
      className={clsx("document-specimen-card", className)}
      aria-selected={selected}
      data-selected={selected ? "true" : undefined}
      data-size={size}
      data-kind={typeLabel.toLowerCase()}
      onClick={onCardClick}
      {...cardProps}
    >
      {selector}
      <button
        type="button"
        className="document-specimen-card__preview-button"
        ref={previewRef}
        onFocusCapture={onPreviewFocusCapture}
        onPointerEnter={onPreviewPointerEnter}
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        <span
          className="document-specimen-card__mount"
          data-pack={isPack ? "true" : undefined}
        >
          <span
            className={clsx(
              "document-specimen-card__type-chip",
              typeChipClassName,
            )}
            aria-label={typeLabel}
            data-type-label={typeLabel}
          >
            <TypeIcon size={13} strokeWidth={1.8} aria-hidden="true" />
          </span>
          {isPack ? (
            <span
              className="document-specimen-card__stack-sheet"
              aria-hidden="true"
            />
          ) : null}
          <span
            className="document-specimen-card__preview-stage"
            data-size={size}
            ref={previewStageRef}
          >
            {children}
          </span>
        </span>
      </button>
      <div className="document-specimen-card__caption">
        <div className="document-specimen-card__caption-row">
          <button
            type="button"
            className="document-specimen-card__title-button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            <strong>{title}</strong>
          </button>
          {actions ? (
            <div className="document-specimen-card__actions">{actions}</div>
          ) : null}
        </div>
        {hasMeta ? (
          <div className="document-specimen-card__meta-row">
            {context ? <span>{context}</span> : null}
            {showUpdatedLabel ? <span>{updatedLabel}</span> : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export default DocumentSpecimenCard;
