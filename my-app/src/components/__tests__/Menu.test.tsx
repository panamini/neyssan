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

function stubViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height,
  });
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

  it("can position a menu as a left sidecar when there is enough room", async () => {
    stubViewport(1000, 720);
    render(
      <Menu
        ariaLabel="Sidecar actions"
        side="left"
        align="start"
        sections={[
          {
            items: [{ id: "create", label: "Create new CV" }],
          },
        ]}
        trigger={<button type="button">Open sidecar</button>}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Open sidecar" });
    stubRect(trigger, {
      top: 120,
      left: 640,
      right: 760,
      bottom: 152,
      width: 120,
      height: 32,
    });
    fireEvent.click(trigger);

    const menu = await screen.findByRole("menu", { name: "Sidecar actions" });
    stubRect(menu, { width: 320, height: 180 });
    fireEvent(window, new Event("resize"));

    await waitFor(() => expect(menu).toHaveAttribute("data-side", "left"));
    expect(menu).toHaveStyle({ left: "312px", top: "120px" });
  });

  it("falls back to a bounded popover when a left sidecar would be cropped", async () => {
    stubViewport(360, 720);
    render(
      <Menu
        ariaLabel="Constrained actions"
        side="left"
        align="start"
        sections={[
          {
            items: [{ id: "create", label: "Create new CV" }],
          },
        ]}
        trigger={<button type="button">Open constrained menu</button>}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Open constrained menu",
    });
    stubRect(trigger, {
      top: 120,
      left: 260,
      right: 340,
      bottom: 152,
      width: 80,
      height: 32,
    });
    fireEvent.click(trigger);

    const menu = await screen.findByRole("menu", {
      name: "Constrained actions",
    });
    stubRect(menu, { width: 320, height: 180 });
    fireEvent(window, new Event("resize"));

    await waitFor(() => expect(menu).toHaveAttribute("data-side", "bottom"));
    expect(menu).toHaveStyle({ left: "32px", top: "160px" });
  });

  it("flips a bottom menu upward when the viewport would crop it", async () => {
    stubViewport(390, 360);
    render(
      <Menu
        ariaLabel="Card actions"
        align="end"
        sections={[
          {
            items: [
              { id: "open", label: "Open" },
              { id: "delete", label: "Delete" },
            ],
          },
        ]}
        trigger={<button type="button">More actions</button>}
      />,
    );

    const trigger = screen.getByRole("button", { name: "More actions" });
    stubRect(trigger, {
      top: 300,
      left: 320,
      right: 352,
      bottom: 332,
      width: 32,
      height: 32,
    });
    fireEvent.click(trigger);

    const menu = await screen.findByRole("menu", { name: "Card actions" });
    stubRect(menu, { width: 200, height: 112 });
    fireEvent(window, new Event("resize"));

    await waitFor(() => expect(menu).toHaveAttribute("data-side", "top"));
    expect(menu).toHaveStyle({ top: "180px", left: "152px" });
  });

  it("uses a sheet-style placement on narrow viewports when requested", async () => {
    stubViewport(390, 720);
    render(
      <Menu
        ariaLabel="Mobile actions"
        side="left"
        mobileMode="sheet"
        sections={[
          {
            items: [{ id: "create", label: "Create new CV" }],
          },
        ]}
        trigger={<button type="button">Open mobile menu</button>}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Open mobile menu" });
    stubRect(trigger, {
      top: 120,
      left: 260,
      right: 340,
      bottom: 152,
      width: 80,
      height: 32,
    });
    fireEvent.click(trigger);

    const menu = await screen.findByRole("menu", { name: "Mobile actions" });
    stubRect(menu, { width: 320, height: 180 });
    fireEvent(window, new Event("resize"));

    await waitFor(() => expect(menu).toHaveAttribute("data-side", "sheet"));
    expect(menu).toHaveStyle({ left: "8px", width: "374px" });
  });
});
