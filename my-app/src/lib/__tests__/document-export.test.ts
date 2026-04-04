import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  html2canvasMock,
  jsPdfAddImageMock,
  jsPdfAddPageMock,
  jsPdfSaveMock,
} = vi.hoisted(() => ({
  html2canvasMock: vi.fn(),
  jsPdfAddImageMock: vi.fn(),
  jsPdfAddPageMock: vi.fn(),
  jsPdfSaveMock: vi.fn(),
}));

vi.mock("html2canvas", () => ({
  default: html2canvasMock,
}));

vi.mock("jspdf", () => ({
  jsPDF: function MockJsPDF(this: {
    internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
    addImage: typeof jsPdfAddImageMock;
    addPage: typeof jsPdfAddPageMock;
    save: typeof jsPdfSaveMock;
  }) {
    this.internal = {
      pageSize: {
        getWidth: () => 595,
        getHeight: () => 842,
      },
    };
    this.addImage = jsPdfAddImageMock;
    this.addPage = jsPdfAddPageMock;
    this.save = jsPdfSaveMock;
  },
}));

import {
  downloadElementAsPdf,
  downloadFirstMatchingNodeAsPdf,
} from "../document-export";

afterEach(() => {
  vi.restoreAllMocks();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  html2canvasMock.mockReset();
  jsPdfAddImageMock.mockReset();
  jsPdfAddPageMock.mockReset();
  jsPdfSaveMock.mockReset();
});

describe("document export", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          fillStyle: "",
          fillRect: vi.fn(),
          drawImage: vi.fn(),
        }) as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(
      () => "data:image/png;base64,slice",
    );
  });

  it("downloads the mounted document node as a PDF file without opening a popup", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1600;
    canvas.toDataURL = vi.fn(() => "data:image/png;base64,export");
    html2canvasMock.mockResolvedValue(canvas);

    const node = document.createElement("div");
    node.textContent = "Mounted preview content";
    document.body.appendChild(node);

    await expect(
      downloadElementAsPdf({ node, title: "Generated proposal" }),
    ).resolves.toBe(true);

    expect(html2canvasMock).toHaveBeenCalledWith(
      node,
      expect.objectContaining({
        backgroundColor: "#ffffff",
        useCORS: true,
      }),
    );
    expect(jsPdfAddImageMock).toHaveBeenCalled();
    expect(jsPdfSaveMock).toHaveBeenCalledWith("Generated proposal.pdf");
  });

  it("exports the first matching mounted node when downloading a PDF", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1600;
    canvas.toDataURL = vi.fn(() => "data:image/png;base64,proposal");
    html2canvasMock.mockResolvedValue(canvas);

    const container = document.createElement("div");
    container.innerHTML = `
      <div class="dasti-proposal-document">Rendered proposal</div>
      <div class="dasti-proposal-document__page">Fallback page</div>
    `;
    document.body.appendChild(container);

    await expect(
      downloadFirstMatchingNodeAsPdf({
        container,
        selectors: [
          ".dasti-proposal-document",
          ".dasti-proposal-document__page",
        ],
        title: "Proposal",
      }),
    ).resolves.toBe(true);

    expect(html2canvasMock).toHaveBeenCalledWith(
      container.querySelector(".dasti-proposal-document"),
      expect.any(Object),
    );
    expect(jsPdfSaveMock).toHaveBeenCalledWith("Proposal.pdf");
  });

  it("returns false when no mounted export node is available", async () => {
    await expect(
      downloadFirstMatchingNodeAsPdf({
        container: document.createElement("div"),
        selectors: [".missing-export-node"],
        title: "Missing proposal",
      }),
    ).resolves.toBe(false);

    expect(html2canvasMock).not.toHaveBeenCalled();
    expect(jsPdfSaveMock).not.toHaveBeenCalled();
  });
});
