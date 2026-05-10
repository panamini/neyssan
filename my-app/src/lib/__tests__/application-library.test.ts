import { describe, expect, it } from "vitest";
import { buildWorkLibraryModel } from "../application-library";

const now = Date.parse("2026-05-10T12:00:00.000Z");

const cv = {
  id: "cv-1",
  title: "Porphyre",
  metadata: { updatedAt: "2026-05-09T12:00:00.000Z" },
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

describe("buildWorkLibraryModel", () => {
  it("builds CV items from CV library records", () => {
    const model = buildWorkLibraryModel({
      cvs: [cv as any],
      currentCvId: "cv-1",
      now,
    });

    expect(model.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "cv:cv-1",
          type: "cv",
          title: "Porphyre",
          source: "cv-library",
          cvDocument: expect.objectContaining({ id: "cv-1" }),
          previewLines: expect.arrayContaining(["Profile", "Senior product engineer."]),
          routeTarget: { kind: "route", to: "/cv?id=cv-1" },
        }),
      ]),
    );
  });

  it("maps draft Convex proposals to proposal items", () => {
    const model = buildWorkLibraryModel({
      proposals: [
        {
          _id: "draft-1",
          title: "Staff Designer draft",
          content: "Draft proposal body.",
          status: "draft",
          updatedAt: now - 1_000,
        },
      ],
      now,
    });

    expect(model.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "proposal:draft-1",
          type: "proposal",
          title: "Staff Designer draft",
          content: "Draft proposal body.",
          previewLines: expect.arrayContaining(["Draft proposal body."]),
          routeTarget: { kind: "route", to: "/proposal?draftId=draft-1" },
        }),
      ]),
    );
  });

  it("maps saved Convex proposals to proposal items", () => {
    const model = buildWorkLibraryModel({
      proposals: [
        {
          _id: "proposal-1",
          title: "Senior Frontend Engineer",
          content: "Saved proposal body.",
          status: "saved",
          updatedAt: now - 1_000,
        },
      ],
      now,
    });

    expect(model.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "proposal:proposal-1",
          type: "proposal",
          title: "Senior Frontend Engineer",
          content: "Saved proposal body.",
          routeTarget: {
            kind: "route",
            to: "/proposal?view=saved&id=proposal-1",
          },
        }),
      ]),
    );
  });

  it("maps local generated output with proposal text to a proposal item", () => {
    const model = buildWorkLibraryModel({
      outputDraft: {
        proposalDocumentTitle: "Local proposal",
        proposalContent: "Local generated body.",
        sourceComposeDraft: {
          jobTitle: "Security Officer",
          jobDescription: "Guard building access.",
        },
      } as any,
      now,
    });

    expect(model.items).toEqual([
      expect.objectContaining({
        id: "proposal:local",
        type: "proposal",
        title: "Local proposal",
        content: "Local generated body.",
        jobTitle: "Security Officer",
        source: "local",
        routeTarget: { kind: "route", to: "/proposal" },
      }),
    ]);
  });

  it("does not map compose-only job context to a proposal", () => {
    const model = buildWorkLibraryModel({
      composeDraft: {
        jobTitle: "Security Officer",
        jobDescription: "Guard building access.",
      } as any,
      now,
    });

    expect(model.items).toEqual([]);
    expect(model.allItems).toEqual([]);
  });

  it("exposes proposal job and linked CV metadata", () => {
    const model = buildWorkLibraryModel({
      proposals: [
        {
          _id: "proposal-1",
          title: "Building Security Guard",
          content: "Proposal body.",
          status: "draft",
          updatedAt: now - 1_000,
          metadata: {
            jobId: "job-1",
            sourceJobTitle: "Building Security Guard",
            sourceCvId: "cv-1",
          },
        },
      ],
      cvs: [cv as any],
      now,
    });

    expect(model.items[0]).toEqual(
      expect.objectContaining({
        type: "proposal",
        jobId: "job-1",
        jobTitle: "Building Security Guard",
        linkedCvId: "cv-1",
        linkedCvTitle: "Porphyre",
      }),
    );
  });

  it("sorts recent items by updated time", () => {
    const model = buildWorkLibraryModel({
      proposals: [
        { _id: "old", title: "Old", status: "draft", updatedAt: now - 20_000 },
        { _id: "new", title: "New", status: "saved", updatedAt: now - 1_000 },
      ],
      now,
    });

    expect(model.recentItems.map((item) => item.title)).toEqual(["New", "Old"]);
  });

  it("does not produce Application items or workflow states", () => {
    const model = buildWorkLibraryModel({
      proposals: [
        {
          _id: "sent-1",
          title: "Role one",
          status: "sent",
          updatedAt: now - 1_000,
          metadata: { sourceJobTitle: "Role one" },
        },
        {
          _id: "exported-1",
          title: "Role two",
          status: "exported",
          updatedAt: now - 2_000,
          metadata: { sourceJobTitle: "Role two" },
        },
        {
          _id: "applied-1",
          title: "Role three",
          status: "applied",
          updatedAt: now - 3_000,
          metadata: { sourceJobTitle: "Role three" },
        },
      ],
      now,
    });

    const visibleText = [
      ...model.items.flatMap((item) => [item.type, item.title, item.subtitle]),
      ...model.continueItems.flatMap((item) => [
        item.type,
        item.title,
        item.subtitle,
        item.primaryAction,
      ]),
      ...model.contextItems.flatMap((item) => [
        item.type,
        item.title,
        item.subtitle,
        item.primaryAction,
      ]),
    ].join(" ");

    expect(model.items.every((item) => item.type !== "application")).toBe(true);
    expect(JSON.stringify(model)).not.toMatch(/"status"|"statusLabel"/);
    expect(visibleText).not.toMatch(/Application|Needs review|Ready|Sent|Applied|Exported/i);
  });

  it("includes proposal and CV items in allItems for page search", () => {
    const model = buildWorkLibraryModel({
      proposals: [
        {
          _id: "proposal-1",
          title: "Product Engineer",
          content: "Proposal body.",
          status: "saved",
          updatedAt: now - 1_000,
          metadata: { sourceJobTitle: "Product Engineer" },
        },
      ],
      cvs: [cv as any],
      currentCvId: "cv-1",
      now,
    });

    expect(model.allItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "proposal", title: "Product Engineer" }),
        expect.objectContaining({ type: "cv", title: "Porphyre" }),
      ]),
    );
  });
});
