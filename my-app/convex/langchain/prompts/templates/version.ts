import { z } from "zod";

/**
 * Schema for template version metadata
 */
export const TemplateVersionSchema = z.object({
  version: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  description: z.string().min(1, "Description cannot be empty"),
  author: z.string(),
  changes: z.array(z.string()),
});

export type TemplateVersion = z.infer<typeof TemplateVersionSchema>;

/**
 * Schema for versioned template
 */
export interface VersionedContent {
  content: string;
  version: TemplateVersion;
}

export const VersionedTemplateSchema = z.object({
  name: z.string(),
  currentVersion: z.object({
    content: z.string(),
    version: TemplateVersionSchema,
  }),
  previousVersions: z.array(z.object({
    content: z.string(),
    version: TemplateVersionSchema,
  })).optional(),
});

export type VersionedTemplate = z.infer<typeof VersionedTemplateSchema>;

/**
 * Template version manager
 */
export class TemplateVersionManager {
  private templates: Map<string, VersionedTemplate> = new Map();

  /**
   * Add a new template version
   */
  addVersion(
    name: string,
    content: string,
    version: Omit<TemplateVersion, "createdAt" | "updatedAt">
  ): VersionedTemplate {
    const now = new Date();
    const currentTemplate = this.templates.get(name);

    const newVersion: TemplateVersion = {
      ...version,
      createdAt: now,
      updatedAt: now,
    };

    const versionedTemplate: VersionedTemplate = {
      name,
      currentVersion: {
        content,
        version: newVersion,
      },
      previousVersions: currentTemplate
        ? [
            {
              content: currentTemplate.currentVersion.content,
              version: currentTemplate.currentVersion.version,
            },
            ...(currentTemplate.previousVersions || []),
          ]
        : undefined,
    };

    // Validate template
    VersionedTemplateSchema.parse(versionedTemplate);

    // Store template
    this.templates.set(name, versionedTemplate);

    return versionedTemplate;
  }

  /**
   * Get a template by name
   */
  getTemplate(name: string): VersionedTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * Get template history
   */
  getHistory(name: string): TemplateVersion[] {
    const template = this.templates.get(name);
    if (!template) return [];

    return [template.currentVersion.version, ...(template.previousVersions?.map(v => v.version) || [])];
  }

  /**
   * Get template at specific version
   */
  getTemplateAtVersion(name: string, version: string): VersionedTemplate | undefined {
    const template = this.templates.get(name);
    if (!template) return undefined;

    // Check current version
    if (template.currentVersion.version.version === version) {
      return template;
    }

    // Find in previous versions
    const versionedContent = template.previousVersions?.find(v => v.version.version === version);
    if (!versionedContent) return undefined;

    // Return template with requested version as current
    return {
      name,
      currentVersion: versionedContent,
      previousVersions: template.previousVersions?.slice(
        template.previousVersions.findIndex(v => v.version.version === version) + 1
      ),
    };
  }

  /**
   * List all template names
   */
  listTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Check if template exists
   */
  hasTemplate(name: string): boolean {
    return this.templates.has(name);
  }

  /**
   * Delete a template
   */
  deleteTemplate(name: string): boolean {
    return this.templates.delete(name);
  }
}
