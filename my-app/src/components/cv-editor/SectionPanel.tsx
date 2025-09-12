import React from "react";
import type { Section, CvBlock } from "./types";
import { uid } from "./types";
import { ensureRemirrorDoc } from "../remirror-editor/utils/conversion";
import { AddBlockButton } from "./AddBlockButton";
import { BlockEditor } from "./BlockEditor";

export function SectionPanel({
  section,
  onSectionChange,
}: {
  section: Section;
  onSectionChange: (s: Section) => void;
}) {
  const [collapsed, setCollapsed] = React.useState<boolean>(section.collapsed ?? false);
  const hasInitializedStructured = React.useRef(false);

  React.useEffect(() => {
    setCollapsed(section.collapsed ?? false);
  }, [section.collapsed]);

  // If structuredContent exists and blocks empty, generate representative blocks once.
  React.useEffect(() => {
    if (!hasInitializedStructured.current && Array.isArray(section.structuredContent) && section.blocks.length === 0) {
      const generatedBlocks: CvBlock[] = (section.structuredContent || []).map(item => {
        const itemId = String((item && (item.id ?? undefined)) ?? uid());
        const title = (item && (item.company || item.institution || item.skill || item.title || "Entry")) as string;
        const content = ensureRemirrorDoc((item.responsibilities || item.description || item.skill || "") as any);
        return {
          id: uid(),
          title: title,
          type: "text",
          content,
          attributes: { linkedStructuredId: itemId },
        };
      });

      const next: Section = { ...section, blocks: generatedBlocks };
      hasInitializedStructured.current = true;
      onSectionChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.structuredContent, section.blocks.length]);

  const handleAddBlock = React.useCallback(() => {
    const newBlock: CvBlock = {
      id: uid(),
      title: "New Block",
      type: "text",
      content: ensureRemirrorDoc(""),
    };
    const next: Section = { ...section, blocks: [...section.blocks, newBlock] };
    onSectionChange(next);
  }, [section, onSectionChange]);

  const handleAddEntry = React.useCallback(() => {
    const newStructuredId = uid();
    const newStructuredItem = { id: newStructuredId, title: "New Entry" };
    const newBlock: CvBlock = {
      id: uid(),
      title: "New Entry",
      type: "text",
      content: ensureRemirrorDoc(""),
      attributes: { linkedStructuredId: newStructuredId },
    };

    const next: Section = {
      ...section,
      structuredContent: Array.isArray(section.structuredContent) ? [...section.structuredContent, newStructuredItem] : [newStructuredItem],
      blocks: [...section.blocks, newBlock],
    };
    onSectionChange(next);
  }, [section, onSectionChange]);

  const updateBlock = React.useCallback((updated: Section["blocks"][number]) => {
    const next: Section = { ...section, blocks: section.blocks.map(b => (b.id === updated.id ? updated : b)) };
    onSectionChange(next);
  }, [section, onSectionChange]);

  const deleteBlock = React.useCallback((blockId: string) => {
    const next: Section = { ...section, blocks: section.blocks.filter(b => b.id !== blockId) };
    onSectionChange(next);
  }, [section, onSectionChange]);

  return (
    <div className="p-3 my-2 border rounded bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold">{section.title}</div>
          <div className="text-xs text-gray-500">{section.blocks.length} blocks</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCollapsed(c => {
                const next = !c;
                onSectionChange({ ...section, collapsed: next });
                return next;
              });
            }}
            className="px-2 py-1 text-sm bg-gray-200 rounded"
            aria-pressed={collapsed}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
          <AddBlockButton onAdd={handleAddBlock} label="Add block" />
          <button
            type="button"
            onClick={handleAddEntry}
            className="px-2 py-1 text-[var(--foreground)] bg-[var(--accent)] rounded"
          >
            Add entry
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {section.blocks.map(b => (
          <BlockEditor
            key={b.id}
            sectionId={section.id}
            block={b}
            onUpdate={(next) => updateBlock(next)}
            onDelete={() => deleteBlock(b.id)}
          />
        ))}
      </div>
    </div>
  );
}