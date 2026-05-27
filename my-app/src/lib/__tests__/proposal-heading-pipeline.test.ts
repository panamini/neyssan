import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLocalCvDocumentStorageKey } from "../cv-local-storage";
import {
  buildProposalPreviewPrintSource,
  buildProposalExportSource,
} from "../document-export-models";
import {
  buildProposalApplicantContactLine,
  buildProposalContactLineFromParts,
  buildProposalHeadingMetadataPatch,
  mergeProposalContactDefaults,
  parseProposalContactLine,
  resolveAutoHeadingField,
} from "../proposal-heading-state";
import {
  buildProposalLetterDateLine,
  buildProposalRecipientPrefill,
  buildProposalSalutation,
  readProposalSalutation,
  replaceProposalSalutation,
} from "../proposal-header";
import {
  clearProposalAttachedCvId,
  getLocalPersonalizationSourceByCvId,
  setProposalAttachedCvId,
} from "../proposal-personalization";
import type { CvDocument } from "../../types/cvDocument";

const ATTACHED_CV_FIXTURE: CvDocument = {
  id: "cv_heading_fixture",
  title: "Alex Martin CV",
  metadata: {
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-11T10:00:00.000Z",
    version: 1,
  },
  sections: [
    {
      id: "profile",
      type: "profile",
      title: "Profile",
      blocks: [],
      structuredContent: [
        {
          name: "Alex Martin",
          desiredPosition: "Operations Associate",
          email: "alex@cv.example",
          phone: "+33 6 11 11 11 11",
          location: "Paris",
          linkedin: "linkedin.com/in/alexmartin",
          website: "alexmartin.dev",
        },
      ],
    },
    {
      id: "experience",
      type: "experience",
      title: "Experience",
      blocks: [],
      structuredContent: [
        {
          company: "Northstar Studio",
          position: "Operations Associate",
          responsibilities: "Reduced manual review time and improved handoffs.",
          achievements: ["Reduced manual review time by 30%."],
        },
      ],
    },
    {
      id: "education",
      type: "education",
      title: "Education",
      blocks: [],
      structuredContent: [
        {
          school: "Sorbonne University",
          degree: "MSc",
          fieldOfStudy: "Management",
        },
      ],
    },
    {
      id: "skills",
      type: "skills",
      title: "Skills",
      blocks: [],
      structuredContent: [{ name: "Operations" }, { name: "Workflow design" }],
    },
    {
      id: "certifications",
      type: "certifications",
      title: "Certifications",
      blocks: [],
      structuredContent: [{ name: "Notion Certified", issuer: "Notion" }],
    },
  ],
};

const JOB_FIXTURE = {
  company: "Northstar Studio",
  role: "Talent Acquisition Lead",
  city: "Paris",
  email: "jobs@northstar.example",
};

const SETTINGS_FIXTURE = {
  proposalDefaultContactEmail: "settings@example.com",
  proposalDefaultContactPhone: "+44 20 7000 0000",
  proposalDefaultContactLinkedin: "linkedin.com/in/settings",
  proposalDefaultContactWebsite: "settings.example",
  proposalDefaultContactLocation: "London",
};

const MANUAL_DRAFT_FIXTURE = {
  proposalApplicantName: "Alex Martin",
  proposalApplicantRole: "Manual Operations Lead",
  proposalContactLine:
    "manual@proposal.example · +33 6 99 99 99 99 · Rome · linkedin.com/in/manualalex · manualalex.dev",
  proposalRecipientDetails:
    "Jordan Lee\nTalent Acquisition Lead\nNorthstar Studio\nParis",
  proposalDocumentTitle: "Manual Proposal Title",
  proposalLetterDate: "Paris, 11 May 2026",
  proposalSalutationValue: "Dear Jordan Lee,",
};

const REGRESSION_AUTO_FIXTURE = {
  applicantName: "Alex Martin",
  applicantRole: "Operations Associate",
  contactLine:
    "alex.updated@cv.example · +33 6 22 22 22 22 · Lyon · linkedin.com/in/alexmartin-updated · alexmartin.co",
  documentTitle: "Operations Associate Proposal",
  letterDate: "Paris, 12 May 2026",
  recipientDetails: buildProposalRecipientPrefill({
    company: JOB_FIXTURE.company,
    role: JOB_FIXTURE.role,
    city: JOB_FIXTURE.city,
    email: JOB_FIXTURE.email,
  }),
  salutation: buildProposalSalutation(
    buildProposalRecipientPrefill({
      company: JOB_FIXTURE.company,
      role: JOB_FIXTURE.role,
      city: JOB_FIXTURE.city,
      email: JOB_FIXTURE.email,
    }),
  ),
};

function storeAttachedCvFixture(): void {
  window.localStorage.setItem(
    getLocalCvDocumentStorageKey(ATTACHED_CV_FIXTURE.id),
    JSON.stringify(ATTACHED_CV_FIXTURE),
  );
  setProposalAttachedCvId(ATTACHED_CV_FIXTURE.id);
}

function buildPipelineResult(args: {
  draftRecipientDetails?: string;
  draftSalutation?: string;
  draftDocumentTitle?: string;
  draftLetterDate?: string;
}) {
  const attachedSource = getLocalPersonalizationSourceByCvId(
    ATTACHED_CV_FIXTURE.id,
  );
  const mergedSource = mergeProposalContactDefaults(
    attachedSource,
    SETTINGS_FIXTURE,
  );

  const applicantHeader = {
    name: mergedSource.personalizationContext?.name ?? null,
    role:
      mergedSource.personalizationContext?.desiredPosition ??
      mergedSource.personalizationContext?.recentExperience?.[0]?.position ??
      null,
    email: mergedSource.email ?? null,
    phone: mergedSource.phone ?? null,
    linkedin: mergedSource.linkedin ?? null,
    website: mergedSource.website ?? null,
    location: mergedSource.location ?? null,
    tag: mergedSource.personalizationContext?.topSkills?.[0] ?? null,
  };

  const autoApplicantHeader = {
    name: applicantHeader.name ?? "",
    role: applicantHeader.role ?? "",
    contactLine: buildProposalApplicantContactLine(mergedSource),
  };
  const autoLetterDate = buildProposalLetterDateLine({
    location: mergedSource.location,
  });
  const autoRecipientDetails = buildProposalRecipientPrefill(JOB_FIXTURE);
  const autoSalutation = buildProposalSalutation(autoRecipientDetails);
  const nextAutoDocumentTitle = REGRESSION_AUTO_FIXTURE.documentTitle;

  const resolvedApplicantName = resolveAutoHeadingField({
    current: MANUAL_DRAFT_FIXTURE.proposalApplicantName,
    previousAuto: autoApplicantHeader.name,
    nextAuto: REGRESSION_AUTO_FIXTURE.applicantName,
  });
  const resolvedApplicantRole = resolveAutoHeadingField({
    current: MANUAL_DRAFT_FIXTURE.proposalApplicantRole,
    previousAuto: autoApplicantHeader.role,
    nextAuto: REGRESSION_AUTO_FIXTURE.applicantRole,
  });
  const resolvedContactLine = resolveAutoHeadingField({
    current: MANUAL_DRAFT_FIXTURE.proposalContactLine,
    previousAuto: autoApplicantHeader.contactLine,
    nextAuto: REGRESSION_AUTO_FIXTURE.contactLine,
  });
  const resolvedRecipientDetails =
    args.draftRecipientDetails?.trim() || autoRecipientDetails;
  const resolvedLetterDate = resolveAutoHeadingField({
    current: args.draftLetterDate ?? MANUAL_DRAFT_FIXTURE.proposalLetterDate,
    previousAuto: autoLetterDate,
    nextAuto: REGRESSION_AUTO_FIXTURE.letterDate,
  });
  const resolvedDocumentTitle = resolveAutoHeadingField({
    current:
      args.draftDocumentTitle ?? MANUAL_DRAFT_FIXTURE.proposalDocumentTitle,
    previousAuto: "Operations Associate Proposal",
    nextAuto: nextAutoDocumentTitle,
  });
  const resolvedSalutation = resolveAutoHeadingField({
    current:
      args.draftSalutation ?? MANUAL_DRAFT_FIXTURE.proposalSalutationValue,
    previousAuto: autoSalutation,
    nextAuto: REGRESSION_AUTO_FIXTURE.salutation,
  });

  const generatedContent = [
    autoSalutation,
    "",
    "We are shipping a proposal with corrected heading precedence.",
    "",
    "Best,",
    "Alex Martin",
  ].join("\n");
  const proposalContent =
    resolvedSalutation && resolvedSalutation !== autoSalutation
      ? replaceProposalSalutation({
          content: generatedContent,
          salutation: resolvedSalutation,
          previousSalutation: readProposalSalutation(generatedContent),
        })
      : generatedContent;

  const headingMetadataPatch = buildProposalHeadingMetadataPatch({
    applicantName: resolvedApplicantName,
    applicantRole: resolvedApplicantRole,
    contactLine: resolvedContactLine,
    letterDate: resolvedLetterDate,
    recipientDetails: resolvedRecipientDetails,
    headerVisibility: {
      showSender: true,
      showDate: true,
      showSubject: true,
      showRecipient: true,
      showRecipientDetails: false,
    },
  });

  const previewSource = buildProposalPreviewPrintSource({
    content: proposalContent,
    proposalType: "cover_letter",
    voicePreset: "signature",
    railTitle: resolvedApplicantName,
    railMeta: "Cover letter · Signature",
    contactLine: resolvedContactLine,
    letterDate: resolvedLetterDate,
    recipientDetails: resolvedRecipientDetails,
    documentTitle: resolvedDocumentTitle,
    documentMeta: "Cover letter · Signature",
    applicantHeader: {
      name: resolvedApplicantName,
      role: resolvedApplicantRole,
      email: mergedSource.email ?? undefined,
      phone: mergedSource.phone ?? undefined,
      linkedin: mergedSource.linkedin ?? undefined,
      website: mergedSource.website ?? undefined,
      location: mergedSource.location ?? undefined,
      tag: applicantHeader.tag ?? undefined,
    },
    headerVisibility: headingMetadataPatch,
    templateId: "editorial_wide",
  });

  const exportSource = buildProposalExportSource({
    content: proposalContent,
    proposalType: "cover_letter",
    documentTitle: resolvedDocumentTitle,
    documentMeta: "Cover letter · Signature",
    contactLine: resolvedContactLine,
    letterDate: resolvedLetterDate,
    recipientDetails: resolvedRecipientDetails,
    applicantHeader: {
      name: resolvedApplicantName,
      role: resolvedApplicantRole,
      email: mergedSource.email ?? undefined,
      phone: mergedSource.phone ?? undefined,
      linkedin: mergedSource.linkedin ?? undefined,
      website: mergedSource.website ?? undefined,
      location: mergedSource.location ?? undefined,
      tag: applicantHeader.tag ?? undefined,
    },
    headerVisibility: headingMetadataPatch,
    templateId: "editorial_wide",
  });

  return {
    attachedSource,
    mergedSource,
    autoApplicantHeader,
    autoLetterDate,
    autoRecipientDetails,
    autoSalutation,
    resolvedApplicantName,
    resolvedApplicantRole,
    resolvedContactLine,
    resolvedRecipientDetails,
    resolvedLetterDate,
    resolvedDocumentTitle,
    resolvedSalutation,
    headingMetadataPatch,
    previewSource: {
      documentTitle: previewSource.documentTitle,
      documentMeta: previewSource.documentMeta,
      contactLine: previewSource.contactLine,
      letterDate: previewSource.letterDate,
      recipientDetails: previewSource.recipientDetails,
      applicantHeader: previewSource.applicantHeader,
      content: previewSource.content,
    },
    exportSource: {
      documentTitle: exportSource.documentTitle,
      documentMeta: exportSource.documentMeta,
      contactLine: exportSource.contactLine,
      letterDate: exportSource.letterDate,
      recipientDetails: exportSource.recipientDetails,
      applicantHeader: exportSource.applicantHeader,
      body: exportSource.body.map((block) =>
        block.type === "closing"
          ? {
              type: block.type,
              signOff: block.signOff,
              signatureName: block.signatureName,
              handwrittenSignatureEnabled:
                block.handwrittenSignatureEnabled ?? false,
            }
          : {
              type: block.type,
              text: block.text,
            },
      ),
    },
  };
}

describe("proposal heading JSON pipeline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-11T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    clearProposalAttachedCvId();
    window.localStorage.clear();
  });

  it("keeps combined contact-line storage while exposing structured contact fields", () => {
    const parts = parseProposalContactLine(
      "zoe@loi.com · 09898777 · Paris · @zoe · zoe.com",
    );

    expect(parts).toEqual({
      email: "zoe@loi.com",
      phone: "09898777",
      location: "Paris",
      linkedin: "@zoe",
      website: "zoe.com",
      other: "",
    });
    expect(
      buildProposalContactLineFromParts({
        ...parts,
        phone: "+33 6 00 00 00 00",
      }),
    ).toBe("zoe@loi.com · +33 6 00 00 00 00 · Paris · @zoe · zoe.com");
    expect(
      parseProposalContactLine("Letter · zoe@loi.com · 09898777 · Paris"),
    ).toEqual({
      email: "zoe@loi.com",
      phone: "09898777",
      location: "Paris",
      linkedin: "",
      website: "",
      other: "",
    });
  });

  it("keeps CV contact ahead of settings, applies manual overrides, and emits placeholder-free export and preview payloads", () => {
    storeAttachedCvFixture();

    const result = buildPipelineResult({
      draftRecipientDetails: MANUAL_DRAFT_FIXTURE.proposalRecipientDetails,
      draftSalutation: MANUAL_DRAFT_FIXTURE.proposalSalutationValue,
      draftDocumentTitle: MANUAL_DRAFT_FIXTURE.proposalDocumentTitle,
      draftLetterDate: MANUAL_DRAFT_FIXTURE.proposalLetterDate,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "attachedSource": {
          "email": "alex@cv.example",
          "linkedin": "linkedin.com/in/alexmartin",
          "location": "Paris",
          "personalizationContext": {
            "desiredPosition": "Operations Associate",
            "name": "Alex Martin",
            "recentExperience": [
              {
                "company": "Northstar Studio",
                "highlights": [
                  "Reduced manual review time by 30%.",
                  "Reduced manual review time and improved handoffs.",
                ],
                "position": "Operations Associate",
              },
            ],
            "standoutAchievements": [
              "Reduced manual review time by 30%.",
            ],
            "topSkills": [
              "Operations",
              "Workflow design",
            ],
          },
          "phone": "+33 6 11 11 11 11",
          "richness": "rich",
          "title": "Operations Associate — Alex Martin",
          "website": "alexmartin.dev",
        },
        "autoApplicantHeader": {
          "contactLine": "alex@cv.example · +33 6 11 11 11 11 · Paris · linkedin.com/in/alexmartin · alexmartin.dev",
          "name": "Alex Martin",
          "role": "Operations Associate",
        },
        "autoLetterDate": "Paris, May 11, 2026",
        "autoRecipientDetails": "Talent Acquisition Lead
      Northstar Studio
      jobs@northstar.example
      Paris",
        "autoSalutation": "Dear Talent Acquisition Lead,",
        "exportSource": {
          "applicantHeader": {
            "company": "",
            "email": "alex@cv.example",
            "linkedin": "linkedin.com/in/alexmartin",
            "location": "Paris",
            "name": "Alex Martin",
            "phone": "+33 6 11 11 11 11",
            "role": "Manual Operations Lead",
            "tag": "Operations",
            "website": "alexmartin.dev",
          },
          "body": [
            {
              "text": "Dear Jordan Lee,",
              "type": "salutation",
            },
            {
              "text": "We are shipping a proposal with corrected heading precedence.",
              "type": "paragraph",
            },
            {
              "text": "Best,
      Alex Martin",
              "type": "paragraph",
            },
          ],
          "contactLine": "manual@proposal.example · +33 6 99 99 99 99 · Rome · linkedin.com/in/manualalex · manualalex.dev",
          "documentMeta": "Cover letter · Signature",
          "documentTitle": "Manual Proposal Title",
          "letterDate": "Paris, 11 May 2026",
          "recipientDetails": "Jordan Lee
      Talent Acquisition Lead
      Northstar Studio
      Paris",
        },
        "headingMetadataPatch": {
          "applicantCompany": "",
          "applicantName": "Alex Martin",
          "applicantRole": "Manual Operations Lead",
          "contactLine": "manual@proposal.example · +33 6 99 99 99 99 · Rome · linkedin.com/in/manualalex · manualalex.dev",
          "headerShowDate": true,
          "headerShowRecipient": true,
          "headerShowRecipientDetails": false,
          "headerShowSender": true,
          "headerShowSubject": true,
          "letterDate": "Paris, 11 May 2026",
          "recipientDetails": "Jordan Lee
      Talent Acquisition Lead
      Northstar Studio
      Paris",
        },
        "mergedSource": {
          "email": "alex@cv.example",
          "linkedin": "linkedin.com/in/alexmartin",
          "location": "Paris",
          "personalizationContext": {
            "desiredPosition": "Operations Associate",
            "name": "Alex Martin",
            "recentExperience": [
              {
                "company": "Northstar Studio",
                "highlights": [
                  "Reduced manual review time by 30%.",
                  "Reduced manual review time and improved handoffs.",
                ],
                "position": "Operations Associate",
              },
            ],
            "standoutAchievements": [
              "Reduced manual review time by 30%.",
            ],
            "topSkills": [
              "Operations",
              "Workflow design",
            ],
          },
          "phone": "+33 6 11 11 11 11",
          "richness": "rich",
          "title": "Operations Associate — Alex Martin",
          "website": "alexmartin.dev",
        },
        "previewSource": {
          "applicantHeader": {
            "company": "",
            "email": "alex@cv.example",
            "linkedin": "linkedin.com/in/alexmartin",
            "location": "Paris",
            "name": "Alex Martin",
            "phone": "+33 6 11 11 11 11",
            "role": "Manual Operations Lead",
            "tag": "Operations",
            "website": "alexmartin.dev",
          },
          "contactLine": "manual@proposal.example · +33 6 99 99 99 99 · Rome · linkedin.com/in/manualalex · manualalex.dev",
          "content": "Dear Jordan Lee,

      We are shipping a proposal with corrected heading precedence.

      Best,
      Alex Martin",
          "documentMeta": "Cover letter · Signature",
          "documentTitle": "Manual Proposal Title",
          "letterDate": "Paris, 11 May 2026",
          "recipientDetails": "Jordan Lee
      Talent Acquisition Lead
      Northstar Studio
      Paris",
        },
        "resolvedApplicantName": "Alex Martin",
        "resolvedApplicantRole": "Manual Operations Lead",
        "resolvedContactLine": "manual@proposal.example · +33 6 99 99 99 99 · Rome · linkedin.com/in/manualalex · manualalex.dev",
        "resolvedDocumentTitle": "Manual Proposal Title",
        "resolvedLetterDate": "Paris, 11 May 2026",
        "resolvedRecipientDetails": "Jordan Lee
      Talent Acquisition Lead
      Northstar Studio
      Paris",
        "resolvedSalutation": "Dear Jordan Lee,",
      }
    `);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Full name");
    expect(serialized).not.toContain("Contact information");
    expect(serialized).not.toContain("Hiring manager or team");
    expect(serialized).not.toContain("Dear Hiring Manager,");
  });

  it("prefills recipient details from the job when the draft field is empty and keeps manual edits through regeneration", () => {
    storeAttachedCvFixture();

    const result = buildPipelineResult({
      draftRecipientDetails: "",
      draftSalutation: "Dear Talent Acquisition Lead,",
      draftDocumentTitle: "Manual Proposal Title",
      draftLetterDate: "Paris, 11 May 2026",
    });

    expect(result.resolvedRecipientDetails).toBe(
      "Talent Acquisition Lead\nNorthstar Studio\njobs@northstar.example\nParis",
    );
    expect(result.previewSource.recipientDetails).toBe(
      "Talent Acquisition Lead\nNorthstar Studio\njobs@northstar.example\nParis",
    );
    expect(result.resolvedSalutation).toBe("Dear Talent Acquisition Lead,");
    expect(result.exportSource.body[0]).toEqual({
      type: "salutation",
      text: "Dear Talent Acquisition Lead,",
    });
  });
});
