import React from "react";
import { Button, Pill, Sheet } from "../ui";

export type CvImportReviewBlock = {
  id: string;
  title: string;
  original: string;
  parsed: string;
  status: "uncertain" | "resolved";
};

type ImportReviewSheetProps = {
  open: boolean;
  blocks: CvImportReviewBlock[];
  onOpenChange: (open: boolean) => void;
};

export function ImportReviewSheet({
  open,
  blocks,
  onOpenChange,
}: ImportReviewSheetProps): JSX.Element {
  const [localBlocks, setLocalBlocks] = React.useState(blocks);

  React.useEffect(() => {
    setLocalBlocks(blocks);
  }, [blocks]);

  const unresolvedCount = localBlocks.filter(
    (block) => block.status === "uncertain",
  ).length;

  function markResolved(blockId: string) {
    setLocalBlocks((current) =>
      current.map((block) =>
        block.id === blockId ? { ...block, status: "resolved" } : block,
      ),
    );
  }

  function deleteBlock(blockId: string) {
    setLocalBlocks((current) => current.filter((block) => block.id !== blockId));
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="CV import review"
      description="Original fragments are preserved beside parsed results. Export stays blocked until each uncertain block is resolved."
      footer={
        <>
          <Button type="button" variant="ghost" size="md" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <span className="dasti-proposal-safe-send__footer-spacer" />
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() =>
              setLocalBlocks((current) =>
                current.map((block) => ({ ...block, status: "resolved" })),
              )
            }
            disabled={localBlocks.length === 0}
          >
            Accept all clear
          </Button>
        </>
      }
    >
      <div className="dasti-cv-import-review">
        {localBlocks.length === 0 ? (
          <div className="dasti-cv-import-review__empty">
            All blocks resolved.
          </div>
        ) : (
          <>
            <div className="dasti-cv-review-banner dasti-cv-review-banner--sheet">
              <div className="dasti-cv-review-banner__icon" aria-hidden="true">
                !
              </div>
              <div className="dasti-cv-review-banner__body">
                <div className="dasti-cv-review-banner__title">
                  {unresolvedCount} uncertain{" "}
                  {unresolvedCount === 1 ? "block" : "blocks"} remain.
                </div>
                <div className="dasti-cv-review-banner__desc">
                  Accept the parsed result, edit it, or delete the block.
                </div>
              </div>
            </div>
            {localBlocks.map((block) => (
              <div className="dasti-cv-review-block" key={block.id}>
                <div className="dasti-cv-review-block__head">
                  <strong>{block.title}</strong>
                  <Pill tone={block.status === "resolved" ? "success" : "warning"}>
                    {block.status === "resolved" ? "Resolved" : "Uncertain"}
                  </Pill>
                </div>
                <div className="dasti-cv-compare-grid">
                  <div>
                    <div className="dasti-cv-ba-label">Original fragment</div>
                    <div className="dasti-cv-fragment">{block.original}</div>
                  </div>
                  <div>
                    <label className="dasti-cv-ba-label" htmlFor={`parsed-${block.id}`}>
                      Parsed result
                    </label>
                    <textarea
                      id={`parsed-${block.id}`}
                      className="ds-field ds-field--textarea"
                      value={block.parsed}
                      onChange={(event) => {
                        const nextValue = event.currentTarget.value;
                        setLocalBlocks((current) =>
                          current.map((currentBlock) =>
                            currentBlock.id === block.id
                              ? { ...currentBlock, parsed: nextValue }
                              : currentBlock,
                          ),
                        );
                      }}
                    />
                  </div>
                </div>
                <div className="dasti-cv-review-block__actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={() => markResolved(block.id)}
                  >
                    Accept
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      document.getElementById(`parsed-${block.id}`)?.focus();
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => deleteBlock(block.id)}
                  >
                    Delete block
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Sheet>
  );
}

export default ImportReviewSheet;
