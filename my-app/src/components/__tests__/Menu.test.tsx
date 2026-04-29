import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Menu } from "../ui/menu";

function stubRect(element: HTMLElement, rect: Partial<DOMRect>) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    x: 24,
    y: 32,
    top: 32,
    left: 24,
    right: 124,
    bottom: 64,
    width: 100,
    height: 32,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
}

describe("Menu", () => {
  it("portals an anchored menu and selects an item", async () => {
    const onSelect = vi.fn();
    render(
      <Menu
        ariaLabel="Actions"
        sections={[
          {
            items: [
              { id: "save", label: "Save", onSelect },
              { id: "delete", label: "Delete", tone: "danger" },
            ],
          },
        ]}
        trigger={<button type="button">Open actions</button>}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Open actions" });
    stubRect(trigger, {});
    fireEvent.click(trigger);

    const menu = await screen.findByRole("menu", { name: "Actions" });
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveClass("ds-menu");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("menuitem", { name: "Save" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });

  it("supports keyboard navigation and escape close", async () => {
    const onSecondSelect = vi.fn();
    render(
      <Menu
        ariaLabel="Keyboard actions"
        sections={[
          {
            items: [
              { id: "first", label: "First" },
              { id: "second", label: "Second", onSelect: onSecondSelect },
            ],
          },
        ]}
        trigger={<button type="button">Open keyboard menu</button>}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Open keyboard menu",
    });
    stubRect(trigger, {});
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const menu = await screen.findByRole("menu", {
      name: "Keyboard actions",
    });
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    fireEvent.keyDown(menu, { key: "Enter" });
    expect(onSecondSelect).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger);
    const reopened = await screen.findByRole("menu", {
      name: "Keyboard actions",
    });
    fireEvent.keyDown(reopened, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });
});
