import React from "react";
import { Remirror, useRemirror, EditorComponent } from "@remirror/react";
import type { RemirrorJSON } from "remirror";
import {
  BoldExtension,
  BulletListExtension,
  HardBreakExtension,
  HistoryExtension,
  ItalicExtension,
  ListItemExtension,
  ParagraphExtension,
  UnderlineExtension,
} from "remirror/extensions";
import { Eye, EyeClosed, Plus, TrashSimple, Wand2 } from "@/lib/icons";

import type { ResumeActiveTarget } from "../resumeLinking";
import { buildResumeEducationDisplay } from "./resumeEducation";
import type {
  ResumeData,
  WorkshopResponsibilitiesRichContent,
  WorkshopResponsibilityTextRun,
} from "./resume.types";
import {
  WORKSHOP_RESUME_ONECOL_TEMPLATE_ID,
  resolveWorkshopPreviewLayoutContract,
  type ResumeTemplateDefinition,
} from "../../../lib/layout/resumeTemplates";
import type {
  WorkshopCommittedResponsibilitiesRichContent,
  WorkshopExperienceContentBlock,
  WorkshopResumeCommittedFragment,
  WorkshopResumeCommittedPage,
} from "../../../lib/resume/resumePagination";
import {
  PreviewItemRegion,
  PreviewSectionRegion,
  buildPreviewRegionAttrs,
  buildProjectPreviewFieldId,
} from "./resumePreviewRegions";
import {
  InlineEditableText,
  type ActivePaperEditTarget,
  type InlineEditableTag,
  type ResumeInlineEditing,
} from "./InlineEditableText";
import {
  getDocumentIcon,
  getDocumentIconColorCss,
  normalizeDocumentIconSettings,
  resolveDefaultListMarkerIconKey,
  resolveSectionHeadingIconKey,
  type DocumentIconKey,
  type DocumentIconSettings,
} from "../../../lib/document-icons";
import {
  resolveDocumentListItemIconOverride,
  type DocumentIconOverrides,
  type DocumentListItemIconOverrideTarget,
} from "../../../lib/document-icon-overrides";
import { DocumentIconPicker } from "../../../components/document-icons/DocumentIconPicker";
import { useEditorFormattingActions } from "../../../components/remirror-editor/components/EditorToolbar";
import {
  INLINE_PAPER_FORMATTING_KEY_ATTR,
  registerInlinePaperFormattingProvider,
  type InlinePaperFormattingAction,
} from "../../../lib/editor-ai-selection";

type InlinePreviewAttrs = Record<string, string | undefined>;
type WorkshopSkillsFragment = Extract<
  WorkshopResumeCommittedFragment,
  { kind: "skills" }
>;
type WorkshopSkillItem = WorkshopSkillsFragment["items"][number];

function InlinePaperFormattingRegistration({
  enabled,
  formattingKey,
}: {
  enabled: boolean;
  formattingKey: string;
}) {
  const editorFormattingActions = useEditorFormattingActions();
  const inlineFormattingActions = React.useMemo<InlinePaperFormattingAction[]>(
    () =>
      enabled
        ? editorFormattingActions.map((action) => ({
            id: action.id,
            label: action.title,
            title: action.title,
            icon: action.icon,
            active: action.active,
            onRun: action.run,
            onMouseDown: action.onMouseDown,
          }))
        : [],
    [editorFormattingActions, enabled],
  );
  const inlineFormattingActionsRef = React.useRef(inlineFormattingActions);

  React.useEffect(() => {
    inlineFormattingActionsRef.current = inlineFormattingActions;
  }, [inlineFormattingActions]);

  React.useEffect(
    () =>
      registerInlinePaperFormattingProvider(
        formattingKey,
        () => inlineFormattingActionsRef.current,
      ),
    [formattingKey],
  );

  return null;
}

type ResumeOneColAtsPageProps = {
  data: ResumeData;
  page: WorkshopResumeCommittedPage;
  template: ResumeTemplateDefinition;
  activeTarget?: ResumeActiveTarget | null;
  inlineEditing?: ResumeInlineEditing | null;
  sectionActions?: ResumeSectionActions | null;
  paperAi?: ResumePaperAiState | null;
  documentIconSettings?: DocumentIconSettings | null;
  documentIconOverrides?: DocumentIconOverrides | null;
  onDocumentListItemIconChange?: (
    target: DocumentListItemIconOverrideTarget,
    iconKey: DocumentIconKey | null,
  ) => void;
};

export type ResumeSectionActions = {
  hiddenSectionIds: readonly string[];
  onAsk: (sectionId: string) => void;
  onAskItem?: (request: {
    sectionId: string;
    sectionType: string;
    itemId: string;
    itemIndex?: number;
    field: "responsibilities" | "achievement" | "education";
  }) => void;
  onToggleHidden: (sectionId: string) => void;
  onDelete: (sectionId: string) => void;
};

export type ResumePaperAiState = {
  activeTarget?: {
    sectionId: string;
    sectionType: string;
    itemId?: string;
    fieldPath?: string;
  } | null;
  listSuggestion?: {
    sectionId: string;
    sectionType: string;
    items: string[];
    state: "loading" | "ready" | "error";
    errorMessage?: string;
  } | null;
  onAcceptListSuggestion?: (value: string) => void;
  onClearListSuggestions?: () => void;
};

const experienceWrapStyle = {
  overflowWrap: "anywhere" as const,
  wordBreak: "break-word" as const,
};
const DRAFT_EMPTY_EXPERIENCE_DESCRIPTION =
  "__draft_empty_experience_description__";

const workshopLabelTextStyle = {
  fontSize: "var(--text-caption-size)",
  lineHeight: "var(--text-caption-line)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "var(--color-text-subtle)",
};

const workshopVisibleListStyle = {
  listStyleType: "none" as const,
  listStylePosition: "outside" as const,
};

type ResumeListMarkerControls = {
  overrides?: DocumentIconOverrides | null;
  activeTarget?: DocumentListItemIconOverrideTarget | null;
  onOpenTarget?: (target: DocumentListItemIconOverrideTarget) => void;
  onClose?: () => void;
  onChange?: (
    target: DocumentListItemIconOverrideTarget,
    iconKey: DocumentIconKey | null,
  ) => void;
};

function getResumeListMarkerTargetKey(
  target: DocumentListItemIconOverrideTarget | null | undefined,
): string {
  if (!target) return "";
  return [
    target.sectionId ?? "",
    target.sectionType ?? "",
    target.itemId ?? "",
    target.field ?? "",
    target.blockIndex ?? "",
    target.itemIndex ?? "",
  ].join("|");
}

function renderDocumentListMarker(
  settings: DocumentIconSettings | null | undefined,
  target?: DocumentListItemIconOverrideTarget | null,
  controls?: ResumeListMarkerControls | null,
): React.ReactNode {
  const documentIconSettings = normalizeDocumentIconSettings(settings);
  const overrideIconKey = resolveDocumentListItemIconOverride(
    controls?.overrides,
    target,
  );
  const markerType = overrideIconKey
    ? "icon"
    : documentIconSettings.listMarkerType ?? "dot";
  const icon =
    markerType === "icon"
      ? getDocumentIcon(
          overrideIconKey ??
            resolveDefaultListMarkerIconKey(documentIconSettings),
        )
      : null;
  const markerGlyph = markerType === "dash" ? "–" : "•";
  const dotSizePt = documentIconSettings.sizePt * 0.58;
  const dashThicknessPt = documentIconSettings.sizePt * 0.16;
  const glyphStyle = !icon
    ? markerType === "dash"
      ? ({
          width: `${documentIconSettings.sizePt}pt`,
          borderTop: `${dashThicknessPt}pt solid currentColor`,
        } as React.CSSProperties)
      : ({
          width: `${dotSizePt}pt`,
          height: `${dotSizePt}pt`,
          borderRadius: "999px",
          backgroundColor: "currentColor",
        } as React.CSSProperties)
    : null;

  const targetKey = getResumeListMarkerTargetKey(target);
  const activeTargetKey = getResumeListMarkerTargetKey(controls?.activeTarget);
  const pickerOpen = Boolean(targetKey && targetKey === activeTargetKey);
  const canEdit = Boolean(
    target && controls?.onChange && controls?.onOpenTarget,
  );
  const markerContent = icon ? (
    <span
      className="dasti-cv-paper-list-marker-content"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icon.svg }}
    />
  ) : (
    <span className="dasti-cv-paper-list-marker-content" aria-hidden="true">
      {glyphStyle ? <span aria-hidden="true" style={glyphStyle} /> : null}
    </span>
  );

  return (
    <span
      className={[
        "dasti-cv-paper-list-marker",
        icon
          ? "dasti-cv-paper-list-marker--icon"
          : "dasti-cv-paper-list-marker--glyph",
        canEdit ? "dasti-cv-paper-list-marker--editable" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-marker={icon ? undefined : markerGlyph}
      aria-hidden={canEdit ? undefined : "true"}
      style={
        {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: `calc(${documentIconSettings.sizePt}pt + 3px)`,
          height: `calc(${documentIconSettings.sizePt}pt + 3px)`,
          "--cv-list-marker-visual-size": `${documentIconSettings.sizePt}pt`,
          color: getDocumentIconColorCss(documentIconSettings.color),
          fontSize: `${documentIconSettings.sizePt}pt`,
          fontWeight: 700,
          lineHeight: 1,
          transform: icon ? "translateY(0.14em)" : "translateY(0.2em)",
        } as React.CSSProperties
      }
    >
      {canEdit && target ? (
        <button
          type="button"
          className="dasti-cv-paper-list-marker-trigger"
          aria-label="Choose bullet icon"
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            controls?.onOpenTarget?.(target);
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {markerContent}
        </button>
      ) : (
        markerContent
      )}
      {pickerOpen && target ? (
        <div
          className="dasti-cv-paper-list-icon-picker"
          role="dialog"
          aria-label="Choose bullet icon"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <DocumentIconPicker
            selectedIconKey={
              overrideIconKey ??
              resolveDefaultListMarkerIconKey(documentIconSettings)
            }
            label="Bullet"
            onChange={(nextIconKey) => {
              controls?.onChange?.(target, nextIconKey);
              controls?.onClose?.();
            }}
          />
          <div className="dasti-cv-paper-list-icon-picker-actions">
            <button
              type="button"
              data-document-icon-picker-action="clear"
              onClick={() => {
                controls?.onChange?.(target, null);
                controls?.onClose?.();
              }}
            >
              Clear
            </button>
            <button
              type="button"
              data-document-icon-picker-action="close"
              onClick={() => controls?.onClose?.()}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </span>
  );
}

function buildDocumentListStyle(args: {
  listGapMm: number;
}): React.CSSProperties {
  return {
    margin: 0,
    paddingLeft: 0,
    ...workshopVisibleListStyle,
    display: "grid",
    gap: formatMillimeters(args.listGapMm),
  };
}

function buildDocumentListItemStyle(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "max-content minmax(0, 1fr)",
    columnGap: "0.72em",
    alignItems: "start",
  };
}

function renderPaperListSuggestions(args: {
  fragment: WorkshopResumeCommittedFragment;
  paperAi?: ResumePaperAiState | null;
}) {
  const suggestion = args.paperAi?.listSuggestion;
  if (!suggestion || suggestion.sectionId !== args.fragment.sectionId) {
    return null;
  }

  if (suggestion.state === "loading") {
    return (
      <div
        className="dasti-cv-paper-list-suggestions"
        data-cv-paper-list-suggestions="loading"
      >
        <span className="dasti-cv-paper-list-suggestions__status">
          Finding suggestions...
        </span>
      </div>
    );
  }

  if (suggestion.state === "error") {
    return (
      <div
        className="dasti-cv-paper-list-suggestions"
        data-cv-paper-list-suggestions="error"
      >
        <span className="dasti-cv-paper-list-suggestions__status">
          {suggestion.errorMessage || "Suggestions are unavailable."}
        </span>
      </div>
    );
  }

  if (suggestion.items.length === 0) {
    return null;
  }

  const label =
    suggestion.sectionType === "languages"
      ? "Suggested languages"
      : suggestion.sectionType === "hobbies"
        ? "Suggested hobbies"
        : "Suggested skills";

  return (
    <div
      className="dasti-cv-paper-list-suggestions"
      data-cv-paper-list-suggestions="ready"
    >
      <span className="dasti-cv-paper-list-suggestions__label">{label}</span>
      {suggestion.items.map((item) => (
        <span className="dasti-cv-paper-list-suggestions__item" key={item}>
          <button
            type="button"
            className="dasti-cv-paper-list-suggestions__chip"
            aria-label={`Add ${item}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              args.paperAi?.onAcceptListSuggestion?.(item);
            }}
          >
            <span>{item}</span>
            <Plus size={12} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </span>
      ))}
      {args.paperAi?.onClearListSuggestions ? (
        <button
          type="button"
          className="dasti-cv-paper-list-suggestions__clear"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            args.paperAi?.onClearListSuggestions?.();
          }}
        >
          Clear suggestions
        </button>
      ) : null}
    </div>
  );
}

function getPaperSectionAiLabel(
  sectionType: string | undefined,
  title: string,
) {
  const normalizedTitle = title.trim().toLocaleLowerCase();
  if (sectionType === "skills" || normalizedTitle === "skills") {
    return "Suggest skills";
  }
  if (sectionType === "languages" || normalizedTitle === "languages") {
    return "Suggest languages";
  }
  if (sectionType === "hobbies" || normalizedTitle === "hobbies") {
    return "Suggest hobbies";
  }
  return `Ask AI for ${title}`;
}

function formatMillimeters(value: number) {
  return `${value}mm`;
}

function buildAdjustedFontSize(args: {
  baseVar:
    | "--text-display-size"
    | "--text-title-size"
    | "--text-body-size"
    | "--text-body-sm-size";
  adjustVar:
    | "--display-size-adjust"
    | "--title-size-adjust"
    | "--body-size-adjust"
    | "--body-sm-size-adjust";
  offsetMm?: number;
  offsetVar?:
    | "--workshop-section-title-reduction"
    | "--workshop-experience-heading-size-adjust";
  offsetOperator?: "+" | "-";
}) {
  if (args.offsetVar) {
    return `calc(var(${args.baseVar}) + var(${args.adjustVar}) ${args.offsetOperator ?? "+"} var(${args.offsetVar}))`;
  }

  const offsetMm = args.offsetMm ?? 0;
  if (offsetMm === 0) {
    return `calc(var(${args.baseVar}) + var(${args.adjustVar}))`;
  }

  return `calc(var(${args.baseVar}) + var(${args.adjustVar}) ${offsetMm < 0 ? "-" : "+"} ${formatMillimeters(Math.abs(offsetMm))})`;
}

const workshopDisplayFontSize = buildAdjustedFontSize({
  baseVar: "--text-display-size",
  adjustVar: "--display-size-adjust",
});
const workshopBodyFontSize = buildAdjustedFontSize({
  baseVar: "--text-body-size",
  adjustVar: "--body-size-adjust",
});
const workshopBodySmFontSize = buildAdjustedFontSize({
  baseVar: "--text-body-sm-size",
  adjustVar: "--body-sm-size-adjust",
});
const workshopCompactRowTextStyle = {
  fontSize: workshopBodySmFontSize,
  lineHeight: "var(--text-body-sm-line)",
};

export function shouldRenderPaperSectionAiControl(
  sectionType: string | undefined,
) {
  switch (sectionType) {
    case "summary":
    case "text":
    case "custom":
    case "additional_information":
    case "skills":
    case "languages":
    case "hobbies":
      return true;
    default:
      return false;
  }
}

export function renderSectionHeading(args: {
  title: string;
  continued: boolean;
  sectionId?: string;
  sectionType?: string;
  sectionActions?: ResumeSectionActions | null;
  documentIconSettings?: DocumentIconSettings | null;
}) {
  const sectionId = args.sectionId;
  const sectionHidden = Boolean(
    sectionId && args.sectionActions?.hiddenSectionIds.includes(sectionId),
  );
  const showSectionAiControl = shouldRenderPaperSectionAiControl(
    args.sectionType,
  );
  const sectionAiLabel = getPaperSectionAiLabel(args.sectionType, args.title);
  const documentIconSettings = normalizeDocumentIconSettings(
    args.documentIconSettings,
  );
  const sectionIconKey = resolveSectionHeadingIconKey({
    settings: documentIconSettings,
    sectionType: args.sectionType,
    sectionTitle: args.title,
  });
  const sectionIcon = getDocumentIcon(sectionIconKey);
  return (
    <div
      className="dasti-cv-paper-section-heading"
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "1.4mm",
        marginBottom: "var(--main-heading-margin)",
        position: "relative",
      }}
    >
      <h2
        style={{
          margin: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: "1.15mm",
          fontFamily: "var(--heading-font, var(--font-heading-family))",
          fontSize: buildAdjustedFontSize({
            baseVar: "--text-title-size",
            adjustVar: "--title-size-adjust",
            offsetVar: "--workshop-section-title-reduction",
            offsetOperator: "-",
          }),
          lineHeight: "var(--text-title-line)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 700,
          color: "var(--color-accent)",
        }}
      >
        {sectionIcon ? (
          <span
            className="dasti-cv-paper-section-heading-icon"
            aria-hidden="true"
            style={{
              display: "inline-flex",
              width: `${documentIconSettings.sizePt}pt`,
              height: `${documentIconSettings.sizePt}pt`,
              color: getDocumentIconColorCss(documentIconSettings.color),
              flex: "0 0 auto",
            }}
            dangerouslySetInnerHTML={{ __html: sectionIcon.svg }}
          />
        ) : null}
        {args.title}
      </h2>
      {args.continued ? (
        <span style={workshopLabelTextStyle}>Continued</span>
      ) : null}
      <div
        className="dasti-cv-paper-section-heading-rule"
        style={{
          flex: 1,
          height: "0.35mm",
          background:
            "color-mix(in srgb, var(--color-accent) 58%, transparent)",
        }}
      />
      {sectionId && args.sectionActions ? (
        <div
          className="dasti-cv-paper-section-controls"
          data-paper-section-controls="true"
        >
          {showSectionAiControl ? (
            <button
              type="button"
              className="dasti-cv-paper-section-control"
              aria-label={sectionAiLabel}
              title={sectionAiLabel}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                args.sectionActions?.onAsk(sectionId);
              }}
            >
              <Wand2 size={13} strokeWidth={1.8} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            className="dasti-cv-paper-section-control"
            aria-label={`${sectionHidden ? "Show" : "Hide"} ${args.title}`}
            title={sectionHidden ? "Show" : "Hide"}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              args.sectionActions?.onToggleHidden(sectionId);
            }}
          >
            {sectionHidden ? (
              <EyeClosed size={13} strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <Eye size={13} strokeWidth={1.8} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="dasti-cv-paper-section-control"
            data-tone="danger"
            aria-label={`Delete ${args.title}`}
            title="Delete"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              args.sectionActions?.onDelete(sectionId);
            }}
          >
            <TrashSimple size={13} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function renderExperienceBlocks(args: {
  blocks: WorkshopExperienceContentBlock[];
  listGapMm: number;
  documentIconSettings?: DocumentIconSettings | null;
  markerControls?: ResumeListMarkerControls | null;
  markerTargetBase?: DocumentListItemIconOverrideTarget | null;
}) {
  const nodes: React.ReactNode[] = [];
  let pendingBullets: WorkshopExperienceContentBlock[] = [];

  const flushBullets = () => {
    if (pendingBullets.length === 0) {
      return;
    }

    nodes.push(
      <ul
        key={`bullets-${nodes.length}`}
        style={buildDocumentListStyle({ listGapMm: args.listGapMm })}
      >
        {pendingBullets.map((block, bulletIndex) => (
          <li
            key={`${block.kind}-${block.text}`}
            style={{
              ...buildDocumentListItemStyle(),
              fontSize: workshopBodyFontSize,
              lineHeight: "var(--text-body-line)",
              ...experienceWrapStyle,
            }}
          >
            {renderDocumentListMarker(
              args.documentIconSettings,
              {
                ...args.markerTargetBase,
                field: args.markerTargetBase?.field ?? "responsibilities",
                itemIndex: bulletIndex,
              },
              args.markerControls,
            )}
            <span>{block.text}</span>
          </li>
        ))}
      </ul>,
    );
    pendingBullets = [];
  };

  args.blocks.forEach((block) => {
    if (block.kind === "bullet") {
      pendingBullets.push(block);
      return;
    }

    flushBullets();
    nodes.push(
      <p
        key={`${block.kind}-${block.text}`}
        style={{
          margin: 0,
          fontSize: workshopBodyFontSize,
          lineHeight: "var(--text-body-line)",
          ...experienceWrapStyle,
        }}
      >
        {block.text}
      </p>,
    );
  });

  flushBullets();

  return nodes;
}

function cleanDraftExperienceText(value: unknown): string {
  const text = String(value ?? "");
  return text === DRAFT_EMPTY_EXPERIENCE_DESCRIPTION ? "" : text;
}

function renderResponsibilityRun(
  run: WorkshopResponsibilityTextRun,
  key: string,
) {
  let content: React.ReactNode = cleanDraftExperienceText(run.text);

  if (run.underline) {
    content = <u>{content}</u>;
  }

  if (run.italic) {
    content = <em>{content}</em>;
  }

  if (run.bold) {
    content = <strong>{content}</strong>;
  }

  return <React.Fragment key={key}>{content}</React.Fragment>;
}

function remirrorMarksFromRun(run: WorkshopResponsibilityTextRun) {
  const marks = [];
  if (run.bold) marks.push({ type: "bold" });
  if (run.italic) marks.push({ type: "italic" });
  if (run.underline) marks.push({ type: "underline" });
  return marks.length > 0 ? marks : undefined;
}

function remirrorInlineFromRuns(runs: WorkshopResponsibilityTextRun[]) {
  return runs.flatMap((run): RemirrorJSON[] => {
    const parts = cleanDraftExperienceText(run.text).split("\n");
    return parts.flatMap((part, index) => {
      const nodes: RemirrorJSON[] = [];
      if (index > 0) {
        nodes.push({ type: "hardBreak" } as RemirrorJSON);
      }
      if (part) {
        nodes.push({
          type: "text",
          text: part,
          ...(remirrorMarksFromRun(run)
            ? { marks: remirrorMarksFromRun(run) }
            : {}),
        } as RemirrorJSON);
      }
      return nodes;
    });
  });
}

function remirrorStructureSignature(doc: RemirrorJSON): string {
  const visit = (node: RemirrorJSON): unknown => ({
    type: node.type,
    attrs: node.attrs ?? null,
    content: Array.isArray(node.content) ? node.content.map(visit) : [],
  });

  return JSON.stringify(visit(doc));
}

function remirrorDocFromRichContent(
  rich:
    | WorkshopResponsibilitiesRichContent
    | WorkshopCommittedResponsibilitiesRichContent
    | undefined,
  fallbackText: string,
): RemirrorJSON {
  if (!rich || rich.blocks.length === 0) {
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: cleanDraftExperienceText(fallbackText)
            ? [{ type: "text", text: cleanDraftExperienceText(fallbackText) }]
            : [],
        },
      ],
    } as RemirrorJSON;
  }

  return {
    type: "doc",
    content: rich.blocks.flatMap((block): RemirrorJSON[] => {
      if (block.kind === "paragraph") {
        return [
          {
            type: "paragraph",
            content: remirrorInlineFromRuns(block.runs),
          } as RemirrorJSON,
        ];
      }

      return [
        {
          type: "bulletList",
          content: block.items.map(
            (item) =>
              ({
                type: "listItem",
                attrs: { closed: false, nested: false },
                content: [
                  {
                    type: "paragraph",
                    content: remirrorInlineFromRuns(item.runs),
                  },
                ],
              }) as RemirrorJSON,
          ),
        } as RemirrorJSON,
      ];
    }),
  } as RemirrorJSON;
}

function PaperRichInlineEditor(args: {
  value: string;
  rich:
    | WorkshopResponsibilitiesRichContent
    | WorkshopCommittedResponsibilitiesRichContent
    | undefined;
  editTarget: ActivePaperEditTarget;
  editable: boolean;
  ariaLabel: string;
  placeholder?: string;
  onActivate?: (target: ActivePaperEditTarget) => void;
  onDeactivate?: (target?: ActivePaperEditTarget) => void;
  onDocChange?: (target: ActivePaperEditTarget, doc: RemirrorJSON) => void;
  style?: React.CSSProperties;
  previewAttrs?: InlinePreviewAttrs;
}) {
  const extensions = React.useMemo(
    () => [
      new ParagraphExtension(),
      new HistoryExtension({}),
      new HardBreakExtension({}),
      new BoldExtension({}),
      new ItalicExtension({}),
      new UnderlineExtension({}),
      new BulletListExtension({}),
      new ListItemExtension({}),
    ],
    [],
  );
  const initialContent = React.useMemo(
    () => remirrorDocFromRichContent(args.rich, args.value),
    // Remirror owns editing state while focused; external value is synced below only when blurred.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const { manager, state, onChange } = useRemirror({
    extensions: () => extensions as any,
    content: initialContent as any,
  });
  const formattingKey = React.useId();
  const latestDocRef = React.useRef<RemirrorJSON>(initialContent);
  const lastExternalDocJsonRef = React.useRef(JSON.stringify(initialContent));
  const lastCommittedDocJsonRef = React.useRef(JSON.stringify(initialContent));
  const lastCommittedDocStructureRef = React.useRef(
    remirrorStructureSignature(initialContent),
  );
  const autoCommitTimerRef = React.useRef<number | null>(null);
  const isFocusedRef = React.useRef(false);
  const externalDoc = React.useMemo(
    () => remirrorDocFromRichContent(args.rich, args.value),
    [args.rich, args.value],
  );

  React.useEffect(() => {
    const nextJson = JSON.stringify(externalDoc);
    const previousExternalJson = lastExternalDocJsonRef.current;
    if (nextJson === previousExternalJson) return;
    const currentEditorJson = JSON.stringify(latestDocRef.current);
    const hasLocalUncommittedChanges =
      currentEditorJson !== previousExternalJson;
    lastExternalDocJsonRef.current = nextJson;
    if (isFocusedRef.current && hasLocalUncommittedChanges) return;
    const nextState = (manager as any)?.createState?.({
      content: externalDoc as any,
    });
    const view = (manager as any)?.view;
    if (nextState && typeof view?.updateState === "function") {
      view.updateState(nextState);
      (onChange as unknown as (param: { state: unknown }) => void)({
        state: nextState,
      });
      latestDocRef.current = externalDoc;
      lastCommittedDocJsonRef.current = nextJson;
      lastCommittedDocStructureRef.current =
        remirrorStructureSignature(externalDoc);
    }
  }, [externalDoc, manager, onChange]);

  const commit = React.useCallback(
    (options?: { force?: boolean }) => {
      const nextJson = JSON.stringify(latestDocRef.current);
      if (!options?.force && nextJson === lastCommittedDocJsonRef.current) {
        return;
      }
      lastCommittedDocJsonRef.current = nextJson;
      lastCommittedDocStructureRef.current = remirrorStructureSignature(
        latestDocRef.current,
      );
      args.onDocChange?.(args.editTarget, latestDocRef.current);

    },
    [args.editTarget, args.onDocChange],
  );

  const scheduleAutoCommit = React.useCallback(() => {
    if (!args.editable) return;
    if (autoCommitTimerRef.current !== null) {
      window.clearTimeout(autoCommitTimerRef.current);
    }
    autoCommitTimerRef.current = window.setTimeout(() => {
      autoCommitTimerRef.current = null;
      commit();
    }, 450);
  }, [args.editable, commit]);

  const handleChange = React.useCallback(
    (param: any) => {
      onChange(param);
      latestDocRef.current =
        (param?.state?.doc?.toJSON?.() as RemirrorJSON | undefined) ??
        latestDocRef.current;
      const nextStructureSignature = remirrorStructureSignature(
        latestDocRef.current,
      );
      if (nextStructureSignature !== lastCommittedDocStructureRef.current) {
        if (autoCommitTimerRef.current !== null) {
          window.clearTimeout(autoCommitTimerRef.current);
          autoCommitTimerRef.current = null;
        }
        commit({ force: true });
        return;
      }
      commit();
    },
    [commit, onChange],
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const flushAutoCommit = () => {
      if (autoCommitTimerRef.current !== null) {
        window.clearTimeout(autoCommitTimerRef.current);
        autoCommitTimerRef.current = null;
      }
      commit();
    };

    window.addEventListener("pagehide", flushAutoCommit);
    window.addEventListener("beforeunload", flushAutoCommit);

    return () => {
      window.removeEventListener("pagehide", flushAutoCommit);
      window.removeEventListener("beforeunload", flushAutoCommit);
      if (autoCommitTimerRef.current !== null) {
        window.clearTimeout(autoCommitTimerRef.current);
        autoCommitTimerRef.current = null;
      }
      commit();
    };
  }, [commit]);

  return (
    <div
      {...(args.previewAttrs ?? {})}
      role="textbox"
      tabIndex={args.editable ? 0 : undefined}
      aria-label={args.ariaLabel}
      data-resume-inline-editable="true"
      data-inline-paper-editable="true"
      {...{ [INLINE_PAPER_FORMATTING_KEY_ATTR]: formattingKey }}
      data-paper-section-id={args.editTarget.sectionId}
      data-paper-section-type={args.editTarget.sectionType}
      data-paper-field-path={args.editTarget.fieldPath}
      data-paper-field-kind={args.editTarget.fieldKind}
      data-paper-item-index={args.editTarget.itemIndex}
      data-paper-bullet-index={args.editTarget.bulletIndex}
      data-paper-chip-index={args.editTarget.chipIndex}
      data-placeholder={args.placeholder}
      className="paper-rich-inline-editor"
      style={args.style}
      onFocusCapture={() => {
        isFocusedRef.current = true;
        args.onActivate?.(args.editTarget);
      }}
      onBlurCapture={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        isFocusedRef.current = false;
        if (autoCommitTimerRef.current !== null) {
          window.clearTimeout(autoCommitTimerRef.current);
          autoCommitTimerRef.current = null;
        }
        commit({ force: true });
        args.onDeactivate?.(args.editTarget);
      }}
      onClick={(event) => {
        if (args.editable) {
          event.stopPropagation();
        }
      }}
      onMouseDown={(event) => {
        if (args.editable) {
          event.stopPropagation();
        }
      }}
      onPointerDown={(event) => {
        if (args.editable) {
          event.stopPropagation();
        }
      }}
    >
      <Remirror
        manager={manager}
        initialContent={state}
        onChange={handleChange}
        editable={args.editable}
      >
        <InlinePaperFormattingRegistration
          enabled={args.editable}
          formattingKey={formattingKey}
        />
        <EditorComponent />
      </Remirror>
    </div>
  );
}

function renderResponsibilitiesRich(args: {
  rich:
    | WorkshopResponsibilitiesRichContent
    | WorkshopCommittedResponsibilitiesRichContent;
  listGapMm: number;
  documentIconSettings?: DocumentIconSettings | null;
  markerControls?: ResumeListMarkerControls | null;
  markerTargetBase?: DocumentListItemIconOverrideTarget | null;
}) {
  return args.rich.blocks.map((block, blockIndex) => {
    if (block.kind === "paragraph") {
      return (
        <p
          key={`paragraph-${blockIndex}`}
          style={{
            margin: 0,
            fontSize: workshopBodyFontSize,
            lineHeight: "var(--text-body-line)",
            ...experienceWrapStyle,
          }}
        >
          {block.runs.map((run, runIndex) =>
            renderResponsibilityRun(
              run,
              `paragraph-${blockIndex}-run-${runIndex}`,
            ),
          )}
        </p>
      );
    }

    return (
      <ul
        key={`bullet-list-${blockIndex}`}
        style={buildDocumentListStyle({ listGapMm: args.listGapMm })}
      >
        {block.items.map((item, itemIndex) => (
          <li
            key={`bullet-list-${blockIndex}-item-${itemIndex}`}
            style={{
              ...buildDocumentListItemStyle(),
              fontSize: workshopBodyFontSize,
              lineHeight: "var(--text-body-line)",
              ...experienceWrapStyle,
            }}
          >
            {renderDocumentListMarker(
              args.documentIconSettings,
              {
                ...args.markerTargetBase,
                field: args.markerTargetBase?.field ?? "responsibilities",
                blockIndex,
                itemIndex:
                  "sourceItemIndex" in item ? item.sourceItemIndex : itemIndex,
              },
              args.markerControls,
            )}
            <span>
              {item.runs.map((run, runIndex) =>
                renderResponsibilityRun(
                  run,
                  `bullet-list-${blockIndex}-item-${itemIndex}-run-${runIndex}`,
                ),
              )}
            </span>
          </li>
        ))}
      </ul>
    );
  });
}

function responsibilitiesRichHasPartialContent(
  rich:
    | WorkshopResponsibilitiesRichContent
    | WorkshopCommittedResponsibilitiesRichContent,
) {
  return rich.blocks.some((block) => {
    if (block.kind === "paragraph") {
      return "partial" in block && block.partial === true;
    }

    return block.items.some(
      (item) => "partial" in item && item.partial === true,
    );
  });
}

function experienceBlocksHaveBodyContent(blocks: WorkshopExperienceContentBlock[]) {
  return blocks.some(
    (block) => cleanDraftExperienceText(block.text).trim().length > 0,
  );
}

function renderExperienceContent(args: {
  item: {
    id?: string;
    blocks: WorkshopExperienceContentBlock[];
    responsibilitiesRich?: WorkshopCommittedResponsibilitiesRichContent;
  };
  sectionId?: string;
  sectionType?: string;
  sectionTitle?: string;
  itemIndex?: number;
  listGapMm: number;
  inlineEditing?: ResumeInlineEditing | null;
  documentIconSettings?: DocumentIconSettings | null;
  markerControls?: ResumeListMarkerControls | null;
}) {
  if (args.inlineEditing?.enabled) {
    const rich = args.item.responsibilitiesRich;
    if (
      rich &&
      rich.blocks.length > 0 &&
      !args.item.blocks.some((block) => block.partial === true) &&
      !responsibilitiesRichHasPartialContent(rich)
    ) {
      const editTarget = {
        sectionId: args.sectionId ?? "",
        sectionType: args.sectionType ?? "experience",
        fieldPath: `structuredContent.item:${args.item.id ?? ""}.responsibilities`,
        fieldKind: "paragraph" as const,
        itemIndex: args.itemIndex,
      };
      const fallbackText = args.item.blocks
        .map((block) =>
          block.text === DRAFT_EMPTY_EXPERIENCE_DESCRIPTION ? "" : block.text,
        )
        .filter((text) => text.length > 0)
        .join("\n");

      const hasRichParagraph = rich.blocks.some(
        (block) => block.kind === "paragraph",
      );

      return [
        <PaperRichInlineEditor
          key="editable-experience-rich-body"
          value={fallbackText}
          rich={rich}
          editable
          editTarget={editTarget}
          onActivate={(target) => args.inlineEditing?.onActivate(target)}
          onDeactivate={args.inlineEditing?.onDeactivate}
          onDocChange={args.inlineEditing?.onFieldDocChange}
          ariaLabel="Edit experience responsibilities"
          placeholder="Type responsibilities..."
          previewAttrs={buildPreviewRegionAttrs({
            sectionType: args.sectionType as "experience",
            sectionId: args.sectionId,
            sectionTitle: args.sectionTitle,
            itemId: `${args.item.id ?? "experience"}-responsibilities`,
            surface: "item",
          })}
          style={{
            margin: 0,
            fontSize: workshopBodyFontSize,
            lineHeight: "var(--text-body-line)",
            ...experienceWrapStyle,
          }}
        />,
        !hasRichParagraph ? (
          <div key="editable-add-paragraph">
            {renderInlineAddButton({
              inlineEditing: args.inlineEditing,
              sectionId: args.sectionId,
              sectionType: args.sectionType ?? "experience",
              itemKind: "paragraph",
              parentItemId: args.item.id,
              label: "Add paragraph",
            })}
          </div>
        ) : null,
        <div key="editable-add-bullet">
          {renderInlineAddButton({
            inlineEditing: args.inlineEditing,
            sectionId: args.sectionId,
            sectionType: args.sectionType ?? "experience",
            itemKind: "bullet",
            parentItemId: args.item.id,
            label: "Add bullet",
          })}
        </div>,
      ];
    }

    let bulletIndex = 0;
    const hasParagraphBlock = args.item.blocks.some(
      (block) => block.kind !== "bullet",
    );
    const baseTarget = {
      sectionId: args.sectionId ?? "",
      sectionType: args.sectionType ?? "experience",
    };
    const paragraphText = args.item.blocks
      .filter((block) => block.kind !== "bullet")
      .map((block) =>
        block.text === DRAFT_EMPTY_EXPERIENCE_DESCRIPTION ? "" : block.text,
      )
      .filter((text) => text.length > 0)
      .join("\n");
    const nodes: React.ReactNode[] = [];
    if (hasParagraphBlock) {
      const editTarget = {
        ...baseTarget,
        fieldPath: `structuredContent.item:${args.item.id ?? ""}.responsibilities`,
        fieldKind: "paragraph" as const,
        itemIndex: args.itemIndex,
      };

      nodes.push(
        <InlineEditableText
          as="div"
          key="editable-experience-text"
          value={paragraphText}
          editable
          editTarget={editTarget}
          onActivate={(target) => args.inlineEditing?.onActivate(target)}
          onDeactivate={args.inlineEditing?.onDeactivate}
          ariaLabel="Edit experience text"
          data-placeholder="Type responsibilities..."
          onPlainTextChange={(text) =>
            args.inlineEditing?.onFieldChange?.(editTarget, text)
          }
          data-preview-section={args.sectionType}
          data-preview-section-id={args.sectionId}
          data-preview-section-title={args.sectionTitle}
          data-preview-item-id={`${args.item.id ?? "experience"}-text`}
          style={{
            margin: 0,
            fontSize: workshopBodyFontSize,
            lineHeight: "var(--text-body-line)",
            ...experienceWrapStyle,
          }}
        />,
      );
    }

    args.item.blocks.forEach((block, blockIndex) => {
      if (block.kind === "bullet") {
        const currentBulletIndex = bulletIndex;
        bulletIndex += 1;
        const editTarget = {
          ...baseTarget,
          fieldPath: `structuredContent.item:${args.item.id ?? ""}.responsibilityBullets.${currentBulletIndex}`,
          fieldKind: "bullet" as const,
          itemIndex: args.itemIndex,
          bulletIndex: currentBulletIndex,
        };

        nodes.push(
          <ul
            key={`editable-bullet-list-${blockIndex}`}
            style={buildDocumentListStyle({ listGapMm: args.listGapMm })}
          >
            <li
              style={{
                ...buildDocumentListItemStyle(),
                fontSize: workshopBodyFontSize,
                lineHeight: "var(--text-body-line)",
                ...experienceWrapStyle,
              }}
            >
              {renderDocumentListMarker(
                args.documentIconSettings,
                {
                  sectionId: args.sectionId,
                  sectionType: args.sectionType ?? "experience",
                  itemId: args.item.id,
                  field: "responsibilities",
                  itemIndex: currentBulletIndex,
                },
                args.markerControls,
              )}
              <span>
                <InlineEditableText
                  as="span"
                  value={block.text}
                  editable
                  editTarget={editTarget}
                  onActivate={(target) =>
                    args.inlineEditing?.onActivate(target)
                  }
                  onDeactivate={args.inlineEditing?.onDeactivate}
                  ariaLabel="Edit experience bullet"
                  data-placeholder="Type an impact bullet..."
                  onPlainTextChange={(text) =>
                    args.inlineEditing?.onFieldChange?.(editTarget, text)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.metaKey &&
                      !event.ctrlKey &&
                      !event.altKey
                    ) {
                      event.preventDefault();
                      args.inlineEditing?.onAddItem?.({
                        sectionId: args.sectionId ?? "",
                        sectionType: args.sectionType ?? "experience",
                        itemKind: "bullet",
                        parentItemId: args.item.id,
                      });
                    }
                  }}
                  data-preview-section={args.sectionType}
                  data-preview-section-id={args.sectionId}
                  data-preview-section-title={args.sectionTitle}
                  data-preview-item-id={`${args.item.id ?? "experience"}-bullet-${currentBulletIndex}`}
                  style={{
                    fontSize: workshopBodyFontSize,
                    lineHeight: "var(--text-body-line)",
                    ...experienceWrapStyle,
                  }}
                />
              </span>
            </li>
          </ul>,
        );
      }
    });

    if (!hasParagraphBlock) {
      nodes.push(
        <div key="editable-add-paragraph">
          {renderInlineAddButton({
            inlineEditing: args.inlineEditing,
            sectionId: args.sectionId,
            sectionType: args.sectionType ?? "experience",
            itemKind: "paragraph",
            parentItemId: args.item.id,
            label: "Add paragraph",
          })}
        </div>,
      );
    }

    nodes.push(
      <div key="editable-add-bullet">
        {renderInlineAddButton({
          inlineEditing: args.inlineEditing,
          sectionId: args.sectionId,
          sectionType: args.sectionType ?? "experience",
          itemKind: "bullet",
          parentItemId: args.item.id,
          label: "Add bullet",
        })}
      </div>,
    );

    return nodes;
  }

  const rich = args.item.responsibilitiesRich;
  if (!rich || rich.blocks.length === 0) {
    return renderExperienceBlocks({
      blocks: args.item.blocks,
      listGapMm: args.listGapMm,
      documentIconSettings: args.documentIconSettings,
      markerControls: args.markerControls,
      markerTargetBase: {
        sectionId: args.sectionId,
        sectionType: args.sectionType ?? "experience",
        itemId: args.item.id,
        field: "responsibilities",
      },
    });
  }

  if (
    (args.item.blocks.some((block) => block.partial === true) &&
      experienceBlocksHaveBodyContent(args.item.blocks)) ||
    responsibilitiesRichHasPartialContent(rich)
  ) {
    return renderExperienceBlocks({
      blocks: args.item.blocks,
      listGapMm: args.listGapMm,
      documentIconSettings: args.documentIconSettings,
      markerControls: args.markerControls,
      markerTargetBase: {
        sectionId: args.sectionId,
        sectionType: args.sectionType ?? "experience",
        itemId: args.item.id,
        field: "responsibilities",
      },
    });
  }

  return renderResponsibilitiesRich({
    rich,
    listGapMm: args.listGapMm,
    documentIconSettings: args.documentIconSettings,
    markerControls: args.markerControls,
    markerTargetBase: {
      sectionId: args.sectionId,
      sectionType: args.sectionType ?? "experience",
      itemId: args.item.id,
      field: "responsibilities",
    },
  });
}

function renderInlineField(args: {
  as?: InlineEditableTag;
  value: string;
  editable: boolean;
  inlineEditing?: ResumeInlineEditing | null;
  editTarget: {
    sectionId: string;
    sectionType: string;
    fieldPath: string;
    fieldKind: "paragraph" | "heading" | "bullet" | "chip" | "date" | "meta";
    itemIndex?: number;
    bulletIndex?: number;
    chipIndex?: number;
  };
  ariaLabel: string;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
  previewAttrs?: InlinePreviewAttrs;
  preservePreviewItemId?: boolean;
}) {
  const previewAttrs = {
    ...(args.previewAttrs ?? {}),
  } as InlinePreviewAttrs;
  if (!args.preservePreviewItemId) {
    delete previewAttrs["data-preview-item-id"];
  }

  return (
    <InlineEditableText
      as={args.as}
      value={args.value}
      editable={args.editable}
      editTarget={args.editTarget}
      onActivate={(target) => args.inlineEditing?.onActivate(target)}
      onDeactivate={args.inlineEditing?.onDeactivate}
      ariaLabel={args.ariaLabel}
      data-placeholder={args.placeholder ?? ""}
      onPlainTextChange={(text) =>
        args.inlineEditing?.onFieldChange?.(args.editTarget, text)
      }
      {...previewAttrs}
      className={args.className}
      style={args.style}
    />
  );
}

function WorkshopSkillInlineItems(args: {
  items: WorkshopSkillItem[];
  fragment: WorkshopSkillsFragment;
  renderSeparators: boolean;
  activeTarget?: ResumeActiveTarget | null;
  inlineEditing?: ResumeInlineEditing | null;
}) {
  const itemRefs = React.useRef(new Map<string, HTMLSpanElement>());
  const [sameLineSeparatorIds, setSameLineSeparatorIds] = React.useState<
    Set<string>
  >(() => new Set(args.items.slice(1).map((item) => item.id)));

  const measureRows = React.useCallback(() => {
    if (!args.renderSeparators) {
      setSameLineSeparatorIds(new Set());
      return;
    }

    const next = new Set<string>();
    args.items.forEach((item, itemIndex) => {
      if (itemIndex === 0) return;

      const currentNode = itemRefs.current.get(item.id);
      const previousNode = itemRefs.current.get(args.items[itemIndex - 1]!.id);
      if (!currentNode || !previousNode) return;

      const currentTop = currentNode.getBoundingClientRect().top;
      const previousTop = previousNode.getBoundingClientRect().top;
      if (Math.abs(currentTop - previousTop) < 1) {
        next.add(item.id);
      }
    });

    setSameLineSeparatorIds((previous) => {
      const previousKey = Array.from(previous).sort().join("|");
      const nextKey = Array.from(next).sort().join("|");
      return previousKey === nextKey ? previous : next;
    });
  }, [args.items, args.renderSeparators]);

  React.useLayoutEffect(() => {
    measureRows();
  }, [measureRows]);

  React.useEffect(() => {
    if (!args.renderSeparators || typeof window === "undefined") {
      return undefined;
    }

    const firstNode = args.items[0]
      ? itemRefs.current.get(args.items[0].id)
      : null;
    const parentNode = firstNode?.parentElement ?? null;
    const resizeObserver =
      typeof ResizeObserver === "undefined" || !parentNode
        ? null
        : new ResizeObserver(() => measureRows());

    if (resizeObserver && parentNode) {
      resizeObserver.observe(parentNode);
    }
    window.addEventListener("resize", measureRows);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureRows);
    };
  }, [args.items, args.renderSeparators, measureRows]);

  return (
    <>
      {args.items.map((item, itemIndex) => (
        <span
          key={item.id}
          ref={(node) => {
            if (node) {
              itemRefs.current.set(item.id, node);
            } else {
              itemRefs.current.delete(item.id);
            }
          }}
          data-workshop-skill-item-wrap="true"
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: "0.45em",
          }}
        >
          {args.renderSeparators &&
          itemIndex > 0 &&
          sameLineSeparatorIds.has(item.id) ? (
            <span
              aria-hidden="true"
              data-workshop-skill-separator="true"
              style={{
                color: "var(--color-text-subtle)",
                fontSize: workshopBodySmFontSize,
                lineHeight: "var(--text-body-sm-line)",
              }}
            >
              •
            </span>
          ) : null}
          {renderInlineField({
            as: "span",
            value: item.name,
            editable: Boolean(args.inlineEditing?.enabled),
            inlineEditing: args.inlineEditing,
            editTarget: {
              sectionId: args.fragment.sectionId ?? "",
              sectionType: "skills",
              fieldPath: `structuredContent.item:${item.id}.name`,
              fieldKind: "chip",
              chipIndex: itemIndex,
            },
            ariaLabel: "Edit skill",
            placeholder: "Add skill",
            previewAttrs: buildPreviewRegionAttrs({
              sectionType: "skills",
              sectionId: args.fragment.sectionId,
              sectionTitle: args.fragment.title ?? "Skills",
              itemId: item.id,
              activeTarget: args.activeTarget,
              surface: "item",
            }),
            preservePreviewItemId: true,
            style: {
              fontSize: workshopBodySmFontSize,
              lineHeight: "var(--text-body-sm-line)",
            },
          })}
        </span>
      ))}
    </>
  );
}

function isActiveItemEditTarget(
  inlineEditing: ResumeInlineEditing | null | undefined,
  itemId: string,
) {
  return Boolean(
    inlineEditing?.enabled &&
      inlineEditing.activeTarget?.fieldPath.includes(
        `structuredContent.item:${itemId}.`,
      ),
  );
}

function hasVisibleText(...values: Array<string | undefined | null>) {
  return values.some((value) => String(value ?? "").trim().length > 0);
}

function renderInlineAddButton(args: {
  inlineEditing?: ResumeInlineEditing | null;
  sectionId?: string;
  sectionType: string;
  itemKind: NonNullable<ResumeInlineEditing["onAddItem"]> extends (
    request: infer Request,
  ) => void
    ? Request extends { itemKind: infer Kind }
      ? Kind
      : never
    : never;
  label: string;
  parentItemId?: string;
}) {
  if (!args.inlineEditing?.enabled || !args.sectionId) {
    return null;
  }

  return (
    <button
      type="button"
      className="dasti-cv-paper-inline-add"
      data-paper-inline-add="true"
      data-paper-section-id={args.sectionId}
      data-paper-section-type={args.sectionType}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        args.inlineEditing?.onAddItem?.({
          sectionId: args.sectionId ?? "",
          sectionType: args.sectionType,
          itemKind: args.itemKind,
          parentItemId: args.parentItemId,
        });
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
        if (args.itemKind === "bullet") {
          event.preventDefault();
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      + {args.label}
    </button>
  );
}

function renderInlineAddListItem(
  args: Parameters<typeof renderInlineAddButton>[0] & { keyName: string },
) {
  const button = renderInlineAddButton(args);
  return button ? <li key={args.keyName}>{button}</li> : null;
}

function renderProfileFragment(args: {
  data: ResumeData;
  activeTarget?: ResumeActiveTarget | null;
  inlineEditing?: ResumeInlineEditing | null;
}) {
  const { data, activeTarget, inlineEditing } = args;
  const profileSectionId = data.profileSectionId ?? "profile";
  const editable = Boolean(inlineEditing?.enabled);
  const photoSizeMm =
    data.photoSize === "small" ? 18 : data.photoSize === "large" ? 32 : 24;
  const photoFit = data.photoFit ?? "cover";
  const populatedProfileFieldKeys = new Set([
    ...data.contact.map((item) =>
      String(item.itemId ?? item.label.toLowerCase()),
    ),
    ...data.metadata.map((item) =>
      String(item.itemId ?? item.label.toLowerCase()),
    ),
  ]);
  const optionalContactFields = [
    { key: "email", label: "Email", addLabel: "email" },
    { key: "phone", label: "Phone", addLabel: "phone" },
    { key: "location", label: "Location", addLabel: "location" },
    { key: "linkedin", label: "LinkedIn", addLabel: "LinkedIn" },
    { key: "website", label: "Website", addLabel: "website" },
  ].filter((item, index, items) => {
    if (populatedProfileFieldKeys.has(item.key)) return false;
    return items.findIndex((candidate) => candidate.key === item.key) === index;
  });

  return (
    <header
      key="profile"
      data-preview-section="profile"
      style={{
        display: "grid",
        gap: "var(--header-row-gap)",
        paddingBottom: "var(--header-bottom-padding)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: data.photoUrl
            ? `${photoSizeMm}mm minmax(0, 1fr)`
            : "minmax(0, 1fr)",
          alignItems: "center",
          gap: data.photoUrl ? "5mm" : "1.5mm",
        }}
      >
        {data.photoUrl ? (
          <img
            src={data.photoUrl}
            alt=""
            data-cv-profile-image="true"
            style={{
              width: `${photoSizeMm}mm`,
              height: `${photoSizeMm}mm`,
              objectFit: photoFit,
              display: "block",
              border:
                "1px solid color-mix(in srgb, var(--color-text) 14%, transparent)",
              borderRadius: "999px",
              background: "var(--paper)",
            }}
          />
        ) : null}
        <div style={{ display: "grid", gap: "1.5mm" }}>
          {renderInlineField({
            as: "h1",
            value: data.name,
            editable,
            inlineEditing,
            editTarget: {
              sectionId: profileSectionId,
              sectionType: "profile",
              fieldPath: "structuredContent.0.name",
              fieldKind: "heading",
            },
            ariaLabel: "Edit name",
            placeholder: "Name",
            previewAttrs: buildPreviewRegionAttrs({
              sectionType: "profile",
              sectionId: profileSectionId,
              sectionTitle: "Profile",
              activeTarget,
              surface: "item",
            }),
            style: {
              margin: 0,
              fontFamily: "var(--heading-font, var(--font-heading-family))",
              fontSize: workshopDisplayFontSize,
              lineHeight: "var(--text-display-line)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
            },
          })}
          {data.title || editable
            ? renderInlineField({
                value: data.title,
                editable,
                inlineEditing,
                editTarget: {
                  sectionId: profileSectionId,
                  sectionType: "profile",
                  fieldPath: "structuredContent.0.desiredPosition",
                  fieldKind: "meta",
                },
                ariaLabel: "Edit title",
                placeholder: "Target title",
                previewAttrs: buildPreviewRegionAttrs({
                  sectionType: "profile",
                  sectionId: profileSectionId,
                  sectionTitle: "Profile",
                  activeTarget,
                  surface: "item",
                }),
                style: {
                  margin: 0,
                  fontSize: buildAdjustedFontSize({
                    baseVar: "--text-body-size",
                    adjustVar: "--body-size-adjust",
                    offsetMm: 0.1,
                  }),
                  lineHeight: "var(--text-body-line)",
                  color: "var(--color-text-muted)",
                },
              })
            : null}
        </div>
      </div>
      {data.contact.length > 0 ? (
        <dl
          data-paper-profile-contact="true"
          style={{
            margin: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(32mm, 1fr))",
            gap: "2.4mm 4mm",
          }}
        >
          {data.contact.map((item) => (
            <div
              key={item.itemId ?? item.label}
              data-paper-profile-contact-item={
                item.itemId ?? item.label.toLowerCase()
              }
              style={{ display: "grid", gap: "0.5mm" }}
            >
              <dt
                style={{
                  margin: 0,
                  ...workshopLabelTextStyle,
                }}
              >
                {item.label}
              </dt>
              <dd
                style={{
                  margin: 0,
                  fontSize: "var(--text-meta-size)",
                  lineHeight: "var(--text-meta-line)",
                  color: "var(--color-text-muted)",
                }}
              >
                {renderInlineField({
                  as: "span",
                  value: item.value,
                  editable,
                  inlineEditing,
                  editTarget: {
                    sectionId: item.sectionId ?? profileSectionId,
                    sectionType: "profile",
                    fieldPath: `structuredContent.0.${item.draftFieldKey ?? item.itemId ?? item.label.toLowerCase()}`,
                    fieldKind: "meta",
                  },
                  ariaLabel: `Edit ${item.label}`,
                  placeholder: item.label,
                  previewAttrs: buildPreviewRegionAttrs({
                    sectionType: "contact",
                    sectionId: item.sectionId ?? profileSectionId,
                    sectionTitle: "Contact",
                    itemId: item.itemId,
                    activeTarget,
                    surface: "item",
                  }),
                  style: {
                    fontSize: "var(--text-meta-size)",
                    lineHeight: "var(--text-meta-line)",
                    color: "var(--color-text-muted)",
                  },
                })}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {data.metadata.length > 0 ? (
        <PreviewSectionRegion
          as="dl"
          sectionType="notes"
          sectionId={data.profileSectionId}
          sectionTitle="Metadata"
          activeTarget={activeTarget}
          surface="section"
          style={{
            margin: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(32mm, 1fr))",
            gap: "2.4mm 4mm",
          }}
        >
          {data.metadata.map((item) => (
            <PreviewItemRegion
              as="div"
              key={item.itemId ?? item.label}
              sectionType="notes"
              sectionId={item.sectionId ?? data.profileSectionId}
              sectionTitle="Metadata"
              itemId={item.itemId}
              activeTarget={activeTarget}
              surface="item"
              style={{ display: "grid", gap: "0.5mm" }}
            >
              <dt
                style={{
                  margin: 0,
                  ...workshopLabelTextStyle,
                }}
              >
                {item.label}
              </dt>
              <dd
                style={{
                  margin: 0,
                  fontSize: "var(--text-meta-size)",
                  lineHeight: "var(--text-meta-line)",
                }}
              >
                {renderInlineField({
                  as: "span",
                  value: item.value,
                  editable,
                  inlineEditing,
                  editTarget: {
                    sectionId: item.sectionId ?? profileSectionId,
                    sectionType: "profile",
                    fieldPath: `structuredContent.0.${item.draftFieldKey ?? item.itemId ?? item.label.toLowerCase()}`,
                    fieldKind: "meta",
                  },
                  ariaLabel: `Edit ${item.label}`,
                  placeholder: item.label,
                  previewAttrs: buildPreviewRegionAttrs({
                    sectionType: "notes",
                    sectionId: item.sectionId ?? profileSectionId,
                    sectionTitle: "Metadata",
                    itemId: item.itemId,
                    activeTarget,
                    surface: "item",
                  }),
                  style: {
                    fontSize: "var(--text-meta-size)",
                    lineHeight: "var(--text-meta-line)",
                  },
                })}
              </dd>
            </PreviewItemRegion>
          ))}
        </PreviewSectionRegion>
      ) : null}
      {editable && optionalContactFields.length > 0 ? (
        <div
          data-paper-profile-contact-add="true"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1.4mm 2.2mm",
          }}
        >
          {optionalContactFields.map((item) => (
            <button
              key={item.key}
              type="button"
              className="dasti-cv-paper-inline-add"
              data-paper-inline-add="true"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                inlineEditing?.onAddItem?.({
                  sectionId: profileSectionId,
                  sectionType: "profile",
                  itemKind: "profile-contact",
                  parentItemId: item.key,
                });
              }}
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              + {item.addLabel}
            </button>
          ))}
        </div>
      ) : null}
    </header>
  );
}

function renderFragmentContent(args: {
  fragment: WorkshopResumeCommittedFragment;
  data: ResumeData;
  activeTarget?: ResumeActiveTarget | null;
  template: ResumeTemplateDefinition;
  inlineEditing?: ResumeInlineEditing | null;
  sectionActions?: ResumeSectionActions | null;
  paperAi?: ResumePaperAiState | null;
  documentIconSettings?: DocumentIconSettings | null;
  markerControls?: ResumeListMarkerControls | null;
}) {
  const {
    fragment,
    data,
    activeTarget,
    inlineEditing,
    sectionActions,
    paperAi,
    documentIconSettings,
    markerControls,
  } = args;
  const workshopLayout = resolveWorkshopPreviewLayoutContract(args.template);

  switch (fragment.kind) {
    case "profile":
      return renderProfileFragment({ data, activeTarget, inlineEditing });
    case "summary": {
      const editTarget = {
        sectionId: fragment.sectionId ?? data.summarySectionId ?? "summary",
        sectionType: "summary",
        fieldPath: "structuredContent.0.summary",
        fieldKind: "paragraph" as const,
      };
      return fragment.summaryRich ? (
        <PaperRichInlineEditor
          key={fragment.fragmentId}
          value={fragment.text}
          rich={fragment.summaryRich}
          editable={Boolean(inlineEditing?.enabled)}
          editTarget={editTarget}
          onActivate={(target) => inlineEditing?.onActivate(target)}
          onDeactivate={inlineEditing?.onDeactivate}
          onDocChange={inlineEditing?.onFieldDocChange}
          ariaLabel="Edit Summary"
          previewAttrs={buildPreviewRegionAttrs({
            sectionType: "summary",
            sectionId: fragment.sectionId ?? data.summarySectionId,
            sectionTitle: fragment.title ?? "Summary",
            itemId: "summary",
            activeTarget,
            surface: "item",
          })}
          style={{
            margin: 0,
            maxWidth: "var(--header-summary-width)",
            fontSize: workshopBodyFontSize,
            lineHeight: "var(--text-body-line)",
            color: "var(--color-text)",
          }}
        />
      ) : (
        <InlineEditableText
          key={fragment.fragmentId}
          value={fragment.text}
          editable={Boolean(inlineEditing?.enabled)}
          editTarget={editTarget}
          onActivate={(target) => inlineEditing?.onActivate(target)}
          onDeactivate={inlineEditing?.onDeactivate}
          ariaLabel="Edit Summary"
          data-placeholder="Write summary..."
          onPlainTextChange={(text) =>
            inlineEditing?.onFieldChange
              ? inlineEditing.onFieldChange(editTarget, text)
              : inlineEditing?.onSummaryChange(text)
          }
          {...buildPreviewRegionAttrs({
            sectionType: "summary",
            sectionId: fragment.sectionId ?? data.summarySectionId,
            sectionTitle: fragment.title ?? "Summary",
            itemId: "summary",
            activeTarget,
            surface: "item",
          })}
          style={{
            margin: 0,
            maxWidth: "var(--header-summary-width)",
            fontSize: workshopBodyFontSize,
            lineHeight: "var(--text-body-line)",
            color: "var(--color-text)",
          }}
        />
      );
    }
    case "experience":
      return [
        ...fragment.items.map((item, itemIndex) => {
          const itemFieldPath = (field: string) =>
            `structuredContent.item:${item.id}.${field}`;
          const isAiReviewTarget =
            paperAi?.activeTarget?.sectionId === fragment.sectionId &&
            paperAi?.activeTarget?.sectionType === "experience" &&
            paperAi?.activeTarget?.itemId === item.id;
          return (
            <PreviewItemRegion
              as="article"
              key={`${fragment.fragmentId}:${item.id}:${item.continued ? "continued" : "initial"}`}
              className="dasti-cv-paper-experience-item"
              sectionType="experience"
              sectionId={fragment.sectionId}
              sectionTitle={fragment.title ?? "Experience"}
              itemId={item.id}
              activeTarget={activeTarget}
              surface="item"
              style={{
                position: "relative",
                display: "grid",
                gap: formatMillimeters(workshopLayout.experienceBlockGapMm),
              }}
              data-preview-row-id={item.id}
              data-cv-ai-review-target={isAiReviewTarget ? "true" : undefined}
              tabIndex={
                inlineEditing?.enabled && sectionActions?.onAskItem
                  ? 0
                  : undefined
              }
              aria-label={
                inlineEditing?.enabled && sectionActions?.onAskItem
                  ? `${item.role || "Experience entry"} actions`
                  : undefined
              }
            >
              {inlineEditing?.enabled && sectionActions?.onAskItem ? (
                <button
                  type="button"
                  className="dasti-cv-paper-item-wand"
                  aria-label={`Improve responsibilities for ${item.role || "experience entry"}`}
                  title="Improve responsibilities with AI"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    sectionActions.onAskItem?.({
                      sectionId: fragment.sectionId ?? "",
                      sectionType: "experience",
                      itemId: item.id,
                      itemIndex,
                      field: "responsibilities",
                    });
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <Wand2 size={12} strokeWidth={1.8} aria-hidden="true" />
                </button>
              ) : null}
              <div
                style={{
                  display: "grid",
                  gap: formatMillimeters(workshopLayout.experienceMetaGapMm),
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "1.2mm",
                    flexWrap: "wrap",
                  }}
                >
                  {renderInlineField({
                    as: "h3",
                    value: item.role,
                    editable: Boolean(inlineEditing?.enabled),
                    inlineEditing,
                    editTarget: {
                      sectionId: fragment.sectionId ?? "",
                      sectionType: "experience",
                      fieldPath: itemFieldPath("position"),
                      fieldKind: "heading",
                      itemIndex,
                    },
                    ariaLabel: "Edit experience title",
                    placeholder: "Job title",
                    previewAttrs: buildPreviewRegionAttrs({
                      sectionType: "experience",
                      sectionId: fragment.sectionId,
                      sectionTitle: fragment.title ?? "Experience",
                      itemId: item.id,
                      activeTarget,
                      surface: "item",
                    }),
                    style: {
                      margin: 0,
                      fontFamily:
                        "var(--heading-font, var(--font-heading-family))",
                      fontSize: buildAdjustedFontSize({
                        baseVar: "--text-body-size",
                        adjustVar: "--body-size-adjust",
                        offsetVar: "--workshop-experience-heading-size-adjust",
                      }),
                      lineHeight:
                        "var(--workshop-experience-heading-line-height)",
                      fontWeight: 700,
                    },
                  })}
                  {item.continued ? (
                    <span style={workshopLabelTextStyle}>Continued</span>
                  ) : null}
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--text-meta-size)",
                    lineHeight: "var(--text-meta-line)",
                    color: "var(--color-text-muted)",
                    ...experienceWrapStyle,
                  }}
                >
                  {renderInlineField({
                    as: "span",
                    value: item.company,
                    editable: Boolean(inlineEditing?.enabled),
                    inlineEditing,
                    editTarget: {
                      sectionId: fragment.sectionId ?? "",
                      sectionType: "experience",
                      fieldPath: itemFieldPath("company"),
                      fieldKind: "meta",
                      itemIndex,
                    },
                    ariaLabel: "Edit company",
                    placeholder: "Company",
                    previewAttrs: buildPreviewRegionAttrs({
                      sectionType: "experience",
                      sectionId: fragment.sectionId,
                      sectionTitle: fragment.title ?? "Experience",
                      itemId: item.id,
                      activeTarget,
                      surface: "item",
                    }),
                  })}
                  {item.location || inlineEditing?.enabled ? " · " : null}
                  {item.location || inlineEditing?.enabled
                    ? renderInlineField({
                        as: "span",
                        value: item.location,
                        editable: Boolean(inlineEditing?.enabled),
                        inlineEditing,
                        editTarget: {
                          sectionId: fragment.sectionId ?? "",
                          sectionType: "experience",
                          fieldPath: itemFieldPath("location"),
                          fieldKind: "meta",
                          itemIndex,
                        },
                        ariaLabel: "Edit location",
                        placeholder: "Location",
                        previewAttrs: buildPreviewRegionAttrs({
                          sectionType: "experience",
                          sectionId: fragment.sectionId,
                          sectionTitle: fragment.title ?? "Experience",
                          itemId: item.id,
                          activeTarget,
                          surface: "item",
                        }),
                      })
                    : null}
                  {item.period ? " · " : null}
                  {item.period}
                </p>
              </div>
              {renderExperienceContent({
                item,
                sectionId: fragment.sectionId,
                sectionType: "experience",
                sectionTitle: fragment.title ?? "Experience",
                itemIndex,
                listGapMm: workshopLayout.listGapMm,
                inlineEditing,
                documentIconSettings,
                markerControls,
              })}
            </PreviewItemRegion>
          );
        }),
        <div key={`${fragment.fragmentId}:add-experience`}>
          {renderInlineAddButton({
            inlineEditing,
            sectionId: fragment.sectionId,
            sectionType: "experience",
            itemKind: "experience",
            label: "Add experience",
          })}
        </div>,
      ];
    case "education":
      return [
        ...fragment.items.map((item) => {
          const educationDisplay = buildResumeEducationDisplay(item);
          const itemFieldPath = (field: string) =>
            `structuredContent.item:${item.id}.${field}`;
          const editable = Boolean(inlineEditing?.enabled);
          return (
            <PreviewItemRegion
              as="article"
              key={item.id}
              sectionType="education"
              sectionId={fragment.sectionId}
              sectionTitle={fragment.title ?? "Education"}
              itemId={item.id}
              activeTarget={activeTarget}
              surface="item"
              style={{
                display: "grid",
                gap: "var(--education-gap)",
              }}
              data-preview-row-id={item.id}
            >
              <h3
                style={{
                  margin: 0,
                  fontFamily: "var(--heading-font, var(--font-heading-family))",
                  fontSize: workshopBodyFontSize,
                  fontWeight: 700,
                }}
              >
                {editable ? (
                  <>
                    {renderInlineField({
                      as: "span",
                      value: item.degree,
                      editable,
                      inlineEditing,
                      editTarget: {
                        sectionId: fragment.sectionId ?? "",
                        sectionType: "education",
                        fieldPath: itemFieldPath("degree"),
                        fieldKind: "heading",
                      },
                      ariaLabel: "Edit education degree",
                      placeholder: "Degree",
                      previewAttrs: buildPreviewRegionAttrs({
                        sectionType: "education",
                        sectionId: fragment.sectionId,
                        sectionTitle: fragment.title ?? "Education",
                        itemId: item.id,
                        activeTarget,
                        surface: "item",
                      }),
                    })}
                    {", "}
                    {renderInlineField({
                      as: "span",
                      value: item.fieldOfStudy ?? "",
                      editable,
                      inlineEditing,
                      editTarget: {
                        sectionId: fragment.sectionId ?? "",
                        sectionType: "education",
                        fieldPath: itemFieldPath("fieldOfStudy"),
                        fieldKind: "heading",
                      },
                      ariaLabel: "Edit field of study",
                      placeholder: "Field",
                      previewAttrs: buildPreviewRegionAttrs({
                        sectionType: "education",
                        sectionId: fragment.sectionId,
                        sectionTitle: fragment.title ?? "Education",
                        itemId: item.id,
                        activeTarget,
                        surface: "item",
                      }),
                    })}
                  </>
                ) : (
                  educationDisplay.title
                )}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--text-body-sm-size)",
                  lineHeight: "var(--text-body-sm-line)",
                  color: "var(--color-text-muted)",
                }}
              >
                {editable ? (
                  <>
                    {renderInlineField({
                      as: "span",
                      value: item.school,
                      editable,
                      inlineEditing,
                      editTarget: {
                        sectionId: fragment.sectionId ?? "",
                        sectionType: "education",
                        fieldPath: itemFieldPath("institution"),
                        fieldKind: "meta",
                      },
                      ariaLabel: "Edit school",
                      placeholder: "School",
                      previewAttrs: buildPreviewRegionAttrs({
                        sectionType: "education",
                        sectionId: fragment.sectionId,
                        sectionTitle: fragment.title ?? "Education",
                        itemId: item.id,
                        activeTarget,
                        surface: "item",
                      }),
                    })}
                    {item.period ? " · " : null}
                    {item.period}
                  </>
                ) : (
                  educationDisplay.previewMeta
                )}
              </p>
            </PreviewItemRegion>
          );
        }),
        <div key={`${fragment.fragmentId}:add-education`}>
          {renderInlineAddButton({
            inlineEditing,
            sectionId: fragment.sectionId,
            sectionType: "education",
            itemKind: "education",
            label: "Add education",
          })}
        </div>,
      ];
    case "skills": {
      const visibleSkillItems = fragment.items.filter(
        (item) =>
          hasVisibleText(item.name) ||
          isActiveItemEditTarget(inlineEditing, item.id),
      );
      const renderSeparators =
        args.template.id === WORKSHOP_RESUME_ONECOL_TEMPLATE_ID;

      return [
        <WorkshopSkillInlineItems
          key={`${fragment.fragmentId}:skills`}
          items={visibleSkillItems}
          fragment={fragment}
          renderSeparators={renderSeparators}
          activeTarget={activeTarget}
          inlineEditing={inlineEditing}
        />,
        <React.Fragment key={`${fragment.fragmentId}:add-skill`}>
          {renderInlineAddButton({
            inlineEditing,
            sectionId: fragment.sectionId,
            sectionType: "skills",
            itemKind: "skill",
            label: "Add skill",
          })}
        </React.Fragment>,
      ];
    }
    case "selected_projects":
      return [
        ...fragment.items
          .filter(
            (item) =>
              hasVisibleText(item.name, item.meta, item.description) ||
              isActiveItemEditTarget(inlineEditing, item.id),
          )
          .map((item) => (
            <article
              key={item.id}
              style={{
                display: "grid",
                gap: "var(--project-gap)",
                padding: "var(--project-padding)",
                borderRadius: "4mm",
                background:
                  "color-mix(in srgb, var(--color-accent-soft) 72%, white 28%)",
              }}
            >
              <PreviewItemRegion
                as="div"
                sectionType="selected_projects"
                sectionId={fragment.sectionId}
                sectionTitle={fragment.title ?? "Selected projects"}
                itemId={item.id}
                activeTarget={activeTarget}
                surface="item"
                style={{
                  display: "grid",
                  gap: formatMillimeters(workshopLayout.compactMetaGapMm),
                }}
              >
                {renderInlineField({
                  as: "h3",
                  value: item.name,
                  editable: Boolean(inlineEditing?.enabled),
                  inlineEditing,
                  editTarget: {
                    sectionId: fragment.sectionId ?? "",
                    sectionType: "projects",
                    fieldPath: `structuredContent.item:${item.id}.name`,
                    fieldKind: "heading",
                  },
                  ariaLabel: "Edit project name",
                  placeholder: "Project name",
                  previewAttrs: buildPreviewRegionAttrs({
                    sectionType: "selected_projects",
                    sectionId: fragment.sectionId,
                    sectionTitle: fragment.title ?? "Selected projects",
                    itemId: item.id,
                    activeTarget,
                    surface: "item",
                  }),
                  style: {
                    margin: 0,
                    fontFamily:
                      "var(--heading-font, var(--font-heading-family))",
                    fontSize: workshopBodyFontSize,
                    fontWeight: 700,
                  },
                })}
                {item.meta || inlineEditing?.enabled
                  ? renderInlineField({
                      value: item.meta,
                      editable: Boolean(inlineEditing?.enabled),
                      inlineEditing,
                      editTarget: {
                        sectionId: fragment.sectionId ?? "",
                        sectionType: "projects",
                        fieldPath: `structuredContent.item:${item.id}.meta`,
                        fieldKind: "meta",
                      },
                      ariaLabel: "Edit project meta",
                      placeholder: "Role / scope",
                      previewAttrs: buildPreviewRegionAttrs({
                        sectionType: "selected_projects",
                        sectionId: fragment.sectionId,
                        sectionTitle: fragment.title ?? "Selected projects",
                        itemId: item.id,
                        activeTarget,
                        surface: "item",
                      }),
                      style: {
                        margin: 0,
                        fontSize: "var(--text-meta-size)",
                        lineHeight: "var(--text-meta-line)",
                        color: "var(--color-text-muted)",
                      },
                    })
                  : null}
              </PreviewItemRegion>
              {item.descriptionRich ? (
                <PaperRichInlineEditor
                  value={item.description}
                  rich={item.descriptionRich}
                  editable={Boolean(inlineEditing?.enabled)}
                  editTarget={{
                    sectionId: fragment.sectionId ?? "",
                    sectionType: "projects",
                    fieldPath: `structuredContent.item:${item.id}.description`,
                    fieldKind: "paragraph",
                  }}
                  onActivate={(target) => inlineEditing?.onActivate(target)}
                  onDeactivate={inlineEditing?.onDeactivate}
                  onDocChange={inlineEditing?.onFieldDocChange}
                  ariaLabel="Edit project description"
                  previewAttrs={buildPreviewRegionAttrs({
                    sectionType: "selected_projects",
                    sectionId: fragment.sectionId,
                    sectionTitle: fragment.title ?? "Selected projects",
                    itemId: buildProjectPreviewFieldId(item.id, "description"),
                    activeTarget,
                    surface: "item",
                  })}
                  style={{
                    margin: 0,
                    fontSize: workshopBodyFontSize,
                    lineHeight: "var(--text-body-line)",
                  }}
                />
              ) : (
                renderInlineField({
                  value: item.description,
                  editable: Boolean(inlineEditing?.enabled),
                  inlineEditing,
                  editTarget: {
                    sectionId: fragment.sectionId ?? "",
                    sectionType: "projects",
                    fieldPath: `structuredContent.item:${item.id}.description`,
                    fieldKind: "paragraph",
                  },
                  ariaLabel: "Edit project description",
                  placeholder: "Type an impact note...",
                  previewAttrs: buildPreviewRegionAttrs({
                    sectionType: "selected_projects",
                    sectionId: fragment.sectionId,
                    sectionTitle: fragment.title ?? "Selected projects",
                    itemId: buildProjectPreviewFieldId(item.id, "description"),
                    activeTarget,
                    surface: "item",
                  }),
                  preservePreviewItemId: true,
                  style: {
                    margin: 0,
                    fontSize: workshopBodyFontSize,
                    lineHeight: "var(--text-body-line)",
                  },
                })
              )}
            </article>
          )),
        <div key={`${fragment.fragmentId}:add-project`}>
          {renderInlineAddButton({
            inlineEditing,
            sectionId: fragment.sectionId,
            sectionType: "projects",
            itemKind: "project",
            label: "Add project",
          })}
        </div>,
      ];
    case "languages":
      return [
        ...fragment.items
          .filter(
            (item) =>
              hasVisibleText(item.name, item.level) ||
              isActiveItemEditTarget(inlineEditing, item.id),
          )
          .map((item) => (
            <li key={item.id} style={buildDocumentListItemStyle()}>
              {renderDocumentListMarker(
                documentIconSettings,
                {
                  sectionId: fragment.sectionId,
                  sectionType: "languages",
                  itemId: item.id,
                  field: "item",
                },
                markerControls,
              )}
              <span>
                {renderInlineField({
                  as: "span",
                  value: item.name,
                  editable: Boolean(inlineEditing?.enabled),
                  inlineEditing,
                  editTarget: {
                    sectionId: fragment.sectionId ?? "",
                    sectionType: "languages",
                    fieldPath: `structuredContent.item:${item.id}.name`,
                    fieldKind: "chip",
                  },
                  ariaLabel: "Edit language",
                  placeholder: "Add language",
                  previewAttrs: buildPreviewRegionAttrs({
                    sectionType: "languages",
                    sectionId: fragment.sectionId,
                    sectionTitle: fragment.title ?? "Languages",
                    itemId: item.id,
                    activeTarget,
                    surface: "item",
                  }),
                  preservePreviewItemId: true,
                  style: workshopCompactRowTextStyle,
                })}
                {item.level || inlineEditing?.enabled ? " · " : null}
                {item.level || inlineEditing?.enabled
                  ? renderInlineField({
                      as: "span",
                      value: item.level,
                      editable: Boolean(inlineEditing?.enabled),
                      inlineEditing,
                      editTarget: {
                        sectionId: fragment.sectionId ?? "",
                        sectionType: "languages",
                        fieldPath: `structuredContent.item:${item.id}.level`,
                        fieldKind: "meta",
                      },
                      ariaLabel: "Edit language level",
                      placeholder: "Level",
                      previewAttrs: buildPreviewRegionAttrs({
                        sectionType: "languages",
                        sectionId: fragment.sectionId,
                        sectionTitle: fragment.title ?? "Languages",
                        itemId: item.id,
                        activeTarget,
                        surface: "item",
                      }),
                      style: workshopCompactRowTextStyle,
                    })
                  : null}
              </span>
            </li>
          )),
        renderInlineAddListItem({
          keyName: `${fragment.fragmentId}:add-language`,
          inlineEditing,
          sectionId: fragment.sectionId,
          sectionType: "languages",
          itemKind: "language",
          label: "Add language",
        }),
      ];
    case "certifications":
      return [
        ...fragment.items
          .filter(
            (item) =>
              hasVisibleText(item.name, item.issuer, item.meta) ||
              isActiveItemEditTarget(inlineEditing, item.id),
          )
          .map((item) => (
            <li key={item.id} style={buildDocumentListItemStyle()}>
              {renderDocumentListMarker(
                documentIconSettings,
                {
                  sectionId: fragment.sectionId,
                  sectionType: "certifications",
                  itemId: item.id,
                  field: "item",
                },
                markerControls,
              )}
              <span>
                {renderInlineField({
                  as: "span",
                  value: item.name,
                  editable: Boolean(inlineEditing?.enabled),
                  inlineEditing,
                  editTarget: {
                    sectionId: fragment.sectionId ?? "",
                    sectionType: "certifications",
                    fieldPath: `structuredContent.item:${item.id}.certificationName`,
                    fieldKind: "paragraph",
                  },
                  ariaLabel: "Edit certification",
                  placeholder: "Certification",
                  previewAttrs: buildPreviewRegionAttrs({
                    sectionType: "certifications",
                    sectionId: fragment.sectionId,
                    sectionTitle: fragment.title ?? "Certifications",
                    itemId: item.id,
                    activeTarget,
                    surface: "item",
                  }),
                  preservePreviewItemId: true,
                  style: {
                    fontSize: workshopBodyFontSize,
                    lineHeight: "var(--text-body-line)",
                  },
                })}
                {item.issuer || inlineEditing?.enabled ? " · " : null}
                {item.issuer || inlineEditing?.enabled
                  ? renderInlineField({
                      as: "span",
                      value: item.issuer ?? "",
                      editable: Boolean(inlineEditing?.enabled),
                      inlineEditing,
                      editTarget: {
                        sectionId: fragment.sectionId ?? "",
                        sectionType: "certifications",
                        fieldPath: `structuredContent.item:${item.id}.issuingOrganization`,
                        fieldKind: "meta",
                      },
                      ariaLabel: "Edit certification issuer",
                      placeholder: "Issuer",
                      previewAttrs: buildPreviewRegionAttrs({
                        sectionType: "certifications",
                        sectionId: fragment.sectionId,
                        sectionTitle: fragment.title ?? "Certifications",
                        itemId: item.id,
                        activeTarget,
                        surface: "item",
                      }),
                      style: {
                        fontSize: workshopBodyFontSize,
                        lineHeight: "var(--text-body-line)",
                      },
                    })
                  : null}
                {item.meta ? ` · ${item.meta}` : null}
              </span>
            </li>
          )),
        renderInlineAddListItem({
          keyName: `${fragment.fragmentId}:add-certification`,
          inlineEditing,
          sectionId: fragment.sectionId,
          sectionType: "certifications",
          itemKind: "certification",
          label: "Add certification",
        }),
      ];
    case "achievements":
      return [
        ...fragment.items
          .filter(
            (item) =>
              hasVisibleText(item.text) ||
              isActiveItemEditTarget(inlineEditing, item.id),
          )
          .map((item, itemIndex) => {
            const isAiReviewTarget =
              paperAi?.activeTarget?.sectionId === fragment.sectionId &&
              paperAi?.activeTarget?.sectionType === "achievements" &&
              paperAi?.activeTarget?.itemId === item.id;
            return (
              <li
                className="dasti-cv-paper-achievement-item"
                key={item.id}
                data-cv-ai-review-target={isAiReviewTarget ? "true" : undefined}
                style={{
                  ...buildDocumentListItemStyle(),
                  position: "relative",
                }}
              >
                {inlineEditing?.enabled && sectionActions?.onAskItem ? (
                  <button
                    type="button"
                    className="dasti-cv-paper-item-wand"
                    aria-label="Improve achievement"
                    title="Improve achievement with AI"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      sectionActions.onAskItem?.({
                        sectionId: fragment.sectionId ?? "",
                        sectionType: "achievements",
                        itemId: item.id,
                        itemIndex,
                        field: "achievement",
                      });
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <Wand2 size={12} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                ) : null}
                {renderDocumentListMarker(
                  documentIconSettings,
                  {
                    sectionId: fragment.sectionId,
                    sectionType: "achievements",
                    itemId: item.id,
                    field: "item",
                  },
                  markerControls,
                )}
                <span>
                  {renderInlineField({
                    as: "span",
                    value: item.text,
                    editable: Boolean(inlineEditing?.enabled),
                    inlineEditing,
                    editTarget: {
                      sectionId: fragment.sectionId ?? "",
                      sectionType: "achievements",
                      fieldPath: `structuredContent.item:${item.id}.text`,
                      fieldKind: "paragraph",
                    },
                    ariaLabel: "Edit achievement",
                    placeholder: "Add achievement",
                    previewAttrs: buildPreviewRegionAttrs({
                      sectionType: "achievements",
                      sectionId: fragment.sectionId,
                      sectionTitle: fragment.title ?? "Achievements",
                      itemId: item.id,
                      activeTarget,
                      surface: "item",
                    }),
                    preservePreviewItemId: true,
                    style: {
                      fontSize: workshopBodyFontSize,
                      lineHeight: "var(--text-body-line)",
                    },
                  })}
                </span>
              </li>
            );
          }),
        renderInlineAddListItem({
          keyName: `${fragment.fragmentId}:add-achievement`,
          inlineEditing,
          sectionId: fragment.sectionId,
          sectionType: "achievements",
          itemKind: "achievement",
          label: "Add achievement",
        }),
      ];
    case "affiliations":
      return [
        ...fragment.items
          .filter(
            (item) =>
              hasVisibleText(
                item.organizationName,
                item.roleOrMembershipType,
                item.dateRange,
                item.notes,
              ) || isActiveItemEditTarget(inlineEditing, item.id),
          )
          .map((item) => (
            <li key={item.id} style={buildDocumentListItemStyle()}>
              {renderDocumentListMarker(
                documentIconSettings,
                {
                  sectionId: fragment.sectionId,
                  sectionType: "affiliations",
                  itemId: item.id,
                  field: "item",
                },
                markerControls,
              )}
              <span>
                {renderInlineField({
                  as: "span",
                  value: item.organizationName,
                  editable: Boolean(inlineEditing?.enabled),
                  inlineEditing,
                  editTarget: {
                    sectionId: fragment.sectionId ?? "",
                    sectionType: "affiliations",
                    fieldPath: `structuredContent.item:${item.id}.organizationName`,
                    fieldKind: "paragraph",
                  },
                  ariaLabel: "Edit affiliation organization",
                  placeholder: "Organization",
                  previewAttrs: buildPreviewRegionAttrs({
                    sectionType: "affiliations",
                    sectionId: fragment.sectionId,
                    sectionTitle: fragment.title ?? "Affiliations",
                    itemId: item.id,
                    activeTarget,
                    surface: "item",
                  }),
                  preservePreviewItemId: true,
                  style: {
                    fontSize: workshopBodyFontSize,
                    lineHeight: "var(--text-body-line)",
                  },
                })}
                {item.roleOrMembershipType || inlineEditing?.enabled
                  ? " · "
                  : null}
                {item.roleOrMembershipType || inlineEditing?.enabled
                  ? renderInlineField({
                      as: "span",
                      value: item.roleOrMembershipType ?? "",
                      editable: Boolean(inlineEditing?.enabled),
                      inlineEditing,
                      editTarget: {
                        sectionId: fragment.sectionId ?? "",
                        sectionType: "affiliations",
                        fieldPath: `structuredContent.item:${item.id}.roleOrMembershipType`,
                        fieldKind: "meta",
                      },
                      ariaLabel: "Edit affiliation role",
                      placeholder: "Role",
                      previewAttrs: buildPreviewRegionAttrs({
                        sectionType: "affiliations",
                        sectionId: fragment.sectionId,
                        sectionTitle: fragment.title ?? "Affiliations",
                        itemId: item.id,
                        activeTarget,
                        surface: "item",
                      }),
                      style: {
                        fontSize: workshopBodyFontSize,
                        lineHeight: "var(--text-body-line)",
                      },
                    })
                  : null}
                {item.dateRange ? ` · ${item.dateRange}` : null}
                {item.notes || inlineEditing?.enabled ? " · " : null}
                {item.notes || inlineEditing?.enabled
                  ? renderInlineField({
                      as: "span",
                      value: item.notes ?? "",
                      editable: Boolean(inlineEditing?.enabled),
                      inlineEditing,
                      editTarget: {
                        sectionId: fragment.sectionId ?? "",
                        sectionType: "affiliations",
                        fieldPath: `structuredContent.item:${item.id}.notes`,
                        fieldKind: "paragraph",
                      },
                      ariaLabel: "Edit affiliation notes",
                      placeholder: "Notes",
                      previewAttrs: buildPreviewRegionAttrs({
                        sectionType: "affiliations",
                        sectionId: fragment.sectionId,
                        sectionTitle: fragment.title ?? "Affiliations",
                        itemId: item.id,
                        activeTarget,
                        surface: "item",
                      }),
                      style: {
                        fontSize: workshopBodyFontSize,
                        lineHeight: "var(--text-body-line)",
                      },
                    })
                  : null}
              </span>
            </li>
          )),
        renderInlineAddListItem({
          keyName: `${fragment.fragmentId}:add-affiliation`,
          inlineEditing,
          sectionId: fragment.sectionId,
          sectionType: "affiliations",
          itemKind: "affiliation",
          label: "Add affiliation",
        }),
      ];
    case "hobbies":
      return [
        ...fragment.items
          .filter(
            (item) =>
              hasVisibleText(item.name) ||
              isActiveItemEditTarget(inlineEditing, item.id),
          )
          .map((item, itemIndex) => (
            <li key={item.id} style={buildDocumentListItemStyle()}>
              {renderDocumentListMarker(
                documentIconSettings,
                {
                  sectionId: fragment.sectionId,
                  sectionType: "hobbies",
                  itemId: item.id,
                  field: "item",
                },
                markerControls,
              )}
              <span>
                {renderInlineField({
                  as: "span",
                  value: item.name,
                  editable: Boolean(inlineEditing?.enabled),
                  inlineEditing,
                  editTarget: {
                    sectionId: fragment.sectionId ?? "",
                    sectionType: "hobbies",
                    fieldPath: `structuredContent.item:${item.id}.name`,
                    fieldKind: "chip",
                    chipIndex: itemIndex,
                  },
                  ariaLabel: "Edit hobby",
                  placeholder: "Add hobby",
                  previewAttrs: buildPreviewRegionAttrs({
                    sectionType: "hobbies",
                    sectionId: fragment.sectionId,
                    sectionTitle: fragment.title ?? "Hobbies",
                    itemId: item.id,
                    activeTarget,
                    surface: "item",
                  }),
                  preservePreviewItemId: true,
                  style: workshopCompactRowTextStyle,
                })}
              </span>
            </li>
          )),
        renderInlineAddListItem({
          keyName: `${fragment.fragmentId}:add-hobby`,
          inlineEditing,
          sectionId: fragment.sectionId,
          sectionType: "hobbies",
          itemKind: "hobby",
          label: "Add hobby",
        }),
      ];
    case "additional_information":
      return fragment.items.map((item) =>
        (() => {
          const resolvedSectionId = item.sectionId ?? fragment.sectionId ?? "";
          const resolvedSectionType = item.sectionType ?? fragment.sectionType;
          const resolvedSectionTitle =
            item.sectionTitle || fragment.title || "Additional information";
          const editTarget = {
            sectionId: resolvedSectionId,
            sectionType: resolvedSectionType,
            fieldPath: "blocks.0.plainText",
            fieldKind: "paragraph" as const,
          };

          return (
            <PreviewItemRegion
              as="article"
              key={item.id}
              sectionType={fragment.sectionType}
              sectionId={fragment.sectionId}
              sectionTitle={fragment.title ?? "Additional information"}
              itemId={item.id}
              activeTarget={activeTarget}
              surface="item"
              style={{ display: "grid", gap: "0.8mm" }}
            >
              {item.sectionTitle && item.sectionTitle !== fragment.title ? (
                <h3
                  style={{
                    margin: 0,
                    fontFamily:
                      "var(--heading-font, var(--font-heading-family))",
                    fontSize: workshopBodyFontSize,
                    fontWeight: 700,
                  }}
                >
                  {item.sectionTitle}
                </h3>
              ) : null}
              <InlineEditableText
                value={item.text}
                editable={Boolean(inlineEditing?.enabled)}
                editTarget={editTarget}
                onActivate={(target) => inlineEditing?.onActivate(target)}
                onDeactivate={inlineEditing?.onDeactivate}
                ariaLabel={`Edit ${resolvedSectionTitle}`}
                onPlainTextChange={(text) =>
                  inlineEditing?.onFieldChange
                    ? inlineEditing.onFieldChange(editTarget, text)
                    : inlineEditing?.onTextSectionChange(
                        resolvedSectionId,
                        text,
                      )
                }
                {...buildPreviewRegionAttrs({
                  sectionType: resolvedSectionType,
                  sectionId: resolvedSectionId,
                  sectionTitle: resolvedSectionTitle,
                  itemId: item.id,
                  activeTarget,
                  surface: "item",
                })}
                style={{
                  margin: 0,
                  fontSize: workshopBodyFontSize,
                  lineHeight: "var(--text-body-line)",
                }}
              />
            </PreviewItemRegion>
          );
        })(),
      );
  }
}

export function renderSectionFragment(args: {
  fragment: WorkshopResumeCommittedFragment;
  data: ResumeData;
  activeTarget?: ResumeActiveTarget | null;
  template: ResumeTemplateDefinition;
  inlineEditing?: ResumeInlineEditing | null;
  sectionActions?: ResumeSectionActions | null;
  paperAi?: ResumePaperAiState | null;
  documentIconSettings?: DocumentIconSettings | null;
  markerControls?: ResumeListMarkerControls | null;
}) {
  const {
    fragment,
    data,
    activeTarget,
    inlineEditing,
    sectionActions,
    paperAi,
    documentIconSettings,
    markerControls,
  } = args;
  const workshopLayout = resolveWorkshopPreviewLayoutContract(args.template);
  if (!fragment.title) {
    return renderFragmentContent({
      fragment,
      data,
      activeTarget,
      template: args.template,
      inlineEditing,
      sectionActions,
      paperAi,
      markerControls,
    });
  }

  const content =
    fragment.kind === "skills" ? (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--skill-gap)",
        }}
      >
        {renderFragmentContent({
          fragment,
          data,
          activeTarget,
          template: args.template,
          inlineEditing,
          sectionActions,
          paperAi,
          documentIconSettings,
          markerControls,
        })}
      </div>
    ) : fragment.kind === "languages" ||
      fragment.kind === "certifications" ||
      fragment.kind === "achievements" ||
      fragment.kind === "affiliations" ||
      fragment.kind === "hobbies" ? (
      <ul
        style={buildDocumentListStyle({ listGapMm: workshopLayout.listGapMm })}
      >
        {renderFragmentContent({
          fragment,
          data,
          activeTarget,
          template: args.template,
          inlineEditing,
          sectionActions,
          paperAi,
          documentIconSettings,
          markerControls,
        })}
      </ul>
    ) : (
      <div
        style={{
          display: "grid",
          gap: formatMillimeters(workshopLayout.sectionContentGapMm),
        }}
      >
        {renderFragmentContent({
          fragment,
          data,
          activeTarget,
          template: args.template,
          inlineEditing,
          sectionActions,
          paperAi,
          documentIconSettings,
          markerControls,
        })}
      </div>
    );

  return (
    <PreviewSectionRegion
      as="section"
      className="dasti-cv-paper-section-region"
      sectionType={fragment.sectionType}
      sectionId={fragment.sectionId}
      sectionTitle={fragment.title}
      activeTarget={activeTarget}
      surface="section"
      style={{
        display: "grid",
        gap: formatMillimeters(workshopLayout.sectionShellGapMm),
      }}
    >
      {renderSectionHeading({
        title: fragment.title,
        continued: fragment.continued,
        sectionId: fragment.sectionId,
        sectionType: fragment.sectionType,
        sectionActions: inlineEditing?.enabled ? sectionActions : null,
        documentIconSettings,
      })}
      {content}
      {renderPaperListSuggestions({ fragment, paperAi })}
    </PreviewSectionRegion>
  );
}

export function ResumeOneColAtsPage({
  data,
  page,
  template,
  activeTarget = null,
  inlineEditing = null,
  sectionActions = null,
  paperAi = null,
  documentIconSettings = null,
  documentIconOverrides = null,
  onDocumentListItemIconChange,
}: ResumeOneColAtsPageProps) {
  const [activeListIconTarget, setActiveListIconTarget] =
    React.useState<DocumentListItemIconOverrideTarget | null>(null);
  React.useEffect(() => {
    if (!activeListIconTarget) return;

    const closeIfOutsidePicker = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          ".dasti-cv-paper-list-icon-picker, .dasti-cv-paper-list-marker-trigger",
        )
      ) {
        return;
      }
      setActiveListIconTarget(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveListIconTarget(null);
      }
    };

    document.addEventListener("pointerdown", closeIfOutsidePicker);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutsidePicker);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeListIconTarget]);
  const markerControls = React.useMemo<ResumeListMarkerControls>(
    () => ({
      overrides: documentIconOverrides,
      activeTarget: activeListIconTarget,
      onOpenTarget: setActiveListIconTarget,
      onClose: () => setActiveListIconTarget(null),
      onChange: onDocumentListItemIconChange,
    }),
    [activeListIconTarget, documentIconOverrides, onDocumentListItemIconChange],
  );

  return (
    <div
      data-testid="resume-template-page"
      style={{
        boxSizing: "border-box",
        width: "100%",
        minHeight: "100%",
        fontFamily: "var(--body-font, var(--font-body-family))",
        padding:
          "var(--margin-top) var(--margin-right) var(--margin-bottom) var(--margin-left)",
        background: "var(--paper)",
        color: "var(--color-text)",
        display: "grid",
        gap: "var(--body-row-gap)",
        alignContent: "start",
        alignItems: "start",
      }}
    >
      {page.fragments.map((fragment) => (
        <React.Fragment key={`${page.index}:${fragment.fragmentId}`}>
          {renderSectionFragment({
            fragment,
            data,
            activeTarget,
            template,
            inlineEditing,
            sectionActions,
            paperAi,
            documentIconSettings,
            markerControls,
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

export default ResumeOneColAtsPage;
