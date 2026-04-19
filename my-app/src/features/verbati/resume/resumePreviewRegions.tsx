import React from "react";

import {
  matchesResumeActiveTarget,
  resolvePreviewSectionType,
  resolvePreviewSurfaceType,
  type ResumeActiveTarget,
  type ResumePreviewSectionType,
} from "../resumeLinking";

export type PreviewRegionSurface = "section" | "item";

type PreviewRegionProps = React.HTMLAttributes<HTMLElement> & {
  as?: keyof JSX.IntrinsicElements;
  sectionType: ResumePreviewSectionType;
  sectionId?: string;
  sectionTitle?: string;
  itemId?: string;
  activeTarget?: ResumeActiveTarget | null;
  surface: PreviewRegionSurface;
};

export function buildPreviewRegionAttrs(args: {
  sectionType: ResumePreviewSectionType;
  sectionId?: string;
  sectionTitle?: string;
  itemId?: string;
  activeTarget?: ResumeActiveTarget | null;
  surface: PreviewRegionSurface;
}) {
  const canonicalSectionType = resolvePreviewSectionType(args.sectionType);
  const previewSectionType = resolvePreviewSurfaceType(args.sectionType);
  const isActive = canonicalSectionType
    ? matchesResumeActiveTarget({
        target: args.activeTarget,
        sectionType: canonicalSectionType,
        previewSectionType,
        sectionId: args.sectionId,
        itemId: args.itemId,
      })
    : false;

  return {
    "data-no-pan": "true",
    "data-preview-section": args.sectionType,
    "data-preview-section-id": args.sectionId,
    "data-preview-section-title": args.sectionTitle,
    "data-preview-item-id": args.itemId,
    "data-preview-surface": args.surface,
    "data-preview-active": isActive ? "true" : undefined,
  };
}

export function PreviewSectionRegion({
  as = "section",
  sectionType,
  sectionId,
  sectionTitle,
  activeTarget,
  surface,
  ...props
}: PreviewRegionProps) {
  const Component = as as keyof JSX.IntrinsicElements;

  return (
    <Component
      {...props}
      {...buildPreviewRegionAttrs({
        sectionType,
        sectionId,
        sectionTitle,
        activeTarget,
        surface,
      })}
    />
  );
}

export function PreviewItemRegion({
  as = "div",
  sectionType,
  sectionId,
  sectionTitle,
  itemId,
  activeTarget,
  surface,
  ...props
}: PreviewRegionProps) {
  const Component = as as keyof JSX.IntrinsicElements;

  return (
    <Component
      {...props}
      {...buildPreviewRegionAttrs({
        sectionType,
        sectionId,
        sectionTitle,
        itemId,
        activeTarget,
        surface,
      })}
    />
  );
}

export function buildProjectPreviewFieldId(
  itemId: string,
  field: "name" | "meta" | "description",
): string {
  return `${itemId}:${field}`;
}
