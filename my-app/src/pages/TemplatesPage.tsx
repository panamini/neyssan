import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Pill } from "../components/ui";

const TEMPLATE_FILTERS = ["all", "cover letters", "cvs"] as const;
type TemplateFilter = (typeof TEMPLATE_FILTERS)[number];

type TemplateCard = {
  id: string;
  name: string;
  kind: "Cover letter" | "CV" | "Cover letter · CV";
  family: "editorial" | "minimal" | "bold" | "classic" | "compact" | "letterpress";
  lines: string[];
};

const TEMPLATES: TemplateCard[] = [
  {
    id: "editorial",
    name: "Editorial",
    kind: "Cover letter · CV",
    family: "editorial",
    lines: [
      "Aurélien Pellegrini",
      "Frontend engineer · Paris",
      "Experience",
      "Lead Frontend · Studio Aurore",
      "TypeScript · React · System design.",
    ],
  },
  {
    id: "minimal",
    name: "Minimal",
    kind: "Cover letter · CV",
    family: "minimal",
    lines: [
      "Aurélien Pellegrini",
      "aurelien@twoweeks.ai · Paris",
      "Experience",
      "Lead Frontend, Studio Aurore.",
      "Senior Frontend, Pixel and Co.",
    ],
  },
  {
    id: "bold",
    name: "Bold",
    kind: "Cover letter",
    family: "bold",
    lines: [
      "Aurélien.",
      "Frontend engineer.",
      "Experience",
      "Lead Frontend.",
      "Built the planning suite from scratch.",
    ],
  },
  {
    id: "classic",
    name: "Classic",
    kind: "CV",
    family: "classic",
    lines: [
      "Aurélien Pellegrini",
      "Frontend engineer · Paris, France",
      "Experience",
      "Lead Frontend — Studio Aurore.",
      "Senior Frontend — Pixel and Co.",
    ],
  },
  {
    id: "compact",
    name: "Compact",
    kind: "CV",
    family: "compact",
    lines: [
      "Aurélien Pellegrini",
      "aurelien@twoweeks.ai · LinkedIn · Paris",
      "Experience",
      "Lead Frontend · Studio Aurore.",
      "Education · MSc Computer Science.",
    ],
  },
  {
    id: "letterpress",
    name: "Letterpress",
    kind: "Cover letter",
    family: "letterpress",
    lines: [
      "Aurélien Pellegrini",
      "May 1, 2026",
      "Hello Linear team,",
      "I have spent six years building craft-first product surfaces.",
      "— Aurélien",
    ],
  },
];

function filterMatches(template: TemplateCard, filter: TemplateFilter): boolean {
  if (filter === "all") return true;
  if (filter === "cover letters") return template.kind.includes("Cover letter");
  return template.kind.includes("CV");
}

function filterLabel(filter: TemplateFilter): string {
  if (filter === "cvs") return "CVs";
  return filter.charAt(0).toUpperCase() + filter.slice(1);
}

export function TemplatesPage(): JSX.Element {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = React.useState<TemplateFilter>("all");
  const visibleTemplates = React.useMemo(
    () => TEMPLATES.filter((template) => filterMatches(template, activeFilter)),
    [activeFilter],
  );

  return (
    <div className="dasti-page-scroll">
      <div className="dasti-page-shell dasti-templates-page">
        <div className="dasti-page-header dasti-templates-page__head">
          <div className="dasti-stack">
            <h1 className="dasti-stack__title">Templates</h1>
            <p className="dasti-stack__subtitle">
              Pick a starting point. Customize fonts and accent in document style.
            </p>
          </div>
          <div className="dasti-page-actions">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => navigate("/settings?tab=docstyle")}
            >
              Customize style
            </Button>
          </div>
        </div>

        <div className="dasti-template-filter">
          <div className="library-tabs" role="tablist" aria-label="Template type">
            {TEMPLATE_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                role="tab"
                aria-selected={activeFilter === filter}
                data-active={activeFilter === filter ? "true" : undefined}
                onClick={() => setActiveFilter(filter)}
              >
                {filterLabel(filter)}
              </button>
            ))}
          </div>
          <span className="dasti-template-filter__spacer" />
          <Pill tone="neutral">Editorial</Pill>
          <Pill tone="neutral">Minimal</Pill>
          <Pill tone="neutral">Classic</Pill>
          <Pill tone="neutral">Bold</Pill>
        </div>

        <div className="dasti-template-grid" aria-label="Templates">
          {visibleTemplates.map((template, index) => (
            <button
              key={template.id}
              type="button"
              className={`dasti-template-card dasti-template-card--${template.family}`}
              data-selected={index === 0 ? "true" : undefined}
              onClick={() => navigate(template.kind === "CV" ? "/cv" : "/proposal")}
            >
              <span className="dasti-template-card__preview" aria-hidden="true">
                {template.lines.map((line, lineIndex) => (
                  <span
                    key={`${template.id}-${line}`}
                    className={lineIndex === 0 ? "dasti-template-card__name-line" : lineIndex === 2 ? "dasti-template-card__heading-line" : undefined}
                  >
                    {line}
                  </span>
                ))}
              </span>
              <span className="dasti-template-card__meta">
                <span className="dasti-template-card__name">{template.name}</span>
                <span className="dasti-template-card__kind">{template.kind}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TemplatesPage;
