import React from "react";
import ResumePage from "./resume/ResumePage";
import {
  buildVerbatiThemeVars,
  resolveVerbatiAccentHex,
  VERBATI_LAYOUT_OPTIONS,
  VERBATI_LAYOUT_TO_RENDERER,
} from "./style";
import type { ResumeData } from "./resume/resume.types";
import type { VerbatiLayoutPreset, VerbatiStylePreset } from "./types";

type VerbatiResumePreviewProps = {
  data: ResumeData;
  stylePreset: VerbatiStylePreset;
  compareLayouts?: boolean;
};

const comparisonLayouts: VerbatiLayoutPreset[] = VERBATI_LAYOUT_OPTIONS.map(
  (option) => option.id,
);

export function VerbatiResumePreview({
  data,
  stylePreset,
  compareLayouts = false,
}: VerbatiResumePreviewProps): JSX.Element {
  const themeVars = React.useMemo(
    () => buildVerbatiThemeVars(stylePreset),
    [stylePreset],
  );
  const accentToken = React.useMemo(
    () => resolveVerbatiAccentHex(stylePreset),
    [stylePreset],
  );

  if (compareLayouts) {
    const comparisonVariantIds = comparisonLayouts.map(
      (layout) => VERBATI_LAYOUT_TO_RENDERER[layout],
    );
    const fitToken = `${stylePreset.layout}:${stylePreset.typography}:${accentToken}:compare:${data.name}:${data.title}:${data.summary.length}:${data.experience.length}:${data.education.length}:${data.skills.length}:${data.languages.length}:${data.projects.length}:${data.achievements?.length ?? 0}`;

    return (
      <div
        key={fitToken}
        className="theme-resume-calm theme-resume-calm--comparison"
        style={themeVars}
      >
        <ResumePage
          data={data}
          mode="comparisonAll"
          comparisonVariantIds={comparisonVariantIds}
          fitToken={fitToken}
        />
      </div>
    );
  }

  const fitToken = `${stylePreset.layout}:${stylePreset.typography}:${accentToken}:single:${data.name}:${data.title}:${data.summary.length}:${data.experience.length}:${data.education.length}:${data.skills.length}:${data.languages.length}:${data.projects.length}:${data.achievements?.length ?? 0}`;

  return (
    <div
      key={fitToken}
      className="theme-resume-calm theme-resume-calm--single"
      style={themeVars}
    >
      <ResumePage
        data={data}
        mode={VERBATI_LAYOUT_TO_RENDERER[stylePreset.layout]}
        fitToken={fitToken}
      />
    </div>
  );
}
