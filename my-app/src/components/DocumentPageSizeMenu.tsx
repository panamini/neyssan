import type { MenuSection } from "./ui/menu";
import type { DocumentPageSizePreference } from "../lib/document-page-size";

type DocumentPageSizeMenuArgs = {
  disabled?: boolean;
  onChange: (preference: DocumentPageSizePreference) => void;
  value: DocumentPageSizePreference;
};

const PAGE_SIZE_OPTIONS: ReadonlyArray<{
  description: string;
  label: string;
  value: DocumentPageSizePreference;
}> = [
  {
    value: "auto",
    label: "Auto",
    description: "Use the document region when available.",
  },
  {
    value: "a4",
    label: "A4",
    description: "210 x 297 mm",
  },
  {
    value: "letter",
    label: "US Letter",
    description: "215.9 x 279.4 mm",
  },
];

export function buildDocumentPageSizeMenuSection({
  disabled = false,
  onChange,
  value,
}: DocumentPageSizeMenuArgs): MenuSection {
  return {
    label: "Page size",
    items: PAGE_SIZE_OPTIONS.map((option) => ({
      id: `page-size-${option.value}`,
      label: option.label,
      description: option.description,
      role: "menuitemradio",
      selected: value === option.value,
      disabled,
      onSelect: () => onChange(option.value),
    })),
  };
}
