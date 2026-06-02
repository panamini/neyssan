import React from "react";
import {
  DOCUMENT_ICON_CATEGORIES,
  DEFAULT_DOCUMENT_ICON_KEY,
  TW_DOCUMENT_ICONS,
  getDocumentIcon,
  type DocumentIconCategory,
  type DocumentIconKey,
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

export function DocumentIconPicker({
  selectedIconKey,
  onChange,
  allowedCategories,
  label = "Icon",
  className,
}: DocumentIconPickerProps): JSX.Element {
  const [search, setSearch] = React.useState("");
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
  const visibleCategories = DOCUMENT_ICON_CATEGORIES.filter((category) =>
    allowedCategorySet ? allowedCategorySet.has(category.id) : true,
  );

  return (
    <div
      className={["document-icon-picker", className].filter(Boolean).join(" ")}
      data-testid="document-icon-picker"
    >
      <div className="document-icon-picker__header">
        <span className="document-icon-picker__label">{label}</span>
        {selectedIcon ? (
          <span className="document-icon-picker__selected">
            <span
              className="document-icon-picker__selected-preview"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: selectedIcon.svg }}
            />
            <span>{selectedIcon.label}</span>
          </span>
        ) : null}
      </div>
      <input
        className="document-icon-picker__search"
        type="search"
        value={search}
        aria-label={searchLabel}
        placeholder="Search icons"
        onChange={(event) => setSearch(event.currentTarget.value)}
      />
      <div className="document-icon-picker__categories">
        {visibleCategories.map((category) => {
          const icons = TW_DOCUMENT_ICONS.filter((icon) => {
            if (icon.category !== category.id) return false;
            if (!normalizedSearch) return true;
            const haystack = [icon.label, icon.key, ...icon.tags].join(" ").toLowerCase();
            return haystack.includes(normalizedSearch);
          });

          if (icons.length === 0) return null;

          return (
            <section key={category.id} className="document-icon-picker__category">
              <div className="document-icon-picker__category-label">{category.label}</div>
              <div className="document-icon-picker__grid">
                {icons.map((icon) => {
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
          );
        })}
      </div>
    </div>
  );
}

export default DocumentIconPicker;
