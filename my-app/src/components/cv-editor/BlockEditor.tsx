import React from "react";
import type { CvBlock, Section } from "./types";
import RemirrorEditor from "../remirror-editor/RemirrorEditor";

export function BlockEditor({
  sectionId,
  block,
  onUpdate,
  onDelete,
}: {
  sectionId: string;
  block: CvBlock;
  onUpdate: (b: CvBlock) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
  const [staged, setStaged] = React.useState(block.content);

  React.useEffect(() => {
    setStaged(block.content);
  }, [block.content, block.id]);

  const handleEditToggle = React.useCallback(() => {
    setIsEditing(prev => !prev);
    // reset staged to current content when opening editor
    setStaged(block.content);
  }, [block.content]);

  const handleSave = React.useCallback(() => {
    try {
      onUpdate({ ...block, content: staged });
      setIsEditing(false);
    } catch (_e) {
      // minimal safe error handling
    }
  }, [onUpdate, block, staged]);

  const handleCancel = React.useCallback(() => {
    setStaged(block.content);
    setIsEditing(false);
  }, [block.content]);

  const handleDelete = React.useCallback(() => {
    // confirm delete
    // eslint-disable-next-line no-alert
    if (confirm("Delete this block?")) {
      onDelete();
    }
  }, [onDelete]);

  // Create a fake section shape expected by RemirrorEditor
  const fakeSection: Section & { content?: any } = {
    id: block.id,
    title: block.title,
    type: "text",
    blocks: [],
    structuredContent: null,
    content: block.content,
  };

  return (
    <div className="p-3 [background:var(--sfr)] border border-bo rounded [box-shadow:var(--sha)]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold [color:var(--ti)]">{block.title}</div>
          <div className="text-xs [color:var(--tm2)]">{block.type}</div>
        </div>
        <div className="space-x-2">
          <button
            type="button"
            onClick={handleEditToggle}
            className="px-2 py-1 text-sm [background:var(--sf2)] rounded hover:brightness-95"
            aria-pressed={isEditing}
          >
            {isEditing ? "Close" : "Edit"}
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="mt-3">
          <div className="p-2 border border-bo rounded [background:var(--sf1)]">
            <RemirrorEditor
              sections={[fakeSection as any]}
              onSectionContentChange={(secId: string, json: any) => {
                // staged content update from editor
                setStaged(json);
              }}
              // minimal required handlers for RemirrorEditor props
              onSectionChange={() => {}}
              collapsedSections={{ [fakeSection.id]: false }}
              onCollapseToggle={() => {}}
            />
          </div>

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1 [background:var(--ac)] [color:var(--op)] rounded hover:brightness-110"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1 [background:var(--sf2)] rounded hover:brightness-95"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-1 ml-auto text-[var(--foreground)] bg-[var(--danger)] rounded hover:bg-[var(--danger)]/90"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}