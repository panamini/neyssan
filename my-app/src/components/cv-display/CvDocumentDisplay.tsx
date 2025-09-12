import React from "react";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import { SectionDisplay } from "./SectionDisplay";

/**
 * CvDocumentDisplay
 *
 * Read-only, block-driven display of the active CV document.
 * - Consumes `CvLibraryContext.currentCv`
 * - Renders each section using `SectionDisplay`
 * - Pure consumer (no local CV state)
 */
export function CvDocumentDisplay(): JSX.Element {
  const { currentCv, isLoading } = useCvLibrary();

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex space-x-4 animate-pulse">
          <div className="flex-1 py-1 space-y-2">
            <div className="w-1/3 h-6 rounded bg-slate-200 dark:bg-slate-700"></div>
            <div className="space-y-1">
              <div className="grid grid-cols-3 gap-2">
                <div className="h-4 col-span-1 rounded bg-slate-200 dark:bg-slate-700"></div>
              </div>
              <div className="w-5/6 h-4 rounded bg-slate-200 dark:bg-slate-700"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentCv) {
    return <div className="p-4 text-center text-slate-500">No CV loaded.</div>;
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm sm:p-6 dark:bg-slate-900">
      <h1 className="pb-2 mb-6 text-3xl font-bold border-b text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700">
        {currentCv.title}
      </h1>
      <div className="space-y-8">
        {currentCv.sections.map((section) => (
          <SectionDisplay key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}