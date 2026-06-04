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

import type { ActivePaperEditTarget } from "./InlineEditableText";
import type { WorkshopResponsibilitiesRichContent } from "../resume.types";
import type { WorkshopCommittedResponsibilitiesRichContent } from "../../../lib/resume/resumePagination";
import { useEditorFormattingActions } from "../../../components/remirror-editor/components/EditorToolbar";
import {
  INLINE_PAPER_FORMATTING_KEY_ATTR,
  registerInlinePaperFormattingProvider,
  type InlinePaperFormattingAction,
} from "../../../lib/editor-ai-selection";

type InlinePreviewAttrs = Record<string, string | undefined>;

type RichInlineContent =
  | WorkshopResponsibilitiesRichContent
  | WorkshopCommittedResponsibilitiesRichContent
  | undefined;

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

function cleanRichInlineText(value: unknown): string {
  return String(value ?? "");
}

function remirrorMarksFromRun(run: { bold?: boolean; italic?: boolean; underline?: boolean }) {
  const marks = [];
  if (run.bold) marks.push({ type: "bold" });
  if (run.italic) marks.push({ type: "italic" });
  if (run.underline) marks.push({ type: "underline" });
  return marks.length > 0 ? marks : undefined;
}

function remirrorInlineFromRuns(
  runs: Array<{ text: unknown; bold?: boolean; italic?: boolean; underline?: boolean }>,
) {
  return runs.flatMap((run): RemirrorJSON[] => {
    const parts = cleanRichInlineText(run.text).split("\n");
    return parts.flatMap((part, index) => {
      const nodes: RemirrorJSON[] = [];
      if (index > 0) {
        nodes.push({ type: "hardBreak" } as RemirrorJSON);
      }
      if (part) {
        nodes.push({
          type: "text",
          text: part,
          ...(remirrorMarksFromRun(run) ? { marks: remirrorMarksFromRun(run) } : {}),
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

function remirrorDocFromRichContent(rich: RichInlineContent, fallbackText: string): RemirrorJSON {
  if (!rich || rich.blocks.length === 0) {
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: cleanRichInlineText(fallbackText)
            ? [{ type: "text", text: cleanRichInlineText(fallbackText) }]
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

export function PaperRichInlineEditor(args: {
  value: string;
  rich: RichInlineContent;
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
    const hasLocalUncommittedChanges = currentEditorJson !== previousExternalJson;
    lastExternalDocJsonRef.current = nextJson;
    if (isFocusedRef.current && hasLocalUncommittedChanges) return;
    const nextState = (manager as any)?.createState?.({ content: externalDoc as any });
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
      <Remirror manager={manager} state={state} onChange={handleChange}>
        <InlinePaperFormattingRegistration
          enabled={args.editable}
          formattingKey={formattingKey}
        />
        <EditorComponent autoFocus={false} />
      </Remirror>
    </div>
  );
}
