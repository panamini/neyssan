import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowSquareOut, CaretLeft, X } from "../lib/icons";
import { useForgeTemplatePanel } from "../contexts/ForgeTemplatePanelContext";
import { TemplateDocumentPreview } from "../pages/TemplatesPage";
import { A4_PAGE_HEIGHT_PX, A4_PAGE_WIDTH_PX } from "../lib/document-stage";

const TEMPLATE_THUMBNAIL_WIDTH_PX = 136;
const TEMPLATE_THUMBNAIL_SCALE =
  TEMPLATE_THUMBNAIL_WIDTH_PX / A4_PAGE_WIDTH_PX;

export function ForgeTemplatePanel(): JSX.Element | null {
  const {
    open,
    openMode,
    activeRegistration,
    closePanel,
    cancelPanelClose,
    queueClosePanel,
  } = useForgeTemplatePanel();
  const navigate = useNavigate();

  const handleBrowseAllTemplates = () => {
    closePanel();
    navigate("/templates");
  };

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePanel, open]);

  const panelHoverProps = {
    onPointerEnter: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === "touch") return;
      cancelPanelClose();
    },
    onPointerLeave: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === "touch") return;
      queueClosePanel();
    },
  };

  if (!open || !activeRegistration) {
    return null;
  }
  const pinned = openMode === "pinned";

  if (activeRegistration.kind === "custom") {
    const handleFooter = () => {
      closePanel();
      activeRegistration.footer?.onSelect();
    };

    return (
      <aside
        className="forge-template-panel"
        aria-label={activeRegistration.title}
        {...panelHoverProps}
      >
        <div className="forge-template-panel__head">
          <span className="forge-template-panel__head-title">
            {activeRegistration.title}
          </span>
          {activeRegistration.footer ? (
            <button
              type="button"
              className="forge-template-panel__head-action"
              onClick={handleFooter}
            >
              {activeRegistration.footer.label}
              <ArrowSquareOut size={13} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            className="forge-template-panel__close"
            aria-label={`Close ${activeRegistration.title}`}
            title={`Close ${activeRegistration.title}`}
            onClick={closePanel}
          >
            <X size={15} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
        {pinned ? (
          <button
            type="button"
            className="forge-template-panel__collapse"
            aria-label="Collapse drawer"
            title="Collapse drawer"
            onClick={closePanel}
          >
            <CaretLeft size={14} strokeWidth={1.8} aria-hidden="true" />
          </button>
        ) : null}

        <div className="forge-template-panel__content">
          {activeRegistration.renderContent()}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="forge-template-panel"
      aria-label={activeRegistration.title}
      {...panelHoverProps}
    >
      <div className="forge-template-panel__head">
        <span className="forge-template-panel__head-title">Templates</span>
        <button
          type="button"
          className="forge-template-panel__head-action"
          onClick={handleBrowseAllTemplates}
        >
          Open Templates
          <ArrowSquareOut size={13} aria-hidden="true" />
        </button>
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
      {pinned ? (
        <button
          type="button"
          className="forge-template-panel__collapse"
          aria-label="Collapse drawer"
          title="Collapse drawer"
          onClick={closePanel}
        >
          <CaretLeft size={14} strokeWidth={1.8} aria-hidden="true" />
        </button>
      ) : null}

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
    </aside>
  );
}

export default ForgeTemplatePanel;
