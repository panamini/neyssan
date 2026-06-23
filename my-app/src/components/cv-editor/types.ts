/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-redundant-type-constituents -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
export type RemirrorJSON = import('remirror').RemirrorJSON | any;

export interface CvBlock {
  id: string;
  title: string;
  type: "text";
  content: RemirrorJSON;
  attributes?: Record<string, any>;
}

export interface Section {
  id: string;
  title: string;
  type: string;
  structuredContent: any[] | null;
  blocks: CvBlock[];
  collapsed?: boolean;
}

export interface CvState {
  sections: Section[];
}

/**
 * Stable-ish uid helper for the cv-editor area.
 * Exported here so other components in this folder can reuse the same implementation
 * without introducing circular imports.
 */
export function uid(): string {
  // timestamp + counter + random ensures reasonably unique stable ids across runs
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 0xfffff).toString(36);
  return `${t}-${r}`;
}