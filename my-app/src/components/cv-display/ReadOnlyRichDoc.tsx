import React, { useMemo } from "react";
import type { RemirrorJSON } from "remirror";
import { Remirror, useRemirror, EditorComponent } from "@remirror/react";
import {
  BoldExtension,
  ItalicExtension,
  UnderlineExtension,
  BulletListExtension,
  OrderedListExtension,
  ListItemExtension,
  ParagraphExtension,
  HistoryExtension,
  HardBreakExtension,
} from "remirror/extensions";

interface ReadOnlyRichDocProps {
  doc: RemirrorJSON | undefined | null;
  className?: string;
}

export function ReadOnlyRichDoc({ doc, className }: ReadOnlyRichDocProps): JSX.Element {
  const extensions = useMemo(
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
    []
  );

  const initialDoc: RemirrorJSON =
    doc && typeof doc === "object" ? (doc as RemirrorJSON) : ({ type: "doc", content: [] } as RemirrorJSON);

  const { manager, state } = useRemirror({

    extensions: () => extensions as any,

    content: initialDoc as any,
  });

  return (
    <div
      className={[
        "rich-content",
        "cv-rich-preview",
        "cv-reading-measure",
        "[color:var(--ti)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Remirror manager={manager} initialContent={state} editable={false}>
        <EditorComponent />
      </Remirror>
    </div>
  );
}

export default ReadOnlyRichDoc;
