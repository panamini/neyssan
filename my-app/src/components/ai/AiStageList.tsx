import React from "react";

export type AiStageState = "pending" | "active" | "done" | "error";

export interface AiStage {
  id: string;
  label: string;
}

export interface AiStageListProps {
  title: string;
  stages: AiStage[];
  currentIndex: number;
  errorIndex?: number | null;
}

function resolveStageState({
  index,
  currentIndex,
  stagesLength,
  errorIndex,
}: {
  index: number;
  currentIndex: number;
  stagesLength: number;
  errorIndex?: number | null;
}): AiStageState {
  if (errorIndex === index) return "error";
  if (errorIndex != null) return "pending";
  if (currentIndex >= stagesLength || index < currentIndex) return "done";
  if (index === currentIndex) return "active";
  return "pending";
}

export function AiStageList({
  title,
  stages,
  currentIndex,
  errorIndex = null,
}: AiStageListProps) {
  const thinking = errorIndex == null && currentIndex < stages.length;

  return (
    <div className="ds-ai-stage" role="status" aria-label={title}>
      <div className="ds-ai-stage__header">
        {title}
        <span
          className="ds-ai-stage__period"
          data-thinking={thinking || undefined}
          aria-hidden="true"
        />
      </div>
      {stages.map((stage, index) => {
        const state = resolveStageState({
          index,
          currentIndex,
          stagesLength: stages.length,
          errorIndex,
        });

        return (
          <div
            key={stage.id}
            className="ds-ai-stage__item"
            data-state={state}
          >
            <span className="ds-ai-stage__dot" aria-hidden="true" />
            <span className="ds-ai-stage__text">{stage.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default AiStageList;
