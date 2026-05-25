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

type InlinePreviewAttrs = Record<string, string | undefined>;

type RichInlineContent =
  | WorkshopResponsibilitiesRichContent
  | WorkshopCommittedResponsibilitiesRichContent
  | undefined;

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
  const latestDocRef = React.useRef<RemirrorJSON>(initialContent);
  const lastExternalDocJsonRef = React.useRef(JSON.stringify(initialContent));
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
    }
  }, [externalDoc, manager, onChange]);

  const handleChange = React.useCallback(
    (param: any) => {
      onChange(param);
      latestDocRef.current =
        (param?.state?.doc?.toJSON?.() as RemirrorJSON | undefined) ??
        latestDocRef.current;
    },
    [onChange],
  );

  const commit = React.useCallback(() => {
    args.onDocChange?.(args.editTarget, latestDocRef.current);
  }, [args]);

  return (
    <div
      {...(args.previewAttrs ?? {})}
      role="textbox"
      tabIndex={args.editable ? 0 : undefined}
      aria-label={args.ariaLabel}
      data-resume-inline-editable="true"
      data-inline-paper-editable="true"
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
        commit();
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
        <EditorComponent autoFocus={false} />
      </Remirror>
    </div>
  );
}
