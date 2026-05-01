import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Pill } from "../components/ui";

const TEMPLATE_FILTERS = ["cover letters", "resume"] as const;
type TemplateFilter = (typeof TEMPLATE_FILTERS)[number];

type TemplateCard = {
  id: string;
  name: string;
  kind: "Cover letter" | "Resume";
  family: "two-column" | "minimal" | "bold" | "classic" | "compact" | "letterpress";
  description: string;
  updatedLabel: string;
  lines: string[];
};

const TEMPLATES: TemplateCard[] = [
  {
    id: "two-column-resume",
    name: "Two-column",
    kind: "Resume",
    family: "two-column",
    description: "A simple two-column resume shell for structured experience and skills.",
    updatedLabel: "Updated 1 week ago",
    lines: [
      "Aurélien Pellegrini",
      "Product engineer",
      "Experience",
      "Lead Frontend · Studio Aurore",
      "Skills",
      "React · TypeScript · Design systems",
    ],
  },
  {
    id: "minimal-letter",
    name: "Minimal",
    kind: "Cover letter",
    family: "minimal",
    description: "A clean letter with quiet spacing and straightforward hierarchy.",
    updatedLabel: "Updated 2h ago",
    lines: [
      "Aurélien Pellegrini",
      "May 1, 2026",
      "Hello Linear team,",
      "I have spent six years building craft-first product surfaces.",
      "— Aurélien",
    ],
  },
  {
    id: "bold-letter",
    name: "Bold",
    kind: "Cover letter",
    family: "bold",
    description: "A sharper letter direction for confident, product-led applications.",
    updatedLabel: "Updated 1 day ago",
    lines: [
      "Aurélien.",
      "Frontend engineer.",
      "Hello team,",
      "I build fast, legible product workflows with careful systems thinking.",
      "Thank you,",
    ],
  },
  {
    id: "classic-resume",
    name: "Classic",
    kind: "Resume",
    family: "classic",
    description: "A traditional resume frame with centered identity and readable sections.",
    updatedLabel: "Updated 1 month ago",
    lines: [
      "Aurélien Pellegrini",
      "Frontend engineer · Paris, France",
      "Experience",
      "Lead Frontend — Studio Aurore.",
      "Senior Frontend — Pixel and Co.",
    ],
  },
  {
    id: "compact-resume",
    name: "Compact",
    kind: "Resume",
    family: "compact",
    description: "A dense resume layout for senior profiles with more content pressure.",
    updatedLabel: "Updated 1 week ago",
    lines: [
      "Aurélien Pellegrini",
      "aurelien@twoweeks.ai · Paris",
      "Experience",
      "Lead Frontend · Studio Aurore.",
      "Education · MSc Computer Science.",
    ],
  },
  {
    id: "letterpress-letter",
    name: "Letterpress",
    kind: "Cover letter",
    family: "letterpress",
    description: "A warmer editorial letter style for narrative applications.",
    updatedLabel: "Updated May 2025",
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
  if (filter === "cover letters") return template.kind === "Cover letter";
  return template.kind === "Resume";
}

function filterLabel(filter: TemplateFilter): string {
  return filter === "resume" ? "Resume" : "Cover letters";
}

export function TemplatesPage(): JSX.Element {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = React.useState<TemplateFilter>("cover letters");
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
        </div>

        <div className="dasti-template-grid" aria-label="Templates">
          {visibleTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              className={`dasti-template-card dasti-template-card--${template.family}`}
              onClick={() => navigate(template.kind === "Resume" ? "/cv" : "/proposal")}
            >
              <span className="ds-card__eyebrow dasti-library-card__eyebrow">{template.kind}</span>
              <span className="dasti-template-card__title">{template.name}</span>
              <span className="dasti-template-card__description">{template.description}</span>
              <span className="dasti-template-card__preview" aria-hidden="true">
                {template.lines.map((line, lineIndex) => (
                  <span
                    key={`${template.id}-${line}`}
                    className={lineIndex === 0 ? "dasti-template-card__name-line" : lineIndex === 2 || lineIndex === 4 ? "dasti-template-card__heading-line" : undefined}
                  >
                    {line}
                  </span>
                ))}
              </span>
              <span className="dasti-library-card__footer dasti-template-card__footer">
                <span>{template.updatedLabel}</span>
                <Pill tone="neutral">{template.kind}</Pill>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TemplatesPage;
