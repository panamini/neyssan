"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { NodeExtension } from '@remirror/core';

/**
 * CvSectionNode
 *
 * A simple container node that represents a resume section inside the single-document
 * Remirror model. It stores a sectionId and an optional title attribute so the application
 * can map ProseMirror nodes back to the app's Section[] domain model.
 *
 * Exported as a named class so it can be instantiated in the editor's extension list.
 */
export class CvSectionNode extends NodeExtension {
  // Prevent remirror from attempting to inject extra attributes automatically.
  // This avoids the "spec was defined without calling the `defaults`, `parse` or `dom` methods"
  // error in certain remirror versions when providing a custom node spec.
  static disableExtraAttributes = true;

  get name() {
    return 'cvSection' as const;
  }

  // Use a broad signature and return type to remain compatible with different
  // @remirror/core versions. The runtime shape follows a ProseMirror NodeSpec.
  createNodeSpec(_extra?: unknown, _override?: unknown): any {
    const spec = {
      attrs: {
        sectionId: { default: null as string | null },
        title: { default: '' },
      },
      content: 'block+',
      group: 'block',
      selectable: true,
      parseDOM: [
        {
          tag: 'section[data-section-id]',
          getAttrs: (dom: any) => {
            const el = dom as HTMLElement | null;
            return {
              sectionId: el?.getAttribute?.('data-section-id') ?? null,
              title: el?.getAttribute?.('data-section-title') ?? '',
            };
          },
        },
      ],
      toDOM: (node: any) => {
        const attrs: Record<string, string> = {};
        if (node?.attrs?.sectionId) attrs['data-section-id'] = String(node.attrs.sectionId);
        if (node?.attrs?.title) attrs['data-section-title'] = String(node.attrs.title);
        // Use a semantic <section> wrapper so downstream tooling / a11y can identify resume sections.
        return ['section', attrs, 0];
      },
    };

    return spec as any;
  }
}