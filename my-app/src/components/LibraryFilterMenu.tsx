import { ChevronDown } from "@/lib/icons";
import { Menu, type MenuSection } from "./ui/menu";
import { ToneBadge, type ToneBadgeTone } from "./ui/tone-badge";

export type LibraryFilterMenuOption<TValue extends string> = {
  value: TValue;
  label: string;
  description?: string;
  tone?: ToneBadgeTone;
};

type LibraryFilterMenuProps<TValue extends string> = {
  label: string;
  value: TValue;
  options: ReadonlyArray<LibraryFilterMenuOption<TValue>>;
  onChange: (value: TValue) => void;
  align?: "start" | "end";
};

export function LibraryFilterMenu<TValue extends string>({
  label,
  value,
  options,
  onChange,
  align = "end",
}: LibraryFilterMenuProps<TValue>): JSX.Element {
  const activeOption =
    options.find((option) => option.value === value) ?? options[0];
  const sections: MenuSection[] = [
    {
      items: options.map((option) => {
        const active = option.value === value;
        return {
          id: option.value,
          role: "menuitemradio",
          selected: active,
          label: option.tone ? (
            <ToneBadge tone={option.tone}>{option.label}</ToneBadge>
          ) : (
            option.label
          ),
          description: option.description,
          onSelect: () => onChange(option.value),
        };
      }),
    },
  ];

  return (
    <div className="dasti-proposal-library-filter-menu">
      <Menu
        ariaLabel={label}
        align={align}
        sections={sections}
        trigger={
          <button
            type="button"
            className="dasti-proposal-library-filter-menu__trigger"
            aria-label={label}
          >
            <span className="dasti-proposal-library-filter-menu__trigger-label">
              {activeOption?.tone ? (
                <ToneBadge tone={activeOption.tone}>
                  {activeOption.label}
                </ToneBadge>
              ) : (
                (activeOption?.label ?? label)
              )}
            </span>
            <ChevronDown
              className="dasti-proposal-library-filter-menu__chevron"
              size={14}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </button>
        }
      />
    </div>
  );
}
