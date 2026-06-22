import React from "react";
import { useAction } from "convex/react";
import { ArrowCounterClockwise, Plus, Wand2 } from "@/lib/icons";
import { Remirror, useRemirror, EditorComponent } from "@remirror/react";
import {
  BoldExtension,
  BulletListExtension,
  HardBreakExtension,
  HistoryExtension,
  ItalicExtension,
  ListItemExtension,
  OrderedListExtension,
  ParagraphExtension,
  UnderlineExtension,
} from "remirror/extensions";
import type { RemirrorJSON } from "remirror";
import { api } from "../../../convex/_generated/api";
import { Button, IslandPanel } from "../ui";
import AiSuggestionCard from "../ai/AiSuggestionCard";
import type {
  CvSection,
  ISkillItem,
  Level,
  SkillBucket,
  SkillCategory,
} from "../../types/cvDocument";
import { formatSectionDisplayTitle } from "../../lib/cv-section-organization";
import { projectResponsibilitiesForWorkshop } from "../../lib/resumeResponsibilityAuthority";
import { remirrorJsonToString } from "../../lib/utils";
import { ensureRemirrorDoc } from "../remirror-editor/utils/conversion";
import { EditorToolbar } from "../remirror-editor/components/EditorToolbar";
import { useToast } from "../ui/toast";
import type { CvRailAiSuggestion } from "./CvRail";
import { SkillsDrawer } from "../structured-blocks/SkillsDrawer";

function getSectionItemCount(section: CvSection | null): number {
  if (!section) return 0;
  if (Array.isArray(section.structuredContent)) {
    return section.structuredContent.length;
  }
  if (Array.isArray(section.blocks)) {
    return section.blocks.length;
  }
  return 0;
}

type SectionEditorSheetProps = {
  open: boolean;
  section: CvSection | null;
  aiSuggestion?: CvRailAiSuggestion | null;
  isAiRunning?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (section: CvSection | null) => void;
  summaryAiEvidence?: {
    summary: string;
    skills: string[];
    experiences: Array<{
      company?: string;
      position?: string;
      description?: string;
      bullets?: string[];
    }>;
    educations: Array<{
      institution?: string;
      degree?: string;
      fieldOfStudy?: string;
      description?: string;
    }>;
    languages: Array<{ name?: string; level?: string }>;
  };
  onRunListAiSuggestion?: (sectionId: string) => void;
  onAcceptListAiSuggestion?: (
    value: string,
    options?: { persist?: boolean },
  ) => void;
  onDismissListAiSuggestion?: (value: string) => void;
  onClearListAiSuggestions?: () => void;
  stageAligned?: boolean;
};

type FieldAiSuggestion = {
  key: string;
  sectionType: "experience" | "achievements" | "projects" | "education" | "text";
  itemIndex: number;
  beforeText: string;
  afterText: string;
};

type SummaryAiSuggestion = {
  beforeText: string;
  afterText: string;
};

type AcceptedAiEdit = {
  key: string;
  beforeSection: CvSection;
};

type DrawerRichTextEditorProps = {
  value: unknown;
  ariaLabel: string;
  testId: string;
  showLists?: boolean;
  toolbarTrailing?: React.ReactNode;
  onChangeDoc: (doc: RemirrorJSON) => void;
  onRegisterFlush?: (key: string, flush: () => boolean) => () => void;
};

function DrawerRichTextEditor({
  value,
  ariaLabel,
  testId,
  showLists = true,
  toolbarTrailing,
  onChangeDoc,
  onRegisterFlush,
}: DrawerRichTextEditorProps) {
  const extensions = React.useMemo(
    () => [
      new ParagraphExtension(),
      new HistoryExtension({}),
      new HardBreakExtension({}),
      new BoldExtension({}),
      new ItalicExtension({}),
      new UnderlineExtension({}),
      new BulletListExtension({}),
      new OrderedListExtension({}),
      new ListItemExtension({}),
    ],
    [],
  );
  const initialContent = React.useMemo(
    () => ensureRemirrorDoc(value as RemirrorJSON | string | undefined | null),
    // Remirror owns subsequent direct edits; external AI/undo updates are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const latestDocRef = React.useRef<RemirrorJSON>(initialContent as RemirrorJSON);
  const lastCommittedDocJsonRef = React.useRef(JSON.stringify(initialContent));
  const lastExternalDocJsonRef = React.useRef(JSON.stringify(initialContent));
  const isFocusedRef = React.useRef(false);
  const { manager, state, onChange } = useRemirror({
    extensions: () => extensions as any,
    content: initialContent as any,
  });

  React.useEffect(() => {
    const nextDoc = ensureRemirrorDoc(value as RemirrorJSON | string | undefined | null);
    const nextJson = JSON.stringify(nextDoc);
    if (nextJson === lastExternalDocJsonRef.current) return;
    lastExternalDocJsonRef.current = nextJson;
    if (isFocusedRef.current) return;
    const nextState = (manager as any)?.createState?.({ content: nextDoc as any });
    const view = (manager as any)?.view;
    if (nextState && typeof view?.updateState === "function") {
      view.updateState(nextState);
      latestDocRef.current = nextDoc;
      lastCommittedDocJsonRef.current = nextJson;
    }
  }, [manager, value]);

  const handleChange = React.useCallback(
    (param: any) => {
      onChange(param);
      const doc =
        ((manager as any)?.view?.state?.doc?.toJSON?.() as RemirrorJSON | undefined) ??
        ensureRemirrorDoc(undefined as any);
      const nextDoc = ensureRemirrorDoc(doc as any);
      latestDocRef.current = nextDoc;
    },
    [manager, onChange],
  );

  const commitLatestDoc = React.useCallback(() => {
    const nextJson = JSON.stringify(latestDocRef.current);
    if (nextJson === lastCommittedDocJsonRef.current) return false;
    lastCommittedDocJsonRef.current = nextJson;
    lastExternalDocJsonRef.current = nextJson;
    onChangeDoc(latestDocRef.current);
    return true;
  }, [onChangeDoc]);

  React.useEffect(() => {
    if (!onRegisterFlush) return undefined;
    return onRegisterFlush(testId, commitLatestDoc);
  }, [commitLatestDoc, onRegisterFlush, testId]);

  return (
    <div
      className="dasti-rich dasti-rich--cv-reading-measure"
      data-cv-drawer-rich-editor="true"
      data-testid={testId}
      aria-label={ariaLabel}
      onFocusCapture={() => {
        isFocusedRef.current = true;
      }}
      onBlurCapture={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        isFocusedRef.current = false;
        commitLatestDoc();
      }}
    >
      <Remirror manager={manager} initialContent={state} onChange={handleChange}>
        <div className="rich-content">
          <div className="dasti-cv-rich-editor-toolbar-row">
            <EditorToolbar position="top" showLists={showLists} />
            {toolbarTrailing ? (
              <div className="dasti-cv-rich-editor-toolbar-row__trailing">
                {toolbarTrailing}
              </div>
            ) : null}
          </div>
          <EditorComponent />
        </div>
      </Remirror>
    </div>
  );
}

function getSectionDraftKey(section: CvSection | null): string | null {
  if (!section) return null;
  if (section.id) return String(section.id);
  return `${section.type}:${section.title}`;
}

function getSectionDraftSignature(section: CvSection | null): string | null {
  if (!section) return null;
  try {
    return JSON.stringify({
      id: section.id ?? null,
      type: section.type,
      title: section.title,
      blocks: section.blocks ?? [],
      structuredContent: section.structuredContent ?? [],
    });
  } catch {
    return `${section.id ?? ""}:${section.type}:${section.title}`;
  }
}

function collectPlainText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(collectPlainText).filter(Boolean).join("\n");
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (record.type === "hardBreak") return "\n";
  if (typeof record.text === "string") return record.text;
  if (Array.isArray(record.content)) {
    const separator =
      record.type === "doc" || record.type === "bulletList" || record.type === "listItem"
        ? "\n"
        : "";
    return record.content.map(collectPlainText).filter(Boolean).join(separator);
  }
  return Object.entries(record)
    .filter(([key]) => !["type", "attrs", "id"].includes(key))
    .map(([, entry]) => collectPlainText(entry))
    .filter(Boolean)
    .join("\n");
}

function getStructuredItems(section: CvSection | null): Array<Record<string, unknown>> {
  return Array.isArray(section?.structuredContent)
    ? (section.structuredContent as Array<Record<string, unknown>>)
    : [];
}

function updateStructuredItem(
  section: CvSection,
  itemIndex: number,
  patch: Record<string, unknown>,
): CvSection {
  const items = getStructuredItems(section);
  return {
    ...section,
    structuredContent: items.map((item, index) =>
      index === itemIndex ? { ...item, ...patch } : item,
    ) as CvSection["structuredContent"],
  };
}

function updateTextBlock(section: CvSection, value: string): CvSection {
  return updateTextBlockDoc(section, ensureRemirrorDoc(value), value);
}

function updateTextBlockDoc(
  section: CvSection,
  doc: RemirrorJSON,
  plainText = remirrorJsonToString(doc),
): CvSection {
  const firstBlock = section.blocks[0];
  return {
    ...section,
    blocks: [
      {
        ...(firstBlock ?? {
          id: `block-${section.id ?? section.type}`,
          type: "text" as const,
          title: section.title,
          attributes: {},
        }),
        content: doc,
        plainText,
      },
      ...section.blocks.slice(1),
    ],
  };
}

function readSectionText(section: CvSection): string {
  const structuredItems = getStructuredItems(section);
  if (section.type === "summary") {
    return collectPlainText(structuredItems[0]?.summary ?? section.blocks[0]?.content);
  }
  return collectPlainText(section.blocks[0]?.plainText ?? section.blocks[0]?.content);
}

function splitSuggestionLines(value: string): string[] {
  return value
    .split(/\r?\n|[•·]/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function readAiResultText(result: unknown): string {
  if (typeof result === "string") return result.trim();
  const record = result && typeof result === "object"
    ? (result as Record<string, unknown>)
    : null;
  if (!record) return "";
  if (typeof record.text === "string") {
    return record.text.trim();
  }
  if (record.kind === "list" && Array.isArray(record.items)) {
    return record.items.map((item) => String(item ?? "").trim()).filter(Boolean).join("\n");
  }
  return "";
}

function cleanProjectDescriptionAiText(value: string): string {
  const unfenced = value
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const descriptionMatch = unfenced.match(
    /(?:^|\n)\s*(?:\*\*)?description(?:\*\*)?\s*:\s*([\s\S]*)$/i,
  );
  const descriptionOnly = descriptionMatch?.[1] ?? unfenced;
  return descriptionOnly
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/\*\*/g, "")
        .replace(
          /^\s*(project|name|stack|tech stack|technologies)\s*:\s*.*$/i,
          "",
        )
        .trimEnd(),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textInputLabel(sectionTitle: string, label: string) {
  void sectionTitle;
  return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : label;
}

function isPillSection(section: CvSection | null): boolean {
  if (!section) return false;
  return (
    section.type === "skills" ||
    section.type === "languages" ||
    String(section.type) === "hobbies" ||
    section.title.trim().toLowerCase() === "hobbies"
  );
}

const SKILL_LEVELS: readonly Level[] = [
  "Beginner",
  "Elementary",
  "Intermediate",
  "Advanced",
  "Fluent",
];

const SKILL_BUCKETS: readonly SkillBucket[] = ["core", "secondary", "familiar"];

function isSkillLevel(value: unknown): value is Level {
  return typeof value === "string" && SKILL_LEVELS.some((level) => level === value);
}

function isSkillBucket(value: unknown): value is SkillBucket {
  return typeof value === "string" && SKILL_BUCKETS.some((bucket) => bucket === value);
}

function getPillItemName(item: Record<string, unknown>): string {
  return String(item.name ?? "").trim();
}

function getOptionalString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function toSkillItem(item: Record<string, unknown>): ISkillItem | null {
  const name = getPillItemName(item);
  if (!name) return null;

  return {
    ...item,
    id: getOptionalString(item.id),
    name,
    level: isSkillLevel(item.level) ? item.level : "Intermediate",
    bucket: isSkillBucket(item.bucket) ? item.bucket : undefined,
    categoryId: getOptionalString(item.categoryId),
  };
}

function sanitizeSectionForSave(section: CvSection | null): CvSection | null {
  if (!section || !isPillSection(section)) return section;
  return {
    ...section,
    structuredContent: getStructuredItems(section).filter((item) =>
      Boolean(getPillItemName(item)),
    ) as CvSection["structuredContent"],
  };
}

function readEducationAiFields(
  value: string,
  currentItem: Record<string, unknown>,
): Record<string, string> {
  const next = {
    degree: String(currentItem.degree ?? ""),
    institution: String(currentItem.institution ?? ""),
    fieldOfStudy: String(currentItem.fieldOfStudy ?? ""),
  };

  for (const line of value.split(/\r?\n/)) {
    const match = line.match(/^\s*(degree|school|institution|field)\s*:\s*(.*?)\s*$/i);
    if (!match) continue;
    const [, rawKey, rawValue] = match;
    const key = rawKey.toLowerCase();
    if (key === "degree") next.degree = rawValue;
    if (key === "school" || key === "institution") next.institution = rawValue;
    if (key === "field") next.fieldOfStudy = rawValue;
  }

  return next;
}


function Field({
  label,
  value,
  onChange,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <label className="dasti-cv-section-field">
      <span>{label}</span>
      <input
        className="ds-field"
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function CompactAppliedAiStatus({ onUndo }: { onUndo: () => void }) {
  return (
    <div
      role="status"
      aria-label="Applied. Undo"
      className="dasti-ai-applied-status"
    >
      <span>Applied.</span>
      <button
        type="button"
        className="dasti-ai-applied-status__undo"
        onClick={onUndo}
      >
        Undo
      </button>
    </div>
  );
}

function AiHelperAction({
  label,
  loadingLabel,
  isLoading = false,
  ariaLabel,
  disabled,
  onClick,
}: {
  label: string;
  loadingLabel?: string;
  isLoading?: boolean;
  ariaLabel?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const visibleLabel = isLoading ? (loadingLabel ?? label) : label;
  return (
    <button
      type="button"
      className="dasti-cv-ai-helper-action"
      aria-label={ariaLabel ?? label}
      title={ariaLabel ?? label}
      disabled={disabled || isLoading}
      onClick={onClick}
    >
      <Wand2 size={13} strokeWidth={1.8} aria-hidden="true" />
      <span>{visibleLabel}</span>
    </button>
  );
}

export function SectionEditorSheet({
  open,
  section,
  aiSuggestion,
  isAiRunning = false,
  onOpenChange,
  onSave,
  summaryAiEvidence,
  onRunListAiSuggestion,
  onAcceptListAiSuggestion,
  onDismissListAiSuggestion,
  onClearListAiSuggestions,
  stageAligned = false,
}: SectionEditorSheetProps): JSX.Element {
  const runCvSectionAiAction = useAction(
    ((api.functions as any)?.runCvSectionAiAction ??
      "functions.runCvSectionAiAction") as any,
  );
  const { showToast } = useToast();
  const [draftSection, setDraftSection] = React.useState<CvSection | null>(section);
  const [fieldAiLoadingKey, setFieldAiLoadingKey] = React.useState<string | null>(null);
  const [fieldAiSuggestion, setFieldAiSuggestion] =
    React.useState<FieldAiSuggestion | null>(null);
  const [summaryAiSuggestion, setSummaryAiSuggestion] =
    React.useState<SummaryAiSuggestion | null>(null);
  const [acceptedAiEdit, setAcceptedAiEdit] =
    React.useState<AcceptedAiEdit | null>(null);
  const [isSummaryAiLoading, setIsSummaryAiLoading] = React.useState(false);
  const [newPillValue, setNewPillValue] = React.useState("");
  const latestSectionRef = React.useRef(section);
  const draftSectionRef = React.useRef<CvSection | null>(section);
  const openedSectionRef = React.useRef<CvSection | null>(section);
  const loadedDraftKeyRef = React.useRef<string | null>(null);
  const loadedDraftSignatureRef = React.useRef<string | null>(
    getSectionDraftSignature(section),
  );
  const previousOpenRef = React.useRef(open);
  const pillInputRef = React.useRef<HTMLInputElement | null>(null);
  const autosaveTimerRef = React.useRef<number | null>(null);
  const pendingAutosaveSectionRef = React.useRef<CvSection | null>(null);
  const richEditorFlushersRef = React.useRef(new Map<string, () => boolean>());

  latestSectionRef.current = section;

  const sectionDraftKey = getSectionDraftKey(section);
  const sectionDraftSignature = getSectionDraftSignature(section);

  function resetAiState() {
    setFieldAiLoadingKey(null);
    setFieldAiSuggestion(null);
    setSummaryAiSuggestion(null);
    setAcceptedAiEdit(null);
    setIsSummaryAiLoading(false);
    setNewPillValue("");
  }

  function clearAutosaveTimer() {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }

  function flushAutosave() {
    clearAutosaveTimer();
    if (!pendingAutosaveSectionRef.current) return;
    onSave?.(sanitizeSectionForSave(pendingAutosaveSectionRef.current));
    pendingAutosaveSectionRef.current = null;
  }

  const registerDrawerRichEditorFlush = React.useCallback(
    (key: string, flush: () => boolean) => {
      richEditorFlushersRef.current.set(key, flush);
      return () => {
        if (richEditorFlushersRef.current.get(key) === flush) {
          richEditorFlushersRef.current.delete(key);
        }
      };
    },
    [],
  );

  function flushDrawerRichEditors() {
    for (const flush of richEditorFlushersRef.current.values()) {
      flush();
    }
  }

  React.useEffect(() => () => clearAutosaveTimer(), []);

  React.useEffect(() => {
    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = open;

    if (!open) {
      loadedDraftKeyRef.current = null;
      loadedDraftSignatureRef.current = sectionDraftSignature;
      draftSectionRef.current = latestSectionRef.current;
      setDraftSection(latestSectionRef.current);
      resetAiState();
      return;
    }

    const sourceSectionChanged =
      loadedDraftSignatureRef.current !== sectionDraftSignature;
    const localDraftSectionSignature = getSectionDraftSignature(draftSectionRef.current);
    const sourceSectionChangedFromLocalDraft =
      localDraftSectionSignature === sectionDraftSignature;
    if (
      !wasOpen ||
      loadedDraftKeyRef.current !== sectionDraftKey ||
      (sourceSectionChanged &&
        !pendingAutosaveSectionRef.current &&
        !sourceSectionChangedFromLocalDraft)
    ) {
      loadedDraftKeyRef.current = sectionDraftKey;
      loadedDraftSignatureRef.current = sectionDraftSignature;
      openedSectionRef.current = latestSectionRef.current;
      draftSectionRef.current = latestSectionRef.current;
      setDraftSection(latestSectionRef.current);
      resetAiState();
    }
  }, [open, sectionDraftKey, sectionDraftSignature]);

  const editableSection = draftSection ?? section;
  const title = formatSectionDisplayTitle(editableSection, {
    fallback: "Section",
  });
  const structuredItems = getStructuredItems(editableSection);
  const itemCount = isPillSection(editableSection)
    ? structuredItems.filter((item) => Boolean(getPillItemName(item))).length
    : getSectionItemCount(editableSection);

  function commitSection(
    nextSection: CvSection,
    options?: { preserveAcceptedAi?: boolean },
  ) {
    draftSectionRef.current = nextSection;
    setDraftSection(nextSection);
    pendingAutosaveSectionRef.current = nextSection;
    clearAutosaveTimer();
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      if (!pendingAutosaveSectionRef.current) return;
      onSave?.(sanitizeSectionForSave(pendingAutosaveSectionRef.current));
      pendingAutosaveSectionRef.current = null;
    }, 350);
    if (!options?.preserveAcceptedAi) {
      setAcceptedAiEdit(null);
    }
  }

  function revertChanges() {
    clearAutosaveTimer();
    pendingAutosaveSectionRef.current = null;
    const restoredSection = openedSectionRef.current ?? section;
    draftSectionRef.current = restoredSection;
    setDraftSection(restoredSection);
    onSave?.(sanitizeSectionForSave(restoredSection));
    setFieldAiSuggestion(null);
    setSummaryAiSuggestion(null);
    setAcceptedAiEdit(null);
    setIsSummaryAiLoading(false);
    setNewPillValue("");
  }

  function saveAndClose() {
    flushDrawerRichEditors();
    clearAutosaveTimer();
    const sectionToSave =
      pendingAutosaveSectionRef.current ??
      draftSectionRef.current ??
      editableSection ??
      null;
    pendingAutosaveSectionRef.current = null;
    onSave?.(sanitizeSectionForSave(sectionToSave));
    setSummaryAiSuggestion(null);
    setAcceptedAiEdit(null);
    onOpenChange(false);
  }

  function undoAcceptedAiEdit() {
    if (!acceptedAiEdit) return;
    commitSection(acceptedAiEdit.beforeSection, { preserveAcceptedAi: true });
    onSave?.(sanitizeSectionForSave(acceptedAiEdit.beforeSection));
    setAcceptedAiEdit(null);
  }

  function addExperienceEntry() {
    if (!editableSection) return;
    commitSection({
      ...editableSection,
      structuredContent: [
        ...structuredItems,
        {
          id: `experience-${Date.now()}`,
          company: "",
          position: "",
          startDate: "",
          endDate: null,
          responsibilities: ensureRemirrorDoc(""),
        },
      ] as CvSection["structuredContent"],
    });
  }

  function addEducationEntry() {
    if (!editableSection) return;
    commitSection({
      ...editableSection,
      structuredContent: [
        ...structuredItems,
        {
          id: `education-${Date.now()}`,
          institution: "",
          degree: "",
          fieldOfStudy: "",
        },
      ] as CvSection["structuredContent"],
    });
  }

  function addProjectEntry() {
    if (!editableSection) return;
    commitSection({
      ...editableSection,
      structuredContent: [
        ...structuredItems,
        {
          id: `project-${Date.now()}`,
          title: "",
          meta: "",
          description: "",
        },
      ] as CvSection["structuredContent"],
    });
  }

  function addAchievementEntry() {
    if (!editableSection) return;
    commitSection({
      ...editableSection,
      structuredContent: [
        ...structuredItems,
        {
          id: `achievement-${Date.now()}`,
          text: "",
        },
      ] as CvSection["structuredContent"],
    });
  }

  function addCertificationEntry() {
    if (!editableSection) return;
    commitSection({
      ...editableSection,
      structuredContent: [
        ...structuredItems,
        {
          id: `certification-${Date.now()}`,
          certificationName: "",
          issuingOrganization: "",
          issueDate: "",
          expirationDate: null,
          credentialId: "",
        },
      ] as CvSection["structuredContent"],
    });
  }

  async function runExperienceResponsibilitiesAi(itemIndex: number) {
    if (!editableSection) return;
    if (typeof runCvSectionAiAction !== "function") {
      showToast("AI unavailable.", { variant: "warning" });
      return;
    }
    const item = structuredItems[itemIndex];
    const itemKey = String(item?.id ?? itemIndex);
    const beforeText = collectPlainText(item?.responsibilities).trim();
    if (!beforeText) {
      showToast("Add responsibilities before using AI.", { variant: "warning" });
      return;
    }

    try {
      setFieldAiLoadingKey(`experience:${itemKey}`);
      setFieldAiSuggestion(null);
      setAcceptedAiEdit(null);
      const result = await runCvSectionAiAction({
        action: "improve_experience_responsibilities",
        existingText: beforeText,
        outputShape: beforeText.includes("\n") ? "list" : "paragraph",
      });
      const afterText = readAiResultText(result);
      if (!afterText) {
        showToast("AI returned no usable suggestion.", { variant: "warning" });
        return;
      }
      setFieldAiSuggestion({
        key: `experience:${itemKey}`,
        sectionType: "experience",
        itemIndex,
        beforeText,
        afterText,
      });
    } catch (error) {
      console.error("[SectionEditorSheet] improve_experience_responsibilities failed", error);
      showToast("AI unavailable.", { variant: "error" });
    } finally {
      setFieldAiLoadingKey(null);
    }
  }

  async function runAchievementLineAi(itemIndex: number) {
    if (!editableSection) return;
    if (typeof runCvSectionAiAction !== "function") {
      showToast("AI unavailable.", { variant: "warning" });
      return;
    }
    const item = structuredItems[itemIndex];
    const itemKey = String(item?.id ?? itemIndex);
    const beforeText = String(item?.text ?? "").trim();
    if (!beforeText) {
      showToast("Add an achievement before using AI.", { variant: "warning" });
      return;
    }

    try {
      setFieldAiLoadingKey(`achievements:${itemKey}`);
      setFieldAiSuggestion(null);
      setAcceptedAiEdit(null);
      const result = await runCvSectionAiAction({
        action: "improve_achievement_line",
        existingText: beforeText,
      });
      const afterText = readAiResultText(result);
      if (!afterText) {
        showToast("AI returned no usable suggestion.", { variant: "warning" });
        return;
      }
      setFieldAiSuggestion({
        key: `achievements:${itemKey}`,
        sectionType: "achievements",
        itemIndex,
        beforeText,
        afterText,
      });
    } catch (error) {
      console.error("[SectionEditorSheet] improve_achievement_line failed", error);
      showToast("AI unavailable.", { variant: "error" });
    } finally {
      setFieldAiLoadingKey(null);
    }
  }

  async function runEducationSyntaxAi(itemIndex: number) {
    if (!editableSection) return;
    if (typeof runCvSectionAiAction !== "function") {
      showToast("AI unavailable.", { variant: "warning" });
      return;
    }
    const item = structuredItems[itemIndex];
    const itemKey = String(item?.id ?? itemIndex);
    const beforeText = [
      `Degree: ${String(item?.degree ?? "").trim()}`,
      `School: ${String(item?.institution ?? "").trim()}`,
      `Field: ${String(item?.fieldOfStudy ?? "").trim()}`,
    ].join("\n");
    if (
      ![
        item?.degree,
        item?.institution,
        item?.fieldOfStudy,
      ].some((entry) => String(entry ?? "").trim())
    ) {
      showToast("Add education text before using AI.", { variant: "warning" });
      return;
    }

    try {
      setFieldAiLoadingKey(`education:${itemKey}`);
      setFieldAiSuggestion(null);
      setAcceptedAiEdit(null);
      const result = await runCvSectionAiAction({
        action: "fix_education_entry",
        existingText: beforeText,
      });
      const afterText = readAiResultText(result);
      if (!afterText) {
        showToast("AI returned no usable suggestion.", { variant: "warning" });
        return;
      }
      setFieldAiSuggestion({
        key: `education:${itemKey}`,
        sectionType: "education",
        itemIndex,
        beforeText,
        afterText,
      });
    } catch (error) {
      console.error("[SectionEditorSheet] fix_education_entry failed", error);
      showToast("AI unavailable.", { variant: "error" });
    } finally {
      setFieldAiLoadingKey(null);
    }
  }

  async function runProjectDescriptionAi(itemIndex: number) {
    if (!editableSection) return;
    if (typeof runCvSectionAiAction !== "function") {
      showToast("AI unavailable.", { variant: "warning" });
      return;
    }
    const item = structuredItems[itemIndex];
    const itemKey = String(item?.id ?? itemIndex);
    const description = collectPlainText(item?.description ?? item?.summary).trim();
    if (!description) {
      showToast("Add a project description before using AI.", { variant: "warning" });
      return;
    }

    try {
      setFieldAiLoadingKey(`projects:${itemKey}`);
      setFieldAiSuggestion(null);
      setAcceptedAiEdit(null);
      const result = await runCvSectionAiAction({
        action: "improve_project_description",
        existingText: description,
      });
      const afterText = cleanProjectDescriptionAiText(readAiResultText(result));
      if (!afterText) {
        showToast("AI returned no usable suggestion.", { variant: "warning" });
        return;
      }
      setFieldAiSuggestion({
        key: `projects:${itemKey}`,
        sectionType: "projects",
        itemIndex,
        beforeText: description,
        afterText,
      });
    } catch (error) {
      console.error("[SectionEditorSheet] improve_project_description failed", error);
      showToast("AI unavailable.", { variant: "error" });
    } finally {
      setFieldAiLoadingKey(null);
    }
  }

  async function runTextSectionAi() {
    if (!editableSection) return;
    if (typeof runCvSectionAiAction !== "function") {
      showToast("AI unavailable.", { variant: "warning" });
      return;
    }
    const beforeText = readSectionText(editableSection).trim();
    if (!beforeText) {
      showToast("Add text before using AI.", { variant: "warning" });
      return;
    }
    const suggestionKey = `text:${getSectionDraftKey(editableSection) ?? "section"}`;

    try {
      setFieldAiLoadingKey(suggestionKey);
      setFieldAiSuggestion(null);
      setAcceptedAiEdit(null);
      const result = await runCvSectionAiAction({
        action: "improve_custom_text",
        existingText: beforeText,
      });
      const afterText = readAiResultText(result);
      if (!afterText) {
        showToast("AI returned no usable suggestion.", { variant: "warning" });
        return;
      }
      setFieldAiSuggestion({
        key: suggestionKey,
        sectionType: "text",
        itemIndex: 0,
        beforeText,
        afterText,
      });
    } catch (error) {
      console.error("[SectionEditorSheet] improve_custom_text failed", error);
      showToast("AI unavailable.", { variant: "error" });
    } finally {
      setFieldAiLoadingKey(null);
    }
  }

  function acceptFieldAiSuggestion() {
    if (!editableSection || !fieldAiSuggestion) return;
    const beforeSection = editableSection;
    let nextSection: CvSection;
    if (fieldAiSuggestion.sectionType === "experience") {
      const nextLines = splitSuggestionLines(fieldAiSuggestion.afterText);
      nextSection = updateStructuredItem(editableSection, fieldAiSuggestion.itemIndex, {
          responsibilities: ensureRemirrorDoc(fieldAiSuggestion.afterText),
          ...(nextLines.length > 1 ? { responsibilityBullets: nextLines } : {}),
      });
    } else if (fieldAiSuggestion.sectionType === "projects") {
      nextSection = updateStructuredItem(editableSection, fieldAiSuggestion.itemIndex, {
          description: ensureRemirrorDoc(
            cleanProjectDescriptionAiText(fieldAiSuggestion.afterText),
          ),
      });
    } else if (fieldAiSuggestion.sectionType === "education") {
      nextSection = updateStructuredItem(
          editableSection,
          fieldAiSuggestion.itemIndex,
          readEducationAiFields(
            fieldAiSuggestion.afterText,
            structuredItems[fieldAiSuggestion.itemIndex] ?? {},
          ),
      );
    } else if (fieldAiSuggestion.sectionType === "text") {
      nextSection = updateTextBlock(editableSection, fieldAiSuggestion.afterText);
    } else {
      nextSection = updateStructuredItem(editableSection, fieldAiSuggestion.itemIndex, {
          text: fieldAiSuggestion.afterText,
      });
    }
    commitSection(nextSection, { preserveAcceptedAi: true });
    onSave?.(sanitizeSectionForSave(nextSection));
    setAcceptedAiEdit({
      key: fieldAiSuggestion.key,
      beforeSection,
    });
    setFieldAiSuggestion(null);
  }

  async function runSummaryRewriteAi() {
    if (!editableSection) return;
    if (typeof runCvSectionAiAction !== "function") {
      showToast("AI unavailable.", { variant: "warning" });
      return;
    }
    const beforeText = readSectionText(editableSection).trim();

    try {
      setIsSummaryAiLoading(true);
      setSummaryAiSuggestion(null);
      setAcceptedAiEdit(null);
      const result = await runCvSectionAiAction({
        action: beforeText ? "improve_summary_text" : "rewrite_summary_from_profile",
        existingText: beforeText,
        summary: beforeText || summaryAiEvidence?.summary,
        skills: summaryAiEvidence?.skills ?? [],
        experiences: summaryAiEvidence?.experiences ?? [],
        educations: summaryAiEvidence?.educations ?? [],
        languages: summaryAiEvidence?.languages ?? [],
      });
      const afterText = readAiResultText(result);
      if (!afterText) {
        showToast("AI returned no usable suggestion.", { variant: "warning" });
        return;
      }
      setSummaryAiSuggestion({
        beforeText: beforeText || "No summary yet.",
        afterText,
      });
    } catch (error) {
      console.error("[SectionEditorSheet] summary AI failed", error);
      showToast("AI unavailable.", { variant: "error" });
    } finally {
      setIsSummaryAiLoading(false);
    }
  }

  function acceptSummaryAiSuggestion() {
    if (!editableSection || !summaryAiSuggestion) return;
    const nextText = summaryAiSuggestion.afterText;
    const nextSection = updateTextBlock(
        updateStructuredItem(editableSection, 0, {
          summary: nextText,
        }),
        nextText,
    );
    commitSection(nextSection, { preserveAcceptedAi: true });
    onSave?.(sanitizeSectionForSave(nextSection));
    setAcceptedAiEdit({
      key: "summary",
      beforeSection: editableSection,
    });
    setSummaryAiSuggestion(null);
  }

  function renderProfileEditor() {
    if (!editableSection) return null;
    const item = structuredItems[0] ?? {};
    return (
      <div className="dasti-cv-section-grid">
        {[
          ["Name", "name"],
          ["Target Role", "desiredPosition"],
          ["Email", "email"],
          ["Phone", "phone"],
          ["Location", "location"],
          ["LinkedIn", "linkedin"],
          ["Website", "website"],
        ].map(([label, key]) => (
          <Field
            key={key}
            label={textInputLabel(title, label)}
            value={String(item[key] ?? "")}
            onChange={(value) =>
              commitSection(updateStructuredItem(editableSection, 0, { [key]: value }))
            }
          />
        ))}
      </div>
    );
  }

  function renderSummaryEditor() {
    if (!editableSection) return null;
    return (
      <div className="dasti-cv-section-stack">
        <div className="dasti-cv-section-field dasti-cv-section-field--wide">
          <span className="sr-only">{textInputLabel(title, "body")}</span>
          <DrawerRichTextEditor
            key={`${String(editableSection.id ?? "summary")}:summary`}
            ariaLabel="Summary body"
            testId="drawer-rich-editor-summary"
            showLists={false}
            toolbarTrailing={
              <AiHelperAction
                label="Rewrite"
                loadingLabel="Rewriting"
                isLoading={isSummaryAiLoading}
                ariaLabel="Rewrite summary"
                onClick={() => void runSummaryRewriteAi()}
              />
            }
            onRegisterFlush={registerDrawerRichEditorFlush}
            value={
              getStructuredItems(editableSection)[0]?.summary ??
              editableSection.blocks[0]?.content ??
              readSectionText(editableSection)
            }
            onChangeDoc={(doc) => {
              const nextSection = updateStructuredItem(editableSection, 0, {
                summary: doc,
              });
              commitSection(updateTextBlockDoc(nextSection, doc));
            }}
          />
        </div>
        {summaryAiSuggestion ? (
          <AiSuggestionCard
            compact
            actionLabel="Apply"
            title="Suggested summary"
            beforeText={summaryAiSuggestion.beforeText}
            afterText={summaryAiSuggestion.afterText}
            onAccept={acceptSummaryAiSuggestion}
            onDiscard={() => setSummaryAiSuggestion(null)}
          />
        ) : null}
        {acceptedAiEdit?.key === "summary" ? (
          <CompactAppliedAiStatus onUndo={undoAcceptedAiEdit} />
        ) : null}
      </div>
    );
  }

  function renderExperienceEditor() {
    if (!editableSection) return null;
    return (
      <div className="dasti-cv-section-stack">
        {structuredItems.map((item, index) => (
          <section className="dasti-cv-section-card" key={String(item.id ?? index)}>
            <div className="dasti-cv-section-card__head">
              <strong>{`Entry ${index + 1}`}</strong>
            </div>
            <Field
              label={`Role ${index + 1}`}
              value={String(item.position ?? "")}
              onChange={(value) =>
                commitSection(updateStructuredItem(editableSection, index, { position: value }))
              }
            />
            <Field
              label={`Company ${index + 1}`}
              value={String(item.company ?? "")}
              onChange={(value) =>
                commitSection(updateStructuredItem(editableSection, index, { company: value }))
              }
            />
            <Field
              label={`Dates ${index + 1}`}
              value={[item.startDate, item.endDate].filter(Boolean).join(" - ")}
              readOnly
              onChange={() => {}}
            />
            <div className="dasti-cv-section-field dasti-cv-section-field--wide">
              <div className="dasti-cv-section-field__topline">
                <span>{`Responsibilities ${index + 1}`}</span>
                <AiHelperAction
                  label="Improve"
                  loadingLabel="Improving"
                  isLoading={fieldAiLoadingKey === `experience:${String(item.id ?? index)}`}
                  disabled={fieldAiLoadingKey === `experience:${String(item.id ?? index)}`}
                  ariaLabel="Improve responsibilities"
                  onClick={() => void runExperienceResponsibilitiesAi(index)}
                />
              </div>
              <DrawerRichTextEditor
                key={`${String(item.id ?? index)}:responsibilities`}
                ariaLabel={`Responsibilities ${index + 1}`}
                testId={`drawer-rich-editor-experience-responsibilities-${index}`}
                onRegisterFlush={registerDrawerRichEditorFlush}
                value={item.responsibilities ?? ""}
                onChangeDoc={(doc) => {
                  const projection = projectResponsibilitiesForWorkshop(doc);
                  commitSection(
                    updateStructuredItem(editableSection, index, {
                      responsibilities: doc,
                      responsibilityBullets:
                        projection.bullets.length > 0 ? projection.bullets : undefined,
                      achievements: [],
                    }),
                  );
                }}
              />
            </div>
            {fieldAiSuggestion?.key === `experience:${String(item.id ?? index)}` ? (
              <AiSuggestionCard
                compact
                actionLabel="Improve"
                title={`Suggested responsibilities for experience ${index + 1}`}
                beforeText={fieldAiSuggestion.beforeText}
                afterText={fieldAiSuggestion.afterText}
                onAccept={acceptFieldAiSuggestion}
                onDiscard={() => setFieldAiSuggestion(null)}
              />
            ) : null}
            {acceptedAiEdit?.key === `experience:${String(item.id ?? index)}` ? (
              <CompactAppliedAiStatus onUndo={undoAcceptedAiEdit} />
            ) : null}
          </section>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="md"
          iconLeft={<Plus size={14} strokeWidth={1.8} />}
          onClick={addExperienceEntry}
        >
          Add experience entry
        </Button>
      </div>
    );
  }

  function renderEducationEditor() {
    if (!editableSection) return null;
    return (
      <div className="dasti-cv-section-stack">
        {structuredItems.map((item, index) => {
          const itemKey = String(item.id ?? index);
          return (
          <section className="dasti-cv-section-card" key={itemKey}>
            <div className="dasti-cv-section-card__head">
              <strong>{`Entry ${index + 1}`}</strong>
              <AiHelperAction
                label="Fix"
                loadingLabel="Fixing"
                isLoading={fieldAiLoadingKey === `education:${itemKey}`}
                disabled={fieldAiLoadingKey === `education:${itemKey}`}
                ariaLabel="Fix education"
                onClick={() => void runEducationSyntaxAi(index)}
              />
            </div>
            <Field
              label={`Degree ${index + 1}`}
              value={String(item.degree ?? "")}
              onChange={(value) =>
                commitSection(updateStructuredItem(editableSection, index, { degree: value }))
              }
            />
            <Field
              label={`School ${index + 1}`}
              value={String(item.institution ?? "")}
              onChange={(value) =>
                commitSection(updateStructuredItem(editableSection, index, { institution: value }))
              }
            />
            <Field
              label={`Field ${index + 1}`}
              value={String(item.fieldOfStudy ?? "")}
              onChange={(value) =>
                commitSection(updateStructuredItem(editableSection, index, { fieldOfStudy: value }))
              }
            />
            {fieldAiSuggestion?.key === `education:${String(item.id ?? index)}` ? (
              <AiSuggestionCard
                compact
                actionLabel="Fix"
                title={`Suggested education ${index + 1}`}
                beforeText={fieldAiSuggestion.beforeText}
                afterText={fieldAiSuggestion.afterText}
                onAccept={acceptFieldAiSuggestion}
                onDiscard={() => setFieldAiSuggestion(null)}
              />
            ) : null}
            {acceptedAiEdit?.key === `education:${String(item.id ?? index)}` ? (
              <CompactAppliedAiStatus onUndo={undoAcceptedAiEdit} />
            ) : null}
          </section>
          );
        })}
        <Button
          type="button"
          variant="secondary"
          size="md"
          iconLeft={<Plus size={14} strokeWidth={1.8} />}
          onClick={addEducationEntry}
        >
          Add education entry
        </Button>
      </div>
    );
  }

  function renderProjectEditor() {
    if (!editableSection) return null;
    return (
      <div className="dasti-cv-section-stack">
        {structuredItems.map((item, index) => (
          <section className="dasti-cv-section-card" key={String(item.id ?? index)}>
            <div className="dasti-cv-section-card__head">
              <strong>{`Project ${index + 1}`}</strong>
            </div>
            <Field
              label={`Name ${index + 1}`}
              value={String(item.title ?? item.name ?? "")}
              onChange={(value) =>
                commitSection(updateStructuredItem(editableSection, index, { title: value }))
              }
            />
            <Field
              label={`Stack ${index + 1}`}
              value={String(item.meta ?? item.subtitle ?? "")}
              onChange={(value) =>
                commitSection(updateStructuredItem(editableSection, index, { meta: value }))
              }
            />
            <div className="dasti-cv-section-field dasti-cv-section-field--wide">
              <div className="dasti-cv-section-field__topline">
                <span>{`Description ${index + 1}`}</span>
                <AiHelperAction
                  label="Improve"
                  loadingLabel="Improving"
                  isLoading={fieldAiLoadingKey === `projects:${String(item.id ?? index)}`}
                  disabled={fieldAiLoadingKey === `projects:${String(item.id ?? index)}`}
                  ariaLabel="Improve description"
                  onClick={() => void runProjectDescriptionAi(index)}
                />
              </div>
              <DrawerRichTextEditor
                key={`${String(item.id ?? index)}:project-description`}
                ariaLabel={`Description ${index + 1}`}
                testId={`drawer-rich-editor-project-description-${index}`}
                onRegisterFlush={registerDrawerRichEditorFlush}
                value={item.description ?? item.summary}
                onChangeDoc={(doc) =>
                  commitSection(
                    updateStructuredItem(editableSection, index, {
                      description: doc,
                    }),
                  )
                }
              />
            </div>
            {fieldAiSuggestion?.key === `projects:${String(item.id ?? index)}` ? (
              <AiSuggestionCard
                compact
                actionLabel="Improve"
                title={`Suggested project ${index + 1}`}
                beforeText={fieldAiSuggestion.beforeText}
                afterText={fieldAiSuggestion.afterText}
                onAccept={acceptFieldAiSuggestion}
                onDiscard={() => setFieldAiSuggestion(null)}
              />
            ) : null}
            {acceptedAiEdit?.key === `projects:${String(item.id ?? index)}` ? (
              <CompactAppliedAiStatus onUndo={undoAcceptedAiEdit} />
            ) : null}
          </section>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="md"
          iconLeft={<Plus size={14} strokeWidth={1.8} />}
          onClick={addProjectEntry}
        >
          Add project entry
        </Button>
      </div>
    );
  }

  function renderPillEditor(keyName: "name") {
    if (!editableSection) return null;
    const sectionId = editableSection.id ? String(editableSection.id) : null;
    const scopedListSuggestion =
      sectionId &&
      aiSuggestion?.kind === "list" &&
      aiSuggestion.sectionId === sectionId
        ? aiSuggestion
        : null;

    const normalizedTitle = editableSection.title.trim().toLowerCase();
    const pillItems = structuredItems.filter((item) =>
      Boolean(getPillItemName(item)),
    );
    const labelBase =
      normalizedTitle === "hobbies"
        ? "hobby"
        : editableSection.type === "skills"
          ? "skill"
          : editableSection.type === "languages"
            ? "language"
            : "item";

    function addPill() {
      const value = newPillValue.trim();
      if (!value || !editableSection) return;
      const nextItem =
        editableSection.type === "languages"
          ? {
              id: `${editableSection.type}-${Date.now()}`,
              name: value,
              level: "Intermediate",
            }
          : { id: `${editableSection.type}-${Date.now()}`, name: value };
      commitSection({
        ...editableSection,
        structuredContent: [
          ...structuredItems.filter((item) => Boolean(getPillItemName(item))),
          nextItem,
        ] as CvSection["structuredContent"],
      });
      setNewPillValue("");
      window.requestAnimationFrame(() => {
        pillInputRef.current?.focus({ preventScroll: true });
      });
    }

    function acceptSuggestedPill(value: string) {
      if (!editableSection) return;
      const cleanValue = value.trim();
      if (!cleanValue) return;
      const existingItems = structuredItems.filter((item) =>
        Boolean(getPillItemName(item)),
      );
      const alreadyExists = existingItems.some(
        (item) =>
          String(item.name ?? "").trim().toLocaleLowerCase() ===
          cleanValue.toLocaleLowerCase(),
      );
      if (!alreadyExists) {
        const nextItem =
          editableSection.type === "languages"
            ? {
                id: `${editableSection.type}-${Date.now()}`,
                name: cleanValue,
                level: "Intermediate",
              }
            : { id: `${editableSection.type}-${Date.now()}`, name: cleanValue };
        commitSection({
          ...editableSection,
          structuredContent: [
            ...existingItems,
            nextItem,
          ] as CvSection["structuredContent"],
        });
      }
      onAcceptListAiSuggestion?.(cleanValue);
    }

    function clearSuggestedPills() {
      if (onClearListAiSuggestions) {
        onClearListAiSuggestions();
        return;
      }
      scopedListSuggestion?.items.forEach((item) => onDismissListAiSuggestion?.(item));
    }

    function removePill(indexToRemove: number) {
      if (!editableSection) return;
      commitSection({
        ...editableSection,
        structuredContent: structuredItems.filter(
          (_, index) => index !== indexToRemove,
        ) as CvSection["structuredContent"],
      });
    }

    return (
      <div className="dasti-cv-pill-editor">
        <form
          className="dasti-cv-pill-editor__input"
          onSubmit={(event) => {
            event.preventDefault();
            addPill();
          }}
        >
          <label className="dasti-cv-section-field dasti-cv-section-field--wide">
            <span className="sr-only">{labelBase.charAt(0).toUpperCase() + labelBase.slice(1)}</span>
            <input
              ref={pillInputRef}
              className="ds-field"
              aria-label={labelBase.charAt(0).toUpperCase() + labelBase.slice(1)}
              placeholder={labelBase.charAt(0).toUpperCase() + labelBase.slice(1)}
              value={newPillValue}
              onChange={(event) => setNewPillValue(event.currentTarget.value)}
            />
          </label>
          <Button
            type="submit"
            variant="secondary"
            size="md"
            disabled={!newPillValue.trim()}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
          >
            Add
          </Button>
          {sectionId && onRunListAiSuggestion ? (
            <AiHelperAction
              label={scopedListSuggestion ? "Refresh" : "Suggest"}
              loadingLabel="Suggesting"
              isLoading={isAiRunning}
              disabled={isAiRunning}
              ariaLabel={`${scopedListSuggestion ? "Refresh" : "Suggest"} ${labelBase}s`}
              onClick={() => onRunListAiSuggestion(sectionId)}
            />
          ) : null}
        </form>

        {scopedListSuggestion ? (
          <div
            className="dasti-cv-pill-suggestions"
            role="region"
            aria-label={`Suggested items for ${scopedListSuggestion.sectionLabel}`}
            data-state={scopedListSuggestion.state}
          >
            <div className="dasti-cv-pill-suggestions__title">
              {`Suggested ${labelBase}s`}
            </div>
            {scopedListSuggestion.state === "loading" ? (
              <p className="dasti-cv-pill-editor__empty">
                Generating suggestions<span className="ds-btn__period">.</span>
              </p>
            ) : scopedListSuggestion.state === "error" ? (
              <p className="dasti-cv-pill-editor__empty">
                {scopedListSuggestion.errorMessage ?? "AI suggestions are unavailable."}
              </p>
            ) : scopedListSuggestion.items.length > 0 ? (
              <>
                <div className="dasti-cv-pill-suggestions__chips">
                  {scopedListSuggestion.items.map((item) => (
                    <button
                      className="dasti-cv-pill-suggestions__chip"
                      key={item}
                      type="button"
                      aria-label={`Add suggested item ${item}`}
                      onClick={() => acceptSuggestedPill(item)}
                    >
                      <Plus size={13} strokeWidth={1.8} aria-hidden="true" />
                      <span>{item}</span>
                    </button>
                  ))}
                </div>
                {onDismissListAiSuggestion ? (
                  <button
                    type="button"
                    className="dasti-cv-ai-helper-action dasti-cv-pill-suggestions__clear"
                    onClick={clearSuggestedPills}
                  >
                    Clear suggestions
                  </button>
                ) : null}
              </>
            ) : (
              <p className="dasti-cv-pill-editor__empty">
                No new suggestions for this section.
              </p>
            )}
          </div>
        ) : null}

        {pillItems.length > 0 ? (
          <div className="dasti-cv-pill-editor__chips" aria-label={`${title} items`}>
            {pillItems.map((item, index) => {
              const originalIndex = structuredItems.findIndex(
                (candidate) => candidate === item,
              );
              const value = String(item[keyName] ?? item.name ?? "").trim();
              const itemLabel = value || `${labelBase} ${index + 1}`;
              return (
                <span className="dasti-cv-pill-editor__chip" key={String(item.id ?? index)}>
                  <input
                    aria-label={`${title} item ${index + 1}`}
                    value={value}
                    onChange={(event) =>
                      commitSection(
                        updateStructuredItem(editableSection, originalIndex, {
                          [keyName]: event.currentTarget.value,
                        }),
                      )
                    }
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${itemLabel}`}
                    onClick={() => removePill(originalIndex)}
                  >
                    Remove
                  </button>
                </span>
              );
            })}
          </div>
        ) : (
          <p className="dasti-cv-pill-editor__empty">No {title.toLowerCase()} yet.</p>
        )}
      </div>
    );
  }

  function renderSkillsDrawerEditor() {
    if (!editableSection) return null;
    const sectionId = editableSection.id ? String(editableSection.id) : "";
    const scopedListSuggestion =
      sectionId &&
      aiSuggestion?.kind === "list" &&
      aiSuggestion.sectionId === sectionId
        ? aiSuggestion
        : null;
    const skillItems = structuredItems.flatMap((item) => {
      const skillItem = toSkillItem(item);
      return skillItem ? [skillItem] : [];
    });
    const categories = Array.isArray(editableSection.skillCategories)
      ? (editableSection.skillCategories as SkillCategory[])
      : [];

    function applySkillsDrawer(next: {
      items: ISkillItem[];
      categories: SkillCategory[];
    }) {
      if (!editableSection) return;
      const nextSection: CvSection = {
        ...editableSection,
        structuredContent: next.items as CvSection["structuredContent"],
        skillCategories: next.categories,
      };
      commitSection(nextSection);
      onSave?.(sanitizeSectionForSave(nextSection));
    }

    function acceptSkillSuggestion(
      value: string,
      targetCategoryId?: string | null,
    ) {
      const cleanValue = value.trim();
      if (!cleanValue || !editableSection) return;
      const alreadyExists = skillItems.some(
        (item) =>
          String(item.name ?? "").trim().toLocaleLowerCase() ===
          cleanValue.toLocaleLowerCase(),
      );
      if (!alreadyExists) {
        applySkillsDrawer({
          items: [
            ...skillItems,
            {
              id: `sk-${Date.now()}`,
              name: cleanValue,
              level: "Intermediate",
              ...(targetCategoryId ? { categoryId: targetCategoryId } : {}),
            },
          ],
          categories,
        });
      }
      onAcceptListAiSuggestion?.(cleanValue, { persist: false });
    }

    return (
      <SkillsDrawer
        open={open}
        sectionId={sectionId}
        items={skillItems}
        categories={categories}
        aiSuggestions={scopedListSuggestion?.items ?? []}
        aiSuggestionsLoading={scopedListSuggestion?.state === "loading"}
        aiSuggestionsRequested={Boolean(scopedListSuggestion)}
        canSuggestSkills={Boolean(sectionId && onRunListAiSuggestion)}
        onRequestAiSuggestions={() => {
          if (sectionId) onRunListAiSuggestion?.(sectionId);
        }}
        onAcceptAiSuggestion={acceptSkillSuggestion}
        onDismissAiSuggestion={onDismissListAiSuggestion}
        onClose={saveAndClose}
        onApply={(next) => {
          if (Array.isArray(next)) {
            applySkillsDrawer({ items: next as ISkillItem[], categories });
            return;
          }
          applySkillsDrawer(next);
        }}
      />
    );
  }

  function renderChipEditor(keyName: "name" | "text" | "certificationName") {
    if (!editableSection) return null;
    return (
      <div className="dasti-cv-section-stack">
        {structuredItems.map((item, index) => {
          const itemKey = String(item.id ?? index);
          const isAchievement = editableSection.type === "achievements";
          const isCertification = editableSection.type === "certifications";
          return (
            <div className="dasti-cv-section-card" key={itemKey}>
              <div className="dasti-cv-section-card__head">
                <strong>
                  {isAchievement
                    ? `Achievement ${index + 1}`
                    : isCertification
                      ? `Certification ${index + 1}`
                      : `Item ${index + 1}`}
                </strong>
                {isAchievement ? (
                  <AiHelperAction
                    label="Improve"
                    loadingLabel="Improving"
                    isLoading={fieldAiLoadingKey === `achievements:${itemKey}`}
                    disabled={fieldAiLoadingKey === `achievements:${itemKey}`}
                    ariaLabel="Improve achievement"
                    onClick={() => void runAchievementLineAi(index)}
                  />
                ) : null}
              </div>
              <Field
                label={
                  isAchievement
                    ? `Line ${index + 1}`
                    : isCertification
                      ? `Name ${index + 1}`
                      : `Item ${index + 1}`
                }
                value={String(item[keyName] ?? item.name ?? item.text ?? "")}
                onChange={(value) =>
                  commitSection(updateStructuredItem(editableSection, index, { [keyName]: value }))
                }
              />
              {isCertification ? (
                <>
                  <Field
                    label={`Issuer ${index + 1}`}
                    value={String(item.issuingOrganization ?? "")}
                    onChange={(value) =>
                      commitSection(
                        updateStructuredItem(editableSection, index, {
                          issuingOrganization: value,
                        }),
                      )
                    }
                  />
                  <Field
                    label={`Date ${index + 1}`}
                    value={String(item.issueDate ?? "")}
                    onChange={(value) =>
                      commitSection(
                        updateStructuredItem(editableSection, index, {
                          issueDate: value,
                        }),
                      )
                    }
                  />
                  <Field
                    label={`Credential ${index + 1}`}
                    value={String(item.credentialId ?? "")}
                    onChange={(value) =>
                      commitSection(
                        updateStructuredItem(editableSection, index, {
                          credentialId: value,
                        }),
                      )
                    }
                  />
                </>
              ) : null}
              {fieldAiSuggestion?.key === `achievements:${itemKey}` ? (
                <AiSuggestionCard
                  compact
                  actionLabel="Improve"
                  title={`Suggested achievement ${index + 1}`}
                  beforeText={fieldAiSuggestion.beforeText}
                  afterText={fieldAiSuggestion.afterText}
                  onAccept={acceptFieldAiSuggestion}
                  onDiscard={() => setFieldAiSuggestion(null)}
                />
              ) : null}
              {acceptedAiEdit?.key === `achievements:${itemKey}` ? (
                <CompactAppliedAiStatus onUndo={undoAcceptedAiEdit} />
              ) : null}
            </div>
          );
        })}
        {editableSection.type === "achievements" ? (
          <Button
            type="button"
            variant="secondary"
            size="md"
            iconLeft={<Plus size={14} strokeWidth={1.8} />}
            onClick={addAchievementEntry}
          >
            Add achievement
          </Button>
        ) : null}
        {editableSection.type === "certifications" ? (
          <Button
            type="button"
            variant="secondary"
            size="md"
            iconLeft={<Plus size={14} strokeWidth={1.8} />}
            onClick={addCertificationEntry}
          >
            Add certification
          </Button>
        ) : null}
      </div>
    );
  }

  function renderTextEditor() {
    if (!editableSection) return null;
    const suggestionKey = `text:${getSectionDraftKey(editableSection) ?? "section"}`;
    return (
      <div className="dasti-cv-section-stack">
        <div className="dasti-cv-section-field dasti-cv-section-field--wide">
          <span className="sr-only">{textInputLabel(title, "body")}</span>
          <span className="dasti-cv-section-field__topline">
            <span aria-hidden="true" />
            <AiHelperAction
              label="Rewrite"
              loadingLabel="Rewriting"
              isLoading={fieldAiLoadingKey === suggestionKey}
              disabled={fieldAiLoadingKey === suggestionKey}
              ariaLabel={`Rewrite ${title}`}
              onClick={() => void runTextSectionAi()}
            />
          </span>
          <textarea
            className="ds-field ds-field--textarea"
            aria-label={textInputLabel(title, "body")}
            value={readSectionText(editableSection)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.stopPropagation();
            }}
            onChange={(event) =>
              commitSection(updateTextBlock(editableSection, event.currentTarget.value))
            }
          />
        </div>
        {fieldAiSuggestion?.key === suggestionKey ? (
          <AiSuggestionCard
            compact
            actionLabel="Clean up"
            title="Suggested text"
            beforeText={fieldAiSuggestion.beforeText}
            afterText={fieldAiSuggestion.afterText}
            onAccept={acceptFieldAiSuggestion}
            onDiscard={() => setFieldAiSuggestion(null)}
          />
        ) : null}
        {acceptedAiEdit?.key === suggestionKey ? (
          <CompactAppliedAiStatus onUndo={undoAcceptedAiEdit} />
        ) : null}
      </div>
    );
  }

  function renderBody() {
    if (!editableSection) {
      return <div className="dasti-cv-section-sheet__body">Pick a section in the paper or rail to start.</div>;
    }
    if (String(editableSection.type) === "hobbies" || editableSection.title.trim().toLowerCase() === "hobbies") {
      return renderPillEditor("name");
    }
    switch (editableSection.type) {
      case "profile":
      case "contact":
        return renderProfileEditor();
      case "summary":
        return renderSummaryEditor();
      case "experience":
        return renderExperienceEditor();
      case "education":
        return renderEducationEditor();
      case "projects":
        return renderProjectEditor();
      case "skills":
      case "languages":
        return renderPillEditor("name");
      case "achievements":
        return renderChipEditor("text");
      case "certifications":
        return renderChipEditor("certificationName");
      default:
        return renderTextEditor();
    }
  }

  if (editableSection?.type === "skills") {
    return renderSkillsDrawerEditor() ?? <></>;
  }

  return (
    <IslandPanel
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onOpenChange(true);
          return;
        }
        saveAndClose();
      }}
      title={title}
      meta={itemCount > 1 ? `${itemCount} items` : undefined}
      ariaLabel={title}
      className={[
        "dasti-cv-section-sheet-panel",
        stageAligned ? "dasti-cv-section-sheet-panel--stage" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      showCloseButton={false}
      discardAction={{
        label: "Revert changes",
        ariaLabel: "Revert this section to when it was opened",
        title: "Revert changes",
        icon: (
          <ArrowCounterClockwise
            size={15}
            strokeWidth={1.7}
            aria-hidden="true"
          />
        ),
        onClick: revertChanges,
      }}
      saveAction={{
        label: "Done",
        onClick: saveAndClose,
      }}
    >
      <div className="dasti-cv-section-sheet">
        {renderBody()}
      </div>
    </IslandPanel>
  );
}

export default SectionEditorSheet;
