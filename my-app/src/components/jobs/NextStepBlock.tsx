import React from "react";

type NextStepActionId = "cover_letter" | "resume" | "save_for_later";

type NextStepAction = {
  id: NextStepActionId;
  label: string;
};

type NextStepBlockProps = {
  headline: string;
  usesCohortData: boolean;
  actions: NextStepAction[];
  onSelectAction: (actionId: NextStepActionId) => void;
};

export function NextStepBlock({
  headline,
  usesCohortData,
  actions,
  onSelectAction,
}: NextStepBlockProps): JSX.Element {
  return (
    <section className="dasti-proposal-sheet" aria-label="Next step">
      <div className="dasti-proposal-sheet__header">
        <div className="dasti-stack">
          <div className="dasti-brief-card__summary-label">Next step</div>
          <div className="dasti-empty-state__title">Pick a next step.</div>
          {usesCohortData ? (
            <p className="dasti-empty-state__subtitle">{headline}</p>
          ) : (
            <p className="dasti-empty-state__subtitle">
              Pick one.
            </p>
          )}
        </div>
      </div>
      <div className="dasti-jobs-next-step__actions">
        {actions.map((action, index) => (
          <button
            key={action.id}
            type="button"
            className={[
              "dasti-button",
              "dasti-button--pill",
              index === 0 ? "dasti-button--primary" : null,
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onSelectAction(action.id)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
