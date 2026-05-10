import React from "react";
import { useNavigate } from "react-router-dom";
import { ImagesSquare, X } from "../lib/icons";
import { useForgeTemplatePanel } from "../contexts/ForgeTemplatePanelContext";
import { TemplateDocumentPreview } from "../pages/TemplatesPage";
import { A4_PAGE_HEIGHT_PX, A4_PAGE_WIDTH_PX } from "../lib/document-stage";

const TEMPLATE_THUMBNAIL_WIDTH_PX = 136;
const TEMPLATE_THUMBNAIL_SCALE =
  TEMPLATE_THUMBNAIL_WIDTH_PX / A4_PAGE_WIDTH_PX;

export function ForgeTemplatePanel(): JSX.Element | null {
  const { open, activeRegistration, closePanel } = useForgeTemplatePanel();
  const navigate = useNavigate();

  const handleBrowseAllTemplates = () => {
    closePanel();
    navigate("/templates");
  };

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
              aria-label={item.label}
              aria-pressed={selected}
              onClick={() => activeRegistration.onSelect(item.id)}
            >
              <span className="forge-template-card__preview" aria-hidden="true">
                <span
                  className="forge-template-card__page"
                  style={
                    {
                      width: A4_PAGE_WIDTH_PX,
                      height: A4_PAGE_HEIGHT_PX,
                      transform: `scale(${TEMPLATE_THUMBNAIL_SCALE})`,
                    } as React.CSSProperties
                  }
                >
                  {item.preview ? (
                    <TemplateDocumentPreview
                      kind={item.preview.kind}
                      family={item.preview.family}
                    />
                  ) : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="forge-template-panel__browse-all"
        onClick={handleBrowseAllTemplates}
      >
        Browse all templates
      </button>
    </aside>
  );
}

export default ForgeTemplatePanel;
