import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { exportDocumentFile } from "../exportDocumentFile";

const fetchMock = vi.fn();
const createObjectUrlMock = vi.fn(() => "blob:export");
const revokeObjectUrlMock = vi.fn();
const clickMock = vi.fn();

describe("exportDocumentFile", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    createObjectUrlMock.mockClear();
    revokeObjectUrlMock.mockClear();
    clickMock.mockClear();

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", {
      createObjectURL: createObjectUrlMock,
      revokeObjectURL: revokeObjectUrlMock,
    });

    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName === "a") {
        return {
          click: clickMock,
          set href(_value: string) {},
          set download(_value: string) {},
        } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tagName);
    }) as typeof document.createElement);
  });

  it("posts resume ATS PDF payloads to the parser service and downloads the response", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Blob(["pdf"], { type: "application/pdf" }), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="Resume - ATS.pdf"',
        },
      }),
    );

    await exportDocumentFile({
      kind: "resume",
      format: "pdf",
      mode: "ats",
      fileNameBase: "Resume - ATS",
      data: {
        schemaVersion: 1,
        kind: "resume",
        title: "Resume",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/document-export/resume/pdf",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(clickMock).toHaveBeenCalled();
  });

  it("posts proposal DOCX payloads to the parser service and preserves explicit filenames", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Blob(["docx"], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }), {
        status: 200,
        headers: {
          "Content-Disposition": 'attachment; filename="Proposal - Editable.docx"',
        },
      }),
    );

    await exportDocumentFile({
      kind: "proposal",
      format: "docx",
      fileNameBase: "Proposal - Editable",
      data: {
        schemaVersion: 1,
        kind: "proposal",
        title: "Proposal",
        body: [],
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/document-export/proposal/docx",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(clickMock).toHaveBeenCalled();
  });

  it("keeps the direct-download client free of raster screenshot export code", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/exportDocumentFile.ts"),
      "utf8",
    );

    expect(source).not.toContain("html2canvas");
    expect(source).not.toContain("addImage");
    expect(source).not.toContain("querySelector");
  });
});
