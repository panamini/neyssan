import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach } from "vitest";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CvForge } from "../CvForge";

const {
  importFileMock,
  useCvLibraryMock,
  transformEditorSelectionMock,
  runCvSectionAiActionMock,
} = vi.hoisted(() => ({
  importFileMock: vi.fn(),
  useCvLibraryMock: vi.fn(),
  transformEditorSelectionMock: vi.fn(),
  runCvSectionAiActionMock: vi.fn(),
}));

vi.mock("../../components/ProfileReviewCard", () => ({
  ProfileReviewCard: ({
    cvId,
    toolbarLeadControl,
    toolbarPrimaryControl,
  }: {
    cvId?: string;
    toolbarLeadControl?: React.ReactNode;
    toolbarPrimaryControl?: React.ReactNode;
  }) => (
    <div>
      <div className="dasti-cv-edit-toolbar">
        <div className="dasti-workbench-top-left-slot--cv">
          <div className="dasti-cv-workbench-toggle">{toolbarLeadControl}</div>
        </div>
        <div className="dasti-workbench-top-right-slot--cv">
          {toolbarPrimaryControl}
        </div>
      </div>
      <div>Mock profile editor {cvId ?? "none"}</div>
    </div>
  ),
}));

vi.mock("../../components/EmbeddedStyleInspector", () => ({
  default: ({
    onSelectLayout,
    onSelectTypography,
    onSelectPalette,
  }: {
    onSelectLayout?: (layout: "editorial") => void;
    onSelectTypography?: (typography: "soft-serif") => void;
    onSelectPalette?: (palette: "encre") => void;
  }) => (
    <div>
      <button
        type="button"
        aria-label="Open text styles"
        onClick={() => onSelectTypography?.("soft-serif")}
      >
        Text
      </button>
      <button
        type="button"
        aria-label="Open layout controls"
        onClick={() => onSelectLayout?.("editorial")}
      >
        Layout
      </button>
      <button
        type="button"
        aria-label="Open palette controls"
        onClick={() => onSelectPalette?.("encre")}
      >
        Color
      </button>
    </div>
  ),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
  })),
  useMutation: vi.fn(() => vi.fn(async () => undefined)),
  useQuery: vi.fn((reference: string, args?: unknown) => {
    if (reference === "proposalSettings.getPresets") {
      return {
        preset1: {
          fontPairId: "quiet-editorial",
          styleChoice: "balanced",
          paletteOverride: "pierre",
          accentHex: null,
          voicePreset: null,
          name: "Stone Swiss",
        },
        preset2: null,
        preset3: null,
        activeSlot: 1,
      };
    }
    if (reference === "proposalSettings.getCurrent") {
      return {
        voicePreset: "engaging",
        savedVoicePreset: "engaging",
      };
    }
    if (reference === "jobsPublic.getById") {
      if (args === "skip") {
        return undefined;
      }
      return {
        id: "job_123",
        title: "Senior Product Designer",
        company: "Acme",
      };
    }
    return null;
  }),
  useAction: vi.fn((reference: string) => {
    if (reference === "functions.runCvSectionAiAction") {
      return runCvSectionAiActionMock;
    }
    return transformEditorSelectionMock;
  }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    proposalSettings: {
      getPresets: "proposalSettings.getPresets",
      getCurrent: "proposalSettings.getCurrent",
    },
    functions: {
      transformEditorSelection: "functions.transformEditorSelection",
      runCvSectionAiAction: "functions.runCvSectionAiAction",
    },
    jobsPublic: {
      getById: "jobsPublic.getById",
      approveReviewItem: "jobsPublic.approveReviewItem",
      updateField: "jobsPublic.updateField",
    },
  },
}));

vi.mock("../../lib/buildCanonicalResumeRenderModel", () => ({
  buildCanonicalResumeRenderModelFromCv: (cv: {
    sections?: Array<Record<string, any>>;
  }) => {
    function readMockPlainText(value: unknown): string {
      if (typeof value === "string") return value;
      if (!value || typeof value !== "object") return "";
      const record = value as Record<string, unknown>;
      if (Array.isArray(record.content)) {
        return record.content
          .map((entry) => readMockPlainText(entry))
          .filter(Boolean)
          .join("\n");
      }
      if (typeof record.text === "string") return record.text;
      return "";
    }

    const sections = cv.sections ?? [];
    const profileSection = sections.find((section) => section.type === "profile");
    const profileItem = Array.isArray(profileSection?.structuredContent)
      ? profileSection.structuredContent[0] ?? {}
      : {};
    const contact = [
      ["Email", "email"],
      ["Phone", "phone"],
      ["Location", "location"],
      ["LinkedIn", "linkedin"],
      ["Website", "website"],
    ]
      .map(([label, key]) => {
        const value = String(profileItem?.[key] ?? "").trim();
        return value
          ? {
              label,
              value,
              itemId: key,
              sectionId: String(profileSection?.id ?? "profile-cv_123"),
              sectionType: "profile",
            }
          : null;
      })
      .filter(Boolean);
    const summarySection = sections.find((section) => section.type === "summary");
    const summaryItem = Array.isArray(summarySection?.structuredContent)
      ? summarySection.structuredContent[0]
      : null;
    const textSections = sections
      .filter(
        (section) =>
          section.type === "text" &&
          String(section.title ?? "").toLowerCase() !== "hobbies",
      )
      .map((section, index) => ({
        id: `text-section-${section.id ?? index}`,
        sectionId: String(section.id),
        sectionType:
          String(section.title ?? "").toLowerCase() === "additional information"
            ? "additional_information"
            : "custom",
        sectionTitle: String(section.title ?? "Custom section"),
        sectionOrder: index,
        text: readMockPlainText(section.blocks?.[0]?.plainText ?? section.blocks?.[0]?.content),
      }));

    return {
      name: "Ada Lovelace",
      title: "Product Designer",
      summary: readMockPlainText(summaryItem?.summary),
      summarySectionId: String(summarySection?.id ?? "summary-cv_123"),
      contact,
      metadata: [],
      experience: [
        {
          id: "experience-item-cv_123",
          sectionId: "experience-cv_123",
          role: "Lead designer",
          company: "Studio",
          period: "2022 - 2026",
          location: "",
          bullets: ["Led product design."],
        },
      ],
      education: [
        {
          id: "education-item-cv_123",
          sectionId: "education-cv_123",
          degree: "MFA",
          school: "Design School",
          period: "",
        },
      ],
      skills: ["TypeScript"],
      skillItems: [
        {
          id: "skill-cv_123",
          name: "TypeScript",
          sectionId: "skills-cv_123",
          sectionType: "skills",
        },
      ],
      projects: [],
      certifications: [
        {
          id: "cert-cv_123",
          name: "UX cert",
          sectionId: "certifications-cv_123",
          sectionType: "certifications",
        },
      ],
      languages: [
        {
          id: "language-cv_123",
          name: "English",
          level: "Intermediate",
          sectionId: "languages-cv_123",
          sectionType: "languages",
        },
      ],
      affiliations: [],
      achievementItems: [
        {
          id: "achievement-cv_123",
          text: "Shipped PR4.",
          sectionId: "achievements-cv_123",
          sectionType: "achievements",
        },
      ],
      hobbies: ["Photography"],
      hobbyItems: [
        {
          id: "hobby-cv_123",
          name: "Photography",
          sectionId: "hobbies-cv_123",
          sectionType: "hobbies",
        },
      ],
      textSections,
    };
  },
}));

vi.mock("../../features/verbati/cvDocumentToResumeData", () => ({
  hasRenderableResumeData: (data: unknown) => Boolean(data),
}));

vi.mock("../../features/verbati/VerbatiResumePreview", () => ({
  VerbatiResumePreview: ({
    data,
    activeTarget,
    hostMode,
    inlineEditing,
    onLinkIntent,
    stylePreset,
  }: {
    data?: {
      summary?: string;
      summarySectionId?: string;
      textSections?: Array<{
        id: string;
        sectionId: string;
        sectionType: "additional_information" | "custom";
        sectionTitle: string;
        text: string;
      }>;
      contact?: Array<{
        label: string;
        value: string;
        itemId: string;
        sectionId: string;
        sectionType: string;
      }>;
      experience?: Array<{ role: string }>;
      education?: Array<{ degree: string }>;
      skillItems?: Array<{ name: string }>;
      languages?: Array<{ name: string }>;
      hobbyItems?: Array<{ name: string }>;
      achievementItems?: Array<{ text: string }>;
    };
    activeTarget?: { sectionId?: string | null } | null;
    hostMode?: "panel" | "workspace";
    inlineEditing?: {
      enabled: boolean;
      activeTarget: {
        sectionId: string;
        sectionType: string;
        fieldPath: string;
        fieldKind: "paragraph" | "heading" | "bullet" | "chip" | "date" | "meta";
        itemIndex?: number;
        bulletIndex?: number;
        chipIndex?: number;
      } | null;
      onActivate: (target: {
        sectionId: string;
        sectionType: string;
        fieldPath: string;
        fieldKind: "paragraph" | "heading" | "bullet" | "chip" | "date" | "meta";
        itemIndex?: number;
        bulletIndex?: number;
        chipIndex?: number;
      }) => void;
      onDeactivate: (target?: {
        sectionId: string;
        sectionType: string;
        fieldPath: string;
        fieldKind: "paragraph" | "heading" | "bullet" | "chip" | "date" | "meta";
        itemIndex?: number;
        bulletIndex?: number;
        chipIndex?: number;
      }) => void;
      onSummaryChange: (text: string) => void;
      onTextSectionChange: (sectionId: string, text: string) => void;
      onFieldChange?: (
        target: {
          sectionId: string;
          sectionType: string;
          fieldPath: string;
          fieldKind: "paragraph" | "heading" | "bullet" | "chip" | "date" | "meta";
          itemIndex?: number;
          bulletIndex?: number;
          chipIndex?: number;
        },
        text: string,
      ) => void;
      onAddItem?: (request: {
        sectionId: string;
        sectionType: string;
        itemKind: "bullet";
        parentItemId?: string;
      }) => void;
    };
    onLinkIntent?: (intent: {
      requestId: string;
      sectionType:
        | "summary"
        | "experience"
        | "education"
        | "additional_information"
        | "custom";
      sectionId: string;
      source: "preview-panel";
      shouldOpenModal: boolean;
    }) => void;
    stylePreset?: {
      accentHex?: string | null;
      layout?: string | null;
      typography?: string | null;
      palette?: string | null;
    };
  }) => {
    const summaryEditTarget = {
      sectionId: data?.summarySectionId ?? "summary-cv_123",
      sectionType: "summary",
      fieldPath: "structuredContent.0.summary",
      fieldKind: "paragraph" as const,
    };
    const isSummaryEditable = Boolean(inlineEditing?.enabled);

    return (
    <div>
      Preview host: {hostMode ?? "panel"}
      <div data-testid="preview-active-section">
        {activeTarget?.sectionId ?? "none"}
      </div>
      <div data-testid="paper-contact-row">
        {(data?.contact ?? []).map((item) => {
          const editTarget = {
            sectionId: item.sectionId,
            sectionType: "profile",
            fieldPath: `structuredContent.0.${item.itemId}`,
            fieldKind: "meta" as const,
          };
          const isContactEditable = Boolean(inlineEditing?.enabled);

          return (
            <span
              key={item.itemId}
              aria-label={`Paper ${item.label}`}
              data-testid={`paper-contact-${item.itemId}`}
              contentEditable={isContactEditable ? "plaintext-only" : undefined}
              suppressContentEditableWarning={isContactEditable}
              role={isContactEditable ? "textbox" : undefined}
              tabIndex={isContactEditable ? 0 : undefined}
              data-inline-paper-editable={isContactEditable ? "true" : undefined}
              data-paper-section-id={editTarget.sectionId}
              data-paper-section-type={editTarget.sectionType}
              data-paper-field-path={editTarget.fieldPath}
              data-paper-field-kind={editTarget.fieldKind}
              onFocus={() => inlineEditing?.onActivate(editTarget)}
              onInput={(event) => {
                inlineEditing?.onActivate(editTarget);
                inlineEditing?.onFieldChange?.(
                  editTarget,
                  event.currentTarget.textContent ?? "",
                );
              }}
              onBlur={() => inlineEditing?.onDeactivate(editTarget)}
            >
              {item.value}
            </span>
          );
        })}
      </div>
      <p
        aria-label="Paper Summary paragraph"
        data-testid="paper-summary-paragraph"
        contentEditable={isSummaryEditable ? "plaintext-only" : undefined}
        suppressContentEditableWarning={isSummaryEditable}
        role={isSummaryEditable ? "textbox" : undefined}
        tabIndex={isSummaryEditable ? 0 : undefined}
        data-inline-paper-editable={isSummaryEditable ? "true" : undefined}
        data-paper-section-id={summaryEditTarget.sectionId}
        data-paper-section-type={summaryEditTarget.sectionType}
        data-paper-field-path={summaryEditTarget.fieldPath}
        data-paper-field-kind={summaryEditTarget.fieldKind}
        onFocus={() => inlineEditing?.onActivate(summaryEditTarget)}
        onClick={(event) => {
          if (inlineEditing?.enabled) {
            event.stopPropagation();
            inlineEditing.onActivate(summaryEditTarget);
            return;
          }
          onLinkIntent?.({
            requestId: "paper-summary",
            sectionType: "summary",
            sectionId: data?.summarySectionId ?? "summary-cv_123",
            source: "preview-panel",
            shouldOpenModal: false,
          });
        }}
        onInput={(event) =>
          {
            inlineEditing?.onActivate(summaryEditTarget);
            inlineEditing?.onSummaryChange(event.currentTarget.textContent ?? "");
          }
        }
      >
        {data?.summary ?? ""}
      </p>
      {(data?.textSections ?? []).map((section) => (
        (() => {
          const textEditTarget = {
            sectionId: section.sectionId,
            sectionType: section.sectionType,
            fieldPath: "blocks.0.plainText",
            fieldKind: "paragraph" as const,
          };
          const isTextSectionEditable = Boolean(inlineEditing?.enabled);

          return (
            <p
              key={section.id}
              aria-label={`Paper ${section.sectionTitle} paragraph`}
              data-testid={`paper-text-section-${section.sectionId}`}
              contentEditable={
                isTextSectionEditable ? "plaintext-only" : undefined
              }
              suppressContentEditableWarning={isTextSectionEditable}
              role={isTextSectionEditable ? "textbox" : undefined}
              tabIndex={isTextSectionEditable ? 0 : undefined}
              data-inline-paper-editable={
                isTextSectionEditable ? "true" : undefined
              }
              data-paper-section-id={textEditTarget.sectionId}
              data-paper-section-type={textEditTarget.sectionType}
              data-paper-field-path={textEditTarget.fieldPath}
              data-paper-field-kind={textEditTarget.fieldKind}
              onFocus={() => inlineEditing?.onActivate(textEditTarget)}
              onClick={(event) => {
                if (inlineEditing?.enabled) {
                  event.stopPropagation();
                  inlineEditing.onActivate(textEditTarget);
                  return;
                }
                onLinkIntent?.({
                  requestId: `paper-${section.sectionId}`,
                  sectionType: section.sectionType,
                  sectionId: section.sectionId,
                  source: "preview-panel",
                  shouldOpenModal: false,
                });
              }}
              onInput={(event) =>
                {
                  inlineEditing?.onActivate(textEditTarget);
                  inlineEditing?.onTextSectionChange(
                    section.sectionId,
                    event.currentTarget.textContent ?? "",
                  );
                }
              }
            >
              {section.text}
            </p>
          );
        })()
      ))}
      <div data-testid="paper-structured-sections">
        {(data?.experience ?? []).map((item) => (
          <p key={item.role}>{item.role}</p>
        ))}
        {(data?.education ?? []).map((item) => (
          <p key={item.degree}>{item.degree}</p>
        ))}
        {(data?.skillItems ?? []).map((item) => (
          <span key={item.name}>{item.name}</span>
        ))}
        {(data?.languages ?? []).map((item) => (
          <span key={item.name}>{item.name}</span>
        ))}
        {(data?.hobbyItems ?? []).map((item) => (
          <span key={item.name}>{item.name}</span>
        ))}
        {(data?.achievementItems ?? []).map((item) => (
          <p key={item.text}>{item.text}</p>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          onLinkIntent?.({
            requestId: "paper-experience",
            sectionType: "experience",
            sectionId: "experience-cv_123",
            source: "preview-panel",
            shouldOpenModal: true,
          })
        }
      >
        Paper Experience
      </button>
      <button
        type="button"
        onClick={() =>
          onLinkIntent?.({
            requestId: "paper-education",
            sectionType: "education",
            sectionId: "education-cv_123",
            source: "preview-panel",
            shouldOpenModal: true,
          })
        }
      >
        Paper Education
      </button>
      {inlineEditing?.enabled ? (
        <>
          <button
            type="button"
            onClick={() =>
              inlineEditing.onAddItem?.({
                sectionId: "experience-cv_123",
                sectionType: "experience",
                itemKind: "bullet",
                parentItemId: "experience-item-cv_123",
              })
            }
          >
            + Add bullet
          </button>
          <button
            type="button"
            onClick={() =>
              inlineEditing.onFieldChange?.(
                {
                  sectionId: "experience-cv_123",
                  sectionType: "experience",
                  fieldPath: "structuredContent.item:experience-item-cv_123.responsibilityBullets.0",
                  fieldKind: "bullet",
                  bulletIndex: 0,
                },
                "Typed bullet.",
              )
            }
          >
            Test type first bullet
          </button>
          <button
            type="button"
            onClick={() =>
              inlineEditing.onDeactivate({
                sectionId: "experience-cv_123",
                sectionType: "experience",
                fieldPath: "structuredContent.item:experience-item-cv_123.responsibilityBullets.0",
                fieldKind: "bullet",
                bulletIndex: 0,
              })
            }
          >
            Test blur first bullet
          </button>
          <button
            type="button"
            onClick={() =>
              inlineEditing.onDeactivate({
                sectionId: "experience-cv_123",
                sectionType: "experience",
                fieldPath: "structuredContent.item:experience-item-cv_123.responsibilityBullets.1",
                fieldKind: "bullet",
                bulletIndex: 1,
              })
            }
          >
            Test blur second bullet
          </button>
        </>
      ) : null}
      <div>
        Preview style: {stylePreset?.layout ?? "none"}|
        {stylePreset?.typography ?? "none"}|{stylePreset?.palette ?? "none"}|
        {stylePreset?.accentHex ?? "none"}
      </div>
    </div>
    );
  },
}));

vi.mock("../../components/useStructuredMistralImport", () => ({
  TRUSTED_MISTRAL_FILE_INPUT_ACCEPT: ".pdf",
  useStructuredMistralImport: () => ({
    importFile: importFileMock,
  }),
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => useCvLibraryMock(),
}));

function buildCvLibraryState(overrides: Record<string, unknown> = {}) {
  const now = "2026-04-17T12:00:00.000Z";
  const currentCv = {
    id: "cv_123",
    title: "Untitled CV",
    metadata: {
      createdAt: now,
      updatedAt: now,
      version: 1,
      verbatiStyle: {
        layout: "swiss",
        typography: "quiet-editorial",
        palette: "sauge",
      },
    },
    sections: [
      {
        id: "profile-cv_123",
        type: "profile",
        title: "Profile",
        blocks: [],
        structuredContent: [
          {
            id: "profile-item-cv_123",
            name: "Ada Lovelace",
            desiredPosition: "Product Designer",
          },
        ],
      },
      {
        id: "summary-cv_123",
        type: "summary",
        title: "Summary",
        blocks: [],
        structuredContent: [{ id: "summary-item-cv_123", summary: "Focused builder." }],
      },
      {
        id: "experience-cv_123",
        type: "experience",
        title: "Experience",
        blocks: [],
        structuredContent: [
          {
            id: "experience-item-cv_123",
            position: "Lead designer",
            company: "Studio",
            startDate: "2022",
            endDate: "2026",
            responsibilities: "Led product design.",
          },
        ],
      },
      {
        id: "education-cv_123",
        type: "education",
        title: "Education",
        blocks: [],
        structuredContent: [
          {
            id: "education-item-cv_123",
            degree: "MFA",
            institution: "Design School",
            fieldOfStudy: "Interaction design",
          },
        ],
      },
      {
        id: "skills-cv_123",
        type: "skills",
        title: "Skills",
        blocks: [],
        structuredContent: [{ id: "skill-cv_123", name: "TypeScript" }],
      },
      {
        id: "languages-cv_123",
        type: "languages",
        title: "Languages",
        blocks: [],
        structuredContent: [{ id: "language-cv_123", name: "English" }],
      },
      {
        id: "certifications-cv_123",
        type: "certifications",
        title: "Certifications",
        blocks: [],
        structuredContent: [{ id: "cert-cv_123", certificationName: "UX cert" }],
      },
      {
        id: "achievements-cv_123",
        type: "achievements",
        title: "Achievements",
        blocks: [],
        structuredContent: [{ id: "achievement-cv_123", text: "Shipped PR4." }],
      },
      {
        id: "additional-cv_123",
        type: "text",
        title: "Additional information",
        blocks: [{ id: "additional-block-cv_123", type: "text", plainText: "Open to remote." }],
        structuredContent: null,
      },
      {
        id: "custom-cv_123",
        type: "text",
        title: "Community",
        blocks: [{ id: "custom-block-cv_123", type: "text", plainText: "Mentors operators." }],
        structuredContent: null,
      },
      {
        id: "hobbies-cv_123",
        type: "text",
        title: "Hobbies",
        blocks: [],
        structuredContent: [{ id: "hobby-cv_123", name: "Photography" }],
      },
    ],
  };

  return {
    currentCv,
    currentCvId: "cv_123",
    createNewCv: vi.fn(async () => undefined),
    importCv: vi.fn(async () => undefined),
    cvs: [currentCv],
    isLibraryHydrated: true,
    lastLibraryFetchFailed: false,
    loadCv: vi.fn(() => true),
    ...overrides,
  };
}

function buildResumePreviewData() {
  return {
    name: "Ada Lovelace",
    title: "Product Designer",
    summary: "Focused builder.",
    summarySectionId: "summary-cv_123",
    profileSectionId: "profile-cv_123",
    contact: [
      {
        label: "Email",
        value: "ada@example.com",
        sectionId: "profile-cv_123",
        sectionType: "profile",
      },
    ],
    metadata: [
      {
        label: "Location",
        value: "Paris",
        sectionId: "profile-cv_123",
        sectionType: "profile",
      },
    ],
    experience: [
      {
        id: "experience-item-cv_123",
        sectionId: "experience-cv_123",
        role: "Lead designer",
        company: "Studio",
        period: "2022 - 2026",
        location: "Remote",
        bullets: ["Led product design."],
      },
    ],
    education: [
      {
        id: "education-item-cv_123",
        sectionId: "education-cv_123",
        degree: "MFA",
        fieldOfStudy: "Interaction design",
        school: "Design School",
        period: "",
      },
    ],
    skills: ["TypeScript"],
    skillItems: [
      {
        id: "skill-cv_123",
        name: "TypeScript",
        sectionId: "skills-cv_123",
        sectionType: "skills",
      },
    ],
    projects: [
      {
        id: "project-cv_123",
        sectionId: "projects-cv_123",
        sectionType: "projects",
        name: "Paper editor",
        meta: "Case study",
        description: "Structured inline editing.",
      },
    ],
    certifications: [
      {
        id: "cert-cv_123",
        name: "UX cert",
        issuer: "NNG",
        sectionId: "certifications-cv_123",
        sectionType: "certifications",
      },
    ],
    languages: [
      {
        id: "language-cv_123",
        name: "English",
        level: "Intermediate",
        sectionId: "languages-cv_123",
        sectionType: "languages",
      },
    ],
    affiliations: [
      {
        id: "affiliation-cv_123",
        organizationName: "AIGA",
        roleOrMembershipType: "Member",
        notes: "Mentors students.",
        sectionId: "affiliations-cv_123",
        sectionType: "affiliations",
      },
    ],
    achievementItems: [
      {
        id: "achievement-cv_123",
        text: "Shipped PR4.",
        sectionId: "achievements-cv_123",
        sectionType: "achievements",
      },
    ],
    hobbies: ["Photography"],
    hobbyItems: [
      {
        id: "hobby-cv_123",
        name: "Photography",
        sectionId: "hobbies-cv_123",
        sectionType: "hobbies",
      },
    ],
    textSections: [
      {
        id: "text-section-additional-cv_123",
        sectionId: "additional-cv_123",
        sectionType: "additional_information",
        sectionTitle: "Additional information",
        sectionOrder: 0,
        text: "Open to remote.",
      },
      {
        id: "text-section-custom-cv_123",
        sectionId: "custom-cv_123",
        sectionType: "custom",
        sectionTitle: "Community",
        sectionOrder: 1,
        text: "Mentors operators.",
      },
    ],
  };
}

function readSavedPlainText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.content)) {
    return record.content.map(readSavedPlainText).filter(Boolean).join("\n");
  }
  if (typeof record.text === "string") return record.text;
  return "";
}

function paragraphDoc(text: string) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: text ? [{ type: "text", text }] : [],
      },
    ],
  };
}

function mixedResponsibilityDoc(paragraph: string, bullets: string[]) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: paragraph }],
      },
      {
        type: "bulletList",
        content: bullets.map((bullet) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: bullet ? [{ type: "text", text: bullet }] : [],
            },
          ],
        })),
      },
    ],
  };
}

function buildStateWithExperienceItem(
  item: Record<string, unknown>,
  importCv = vi.fn(async () => undefined),
) {
  const baseState = buildCvLibraryState();
  const currentCv = {
    ...baseState.currentCv,
    sections: baseState.currentCv.sections.map((section: any) =>
      section.id === "experience-cv_123"
        ? { ...section, structuredContent: [item] }
        : section,
    ),
  };
  return {
    state: buildCvLibraryState({ currentCv, cvs: [currentCv], importCv }),
    importCv,
  };
}

function getLastSavedExperienceItem(importCv: ReturnType<typeof vi.fn>) {
  const savedCv = importCv.mock.calls.at(-1)?.[0] as any;
  const experienceSection = savedCv?.sections?.find(
    (section: any) => section.id === "experience-cv_123",
  );
  return experienceSection?.structuredContent?.[0] as any;
}

describe("CvForge workspace mode", () => {
  beforeEach(() => {
    window.localStorage.removeItem("dasti:cv-forge-workspace-mode:v1");
    window.localStorage.setItem("twoweeks:quick-start-completed", "1");
    transformEditorSelectionMock.mockReset();
    runCvSectionAiActionMock.mockReset();
    runCvSectionAiActionMock.mockResolvedValue({
      kind: "list",
      items: ["Design systems", "Interaction design"],
    });
    transformEditorSelectionMock.mockResolvedValue({
      kind: "text",
      actionId: "custom",
      text: "Sharper AI section text.",
      applyMode: "preview_required",
      outputMode: "single_text",
    });
    importFileMock.mockReset();
    useCvLibraryMock.mockReset();
    useCvLibraryMock.mockReturnValue(buildCvLibraryState());
  });

  it("appends one draft bullet to canonical rich responsibilities while preserving paragraph text", async () => {
    const user = userEvent.setup();
    const { state, importCv } = buildStateWithExperienceItem({
      id: "experience-item-cv_123",
      position: "Lead designer",
      company: "Studio",
      responsibilities: paragraphDoc("Led product design."),
    });
    useCvLibraryMock.mockReturnValue(state);

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /\+ Add bullet/i }));

    await waitFor(() => expect(importCv).toHaveBeenCalled());
    const saved = getLastSavedExperienceItem(importCv);
    expect(saved.responsibilities.content.map((node: any) => node.type)).toEqual([
      "paragraph",
      "bulletList",
    ]);
    expect(readSavedPlainText(saved.responsibilities.content[0])).toBe(
      "Led product design.",
    );
    expect(saved.responsibilities.content[1].content).toHaveLength(1);
    expect(saved.responsibilityBullets).toEqual([
      "__draft_empty_responsibility_bullet__",
    ]);
  });

  it("saves typed added bullets into the canonical Remirror responsibilities doc", async () => {
    const user = userEvent.setup();
    const { state, importCv } = buildStateWithExperienceItem({
      id: "experience-item-cv_123",
      position: "Lead designer",
      company: "Studio",
      responsibilities: paragraphDoc("Led product design."),
    });
    useCvLibraryMock.mockReturnValue(state);

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /\+ Add bullet/i }));
    await user.click(screen.getByRole("button", { name: "Test type first bullet" }));

    await waitFor(() => expect(importCv).toHaveBeenCalledTimes(2));
    const saved = getLastSavedExperienceItem(importCv);
    expect(saved.responsibilities.content.map((node: any) => node.type)).toEqual([
      "paragraph",
      "bulletList",
    ]);
    expect(saved.responsibilities.content[1].content).toHaveLength(1);
    expect(readSavedPlainText(saved.responsibilities.content[1])).toBe("Typed bullet.");
    expect(saved.responsibilityBullets).toEqual(["Typed bullet."]);
  });

  it("clicking add bullet twice creates exactly two canonical bullets", async () => {
    const user = userEvent.setup();
    const { state, importCv } = buildStateWithExperienceItem({
      id: "experience-item-cv_123",
      position: "Lead designer",
      company: "Studio",
      responsibilities: paragraphDoc("Led product design."),
    });
    useCvLibraryMock.mockReturnValue(state);

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /\+ Add bullet/i }));
    await user.click(screen.getByRole("button", { name: /\+ Add bullet/i }));

    await waitFor(() => expect(importCv).toHaveBeenCalledTimes(2));
    const saved = getLastSavedExperienceItem(importCv);
    expect(saved.responsibilities.content[1].type).toBe("bulletList");
    expect(saved.responsibilities.content[1].content).toHaveLength(2);
    expect(saved.responsibilityBullets).toEqual([
      "__draft_empty_responsibility_bullet__",
      "__draft_empty_responsibility_bullet__",
    ]);
  });

  it("removes an empty draft bullet on blur without deleting paragraph text", async () => {
    const user = userEvent.setup();
    const { state, importCv } = buildStateWithExperienceItem({
      id: "experience-item-cv_123",
      position: "Lead designer",
      company: "Studio",
      responsibilities: paragraphDoc("Led product design."),
    });
    useCvLibraryMock.mockReturnValue(state);

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /\+ Add bullet/i }));
    await user.click(screen.getByRole("button", { name: "Test blur first bullet" }));

    await waitFor(() => expect(importCv).toHaveBeenCalledTimes(2));
    const saved = getLastSavedExperienceItem(importCv);
    expect(saved.responsibilities.content.map((node: any) => node.type)).toEqual([
      "paragraph",
    ]);
    expect(readSavedPlainText(saved.responsibilities.content[0])).toBe(
      "Led product design.",
    );
    expect(saved.responsibilityBullets).toBeUndefined();
  });

  it("empty bullet cleanup preserves filled bullets and paragraph text", async () => {
    const user = userEvent.setup();
    const { state, importCv } = buildStateWithExperienceItem({
      id: "experience-item-cv_123",
      position: "Lead designer",
      company: "Studio",
      responsibilities: mixedResponsibilityDoc("Led product design.", [
        "Shipped design systems.",
        "",
      ]),
      responsibilityBullets: [
        "Shipped design systems.",
        "__draft_empty_responsibility_bullet__",
      ],
      __draftResponsibilityBulletCount: 2,
    });
    useCvLibraryMock.mockReturnValue(state);

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Test blur second bullet" }));

    await waitFor(() => expect(importCv).toHaveBeenCalled());
    const saved = getLastSavedExperienceItem(importCv);
    expect(saved.responsibilities.content.map((node: any) => node.type)).toEqual([
      "paragraph",
      "bulletList",
    ]);
    expect(readSavedPlainText(saved.responsibilities.content[0])).toBe(
      "Led product design.",
    );
    expect(saved.responsibilities.content[1].content).toHaveLength(1);
    expect(readSavedPlainText(saved.responsibilities.content[1])).toBe(
      "Shipped design systems.",
    );
    expect(saved.responsibilityBullets).toEqual(["Shipped design systems."]);
  });

  it("switches between edit and preview workbench modes and persists the choice", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1200,
      writable: true,
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(screen.getByText("Preview host: panel")).toBeInTheDocument();
    expect(screen.queryByText("Loaded")).not.toBeInTheDocument();
    expect(container.querySelector(".dasti-cv-active-toolbar-pill")).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: /Switch CV\. Active CV:/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(".dasti-cv-edit-workbench-shell"),
    ).toBeNull();
    expect(container.querySelector(".dasti-cv-preview-panel-slot")).toBeNull();
    expect(container.querySelector(".dasti-preview-toolbar")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Page preview" }),
    );

    expect(screen.getByText("Preview host: panel")).toBeInTheDocument();
    expect(screen.queryByText("Loaded")).not.toBeInTheDocument();
    expect(container.querySelector(".dasti-cv-active-toolbar-pill")).toBeNull();
    expect(
      container.querySelector(".dasti-cv-skeleton-forge"),
    ).toBeTruthy();
    expect(
      container.querySelector(".dasti-cv-page-preview-stage"),
    ).toBeTruthy();
    expect(
      container.querySelector(".dasti-cv-preview-workbench"),
    ).toBeNull();
    expect(
      container.querySelector(".dasti-cv-edit-workbench-shell"),
    ).toBeFalsy();
    expect(
      container.querySelector(".dasti-workbench-top-left-slot--cv-preview"),
    ).toBeFalsy();
    expect(
      screen.queryByRole("button", { name: "Back to resume editing" }),
    ).not.toBeInTheDocument();
    const pageShell = container.querySelector(
      ".dasti-page-shell--cv-forge",
    ) as HTMLElement | null;
    expect(pageShell?.style.getPropertyValue("--page-shell-pad-top")).toBe(
      "var(--space-2)",
    );
    expect(pageShell?.style.getPropertyValue("--page-shell-pad-top-mobile")).toBe(
      "var(--space-2)",
    );
    expect(pageShell?.style.getPropertyValue("--cv-preview-toolbar-inset")).toBe(
      "0px",
    );
    expect(pageShell?.style.getPropertyValue("--page-shell-pad-inline")).toBe(
      "var(--space-4)",
    );
    expect(
      pageShell?.style.getPropertyValue("--page-shell-pad-inline-mobile"),
    ).toBe("var(--space-4)");
    expect(
      window.localStorage.getItem("dasti:cv-forge-workspace-mode:v1"),
    ).toBe("preview");
    expect(
      screen.getByRole("complementary", { name: "CV forge rail" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".dasti-preview-toolbar")).toBeNull();
  });

  it("does not show the create or import choice while the CV library is restoring", () => {
    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({
        currentCv: null,
        currentCvId: null,
        cvs: [],
        isLoading: true,
        isLibraryHydrated: false,
      }),
    );

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Start blank")).not.toBeInTheDocument();
    expect(screen.queryByText("Upload PDF")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Loading CV/i);
  });

  it("shows the create or import choice after restore finishes without a current CV", () => {
    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({
        currentCv: null,
        currentCvId: null,
        cvs: [{ id: "cv_stale", title: "Stale index entry", sections: [] }],
        isLoading: false,
        isLibraryHydrated: true,
        lastLibraryFetchFailed: false,
      }),
    );

    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/Loading CV/i)).not.toBeInTheDocument();
    expect(screen.getByText("Start blank")).toBeInTheDocument();
    expect(screen.getByText("Upload PDF")).toBeInTheDocument();
  });

  it("switches to preview when workspace mode storage quota is unavailable", async () => {
    const user = userEvent.setup();
    const quotaError = new DOMException("quota exceeded", "QuotaExceededError");
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw quotaError;
      });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Page preview" }));

    expect(container.querySelector(".dasti-cv-page-preview-stage")).toBeTruthy();
    expect(screen.getByText("Preview host: panel")).toBeInTheDocument();
    expect(setItemSpy).toHaveBeenCalledWith(
      "dasti:cv-forge-workspace-mode:v1",
      expect.stringMatching(/^(edit|preview)$/),
    );

    warnSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  it("renders the PR4 skeleton stage and section-scoped CV rail tabs", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("complementary", { name: "CV forge rail" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import CV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New CV" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sections" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByRole("button", { name: /Structuring sections/i })).toBeNull();

    await user.click(screen.getByRole("tab", { name: "Ask" }));

    expect(screen.getByText("Profile fields use direct field editing.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ask section" }),
    ).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Ask Profile" })).not.toBeInTheDocument();
    expect(screen.queryByText(/whole CV/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Style" }));

    expect(container.querySelector(".dasti-cv-style-note")).toHaveTextContent(
      /^Default settings → Document style\.$/,
    );
    expect(
      screen.getByRole("link", { name: "→ Document style" }),
    ).toHaveAttribute("href", "/settings");
  });

  it("opens a non-empty section editor from the paper in preview mode and highlights the rail row", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Page preview" }));
    await user.click(screen.getByRole("button", { name: "Paper Experience" }));

    expect(screen.getByRole("dialog", { name: "Experience" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lead designer")).toBeInTheDocument();
    expect(screen.getByTestId("preview-active-section")).toHaveTextContent(
      "experience-cv_123",
    );
    expect(
      container.querySelector('.dasti-cv-org-row[data-active="true"] .dasti-cv-org-row__title'),
    ).toHaveTextContent("Experience");
  });

  it("keeps edit mode paper body clicks from opening the drawer", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Paper Experience" }));

    expect(screen.queryByRole("dialog", { name: "Experience" })).not.toBeInTheDocument();
    expect(screen.getByTestId("preview-active-section")).toHaveTextContent(
      "experience-cv_123",
    );
    expect(
      container.querySelector('.dasti-cv-org-row[data-active="true"] .dasti-cv-org-row__title'),
    ).toHaveTextContent("Experience");
  });

  it("edits the rendered Summary paragraph inline in edit mode", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    const summaryParagraph = screen.getByTestId("paper-summary-paragraph");
    expect(summaryParagraph).toHaveAttribute("contenteditable", "plaintext-only");
    expect(summaryParagraph).toHaveAttribute(
      "data-inline-paper-editable",
      "true",
    );
    expect(summaryParagraph).toHaveAttribute(
      "data-paper-field-path",
      "structuredContent.0.summary",
    );

    await user.click(summaryParagraph);
    expect(document.activeElement).toBe(summaryParagraph);
    expect(screen.queryByRole("dialog", { name: "Summary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /Paper Summary/i })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        container.querySelector('.dasti-cv-org-row[data-active="true"] .dasti-cv-org-row__title'),
      ).toHaveTextContent("Summary"),
    );
    expect(
      container
        .querySelector(".dasti-cv-paper-stage")
        ?.getAttribute("data-active-paper-edit-field-path"),
    ).toBe("structuredContent.0.summary");

    summaryParagraph.textContent = "Inline summary rewrite.\nSecond line.";
    fireEvent.input(summaryParagraph);

    await waitFor(() => expect(importCv).toHaveBeenCalled());
    const summarySection = importCv.mock.lastCall?.[0].sections.find(
      (section: { id: string }) => section.id === "summary-cv_123",
    );
    expect(
      readSavedPlainText(summarySection.structuredContent[0].summary),
    ).toBe("Inline summary rewrite.\nSecond line.");
  });

  it("keeps Summary paper clicks as drawer focus in preview mode", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Page preview" }));
    const summaryParagraph = screen.getByTestId("paper-summary-paragraph");
    expect(summaryParagraph).not.toHaveAttribute("contenteditable");

    await user.click(summaryParagraph);

    expect(screen.getByRole("dialog", { name: "Summary" })).toBeInTheDocument();
    expect(screen.getByTestId("preview-active-section")).toHaveTextContent(
      "summary-cv_123",
    );
    expect(summaryParagraph).not.toHaveAttribute("contenteditable");
  });

  it("routes inline paper clicks away from drawers in edit mode but keeps preview drawer routing", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    const summaryParagraph = screen.getByTestId("paper-summary-paragraph");
    expect(summaryParagraph).toHaveAttribute("data-inline-paper-editable", "true");

    await user.click(summaryParagraph);

    expect(screen.queryByRole("dialog", { name: "Summary" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Page preview" }));
    expect(summaryParagraph).not.toHaveAttribute("data-inline-paper-editable");

    await user.click(summaryParagraph);

    expect(screen.getByRole("dialog", { name: "Summary" })).toBeInTheDocument();
  });

  it("edits the rendered custom text paragraph inline in edit mode", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    const customParagraph = screen.getByTestId("paper-text-section-custom-cv_123");
    expect(customParagraph).toHaveAttribute("contenteditable", "plaintext-only");
    expect(customParagraph).toHaveAttribute("data-inline-paper-editable", "true");
    expect(customParagraph).toHaveAttribute(
      "data-paper-field-path",
      "blocks.0.plainText",
    );

    await user.click(customParagraph);
    expect(document.activeElement).toBe(customParagraph);
    expect(screen.queryByRole("dialog", { name: "Community" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: /Paper Custom section/i }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        container.querySelector('.dasti-cv-org-row[data-active="true"] .dasti-cv-org-row__title'),
      ).toHaveTextContent("Community"),
    );
    expect(
      container
        .querySelector(".dasti-cv-paper-stage")
        ?.getAttribute("data-active-paper-edit-section-id"),
    ).toBe("custom-cv_123");

    customParagraph.textContent = "Inline community rewrite.";
    fireEvent.input(customParagraph);

    await waitFor(() => expect(importCv).toHaveBeenCalled());
    const customSection = importCv.mock.lastCall?.[0].sections.find(
      (section: { id: string }) => section.id === "custom-cv_123",
    );
    expect(customSection.blocks[0].plainText).toBe("Inline community rewrite.");
    expect(customSection.title).toBe("Community");
  });

  it("renders actual workshop paper fields editable before first click", async () => {
    const user = userEvent.setup();
    const { VerbatiResumePreview } = await vi.importActual<
      typeof import("../../features/verbati/VerbatiResumePreview")
    >("../../features/verbati/VerbatiResumePreview");
    const onLinkIntent = vi.fn();
    const onActivate = vi.fn();
    const onSummaryChange = vi.fn();
    const onTextSectionChange = vi.fn();
    const onFieldChange = vi.fn();
    const data = buildResumePreviewData();

    const { container } = render(
      <div className="dasti-cv-paper-stage" data-cv-workspace-mode="edit">
        <VerbatiResumePreview
          data={data as any}
          stylePreset={{
            layout: "workshop",
            familyId: "workshop",
            typography: "quiet-editorial",
            palette: "sauge",
          }}
          hostMode="panel"
          scrollMode="natural"
          activeTarget={null}
          onLinkIntent={onLinkIntent}
          inlineEditing={{
            enabled: true,
            activeTarget: null,
            onActivate,
            onDeactivate: vi.fn(),
            onSummaryChange,
            onTextSectionChange,
            onFieldChange,
          }}
        />
      </div>,
    );

    const editableExpectations = [
      ["Ada Lovelace", "profile-cv_123", "structuredContent.0.name", "heading"],
      ["Product Designer", "profile-cv_123", "structuredContent.0.desiredPosition", "meta"],
      ["ada@example.com", "profile-cv_123", "structuredContent.0.email", "meta"],
      ["Paris", "profile-cv_123", "structuredContent.0.location", "meta"],
      ["Focused builder.", "summary-cv_123", "structuredContent.0.summary", "paragraph"],
      ["Lead designer", "experience-cv_123", "structuredContent.item:experience-item-cv_123.position", "heading"],
      ["Studio", "experience-cv_123", "structuredContent.item:experience-item-cv_123.company", "meta"],
      ["Remote", "experience-cv_123", "structuredContent.item:experience-item-cv_123.location", "meta"],
      ["Led product design.", "experience-cv_123", "structuredContent.item:experience-item-cv_123.responsibilityBullets.0", "bullet"],
      ["MFA", "education-cv_123", "structuredContent.item:education-item-cv_123.degree", "heading"],
      ["Interaction design", "education-cv_123", "structuredContent.item:education-item-cv_123.fieldOfStudy", "heading"],
      ["Design School", "education-cv_123", "structuredContent.item:education-item-cv_123.institution", "meta"],
      ["TypeScript", "skills-cv_123", "structuredContent.item:skill-cv_123.name", "chip"],
      ["Paper editor", "projects-cv_123", "structuredContent.item:project-cv_123.name", "heading"],
      ["Case study", "projects-cv_123", "structuredContent.item:project-cv_123.meta", "meta"],
      ["Structured inline editing.", "projects-cv_123", "structuredContent.item:project-cv_123.description", "paragraph"],
      ["English", "languages-cv_123", "structuredContent.item:language-cv_123.name", "chip"],
      ["Intermediate", "languages-cv_123", "structuredContent.item:language-cv_123.level", "meta"],
      ["UX cert", "certifications-cv_123", "structuredContent.item:cert-cv_123.certificationName", "paragraph"],
      ["NNG", "certifications-cv_123", "structuredContent.item:cert-cv_123.issuingOrganization", "meta"],
      ["Shipped PR4.", "achievements-cv_123", "structuredContent.item:achievement-cv_123.text", "paragraph"],
      ["AIGA", "affiliations-cv_123", "structuredContent.item:affiliation-cv_123.organizationName", "paragraph"],
      ["Member", "affiliations-cv_123", "structuredContent.item:affiliation-cv_123.roleOrMembershipType", "meta"],
      ["Mentors students.", "affiliations-cv_123", "structuredContent.item:affiliation-cv_123.notes", "paragraph"],
      ["Photography", "hobbies-cv_123", "structuredContent.item:hobby-cv_123.name", "chip"],
      ["Open to remote.", "additional-cv_123", "blocks.0.plainText", "paragraph"],
      ["Mentors operators.", "custom-cv_123", "blocks.0.plainText", "paragraph"],
    ] as const;

    for (const [text, sectionId, fieldPath, fieldKind] of editableExpectations) {
      const field = screen.getByText(text);
      const isRichMultilineField =
        sectionId === "summary-cv_123" || fieldPath.endsWith(".responsibilities");
      if (isRichMultilineField) {
        expect(field.tagName).toBe("TEXTAREA");
        expect(field).not.toHaveAttribute("contenteditable");
      } else {
        expect(field).toHaveAttribute("contenteditable", "plaintext-only");
      }
      expect(field).toHaveAttribute("data-inline-paper-editable", "true");
      expect(field).toHaveAttribute("data-paper-section-id", sectionId);
      expect(field).toHaveAttribute("data-paper-field-path", fieldPath);
      expect(field).toHaveAttribute("data-paper-field-kind", fieldKind);
    }

    expect(container.querySelector("[data-paper-field-kind='date']")).toBeNull();
    expect(
      container.querySelector("[data-paper-field-path*='startDate']"),
    ).toBeNull();

    expect(
      container.querySelector(".dasti-document-stage__canvas"),
    ).not.toHaveAttribute("contenteditable");
    expect(container.querySelector(".dasti-cv-paper-stage")).not.toHaveAttribute(
      "contenteditable",
    );

    const summaryParagraph = screen.getByText("Focused builder.");
    await user.click(summaryParagraph);

    expect(document.activeElement).toBe(summaryParagraph);
    expect(onActivate).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: "summary-cv_123",
        fieldPath: "structuredContent.0.summary",
      }),
    );
    expect(onLinkIntent).not.toHaveBeenCalled();

    fireEvent.change(summaryParagraph, {
      target: { value: "Actual workshop summary edit." },
    });

    expect(onFieldChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: "summary-cv_123",
        fieldPath: "structuredContent.0.summary",
      }),
      "Actual workshop summary edit.",
    );

    const roleField = screen.getByText("Lead designer");
    await user.click(roleField);
    expect(document.activeElement).toBe(roleField);
    expect(onActivate).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: "experience-cv_123",
        fieldPath: "structuredContent.item:experience-item-cv_123.position",
      }),
    );
    roleField.textContent = "Principal designer";
    fireEvent.input(roleField);
    expect(onFieldChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: "experience-cv_123",
        fieldPath: "structuredContent.item:experience-item-cv_123.position",
      }),
      "Principal designer",
    );

    const bulletField = screen.getByText("Led product design.");
    bulletField.textContent = "Led product strategy.";
    fireEvent.input(bulletField);
    expect(onFieldChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: "experience-cv_123",
        fieldPath: "structuredContent.item:experience-item-cv_123.responsibilityBullets.0",
        bulletIndex: 0,
      }),
      "Led product strategy.",
    );

    const skillField = screen.getByText("TypeScript");
    skillField.textContent = "React";
    fireEvent.input(skillField);
    expect(onFieldChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: "skills-cv_123",
        fieldPath: "structuredContent.item:skill-cv_123.name",
        chipIndex: 0,
      }),
      "React",
    );

    const customParagraph = screen.getByText("Mentors operators.");
    await user.click(customParagraph);
    expect(document.activeElement).toBe(customParagraph);
    expect(onActivate).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: "custom-cv_123",
        fieldPath: "blocks.0.plainText",
      }),
    );
    expect(onLinkIntent).not.toHaveBeenCalled();

    customParagraph.textContent = "Actual workshop custom edit.";
    fireEvent.input(customParagraph);

    expect(onFieldChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: "custom-cv_123",
        fieldPath: "blocks.0.plainText",
      }),
      "Actual workshop custom edit.",
    );
  });

  it("renders actual workshop inline add pills without routing to the drawer", async () => {
    const user = userEvent.setup();
    const { VerbatiResumePreview } = await vi.importActual<
      typeof import("../../features/verbati/VerbatiResumePreview")
    >("../../features/verbati/VerbatiResumePreview");
    const onLinkIntent = vi.fn();
    const onAddItem = vi.fn();

    render(
      <div className="dasti-cv-paper-stage" data-cv-workspace-mode="edit">
        <VerbatiResumePreview
          data={buildResumePreviewData() as any}
          stylePreset={{
            layout: "workshop",
            familyId: "workshop",
            typography: "quiet-editorial",
            palette: "sauge",
          }}
          hostMode="panel"
          scrollMode="natural"
          activeTarget={null}
          onLinkIntent={onLinkIntent}
          inlineEditing={{
            enabled: true,
            activeTarget: null,
            onActivate: vi.fn(),
            onDeactivate: vi.fn(),
            onSummaryChange: vi.fn(),
            onTextSectionChange: vi.fn(),
            onFieldChange: vi.fn(),
            onAddItem,
          }}
        />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: /\+ Add skill/i }));
    await user.click(screen.getByRole("button", { name: /\+ Add bullet/i }));
    await user.click(screen.getByRole("button", { name: /\+ Add experience/i }));
    await user.click(screen.getByRole("button", { name: /\+ LinkedIn/i }));

    expect(onLinkIntent).not.toHaveBeenCalled();
    expect(onAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: "skills-cv_123",
        sectionType: "skills",
        itemKind: "skill",
      }),
    );
    expect(onAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: "experience-cv_123",
        sectionType: "experience",
        itemKind: "bullet",
        parentItemId: "experience-item-cv_123",
      }),
    );
    expect(onAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: "experience-cv_123",
        sectionType: "experience",
        itemKind: "experience",
      }),
    );
    expect(onAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: "profile-cv_123",
        sectionType: "profile",
        itemKind: "profile-contact",
        parentItemId: "linkedin",
      }),
    );
  });

  it("renders actual workshop blank CV placeholders before any click", async () => {
    const { VerbatiResumePreview } = await vi.importActual<
      typeof import("../../features/verbati/VerbatiResumePreview")
    >("../../features/verbati/VerbatiResumePreview");
    const blankData = {
      ...buildResumePreviewData(),
      name: "",
      title: "",
      summary: "",
      contact: [],
      metadata: [],
      experience: [
        {
          id: "experience-item-cv_123",
          sectionId: "experience-cv_123",
          role: "",
          company: "",
          period: "",
          location: "",
          bullets: [""],
        },
      ],
      education: [
        {
          id: "education-item-cv_123",
          sectionId: "education-cv_123",
          degree: "",
          fieldOfStudy: "",
          school: "",
          period: "",
        },
      ],
      skills: [],
      skillItems: [
        {
          id: "skill-cv_123",
          name: "",
          sectionId: "skills-cv_123",
          sectionType: "skills",
        },
      ],
    };

    const { container } = render(
      <div className="dasti-cv-paper-stage" data-cv-workspace-mode="edit">
        <VerbatiResumePreview
          data={blankData as any}
          stylePreset={{
            layout: "workshop",
            familyId: "workshop",
            typography: "quiet-editorial",
            palette: "sauge",
          }}
          hostMode="panel"
          scrollMode="natural"
          activeTarget={null}
          inlineEditing={{
            enabled: true,
            activeTarget: null,
            onActivate: vi.fn(),
            onDeactivate: vi.fn(),
            onSummaryChange: vi.fn(),
            onTextSectionChange: vi.fn(),
            onFieldChange: vi.fn(),
            onAddItem: vi.fn(),
          }}
        />
      </div>,
    );

    const placeholders = [
      ["structuredContent.0.name", "Name"],
      ["structuredContent.0.desiredPosition", "Target title"],
      ["structuredContent.item:experience-item-cv_123.position", "Job title"],
      ["structuredContent.item:experience-item-cv_123.company", "Company"],
      ["structuredContent.item:experience-item-cv_123.location", "Location"],
      [
        "structuredContent.item:experience-item-cv_123.responsibilityBullets.0",
        "Type an impact bullet...",
      ],
      ["structuredContent.item:education-item-cv_123.degree", "Degree"],
      ["structuredContent.item:education-item-cv_123.fieldOfStudy", "Field"],
      ["structuredContent.item:education-item-cv_123.institution", "School"],
    ] as const;

    for (const [fieldPath, placeholder] of placeholders) {
      const field = container.querySelector(
        `[data-paper-field-path="${fieldPath}"][data-placeholder="${placeholder}"]`,
      );
      expect(
        field,
        `missing ${fieldPath}; found ${Array.from(
          container.querySelectorAll("[data-paper-field-path]"),
        )
          .map(
            (element) =>
              `${element.getAttribute("data-paper-field-path")}=${element.getAttribute(
                "data-placeholder",
              )}`,
          )
          .join(", ")}`,
      ).not.toBeNull();
      expect(field).toHaveAttribute("data-inline-paper-editable", "true");
      expect(field).toHaveAttribute("data-placeholder", placeholder);
    }
    expect(screen.getByRole("button", { name: /\+ Add skill/i })).toBeInTheDocument();
  });

  it("keeps the actual workshop paper non-editable and routed in preview mode", async () => {
    const user = userEvent.setup();
    const { VerbatiResumePreview } = await vi.importActual<
      typeof import("../../features/verbati/VerbatiResumePreview")
    >("../../features/verbati/VerbatiResumePreview");
    const onLinkIntent = vi.fn();

    render(
      <div className="dasti-cv-paper-stage" data-cv-workspace-mode="preview">
        <VerbatiResumePreview
          data={buildResumePreviewData() as any}
          stylePreset={{
            layout: "workshop",
            familyId: "workshop",
            typography: "quiet-editorial",
            palette: "sauge",
          }}
          hostMode="panel"
          scrollMode="natural"
          activeTarget={null}
          onLinkIntent={onLinkIntent}
          inlineEditing={{
            enabled: false,
            activeTarget: null,
            onActivate: vi.fn(),
            onDeactivate: vi.fn(),
            onSummaryChange: vi.fn(),
            onTextSectionChange: vi.fn(),
            onFieldChange: vi.fn(),
          }}
        />
      </div>,
    );

    const summaryParagraph = screen.getByText("Focused builder.");
    expect(summaryParagraph).not.toHaveAttribute("contenteditable");
    expect(summaryParagraph).not.toHaveAttribute("data-inline-paper-editable");
    expect(screen.queryByText("Lead designer")).not.toHaveAttribute(
      "contenteditable",
    );
    expect(screen.queryByText("TypeScript")).not.toHaveAttribute(
      "contenteditable",
    );
    expect(document.querySelector("[data-inline-paper-editable='true']")).toBeNull();
    expect(screen.queryByRole("button", { name: /\+ Add skill/i })).toBeNull();

    await user.click(summaryParagraph);

    expect(onLinkIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionType: "summary",
        sectionId: "summary-cv_123",
        source: "preview-panel",
      }),
    );
  });

  it("keeps structured rendered sections out of raw inline editing", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(container.querySelector(".dasti-cv-paper-stage")).not.toHaveAttribute(
      "contenteditable",
    );
    expect(container.querySelectorAll("[data-inline-paper-editable='true']")).toHaveLength(3);

    for (const text of [
      "Lead designer",
      "MFA",
      "TypeScript",
      "English",
      "Photography",
      "Shipped PR4.",
    ]) {
      expect(screen.getByText(text).closest("[contenteditable]")).toBeNull();
    }

    expect(screen.getByRole("button", { name: "Paper Experience" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Education$/i })).toBeInTheDocument();
  });

  it("opens a non-empty section editor from the rail and focuses the preview section", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Education$/i }));

    expect(screen.getByRole("dialog", { name: "Education" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("MFA")).toBeInTheDocument();
    expect(screen.getByTestId("preview-active-section")).toHaveTextContent(
      "education-cv_123",
    );
  });

  it("adds education entries inside the focused section sheet", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Education$/i }));
    await user.click(screen.getByRole("button", { name: "Add education entry" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(importCv).toHaveBeenCalled());
    const educationSection = importCv.mock.lastCall?.[0].sections.find(
      (section: { id: string }) => section.id === "education-cv_123",
    );
    expect(educationSection.structuredContent).toHaveLength(2);
    expect(screen.getByTestId("preview-active-section")).toHaveTextContent(
      "education-cv_123",
    );
  });

  it("autosaves common section fields while editing the sheet", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Profile$/i }));
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Grace Hopper");
    await waitFor(() => expect(importCv).toHaveBeenCalled());
    expect(importCv.mock.lastCall?.[0].sections[0].structuredContent[0].name).toBe(
      "Grace Hopper",
    );
  });

  it("updates the paper contact row immediately from drawer Location and Website edits", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Profile$/i }));
    await user.type(screen.getByLabelText("Location"), "Paris");

    await waitFor(() =>
      expect(screen.getByTestId("paper-contact-location")).toHaveTextContent("Paris"),
    );

    await user.type(screen.getByLabelText("Website"), "ada.example");

    await waitFor(() =>
      expect(screen.getByTestId("paper-contact-website")).toHaveTextContent(
        "ada.example",
      ),
    );
    expect(screen.queryByText(/Portfolio/i)).not.toBeInTheDocument();
  });

  it("keeps selected paper text visibly highlighted while the Ask AI prompt is active", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/CvForge.tsx"), "utf8");
    const styles = readFileSync(resolve(process.cwd(), "src/styles/product-cv.css"), "utf8");

    expect(source).toContain("data-inline-ai-selection-active");
    expect(source).toContain("cv-inline-ai-selection");
    expect(source).toContain("isInlineAiToolbarActiveElement");
    expect(styles).toContain("data-inline-ai-selection-active");
    expect(styles).toContain("::highlight(cv-inline-ai-selection)");
  });

  it("clears inline paper Ask AI loading after a completed request closes the toolbar", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/CvForge.tsx"), "utf8");

    expect(source).toContain("activeInlinePaperAiRequestIdRef.current = null");
    expect(source).toContain(
      "else if (activeInlinePaperAiRequestIdRef.current === null)",
    );
    expect(source).toContain("setIsApplyingInlinePaperAi(false)");
    expect(source).toContain("setPendingInlinePaperAiActionId(null)");
  });

  it("routes inline paper Experience responsibility AI through the shape-aware normalizer", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/CvForge.tsx"), "utf8");

    expect(source).toContain("normalizeResponsibilityAiResultForSource");
    expect(source).toContain("applyInlineExperienceResponsibilityAiResult");
    expect(source).toContain("updateStructuredItemResponsibilities");
    expect(source).toContain("responsibilityBullets");
    expect(source).toContain("if (!handledResponsibilityAi)");
  });

  it("keeps paper contact order stable without Website and Portfolio duplication", async () => {
    const user = userEvent.setup();
    const baseState = buildCvLibraryState();
    const currentCv = {
      ...baseState.currentCv,
      sections: baseState.currentCv.sections.map((section) =>
        section.id === "profile-cv_123"
          ? {
              ...section,
              structuredContent: [
                {
                  ...section.structuredContent[0],
                  email: "ada@example.com",
                  phone: "+33 6 00 00 00 00",
                  location: "Paris",
                  linkedin: "linkedin.com/in/ada",
                  website: "ada.example",
                },
              ],
            }
          : section,
      ),
    };
    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({ currentCv, cvs: [currentCv] }),
    );

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    const readOrder = () =>
      Array.from(screen.getByTestId("paper-contact-row").children).map(
        (element) => element.getAttribute("data-testid"),
      );

    expect(readOrder()).toEqual([
      "paper-contact-email",
      "paper-contact-phone",
      "paper-contact-location",
      "paper-contact-linkedin",
      "paper-contact-website",
    ]);

    await user.click(screen.getByTestId("paper-contact-location"));
    fireEvent.blur(screen.getByTestId("paper-contact-location"));

    expect(readOrder()).toEqual([
      "paper-contact-email",
      "paper-contact-phone",
      "paper-contact-location",
      "paper-contact-linkedin",
      "paper-contact-website",
    ]);
    expect(screen.queryByText(/Portfolio/i)).not.toBeInTheDocument();
  });

  it("reverts autosaved section sheet edits when explicitly canceling", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Profile$/i }));
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Unsaved Name");
    await waitFor(() =>
      expect(importCv.mock.lastCall?.[0].sections[0].structuredContent[0].name).toBe(
        "Unsaved Name",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(importCv.mock.lastCall?.[0].sections[0].structuredContent[0].name).toBe(
        "Ada Lovelace",
      ),
    );
    await user.click(screen.getByRole("button", { name: /^Profile$/i }));
    expect(screen.getByLabelText("Name")).toHaveValue("Ada Lovelace");
  });

  it("keeps section focus after saving the section sheet", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Skills$/i }));
    const skillsDialog = screen.getByRole("dialog", { name: "Skills" });
    expect(screen.queryByLabelText("Section title")).not.toBeInTheDocument();
    expect(screen.getByTestId("preview-active-section")).toHaveTextContent(
      "skills-cv_123",
    );

    await user.click(within(skillsDialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("preview-active-section")).toHaveTextContent(
      "skills-cv_123",
    );
  });

  it("preserves spaces while editing summary text in the section sheet", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Summary$/i }));
    const summaryInput = screen.getByLabelText("Body");
    await user.clear(summaryInput);
    await user.type(summaryInput, "Alpha Beta ");

    expect(summaryInput).toHaveValue("Alpha Beta ");
    await waitFor(() => expect(importCv).toHaveBeenCalled());
    expect(
      importCv.mock.lastCall?.[0].sections.find(
        (section: { id: string }) => section.id === "summary-cv_123",
      ).structuredContent[0].summary,
    ).toBe("Alpha Beta ");
  });

  it("keeps long typed section edits in the draft before save", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Experience$/i }));
    const roleInput = screen.getByLabelText("Role 1");
    await user.clear(roleInput);
    await user.type(roleInput, "Senior product designer");

    expect(roleInput).toHaveValue("Senior product designer");
    await waitFor(() => expect(importCv).toHaveBeenCalled());
    expect(
      importCv.mock.lastCall?.[0].sections.find(
        (section: { id: string }) => section.id === "experience-cv_123",
      ).structuredContent[0].position,
    ).toBe("Senior product designer");
  });

  it("rewrites summary from the section drawer wand with CV evidence", async () => {
    const user = userEvent.setup();
    runCvSectionAiActionMock.mockResolvedValueOnce({
      kind: "text",
      text: "Evidence-backed summary.",
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Summary$/i }));
    await user.click(screen.getByRole("button", { name: "Rewrite summary" }));

    await waitFor(() =>
      expect(runCvSectionAiActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "improve_summary_text",
          skills: expect.arrayContaining(["TypeScript"]),
          experiences: expect.any(Array),
          educations: expect.any(Array),
          languages: expect.any(Array),
        }),
      ),
    );
    expect(screen.getByText("Evidence-backed summary.")).toBeInTheDocument();
  });

  it("shows applied undo after accepting a summary wand edit", async () => {
    const user = userEvent.setup();
    runCvSectionAiActionMock.mockResolvedValueOnce({
      kind: "text",
      text: "Evidence-backed summary.",
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Summary$/i }));
    await user.click(screen.getByRole("button", { name: "Rewrite summary" }));
    await screen.findByText("Evidence-backed summary.");
    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(screen.getByRole("status", { name: "Applied. Undo" })).toBeInTheDocument();
    expect(screen.getByLabelText("Body")).toHaveValue("Evidence-backed summary.");

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByLabelText("Body")).toHaveValue("Focused builder.");
  });

  it("launches structured skill suggestions directly from the skills wand", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Ask for Skills" }));

    const skillsDialog = screen.getByRole("dialog", { name: "Skills" });
    expect(skillsDialog).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    expect(screen.queryByText(/whole CV/i)).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Tighten the second bullet, drop the buzzwords."),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Warm" })).not.toBeInTheDocument();
    expect(document.body.querySelector(".dasti-cv-section-sheet-overlay")).toBeInTheDocument();

    await waitFor(() =>
      expect(runCvSectionAiActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "generate_skills_suggestions",
          existingItems: ["TypeScript"],
          maxItems: 6,
        }),
      ),
    );
    expect(
      within(skillsDialog).getByRole("region", { name: "Suggested items for Skills" }),
    ).toBeInTheDocument();
    expect(within(skillsDialog).getByText("Design systems")).toBeInTheDocument();
  });

  it("launches language suggestions directly from the languages wand", async () => {
    const user = userEvent.setup();
    runCvSectionAiActionMock.mockResolvedValueOnce({
      kind: "list",
      items: ["French", "Spanish"],
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Ask for Languages" }));

    const languagesDialog = screen.getByRole("dialog", { name: "Languages" });
    expect(languagesDialog).toBeInTheDocument();
    await waitFor(() =>
      expect(runCvSectionAiActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "generate_language_suggestions",
          existingItems: ["English"],
          maxItems: 5,
        }),
      ),
    );
    expect(
      within(languagesDialog).getByRole("region", { name: "Suggested items for Languages" }),
    ).toBeInTheDocument();
    expect(within(languagesDialog).getByText("French")).toBeInTheDocument();
  });

  it("launches hobby suggestions directly from the hobbies wand", async () => {
    const user = userEvent.setup();
    runCvSectionAiActionMock.mockResolvedValueOnce({
      kind: "list",
      items: ["TypeScript", "Photography", "Chess"],
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Ask for Hobbies" }));

    const hobbiesDialog = screen.getByRole("dialog", { name: "Hobbies" });
    expect(
      await within(hobbiesDialog).findByRole("region", { name: "Suggested items for Hobbies" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(runCvSectionAiActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "generate_hobby_suggestions",
          existingItems: ["Photography"],
          excludeItems: expect.arrayContaining(["TypeScript"]),
          maxItems: 6,
        }),
      ),
    );
    expect(
      within(hobbiesDialog).getAllByRole("button", { name: /Add suggested item/i }).length,
    ).toBeGreaterThan(0);
    expect(within(hobbiesDialog).queryByText("TypeScript")).not.toBeInTheDocument();
    expect(within(hobbiesDialog).getByText("Chess")).toBeInTheDocument();
  });

  it("accepts structured section AI suggestions into the active CV state", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    const baseState = buildCvLibraryState({ importCv });
    const currentCv = {
      ...baseState.currentCv,
      sections: baseState.currentCv.sections.map((section: any) =>
        section.id === "skills-cv_123"
          ? {
              ...section,
              structuredContent: [
                { id: "empty-skill", name: "" },
                ...section.structuredContent,
              ],
            }
          : section,
      ),
    };
    useCvLibraryMock.mockReturnValue({
      ...baseState,
      currentCv,
      cvs: [currentCv],
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Ask for Skills" }));
    await user.click(
      await screen.findByRole("button", { name: "Add suggested item Design systems" }),
    );

    await waitFor(() => expect(importCv).toHaveBeenCalled());
    const savedSections = importCv.mock.lastCall?.[0].sections;
    expect(
      savedSections.find((section: { id: string }) => section.id === "skills-cv_123")
        .structuredContent,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "TypeScript" }),
        expect.objectContaining({ name: "Design systems", level: "Intermediate" }),
      ]),
    );
    expect(
      savedSections
        .find((section: { id: string }) => section.id === "skills-cv_123")
        .structuredContent.some((item: { name?: string }) => !String(item.name ?? "").trim()),
    ).toBe(false);
  });

  it("shows skills as editable pills and hydrates accepted AI chips into the open sheet", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Skills$/i }));
    const skillsDialog = screen.getByRole("dialog", { name: "Skills" });

    expect(screen.getByDisplayValue("TypeScript")).toBeInTheDocument();
    expect(
      skillsDialog.querySelector(".dasti-cv-section-card"),
    ).not.toBeInTheDocument();
    expect(
      skillsDialog.querySelector(".dasti-cv-pill-editor__chip"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ask for Skills" }));
    await user.click(
      await screen.findByRole("button", { name: "Add suggested item Design systems" }),
    );

    expect(screen.getByDisplayValue("Design systems")).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Skills" }).querySelector(".dasti-cv-pill-editor__chip"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove Design systems" }));

    await waitFor(() => expect(importCv).toHaveBeenCalled());
    expect(screen.queryByDisplayValue("Design systems")).not.toBeInTheDocument();
  });

  it("runs the summary row wand directly in the Ask rail", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    runCvSectionAiActionMock.mockResolvedValueOnce({
      kind: "text",
      text: "Sharper profile-aware summary.",
    });
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Ask for Summary" }));

    expect(screen.getAllByText("Summary").length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(runCvSectionAiActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "improve_summary_text",
          existingText: "Focused builder.",
        }),
      ),
    );
    expect(transformEditorSelectionMock).not.toHaveBeenCalled();

    await user.click(await screen.findByRole("button", { name: "Accept" }));
    expect(
      screen.getByRole("status", { name: "Applied. Undo Summary" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(importCv).toHaveBeenCalledTimes(1));
    expect(
      JSON.stringify(
        importCv.mock.lastCall?.[0].sections.find(
          (section: { id: string }) => section.id === "summary-cv_123",
        ).structuredContent[0].summary,
      ),
    ).toContain("Sharper profile-aware summary.");

    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(importCv).toHaveBeenCalledTimes(2));
    expect(
      JSON.stringify(
        importCv.mock.lastCall?.[0].sections.find(
          (section: { id: string }) => section.id === "summary-cv_123",
        ).structuredContent[0].summary,
      ),
    ).toContain("Focused builder.");
  });

  it("opens languages and auto-loads structured suggestions from the row wand", async () => {
    const user = userEvent.setup();
    runCvSectionAiActionMock.mockResolvedValueOnce({
      kind: "list",
      items: ["French"],
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Ask for Languages" }));

    expect(screen.getByRole("dialog", { name: "Languages" })).toBeInTheDocument();
    await waitFor(() =>
      expect(runCvSectionAiActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "generate_language_suggestions",
          existingItems: ["English"],
        }),
      ),
    );
    expect(
      await screen.findByRole("button", { name: "Add suggested item French" }),
    ).toBeInTheDocument();
    expect(transformEditorSelectionMock).not.toHaveBeenCalled();
  });

  it("keeps the add-skill field focused after adding a manual chip", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^Skills$/i }));
    const addSkillInput = screen.getByLabelText("Skill");
    await user.type(addSkillInput, "Design systems");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(addSkillInput).toHaveFocus());
    expect(screen.getByDisplayValue("Design systems")).toBeInTheDocument();
  });

  it("clears stale rail AI suggestions when switching section scope", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Ask for Skills" }));
    const skillsDialog = screen.getByRole("dialog", { name: "Skills" });
    expect(await within(skillsDialog).findByText("Design systems")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Sections" }));
    await user.click(screen.getByRole("button", { name: "Ask for Summary" }));

    expect(screen.getAllByText("Summary").length).toBeGreaterThan(0);
    expect(screen.queryByText("Design systems")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Suggested items for Skills" })).toBeNull();
  });

  it("routes project wands to the typed drawer instead of prose Ask AI", async () => {
    const user = userEvent.setup();
    const state = buildCvLibraryState();
    useCvLibraryMock.mockReturnValue({
      ...state,
      currentCv: {
        ...state.currentCv,
        sections: [
          ...state.currentCv.sections,
          {
            id: "projects-cv_123",
            type: "projects",
            title: "Projects",
            blocks: [
              {
                id: "project-block-cv_123",
                type: "text",
                plainText: "Built a reusable CV forge.",
              },
            ],
            structuredContent: [
              {
                id: "project-item-cv_123",
                title: "CV Forge",
                meta: "React",
                description: "Built a reusable CV forge.",
              },
            ],
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Open Projects item editor" }));

    expect(screen.getByRole("dialog", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("CV Forge")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Ask" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(transformEditorSelectionMock).not.toHaveBeenCalled();
  });

  it("rewrites only the project description body from the project wand", async () => {
    const user = userEvent.setup();
    const state = buildCvLibraryState();
    runCvSectionAiActionMock.mockResolvedValueOnce({
      kind: "text",
      text:
        "**Project:** CV Forge\n**Stack:** React\n**Description:** Built a sharper CV forge.",
    });
    useCvLibraryMock.mockReturnValue({
      ...state,
      currentCv: {
        ...state.currentCv,
        sections: [
          ...state.currentCv.sections,
          {
            id: "projects-cv_123",
            type: "projects",
            title: "Projects",
            blocks: [
              {
                id: "project-block-cv_123",
                type: "text",
                plainText: "Built a reusable CV forge.",
              },
            ],
            structuredContent: [
              {
                id: "project-item-cv_123",
                title: "CV Forge",
                meta: "React",
                description: "Built a reusable CV forge.",
              },
            ],
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Open Projects item editor" }));
    await user.click(screen.getByRole("button", { name: "Improve description" }));

    await waitFor(() =>
      expect(runCvSectionAiActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "improve_project_description",
          existingText: "Built a reusable CV forge.",
        }),
      ),
    );

    expect(screen.queryByText(/\*\*Project:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\*\*Stack:/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(screen.getByLabelText("Description 1")).toHaveValue(
      "Built a sharper CV forge.",
    );
  });

  it("persists section delete with an undo action instead of warning-only stubbing", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Delete Certifications" }));

    await waitFor(() => expect(importCv).toHaveBeenCalledTimes(1));
    expect(
      importCv.mock.lastCall?.[0].sections.some(
        (section: { id: string }) => section.id === "certifications-cv_123",
      ),
    ).toBe(false);
  });

  it("persists keyboard reorder from the rail handle", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    screen.getByRole("button", { name: "Reorder Skills" }).focus();
    await user.keyboard("{ArrowUp}");

    await waitFor(() => expect(importCv).toHaveBeenCalled());
    expect(
      importCv.mock.lastCall?.[0].sections.map((section: { id: string }) => section.id),
    ).toEqual([
      "profile-cv_123",
      "summary-cv_123",
      "experience-cv_123",
      "skills-cv_123",
      "education-cv_123",
      "languages-cv_123",
      "certifications-cv_123",
      "achievements-cv_123",
      "additional-cv_123",
      "custom-cv_123",
      "hobbies-cv_123",
    ]);
  });

  it("uses the default settings tone and sends freeform summary Ask with CV context", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    runCvSectionAiActionMock.mockResolvedValueOnce({
      kind: "text",
      text: "Sharper profile-aware summary.",
    });
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Ask for Summary" }));
    expect(importCv).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Warm" })).not.toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("Tighten the second bullet, drop the buzzwords."),
      "Make this warmer.",
    );
    await user.click(screen.getByRole("button", { name: "Ask Summary" }));

    await waitFor(() =>
      expect(runCvSectionAiActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "improve_summary_text",
          instruction: expect.stringContaining("User request: Make this warmer."),
          existingText: "Focused builder.",
        }),
      ),
    );
    expect(runCvSectionAiActionMock.mock.lastCall?.[0].instruction).toContain(
      "CV context, use only when relevant:",
    );
    expect(runCvSectionAiActionMock.mock.lastCall?.[0].instruction).toContain(
      "TypeScript",
    );
    expect(runCvSectionAiActionMock.mock.lastCall?.[0].instruction).toContain(
      "Tone preference: warm.",
    );
    expect(transformEditorSelectionMock).not.toHaveBeenCalled();
  });

  it("filters already-present singleton sections from the add section menu", async () => {
    const user = userEvent.setup();
    const importCv = vi.fn(async () => undefined);
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Add section" }));
    expect(document.body.querySelector(".dasti-cv-add-section-menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Projects" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Custom section" })).toBeEnabled();
    expect(screen.queryByRole("menuitem", { name: "Summary" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Experience" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Education" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Skills" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Achievements" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Certifications" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Languages" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Hobbies" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Publications" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Awards" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Volunteer" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "References" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Additional information" })).toBeNull();

    await user.click(screen.getByRole("menuitem", { name: "Projects" }));

    await waitFor(() => expect(importCv).toHaveBeenCalledTimes(1));
    expect(
      importCv.mock.lastCall?.[0].sections.some(
        (section: { title?: string }) => section.title === "Projects",
      ),
    ).toBe(true);
    const addedProjectSection = importCv.mock.lastCall?.[0].sections.find(
      (section: { title?: string }) => section.title === "Projects",
    );
    expect(screen.queryByRole("dialog", { name: "Projects" })).not.toBeInTheDocument();
    expect(screen.getByTestId("preview-active-section")).toHaveTextContent(
      addedProjectSection.id,
    );
  });

  it("routes rail import pdf through the hidden file input", async () => {
    const user = userEvent.setup();
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Import PDF" }));

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("shows an honest pending import state while PDF parsing is unresolved", async () => {
    const user = userEvent.setup();
    let resolveImport: (value: unknown) => void = () => {};
    importFileMock.mockReturnValue(
      new Promise((resolve) => {
        resolveImport = resolve;
      }),
    );

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeTruthy();
    fireEvent.change(input!, {
      target: {
        files: [new File(["%PDF"], "resume.pdf", { type: "application/pdf" })],
      },
    });

    await waitFor(() =>
      expect(screen.getAllByText("Importing PDF").length).toBeGreaterThan(0),
    );
    await user.click(screen.getByRole("button", { name: /Structuring sections/i }));
    expect(screen.getByText("Parsing imported résumé")).toBeInTheDocument();
    expect(screen.getAllByText("Structuring sections").length).toBeGreaterThan(1);
    expect(screen.getByText("Final pass")).toBeInTheDocument();
    expect(screen.getByText(/Parser errors will stay visible/i)).toBeInTheDocument();

    resolveImport({ status: "rejected", message: "Parser URL is not configured." });
    await waitFor(() => expect(importFileMock).toHaveBeenCalled());
  });

  it("clears the parsing pending state after parser returns sections even while save continues", async () => {
    const importCv = vi.fn(() => new Promise(() => undefined));
    useCvLibraryMock.mockReturnValue(buildCvLibraryState({ importCv }));
    importFileMock.mockResolvedValue({
      status: "accepted",
      sections: buildCvLibraryState().currentCv.sections,
      authoritativeResume: null,
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(input!, {
      target: {
        files: [new File(["%PDF"], "resume.pdf", { type: "application/pdf" })],
      },
    });

    await waitFor(() =>
      expect(screen.getAllByText("Importing PDF").length).toBeGreaterThan(0),
    );
    await waitFor(() =>
      expect(screen.queryByText(/Parsing is still pending/i)).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /Structuring sections/i })).toBeNull();
    expect(importCv).toHaveBeenCalled();
  });

  it("keeps the workspace preview on the same canvas path on narrow viewports", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 700,
      writable: true,
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Page preview" }));

    expect(screen.getByText("Preview host: panel")).toBeInTheDocument();
  });

  it("uses the PR4 style tab controls without the old icon cluster", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Preview style: swiss|quiet-editorial|sauge|none"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Style" }));

    expect(screen.getByRole("button", { name: /Fraunces Bold/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Workshop" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open saved resume styles" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open text styles" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Use Cobalt accent" }));

    await waitFor(() =>
      expect(
        screen.getByText("Preview style: swiss|quiet-editorial|custom|#2a78d6"),
      ).toBeInTheDocument(),
    );
  });

  it("applies template and font edits to the cv preview", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Preview style: swiss|quiet-editorial|sauge|none"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Style" }));
    await user.click(screen.getByRole("button", { name: /Fraunces Bold/i }));
    await user.click(screen.getByRole("menuitemradio", { name: "Ledger Sans" }));
    await user.click(screen.getByRole("button", { name: "Workshop" }));

    await waitFor(() =>
      expect(
        screen.getByText("Preview style: workshop|ledger-sans|sauge|none"),
      ).toBeInTheDocument(),
    );
  });

  it("shows a compact job-context chip instead of an embedded brief card and can clear it", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123&jobId=job_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("For: Senior Product Designer @ Acme"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Loaded")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /Switch CV\. Active CV:/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to job" })).not.toBeInTheDocument();
    expect(
      screen.queryByText("Loading saved job brief…"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Saved job context is unavailable for this resume session."),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear job context" }));

    expect(
      screen.queryByText("For: Senior Product Designer @ Acme"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Preview host: panel")).toBeInTheDocument();
  });

  it("keeps the CV Forge workspace mounted instead of reopening the legacy picker", () => {
    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({
        currentCv: null,
        currentCvId: null,
        cvs: [],
        isLibraryHydrated: true,
        isLoading: false,
      }),
    );

    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Choose your CV")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open selected CV" })).not.toBeInTheDocument();
    expect(screen.getByText("Upload PDF")).toBeInTheDocument();
    expect(screen.getByText("Start blank")).toBeInTheDocument();
  });

  it("opens the loaded workspace cv instead of reopening the picker when no id param is present", () => {
    window.localStorage.removeItem("twoweeks:quick-start-completed");

    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(screen.getByText("Preview host: panel")).toBeInTheDocument();
    expect(screen.queryByText("Choose your CV")).not.toBeInTheDocument();
  });
});
