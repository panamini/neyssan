import { describe, expect, it } from "vitest";

import { ensureRemirrorDoc } from "../../components/remirror-editor/utils/conversion";
import { DEFAULT_VERBATI_STYLE } from "../../features/verbati/style";
import type { CvDocument } from "../../types/cvDocument";
import { buildCanonicalResumeRenderModelFromCv } from "../buildCanonicalResumeRenderModel";
import {
  buildResumeExportSource,
  buildStyledResumePrintSource,
} from "../document-export-models";

describe("buildCanonicalResumeRenderModel", () => {
  it("drives preview print and ats/docx export inputs from the same canonical content snapshot", () => {
    const document: CvDocument = {
      id: "cv-canonical-1",
      title: "Principal Operator",
      metadata: {
        createdAt: "2026-04-19T10:00:00.000Z",
        updatedAt: "2026-04-19T10:00:00.000Z",
        version: 1,
      },
      sections: [
        {
          id: "profile",
          title: "Profile",
          type: "profile",
          blocks: [],
          structuredContent: [
            {
              id: "profile-1",
              name: "Alex Martin",
              email: "alex@example.com",
              desiredPosition: "Principal Operator",
              location: "Paris, FR",
            },
          ],
        },
        {
          id: "summary",
          title: "Summary",
          type: "summary",
          blocks: [],
          structuredContent: [
            {
              id: "summary-1",
              summary: "Owns structured content systems across preview and export flows.",
            },
          ],
        },
        {
          id: "experience",
          title: "Experience",
          type: "experience",
          blocks: [],
          structuredContent: [
            {
              id: "exp-1",
              company: "Northline",
              position: "Operations Lead",
              startDate: "2023-01-01T00:00:00.000Z",
              isCurrent: true,
              responsibilities: ensureRemirrorDoc(
                "Led cross-functional delivery rituals.\nReduced export QA churn by 42%.",
              ),
              responsibilityBullets: ["STALE cached bullet"],
            },
          ],
        },
        {
          id: "skills",
          title: "Skills",
          type: "skills",
          blocks: [],
          structuredContent: [
            {
              id: "skill-1",
              name: "Program management",
              level: "Advanced",
            },
          ],
        },
      ],
    };

    const canonical = buildCanonicalResumeRenderModelFromCv(document);
    const previewSource = buildStyledResumePrintSource({
      currentCv: document,
      stylePreset: DEFAULT_VERBATI_STYLE,
    });
    const exportSource = buildResumeExportSource({
      currentCv: document,
    });

    expect(previewSource.resumeData).toEqual(canonical);
    expect(canonical.experience[0]?.description).toBe(
      "Led cross-functional delivery rituals. Reduced export QA churn by 42%.",
    );
    expect(canonical.experience[0]?.bullets).toEqual([]);
    expect(canonical.experience[0]?.responsibilitiesRich).toEqual({
      blocks: [
        {
          kind: "paragraph",
          runs: [
            {
              text: "Led cross-functional delivery rituals. Reduced export QA churn by 42%.",
            },
          ],
        },
      ],
    });
    expect(exportSource).toEqual(
      expect.objectContaining({
        profile: expect.objectContaining({
          name: canonical.name,
          title: canonical.title,
          summary: canonical.summary,
        }),
        contact: canonical.contact.map(({ label, value }) => ({ label, value })),
        skills: canonical.skills,
      }),
    );
    expect(exportSource?.experience[0]).toEqual(
      expect.objectContaining({
        role: canonical.experience[0]?.role,
        company: canonical.experience[0]?.company,
        summary: canonical.experience[0]?.description ?? "",
        bullets: canonical.experience[0]?.bullets,
      }),
    );
  });
});
