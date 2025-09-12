import React from 'react';
import type { CvSection } from '../../types/cvDocument';
import BlockRenderer from '../cv-editor/BlockRenderer';

interface SectionDisplayProps {
  section: CvSection;
}

export function SectionDisplay({ section }: SectionDisplayProps): JSX.Element {
  return (
    <section aria-labelledby={`section-title-${section.id}`} className="break-inside-avoid">
      <h2
        id={`section-title-${section.id}`}
        className="pb-1 mb-3 text-xl font-semibold border-b-2 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
      >
        {section.title}
      </h2>
      <div className="space-y-4">
        {section.blocks && section.blocks.length > 0 ? (
          section.blocks.map((block) => (
            <BlockRenderer
              key={block.id}
              sectionId={section.id as string}
              block={block}
            />
          ))
        ) : (
          <p className="text-sm text-slate-500">No content in this section.</p>
        )}
      </div>
    </section>
  );
}