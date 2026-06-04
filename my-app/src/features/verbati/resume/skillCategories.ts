import type {
  ResumeData,
  ResumeSkillCategory,
  ResumeSkillItem,
} from "./resume.types";

export type ResumeSkillCategoryGroup = {
  id: string;
  label: string;
  order: number;
  items: ResumeSkillItem[];
  uncategorized?: boolean;
};

export function groupResumeSkillsByCategory(
  skillItems: ResumeSkillItem[],
  skillCategories: ResumeData["skillCategories"] = [],
  options: {
    includeEmptyCategories?: boolean;
    uncategorizedLabel?: string;
  } = {},
): ResumeSkillCategoryGroup[] {
  const categories = [...(skillCategories ?? [])]
    .filter((category): category is ResumeSkillCategory =>
      Boolean(category?.id && category?.label?.trim()),
    )
    .sort((a, b) => a.order - b.order);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const groups = new Map<string, ResumeSkillCategoryGroup>();

  categories.forEach((category) => {
    if (options.includeEmptyCategories) {
      groups.set(category.id, {
        id: category.id,
        label: category.label,
        order: category.order,
        items: [],
      });
    }
  });

  const uncategorized: ResumeSkillItem[] = [];
  skillItems.forEach((item) => {
    const category = item.categoryId ? byId.get(item.categoryId) : undefined;
    if (!category) {
      uncategorized.push(item);
      return;
    }
    const existing =
      groups.get(category.id) ??
      ({
        id: category.id,
        label: category.label,
        order: category.order,
        items: [],
      } satisfies ResumeSkillCategoryGroup);
    existing.items.push(item);
    groups.set(category.id, existing);
  });

  const orderedGroups = Array.from(groups.values())
    .filter((group) => options.includeEmptyCategories || group.items.length > 0)
    .sort((a, b) => a.order - b.order);

  if (uncategorized.length > 0) {
    orderedGroups.push({
      id: "__uncategorized__",
      label: options.uncategorizedLabel ?? "Other Skills",
      order: Number.MAX_SAFE_INTEGER,
      items: uncategorized,
      uncategorized: true,
    });
  }

  return orderedGroups;
}
