import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { exportDocumentFile } from "../exportDocumentFile";

const fetchMock = vi.fn();
const createObjectUrlMock = vi.fn(() => "blob:export");
const revokeObjectUrlMock = vi.fn();
const clickMock = vi.fn();
const appendChildMock = vi.fn();
const removeChildMock = vi.fn();
const originalCreateElement = document.createElement.bind(document);
const originalAppendChild = document.body.appendChild.bind(document.body);
const originalRemoveChild = document.body.removeChild.bind(document.body);

describe("exportDocumentFile", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    createObjectUrlMock.mockClear();
    revokeObjectUrlMock.mockClear();
    clickMock.mockClear();
    appendChildMock.mockClear();
    removeChildMock.mockClear();
    vi.stubEnv("VITE_PARSER_URL", "http://127.0.0.1:8001");
    vi.stubEnv("VITE_CONVEX_PARSER_URL", "http://127.0.0.1:8001");
    vi.stubEnv("VITE_PDF_INGEST_URL", "");

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", {
      createObjectURL: createObjectUrlMock,
      revokeObjectURL: revokeObjectUrlMock,
    });

    vi.spyOn(document.body, "appendChild").mockImplementation(((node: Node) => {
      appendChildMock(node);
      return originalAppendChild(node);
    }) as typeof document.body.appendChild);

    vi.spyOn(document.body, "removeChild").mockImplementation(((node: Node) => {
      removeChildMock(node);
      return originalRemoveChild(node);
    }) as typeof document.body.removeChild);

    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName === "a") {
        const element = originalCreateElement(tagName);
        vi.spyOn(element, "click").mockImplementation(clickMock);
        return element;
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.__DASTI_DOCUMENT_EXPORT_DEBUG__;
    delete window.__DASTI_STYLED_RESUME_EXPORT_CONTEXT__;
    delete window.__DASTI_LAST_DOCUMENT_EXPORT__;
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
        locale: "en",
        title: "Resume",
        exportSource: "standard",
        profile: {
          name: "Jane Doe",
          title: "",
          summary: "",
        },
        contact: [],
        metadata: [],
        skills: [],
        languages: [],
        experience: [],
        projects: [],
        education: [],
        achievements: [],
        hobbies: [],
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8001/api/v1/document-export/resume/pdf",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(clickMock).toHaveBeenCalled();
    expect(appendChildMock).toHaveBeenCalledTimes(1);
    expect(removeChildMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlMock).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:export");
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
        locale: "en",
        title: "Proposal",
        proposalType: "cover_letter",
        documentTitle: "Proposal",
        documentMeta: "",
        contactLine: "",
        letterDate: "",
        recipientDetails: "",
        applicantHeader: {
          name: "",
          role: "",
          email: "",
          phone: "",
          linkedin: "",
          website: "",
          location: "",
          tag: "",
        },
        headerVisibility: {
          showSender: true,
          showDate: true,
          showSubject: true,
          showRecipient: true,
          showRecipientDetails: true,
        },
        templateId: null,
        body: [],
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8001/api/v1/document-export/proposal/docx",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(clickMock).toHaveBeenCalled();
  });

  it("posts resume DOCX payloads to the parser service and preserves explicit filenames", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        new Blob(["docx"], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
        {
          status: 200,
          headers: {
            "Content-Disposition":
              'attachment; filename="Resume - Editable.docx"',
          },
        },
      ),
    );

    await exportDocumentFile({
      kind: "resume",
      format: "docx",
      fileNameBase: "Resume - Editable",
      stylePreset: {
        layout: "swiss",
        typography: "quiet-editorial",
        palette: "pierre",
      },
      data: {
        schemaVersion: 1,
        kind: "resume",
        locale: "en",
        title: "Resume",
        exportSource: "standard",
        profile: {
          name: "Jane Doe",
          title: "",
          summary: "",
        },
        contact: [],
        metadata: [],
        skills: [],
        languages: [],
        experience: [],
        projects: [],
        education: [],
        achievements: [],
        hobbies: [],
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8001/api/v1/document-export/resume/docx",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(clickMock).toHaveBeenCalled();
  });

  it("keeps sequential resume exports reliable by creating and cleaning up distinct download links", async () => {
    createObjectUrlMock
      .mockReset()
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(new Blob(["pdf"], { type: "application/pdf" }), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'attachment; filename="Resume - Styled.pdf"',
          },
        }),
      ),
    );

    const resumePayload = {
      schemaVersion: 1,
      kind: "resume" as const,
      locale: "en",
      title: "Resume",
      exportSource: "standard" as const,
      profile: {
        name: "Jane Doe",
        title: "",
        summary: "",
      },
      contact: [],
      metadata: [],
      skills: [],
      languages: [],
      experience: [],
      projects: [],
      education: [],
      achievements: [],
      hobbies: [],
    };

    await exportDocumentFile({
      kind: "resume",
      format: "pdf",
      mode: "ats",
      fileNameBase: "Resume - ATS",
      data: resumePayload,
    });

    await exportDocumentFile({
      kind: "resume",
      format: "pdf",
      mode: "styled",
      fileNameBase: "Resume - Styled",
      data: resumePayload,
      stylePreset: {
        layout: "editorial",
        typography: "quiet-editorial",
        palette: "pierre",
      },
    });

    expect(clickMock).toHaveBeenCalledTimes(2);
    expect(appendChildMock).toHaveBeenCalledTimes(2);
    expect(removeChildMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectUrlMock).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(revokeObjectUrlMock).toHaveBeenNthCalledWith(1, "blob:first");
    expect(revokeObjectUrlMock).toHaveBeenNthCalledWith(2, "blob:second");
  });

  it("captures the exact returned styled resume PDF bytes when export debug is enabled", async () => {
    window.__DASTI_DOCUMENT_EXPORT_DEBUG__ = {
      enabled: true,
      artifactDirRelative: "tmp/test-artifacts",
    };
    window.__DASTI_STYLED_RESUME_EXPORT_CONTEXT__ = {
      cvId: "cv-123",
      cvUrl: "http://127.0.0.1:5173/cv?id=cv-123",
      rendererVariantId: "robial",
      stylePreset: {
        layout: "two-column",
        typography: "quiet-editorial",
        palette: "sauge",
      },
      previewCapture: null,
      timestamp: 123,
    };
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([112, 100, 102, 45, 108, 105, 118, 101]), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="Resume - Styled.pdf"',
        },
      }),
    );

    await exportDocumentFile({
      kind: "resume",
      format: "pdf",
      mode: "styled",
      fileNameBase: "Resume - Styled",
      data: {
        schemaVersion: 1,
        kind: "resume",
        locale: "en",
        title: "Resume",
        exportSource: "standard",
        profile: {
          name: "Jane Doe",
          title: "",
          summary: "",
        },
        contact: [],
        metadata: [],
        skills: [],
        languages: [],
        experience: [],
        projects: [],
        education: [],
        achievements: [],
        hobbies: [],
      },
      stylePreset: {
        layout: "two-column",
        typography: "quiet-editorial",
        palette: "sauge",
      },
    });

    expect(window.__DASTI_LAST_DOCUMENT_EXPORT__).toEqual(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          kind: "resume",
          format: "pdf",
          mode: "styled",
        }),
        response: expect.objectContaining({
          responseStatus: 200,
          filename: "Resume - Styled.pdf",
          byteLength: 8,
          bytesBase64: "cGRmLWxpdmU=",
        }),
        clickContext: expect.objectContaining({
          cvId: "cv-123",
          rendererVariantId: "robial",
        }),
      }),
    );
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
