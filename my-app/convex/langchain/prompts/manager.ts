import { PromptTemplate } from "@langchain/core/prompts";
import { TemplateVersionManager, type TemplateVersion, type VersionedTemplate } from "./templates/version";
import { z } from "zod";
import { templateConfigurations } from "./templates";

/**
 * Configuration for prompt manager
 */
export interface PromptManagerConfig {
  defaultFormat?: string;
  defaultStyle?: string;
  validateTemplates?: boolean;
}

/**
 * Schema for template variables
 */
const TemplateVariablesSchema = z.record(z.unknown());

export type TemplateName = keyof typeof templateConfigurations;

export class PromptManager {
  private versionManager: TemplateVersionManager = new TemplateVersionManager();
  private compiledTemplates: Map<string, PromptTemplate> = new Map();
  private defaults: Record<string, any> = {};
  private validators: Map<string, (vars: Record<string, any>) => boolean> = new Map(); // Initialize validators map

  /**
   * Register a new template version
   */
  register(
    name: string,
    content: string, // Add content parameter
    version: Omit<TemplateVersion, "createdAt" | "updatedAt">, // Add version parameter
    defaults?: Record<string, any>,
    validator?: (vars: Record<string, any>) => boolean
  ): VersionedTemplate {
    // Add version to manager
    const versionedTemplate = this.versionManager.addVersion(name, content, version); // Use content and version

    // Compile template
    this.compiledTemplates.set(
      name,
      PromptTemplate.fromTemplate(content) // Use content
    );
    if (defaults) {
      this.defaults[name] = defaults;
    }
    if (validator) {
      this.validators.set(name, validator); // Store validator
    }

    return versionedTemplate;
  }

  /**
   * Get a template by name and format with variables
   */
  async get(name: TemplateName, variables: Record<string, any>): Promise<string> {
    const template = this.compiledTemplates.get(name); // Use compiledTemplates
    if (!template) {
      throw new Error(`Template not found: ${name}`);
    }

    // Get default variables for this template
    const defaults = templateConfigurations[name]?.defaults || {}; // Use templateConfigurations defaults

    // Merge with provided variables
    const mergedVariables = {
      ...defaults,
      ...variables,
    };

    console.log("Variables before validation:", mergedVariables);
    // Validate variables if validator exists
    const validator = templateConfigurations[name]?.validator; // Use templateConfigurations validator
    if (validator && !validator(mergedVariables)) {
      throw new Error(`Invalid variables for template: ${name}`);
    }

    // Format template with variables
    return template.format(mergedVariables);
  }

  /**
   * Get a specific version of a template
   */
  async getVersion(
    name: string,
    version: string,
    variables: Record<string, any>
  ): Promise<string> {
    // Get specific template version
    const template = this.versionManager.getTemplateAtVersion(name, version);
    if (!template) {
      throw new Error(`Template ${name} version ${version} not found`);
    }

    // Create temporary compiled template
    const compiled = PromptTemplate.fromTemplate(template.currentVersion.content);

    // Validate variables
    TemplateVariablesSchema.parse(variables);

    // Format template with variables and defaults
    return compiled.format({
      ...this.defaults,
      ...variables,
    });
  }

  /**
   * Get template history
   */
  getHistory(name: string) {
    return this.versionManager.getHistory(name);
  }

  /**
   * List all template names
   */
  listTemplates(): string[] {
    return this.versionManager.listTemplates();
  }

  /**
   * Delete a template
   */
  deleteTemplate(name: string): boolean {
    const deleted = this.versionManager.deleteTemplate(name);
    if (deleted) {
      this.compiledTemplates.delete(name);
    }
    return deleted;
  }
}
