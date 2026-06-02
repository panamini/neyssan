import React from "react";
import {
  DOCUMENT_ICON_CATEGORIES,
  DEFAULT_DOCUMENT_ICON_KEY,
  TW_DOCUMENT_ICONS,
  getDocumentIcon,
  type DocumentIconCategory,
  type DocumentIconKey,
  type TwDocumentIcon,
} from "../../lib/document-icons";

export type DocumentIconPickerProps = {
  selectedIconKey?: DocumentIconKey | null;
  onChange: (iconKey: DocumentIconKey) => void;
  allowedCategories?: DocumentIconCategory[];
  label?: string;
  className?: string;
};

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

type DisplayIconCategory = {
  id: string;
  label: string;
  categories: DocumentIconCategory[];
  representativeIconKey: DocumentIconKey;
};

const DISPLAY_ICON_CATEGORIES: DisplayIconCategory[] = [
  {
    id: "essentials",
    label: "Essentials",
    categories: ["core"],
    representativeIconKey: "check",
  },
  {
    id: "work-admin",
    label: "Work and admin",
    categories: ["work", "legal-admin"],
    representativeIconKey: "briefcase",
  },
  {
    id: "skills-craft",
    label: "Skills and craft",
    categories: ["skills", "analytics", "design"],
    representativeIconKey: "wrench",
  },
  {
    id: "technology",
    label: "Technology",
    categories: ["tech"],
    representativeIconKey: "code",
  },
  {
    id: "protection",
    label: "Protection",
    categories: ["security"],
    representativeIconKey: "shield-check",
  },
  {
    id: "people-language",
    label: "People and language",
    categories: ["communication", "languages", "people"],
    representativeIconKey: "chat-circle",
  },
  {
    id: "movement-sport",
    label: "Movement and sport",
    categories: ["movement", "sports"],
    representativeIconKey: "soccer-ball",
  },
  {
    id: "interests",
    label: "Interests",
    categories: ["interests"],
    representativeIconKey: "music-note",
  },
];

function iconMatchesSearch(icon: TwDocumentIcon, normalizedSearch: string): boolean {
  if (!normalizedSearch) return true;
  const haystack = [icon.label, icon.key, ...icon.tags].join(" ").toLowerCase();
  return haystack.includes(normalizedSearch);
}

export function DocumentIconPicker({
  selectedIconKey,
  onChange,
  allowedCategories,
  label = "Icon",
  className,
}: DocumentIconPickerProps): JSX.Element {
  const [search, setSearch] = React.useState("");
  const [activeCategoryId, setActiveCategoryId] = React.useState<string | null>(
    null,
  );
  const normalizedSearch = normalizeSearch(search);
  const allowedCategorySet = React.useMemo(
    () => (allowedCategories ? new Set(allowedCategories) : null),
    [allowedCategories],
  );
  const selectedIcon =
    getDocumentIcon(selectedIconKey) ?? getDocumentIcon(DEFAULT_DOCUMENT_ICON_KEY);
  const searchLabel =
    label.trim().toLowerCase() === "icon"
      ? "Search icons"
      : `Search ${label.toLowerCase()} icons`;
  const visibleCategoryIds = React.useMemo(
    () =>
      new Set(
        DOCUMENT_ICON_CATEGORIES.filter((category) =>
          allowedCategorySet ? allowedCategorySet.has(category.id) : true,
        ).map((category) => category.id),
      ),
    [allowedCategorySet],
  );
  const visibleCategories = DISPLAY_ICON_CATEGORIES.map((category) => ({
    ...category,
    categories: category.categories.filter((id) => visibleCategoryIds.has(id)),
  })).filter((category) => category.categories.length > 0);
  const resolvedActiveCategoryId =
    activeCategoryId && visibleCategories.some((category) => category.id === activeCategoryId)
      ? activeCategoryId
      : visibleCategories[0]?.id ?? null;
  const activeCategory = visibleCategories.find(
    (category) => category.id === resolvedActiveCategoryId,
  );
  const categoryIcons = React.useMemo(
    () =>
      visibleCategories.map((category) => ({
        category,
        icon:
          getDocumentIcon(category.representativeIconKey) ??
          TW_DOCUMENT_ICONS.find((icon) =>
            category.categories.includes(icon.category),
          ) ??
          getDocumentIcon(DEFAULT_DOCUMENT_ICON_KEY),
      })),
    [visibleCategories],
  );
  const activeCategorySet = new Set(activeCategory?.categories ?? []);
  const activeIcons = TW_DOCUMENT_ICONS.filter((icon) => {
    if (!visibleCategoryIds.has(icon.category)) return false;
    if (normalizedSearch) return iconMatchesSearch(icon, normalizedSearch);
    return activeCategorySet.has(icon.category);
  });

  return (
    <div
      className={["document-icon-picker", className].filter(Boolean).join(" ")}
      data-testid="document-icon-picker"
    >
      <input
        className="document-icon-picker__search"
        type="search"
        value={search}
        aria-label={searchLabel}
        placeholder="Search icons"
        onChange={(event) => setSearch(event.currentTarget.value)}
      />
      <div
        className="document-icon-picker__category-nav"
        role="tablist"
        aria-label="Icon categories"
      >
        {categoryIcons.map(({ category, icon }) => (
          <button
            key={category.id}
            type="button"
            className="document-icon-picker__category-tab"
            role="tab"
            aria-selected={category.id === resolvedActiveCategoryId}
            aria-label={category.label}
            title={category.label}
            onClick={() => setActiveCategoryId(category.id)}
          >
            {icon ? (
              <span
                className="document-icon-picker__category-tab-icon"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: icon.svg }}
              />
            ) : null}
          </button>
        ))}
      </div>
      <div className="document-icon-picker__categories">
        <section
          className="document-icon-picker__category"
          aria-label={
            normalizedSearch
              ? `Search results for ${label}`
              : activeCategory?.label ?? label
          }
        >
          <div className="document-icon-picker__grid">
            {activeIcons.map((icon) => {
              const isSelected = icon.key === selectedIcon?.key;
              return (
                <button
                  key={icon.key}
                  type="button"
                  className="document-icon-picker__option"
                  data-selected={isSelected ? "true" : undefined}
                  aria-pressed={isSelected}
                  aria-label={`Use ${icon.label} icon`}
                  title={icon.label}
                  onClick={() => onChange(icon.key)}
                >
                  <span
                    className="document-icon-picker__option-preview"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: icon.svg }}
                  />
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default DocumentIconPicker;
