import {
  getDocumentIcon,
  type DocumentIconKey,
} from "./document-icons";

export type DocumentListItemIconOverrideTarget = {
  sectionId?: string | null;
  sectionType?: string | null;
  itemId?: string | null;
  field?: string | null;
  blockIndex?: number | null;
  itemIndex?: number | null;
};

export type DocumentIconOverrides = {
  listItems?: Record<string, DocumentIconKey>;
};

function cleanKeyPart(value: unknown): string {
  return String(value ?? "").trim().replace(/[|:]/g, "_");
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function buildDocumentListItemIconOverrideKey(
  target: DocumentListItemIconOverrideTarget,
): string | null {
  const sectionId = cleanKeyPart(target.sectionId);
  const sectionType = cleanKeyPart(target.sectionType);
  const itemId = cleanKeyPart(target.itemId);
  const field = cleanKeyPart(target.field ?? "item");
  const blockIndex =
    typeof target.blockIndex === "number" && Number.isFinite(target.blockIndex)
      ? String(target.blockIndex)
      : "";
  const itemIndex =
    typeof target.itemIndex === "number" && Number.isFinite(target.itemIndex)
      ? String(target.itemIndex)
      : "";

  if (!sectionId || !sectionType || !itemId) {
    return null;
  }

  return [sectionId, sectionType, itemId, field, blockIndex, itemIndex].join("|");
}

export function normalizeDocumentIconOverrides(
  input: unknown,
): DocumentIconOverrides {
  const record = readRecord(input);
  const listItemsRecord = readRecord(record?.listItems);
  const listItems = listItemsRecord
    ? Object.entries(listItemsRecord).reduce<Record<string, DocumentIconKey>>(
        (result, [key, iconKey]) => {
          if (typeof iconKey === "string" && getDocumentIcon(iconKey)) {
            result[key] = iconKey;
          }
          return result;
        },
        {},
      )
    : {};

  return Object.keys(listItems).length > 0 ? { listItems } : {};
}

export function resolveDocumentListItemIconOverride(
  overrides: DocumentIconOverrides | null | undefined,
  target: DocumentListItemIconOverrideTarget | null | undefined,
): DocumentIconKey | null {
  if (!overrides || !target) {
    return null;
  }
  const key = buildDocumentListItemIconOverrideKey(target);
  if (!key) {
    return null;
  }
  const iconKey = overrides.listItems?.[key];
  return typeof iconKey === "string" && getDocumentIcon(iconKey) ? iconKey : null;
}
