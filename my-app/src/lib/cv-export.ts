import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  type IParagraphOptions,
} from "docx";
import { jsPDF } from "jspdf";

import type {
  AuthoritativeResume,
  AuthoritativeResumeCertification,
  AuthoritativeResumeEducation,
  AuthoritativeResumeExperience,
  AuthoritativeResumeExportModel,
  AuthoritativeResumeLanguage,
  AuthoritativeResumeProject,
} from "./authoritative-resume";
import { buildAuthoritativeResumeExportModel } from "./authoritative-resume";

export type ResumeExportFormat = "pdf" | "docx" | "markdown" | "json";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function cleanString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function sanitizeFilenamePart(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return normalized || "resume";
}

function buildFilenameBase(model: AuthoritativeResumeExportModel): string {
  const name = cleanString(model.profile.name);
  return name ? sanitizeFilenamePart(name) : "resume";
}

export function buildAuthoritativeResumeFilename(
  model: AuthoritativeResumeExportModel,
  format: ResumeExportFormat,
): string {
  const base = buildFilenameBase(model);
  if (format === "json") return `${base}.json`;
  if (format === "markdown") return `${base}.md`;
  if (format === "docx") return `${base}.docx`;
  return `${base}.pdf`;
}

function formatStructuredDateToken(raw: string | null | undefined): string {
  const value = cleanString(raw);
  if (!value) {
    return "";
  }

  const yearMatch = value.match(/^(\d{4})$/);
  if (yearMatch) {
    return yearMatch[1];
  }

  const monthMatch = value.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const monthIndex = Number(monthMatch[2]) - 1;
    if (monthIndex >= 0 && monthIndex < MONTHS.length) {
      return `${MONTHS[monthIndex]} ${monthMatch[1]}`;
    }
    return value;
  }

  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (dateMatch) {
    const monthIndex = Number(dateMatch[2]) - 1;
    const day = Number(dateMatch[3]);
    if (monthIndex >= 0 && monthIndex < MONTHS.length && Number.isFinite(day)) {
      return `${MONTHS[monthIndex]} ${day}, ${dateMatch[1]}`;
    }
    return value;
  }

  return value;
}

function formatStructuredDateRange(input: {
  startDate?: string;
  endDate?: string | null;
  isCurrent?: boolean;
}): string {
  const start = formatStructuredDateToken(input.startDate);
  const end = input.isCurrent
    ? "Present"
    : formatStructuredDateToken(input.endDate ?? undefined);

  if (start && end) {
    return `${start} — ${end}`;
  }
  if (start) {
    return start;
  }
  if (end) {
    return end;
  }
  return "";
}

function buildContactLine(model: AuthoritativeResumeExportModel): string {
  return [
    model.profile.email,
    model.profile.phone,
    model.profile.location,
    model.profile.linkedin,
    model.profile.website,
    model.profile.github,
    model.profile.portfolio,
  ]
    .map((value) => cleanString(value))
    .filter(Boolean)
    .join(" | ");
}

function addLines(lines: string[], ...values: Array<string | undefined>): void {
  values.forEach((value) => {
    const cleaned = cleanString(value);
    if (cleaned) {
      lines.push(cleaned);
    }
  });
}

function serializeExperienceMarkdown(
  lines: string[],
  items: AuthoritativeResumeExperience[],
): void {
  if (items.length === 0) return;
  lines.push("", "## Experience");
  items.forEach((item) => {
    const header = [cleanString(item.position), cleanString(item.company)]
      .filter(Boolean)
      .join(" — ");
    const meta = [cleanString(item.location), formatStructuredDateRange(item)]
      .filter(Boolean)
      .join(" | ");
    lines.push("", `### ${header || "Experience"}`);
    if (meta) {
      lines.push(meta);
    }
    if (item.responsibilityBullets.length > 0) {
      item.responsibilityBullets.forEach((bullet) => {
        lines.push(`- ${bullet}`);
      });
      return;
    }
    addLines(lines, item.summary);
    item.achievements.forEach((achievement) => {
      lines.push(`- ${achievement}`);
    });
  });
}

function serializeEducationMarkdown(
  lines: string[],
  items: AuthoritativeResumeEducation[],
): void {
  if (items.length === 0) return;
  lines.push("", "## Education");
  items.forEach((item) => {
    const header = [cleanString(item.degree), cleanString(item.institution)]
      .filter(Boolean)
      .join(" — ");
    const meta = [cleanString(item.fieldOfStudy), formatStructuredDateRange(item)]
      .filter(Boolean)
      .join(" | ");
    lines.push("", `### ${header || "Education"}`);
    if (meta) {
      lines.push(meta);
    }
    addLines(lines, item.description);
  });
}

function serializeNamedListMarkdown(
  lines: string[],
  title: string,
  values: string[],
): void {
  if (values.length === 0) return;
  lines.push("", `## ${title}`);
  values.forEach((value) => {
    lines.push(`- ${value}`);
  });
}

function serializeLanguagesMarkdown(
  lines: string[],
  items: AuthoritativeResumeLanguage[],
): void {
  if (items.length === 0) return;
  lines.push("", "## Languages");
  items.forEach((item) => {
    const value = item.level ? `${item.name} (${item.level})` : item.name;
    lines.push(`- ${value}`);
  });
}

function serializeProjectsMarkdown(
  lines: string[],
  items: AuthoritativeResumeProject[],
): void {
  if (items.length === 0) return;
  lines.push("", "## Projects");
  items.forEach((item) => {
    lines.push("", `### ${cleanString(item.title) || "Project"}`);
    addLines(lines, item.meta, item.summary);
  });
}

function serializeCertificationsMarkdown(
  lines: string[],
  items: AuthoritativeResumeCertification[],
): void {
  if (items.length === 0) return;
  lines.push("", "## Certifications");
  items.forEach((item) => {
    lines.push("", `### ${item.name}`);
    const meta = [
      cleanString(item.issuer),
      formatStructuredDateToken(item.date),
      cleanString(item.credentialId),
    ]
      .filter(Boolean)
      .join(" | ");
    if (meta) {
      lines.push(meta);
    }
  });
}

export function serializeAuthoritativeResumeJson(
  model: AuthoritativeResumeExportModel,
): string {
  return `${JSON.stringify(model, null, 2)}\n`;
}

export function serializeAuthoritativeResumeMarkdown(
  model: AuthoritativeResumeExportModel,
): string {
  const lines: string[] = [`# ${model.profile.name}`];
  addLines(lines, model.profile.desiredPosition, buildContactLine(model));

  if (model.summary) {
    lines.push("", "## Summary", "", model.summary);
  }

  serializeExperienceMarkdown(lines, model.experience);
  serializeEducationMarkdown(lines, model.education);
  serializeNamedListMarkdown(
    lines,
    "Skills",
    model.skills.map((skill) => skill.name),
  );
  serializeLanguagesMarkdown(lines, model.languages);
  serializeProjectsMarkdown(lines, model.projects);
  serializeCertificationsMarkdown(lines, model.certifications);
  serializeNamedListMarkdown(lines, "Achievements", model.achievements);

  return `${lines.join("\n").trim()}\n`;
}

function paragraph(text: string, options?: Omit<IParagraphOptions, "children">): Paragraph {
  return new Paragraph({
    ...options,
    children: [new TextRun({ text })],
  });
}

export async function buildAuthoritativeResumeDocx(
  model: AuthoritativeResumeExportModel,
): Promise<Blob> {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: model.profile.name, bold: true })],
    }),
  ];

  if (model.profile.desiredPosition) {
    children.push(paragraph(model.profile.desiredPosition));
  }

  const contactLine = buildContactLine(model);
  if (contactLine) {
    children.push(paragraph(contactLine));
  }

  if (model.summary) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Summary", bold: true })],
      }),
      paragraph(model.summary),
    );
  }

  if (model.experience.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Experience", bold: true })],
      }),
    );
    model.experience.forEach((item) => {
      const header = [cleanString(item.position), cleanString(item.company)]
        .filter(Boolean)
        .join(" — ");
      const meta = [cleanString(item.location), formatStructuredDateRange(item)]
        .filter(Boolean)
        .join(" | ");
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: header || "Experience", bold: true })],
        }),
      );
      if (meta) {
        children.push(paragraph(meta));
      }
      if (item.responsibilityBullets.length > 0) {
        item.responsibilityBullets.forEach((bullet) => {
          children.push(
            new Paragraph({
              text: bullet,
              bullet: { level: 0 },
            }),
          );
        });
      } else {
        if (item.summary) {
          children.push(paragraph(item.summary));
        }
        item.achievements.forEach((achievement) => {
          children.push(
            new Paragraph({
              text: achievement,
              bullet: { level: 0 },
            }),
          );
        });
      }
    });
  }

  if (model.education.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Education", bold: true })],
      }),
    );
    model.education.forEach((item) => {
      const header = [cleanString(item.degree), cleanString(item.institution)]
        .filter(Boolean)
        .join(" — ");
      const meta = [cleanString(item.fieldOfStudy), formatStructuredDateRange(item)]
        .filter(Boolean)
        .join(" | ");
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: header || "Education", bold: true })],
        }),
      );
      if (meta) {
        children.push(paragraph(meta));
      }
      if (item.description) {
        children.push(paragraph(item.description));
      }
    });
  }

  if (model.skills.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Skills", bold: true })],
      }),
      paragraph(model.skills.map((skill) => skill.name).join(", ")),
    );
  }

  if (model.languages.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Languages", bold: true })],
      }),
    );
    model.languages.forEach((item) => {
      children.push(
        new Paragraph({
          text: item.level ? `${item.name} (${item.level})` : item.name,
          bullet: { level: 0 },
        }),
      );
    });
  }

  if (model.projects.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Projects", bold: true })],
      }),
    );
    model.projects.forEach((item) => {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: cleanString(item.title) || "Project", bold: true })],
        }),
      );
      if (item.meta) {
        children.push(paragraph(item.meta));
      }
      if (item.summary) {
        children.push(paragraph(item.summary));
      }
    });
  }

  if (model.certifications.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Certifications", bold: true })],
      }),
    );
    model.certifications.forEach((item) => {
      const meta = [
        cleanString(item.issuer),
        formatStructuredDateToken(item.date),
        cleanString(item.credentialId),
      ]
        .filter(Boolean)
        .join(" | ");
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: item.name, bold: true })],
        }),
      );
      if (meta) {
        children.push(paragraph(meta));
      }
    });
  }

  if (model.achievements.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Achievements", bold: true })],
      }),
    );
    model.achievements.forEach((item) => {
      children.push(
        new Paragraph({
          text: item,
          bullet: { level: 0 },
        }),
      );
    });
  }

  const document = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBlob(document);
}

export function buildAuthoritativeResumePdf(
  model: AuthoritativeResumeExportModel,
): Blob {
  const pdf = new jsPDF({
    unit: "pt",
    format: "a4",
    compress: true,
  });

  const margin = 44;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - margin;
  let y = margin;

  const ensureSpace = (height: number) => {
    if (y + height <= bottomLimit) return;
    pdf.addPage();
    y = margin;
  };

  const writeText = (text: string, options?: {
    size?: number;
    bold?: boolean;
    indent?: number;
    spacingAfter?: number;
  }) => {
    const cleaned = cleanString(text);
    if (!cleaned) return;
    const size = options?.size ?? 11;
    const indent = options?.indent ?? 0;
    const lines = pdf.splitTextToSize(cleaned, contentWidth - indent) as string[];
    const lineHeight = Math.max(13, size * 1.25);
    ensureSpace(lines.length * lineHeight + (options?.spacingAfter ?? 4));
    pdf.setFont("helvetica", options?.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.text(lines, margin + indent, y);
    y += lines.length * lineHeight + (options?.spacingAfter ?? 4);
  };

  const writeBullet = (text: string) => {
    const cleaned = cleanString(text);
    if (!cleaned) return;
    ensureSpace(18);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text("•", margin, y);
    const lines = pdf.splitTextToSize(cleaned, contentWidth - 16) as string[];
    pdf.text(lines, margin + 16, y);
    y += lines.length * 14 + 4;
  };

  const writeSectionHeading = (title: string) => {
    ensureSpace(30);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(title, margin, y);
    y += 18;
  };

  writeText(model.profile.name, { size: 24, bold: true, spacingAfter: 8 });
  writeText(model.profile.desiredPosition ?? "", { size: 12, spacingAfter: 6 });
  writeText(buildContactLine(model), { size: 10, spacingAfter: 10 });

  if (model.summary) {
    writeSectionHeading("Summary");
    writeText(model.summary, { spacingAfter: 8 });
  }

  if (model.experience.length > 0) {
    writeSectionHeading("Experience");
    model.experience.forEach((item) => {
      const header = [cleanString(item.position), cleanString(item.company)]
        .filter(Boolean)
        .join(" — ");
      const meta = [cleanString(item.location), formatStructuredDateRange(item)]
        .filter(Boolean)
        .join(" | ");
      writeText(header || "Experience", { size: 11.5, bold: true, spacingAfter: 2 });
      writeText(meta, { size: 10, spacingAfter: 4 });
      if (item.responsibilityBullets.length > 0) {
        item.responsibilityBullets.forEach(writeBullet);
      } else {
        writeText(item.summary ?? "", { spacingAfter: 4 });
        item.achievements.forEach(writeBullet);
      }
      y += 4;
    });
  }

  if (model.education.length > 0) {
    writeSectionHeading("Education");
    model.education.forEach((item) => {
      const header = [cleanString(item.degree), cleanString(item.institution)]
        .filter(Boolean)
        .join(" — ");
      const meta = [cleanString(item.fieldOfStudy), formatStructuredDateRange(item)]
        .filter(Boolean)
        .join(" | ");
      writeText(header || "Education", { size: 11.5, bold: true, spacingAfter: 2 });
      writeText(meta, { size: 10, spacingAfter: 4 });
      writeText(item.description ?? "", { spacingAfter: 6 });
    });
  }

  if (model.skills.length > 0) {
    writeSectionHeading("Skills");
    writeText(model.skills.map((skill) => skill.name).join(", "), { spacingAfter: 8 });
  }

  if (model.languages.length > 0) {
    writeSectionHeading("Languages");
    model.languages.forEach((item) => {
      writeBullet(item.level ? `${item.name} (${item.level})` : item.name);
    });
    y += 4;
  }

  if (model.projects.length > 0) {
    writeSectionHeading("Projects");
    model.projects.forEach((item) => {
      writeText(cleanString(item.title) || "Project", { size: 11.5, bold: true, spacingAfter: 2 });
      writeText(item.meta ?? "", { size: 10, spacingAfter: 3 });
      writeText(item.summary ?? "", { spacingAfter: 6 });
    });
  }

  if (model.certifications.length > 0) {
    writeSectionHeading("Certifications");
    model.certifications.forEach((item) => {
      const meta = [
        cleanString(item.issuer),
        formatStructuredDateToken(item.date),
        cleanString(item.credentialId),
      ]
        .filter(Boolean)
        .join(" | ");
      writeText(item.name, { size: 11.5, bold: true, spacingAfter: 2 });
      writeText(meta, { size: 10, spacingAfter: 6 });
    });
  }

  if (model.achievements.length > 0) {
    writeSectionHeading("Achievements");
    model.achievements.forEach(writeBullet);
  }

  return pdf.output("blob");
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

export async function downloadAuthoritativeResumeExport(args: {
  authoritativeResume: AuthoritativeResume | unknown;
  format: ResumeExportFormat;
}): Promise<{ filename: string; model: AuthoritativeResumeExportModel }> {
  const model = buildAuthoritativeResumeExportModel(args.authoritativeResume);
  if (!model) {
    throw new Error("Trusted Mistral v3 export data is unavailable.");
  }

  const filename = buildAuthoritativeResumeFilename(model, args.format);

  if (args.format === "json") {
    triggerDownload(
      new Blob([serializeAuthoritativeResumeJson(model)], {
        type: "application/json;charset=utf-8",
      }),
      filename,
    );
    return { filename, model };
  }

  if (args.format === "markdown") {
    triggerDownload(
      new Blob([serializeAuthoritativeResumeMarkdown(model)], {
        type: "text/markdown;charset=utf-8",
      }),
      filename,
    );
    return { filename, model };
  }

  if (args.format === "docx") {
    triggerDownload(
      await buildAuthoritativeResumeDocx(model),
      filename,
    );
    return { filename, model };
  }

  triggerDownload(buildAuthoritativeResumePdf(model), filename);
  return { filename, model };
}
