import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryItem } from "../application-library";
import {
  buildLibraryItemPdfBlob,
  buildLibraryItemsZipBlob,
  downloadLibraryItems,
  sanitizeDownloadFilename,
} from "../library-download";

const { buildExportDocumentFileBlobMock, downloadBlobMock } = vi.hoisted(() => ({
  buildExportDocumentFileBlobMock: vi.fn(),
  downloadBlobMock: vi.fn(),
}));

vi.mock("../exportDocumentFile", () => ({
  buildExportDocumentFileBlob: (...args: unknown[]) =>
    buildExportDocumentFileBlobMock(...args),
  downloadBlob: (...args: unknown[]) => downloadBlobMock(...args),
}));

const cvDocument = {
  id: "cv-1",
  title: "Porphyre",
  metadata: {
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-09T12:00:00.000Z",
    version: 1,
  },
  sections: [
    {
      id: "summary",
      title: "Profile",
      type: "summary",
      blocks: [],
      structuredContent: [{ summary: "Senior product engineer." }],
    },
  ],
};

const cvItem: LibraryItem = {
  id: "cv:cv-1",
  type: "cv",
  title: "Porphyre / CV",
  subtitle: "CV profile",
  updatedAt: Date.parse("2026-05-09T12:00:00.000Z"),
  routeTarget: { kind: "route", to: "/cv?id=cv-1" },
  source: "cv-library",
  cvDocument: cvDocument as any,
};

const proposalItem: LibraryItem = {
  id: "proposal:proposal-1",
  type: "proposal",
  title: "Senior Frontend: Linear",
  subtitle: "Proposal text",
  updatedAt: Date.parse("2026-05-09T12:00:00.000Z"),
  routeTarget: { kind: "route", to: "/proposal?view=saved&id=proposal-1" },
  source: "convex",
  content: "Dear team,\n\nI am interested in the role.",
  jobId: "job-1",
  jobTitle: "Senior Frontend",
  linkedCvId: "cv-1",
  linkedCvTitle: "Porphyre",
};

describe("library-download", () => {
  beforeEach(() => {
    buildExportDocumentFileBlobMock.mockReset();
    downloadBlobMock.mockReset();
    buildExportDocumentFileBlobMock.mockImplementation((args: { fileNameBase: string }) =>
      Promise.resolve({
        filename: `${args.fileNameBase}.pdf`,
        blob: new Blob([args.fileNameBase], { type: "application/pdf" }),
      }),
    );
  });

  it("sanitizes download filenames", () => {
    expect(sanitizeDownloadFilename("ACME / Senior: CV", "cv")).toBe("ACME Senior CV");
    expect(sanitizeDownloadFilename("  ", "proposal")).toBe("proposal");
  });

  it("builds CV PDFs through the existing resume export path", async () => {
    const pdf = await buildLibraryItemPdfBlob(cvItem);

    expect(buildExportDocumentFileBlobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "resume",
        format: "pdf",
        mode: "styled",
        fileNameBase: "Porphyre CV",
      }),
    );
    expect(pdf.filename).toBe("Porphyre CV.pdf");
    expect(pdf.blob.type).toBe("application/pdf");
  });

  it("hydrates summary-only CVs before building download PDFs", async () => {
    const hydrateCvDocument = vi.fn().mockResolvedValue(cvDocument);
    const summaryOnlyCvItem: LibraryItem = {
      ...cvItem,
      cvDocument: {
        id: "cv-1",
        title: "Summary only",
        metadata: { librarySummaryOnly: true },
        sections: [],
      } as any,
    };

    await buildLibraryItemPdfBlob(summaryOnlyCvItem, { hydrateCvDocument });

    expect(hydrateCvDocument).toHaveBeenCalledWith("cv-1");
    expect(buildExportDocumentFileBlobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "resume",
        data: expect.objectContaining({
          committedPages: expect.any(Array),
        }),
      }),
    );
  });

  it("blocks CV downloads when hydration cannot resolve a full document", async () => {
    const hydrateCvDocument = vi.fn().mockResolvedValue(null);
    const summaryOnlyCvItem: LibraryItem = {
      ...cvItem,
      cvDocument: {
        id: "cv-1",
        title: "Summary only",
        metadata: { librarySummaryOnly: true },
        sections: [],
      } as any,
    };

    await expect(
      buildLibraryItemPdfBlob(summaryOnlyCvItem, { hydrateCvDocument }),
    ).rejects.toThrow("CV export source is unavailable.");
    expect(buildExportDocumentFileBlobMock).not.toHaveBeenCalled();
  });

  it("builds proposal PDFs through the existing proposal export path", async () => {
    const pdf = await buildLibraryItemPdfBlob(proposalItem);

    expect(buildExportDocumentFileBlobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "proposal",
        format: "pdf",
        mode: "styled",
        fileNameBase: "Senior Frontend Linear",
      }),
    );
    expect(pdf.filename).toBe("Senior Frontend Linear.pdf");
  });

  it("downloads one selected item directly as a PDF", async () => {
    await downloadLibraryItems([cvItem]);

    expect(downloadBlobMock).toHaveBeenCalledWith(
      expect.any(Blob),
      "Porphyre CV.pdf",
    );
  });

  it("downloads multiple selected items as one ZIP", async () => {
    const result = await downloadLibraryItems([cvItem, proposalItem]);

    expect(result).toEqual({ downloaded: 2, skipped: 0 });
    expect(downloadBlobMock).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.stringMatching(/^twoweeks-documents-\d{4}-\d{2}-\d{2}\.zip$/),
    );
  });

  it("skips unsupported selected items without freezing supported downloads", async () => {
    const unsupportedProposal = {
      ...proposalItem,
      id: "proposal:empty",
      content: "",
    };

    const result = await buildLibraryItemsZipBlob([cvItem, unsupportedProposal]);

    expect(result.downloaded).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.filename).toMatch(/^twoweeks-documents-\d{4}-\d{2}-\d{2}\.zip$/);
  });
});
