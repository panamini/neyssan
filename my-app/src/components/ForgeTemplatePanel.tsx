import React from "react";
import { Check, ImagesSquare, X } from "../lib/icons";
import { useForgeTemplatePanel } from "../contexts/ForgeTemplatePanelContext";

export function ForgeTemplatePanel(): JSX.Element | null {
  const { open, activeRegistration, closePanel } = useForgeTemplatePanel();

  if (!open || !activeRegistration) {
    return null;
  }

  return (
    <aside className="forge-template-panel" aria-label={activeRegistration.title}>
      <div className="forge-template-panel__head">
        <span className="forge-template-panel__icon" aria-hidden="true">
          <ImagesSquare size={16} strokeWidth={1.7} />
        </span>
        <div className="forge-template-panel__title-group">
          <h2>{activeRegistration.title}</h2>
          {activeRegistration.subtitle ? (
            <p>{activeRegistration.subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="forge-template-panel__close"
          aria-label="Close templates"
          title="Close templates"
          onClick={closePanel}
        >
          <X size={15} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>

      <div className="forge-template-panel__grid" role="list">
        {activeRegistration.items.map((item) => {
          const selected = item.id === activeRegistration.activeItemId;
          return (
            <button
              key={item.id}
              type="button"
              role="listitem"
              className="forge-template-card"
              data-selected={selected ? "true" : undefined}
              aria-pressed={selected}
              onClick={() => activeRegistration.onSelect(item.id)}
            >
              <span className="forge-template-card__preview" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="forge-template-card__body">
                <span className="forge-template-card__title-row">
                  <span className="forge-template-card__title">{item.label}</span>
                  {selected ? (
                    <Check size={13} strokeWidth={1.9} aria-hidden="true" />
                  ) : null}
                </span>
                {item.meta ? (
                  <span className="forge-template-card__meta">{item.meta}</span>
                ) : null}
                {item.description ? (
                  <span className="forge-template-card__description">
                    {item.description}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default ForgeTemplatePanel;
