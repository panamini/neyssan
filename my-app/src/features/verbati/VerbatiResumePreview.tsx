import React from "react";
import ResumePage from "./resume/ResumePage";
import {
  buildVerbatiThemeVars,
  resolveVerbatiAccentHex,
  VERBATI_LAYOUT_OPTIONS,
  VERBATI_LAYOUT_TO_RENDERER,
} from "./style";
import type { ResumeData, ResumeLayoutVariantId } from "./resume/resume.types";
import type { VerbatiLayoutPreset, VerbatiStylePreset } from "./types";

type VerbatiResumePreviewProps = {
  data: ResumeData;
  stylePreset: VerbatiStylePreset;
  compareLayouts?: boolean;
  onSelectComparisonLayout?: ((layout: VerbatiLayoutPreset) => void) | undefined;
};

const comparisonLayouts: VerbatiLayoutPreset[] = VERBATI_LAYOUT_OPTIONS.map(
  (option) => option.id,
);

function getLayoutPresetForRenderer(
  variantId: ResumeLayoutVariantId,
): VerbatiLayoutPreset | null {
  const match = comparisonLayouts.find(
    (layoutPreset) => VERBATI_LAYOUT_TO_RENDERER[layoutPreset] === variantId,
  );

  return match ?? null;
}

export function VerbatiResumePreview({
  data,
  stylePreset,
  compareLayouts = false,
  onSelectComparisonLayout,
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
          onSelectVariantId={
            onSelectComparisonLayout
              ? (variantId) => {
                  const nextLayout = getLayoutPresetForRenderer(variantId);
                  if (!nextLayout) return;
                  onSelectComparisonLayout(nextLayout);
                }
              : undefined
          }
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
