import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DocumentTitleEditor from "../DocumentTitleEditor";

function renderEditor(
  props: Partial<React.ComponentProps<typeof DocumentTitleEditor>> = {},
) {
  const onTitleCommit = vi.fn();
  render(
    <DocumentTitleEditor
      documentTitle="Initial title"
      titlePlaceholder="Untitled document"
      ariaLabel="Document title"
      onTitleCommit={onTitleCommit}
      {...props}
    />,
  );
  return { onTitleCommit };
}

describe("DocumentTitleEditor", () => {
  it("enters edit mode when the displayed title is clicked", () => {
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Edit Document title" }));

    expect(screen.getByRole("textbox", { name: "Document title" })).toHaveValue(
      "Initial title",
    );
  });

  it("commits a trimmed title with Enter", () => {
    const { onTitleCommit } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Edit Document title" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Document title" }), {
      target: { value: "  Renamed title  " },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Document title" }), {
      key: "Enter",
    });

    expect(onTitleCommit).toHaveBeenCalledWith("Renamed title");
  });

  it("commits a trimmed title on blur", () => {
    const { onTitleCommit } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Edit Document title" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Document title" }), {
      target: { value: "  Blur title  " },
    });
    fireEvent.blur(screen.getByRole("textbox", { name: "Document title" }));

    expect(onTitleCommit).toHaveBeenCalledWith("Blur title");
  });

  it("cancels the edit with Escape", () => {
    const { onTitleCommit } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Edit Document title" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Document title" }), {
      target: { value: "Canceled title" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Document title" }), {
      key: "Escape",
    });

    expect(onTitleCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit Document title" })).toHaveTextContent(
      "Initial title",
    );
  });

  it("passes an empty commit to the caller", () => {
    const { onTitleCommit } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Edit Document title" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Document title" }), {
      target: { value: "   " },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Document title" }), {
      key: "Enter",
    });

    expect(onTitleCommit).toHaveBeenCalledWith("");
  });
});
