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
    <div className="p-3 bg-white border rounded shadow-sm dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{block.title}</div>
          <div className="text-xs text-gray-500">{block.type}</div>
        </div>
        <div className="space-x-2">
          <button
            type="button"
            onClick={handleEditToggle}
            className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
            aria-pressed={isEditing}
          >
            {isEditing ? "Close" : "Edit"}
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="mt-3">
          <div className="p-2 border rounded bg-gray-50">
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
              className="px-3 py-1 text-white bg-[var(--primary)] rounded hover:bg-blue-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
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