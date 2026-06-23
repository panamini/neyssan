/* eslint-disable @typescript-eslint/no-explicit-any -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { PromptTemplate } from "@langchain/core/prompts";

// Template types
export type TemplateName = string; // Allow any string for template names during testing

export type TemplateMap = {
  [K in TemplateName]: PromptTemplate;
};

// Manager for prompt templates and their variables
export class PromptManager {
  private readonly templates: Map<string, PromptTemplate>;
  private readonly defaults: Map<string, Record<string, any>>;
  private readonly validators: Map<string, (vars: Record<string, any>) => boolean>;

  constructor() {
    this.templates = new Map();
    this.defaults = new Map();
    this.validators = new Map();
  }

  /**
   * Gets a template by name
   */
  async get(name: TemplateName, variables: Record<string, any>): Promise<string> {
    const template = this.templates.get(name);
    if (!template) {
      throw new Error(`Template not found: ${name}`);
    }

    // Get default variables for this template
    const defaults = this.defaults.get(name) || {};

    // Merge with provided variables
    const mergedVariables = {
      ...defaults,
      ...variables,
    };

    // Validate variables if validator exists
    const validator = this.validators.get(name);
    if (validator && !validator(mergedVariables)) {
      throw new Error(`Invalid variables for template: ${name}`);
    }

    // Format template with variables
    return template.format(mergedVariables);
  }

  /**
   * Registers a new template
   */
  register(
    name: string,
    template: PromptTemplate,
    defaults?: Record<string, any>,
    validator?: (vars: Record<string, any>) => boolean
  ): void {
    this.templates.set(name, template);
    if (defaults) this.defaults.set(name, defaults);
    if (validator) this.validators.set(name, validator);
  }

  /**
   * Gets all registered template names
   */
  getTemplateNames(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Checks if a template exists
   */
  hasTemplate(name: string): boolean {
    return this.templates.has(name);
  }
}

import { templateConfigurations } from './templates/index';

// Export factory function
export function createPromptManager(): PromptManager {
  const promptManager = new PromptManager();

  // Register templates from templateConfigurations
  for (const templateName in templateConfigurations) {
    if (Object.hasOwn(templateConfigurations, templateName)) {
      const config = templateConfigurations[templateName as keyof typeof templateConfigurations];
      promptManager.register(
        templateName as keyof typeof templateConfigurations,
        config.template,
        config.defaults,
        config.validator
      );
    }
  }

  return promptManager;
}
