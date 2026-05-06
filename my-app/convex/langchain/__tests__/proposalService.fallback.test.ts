import { describe, expect, it, vi } from "vitest";
import type { BaseMessage } from "@langchain/core/messages";

import { ProposalService } from "../index";
import type { ModelAdapter } from "../models/model_adapter";
import type { PromptManager } from "../prompts";

function buildProposalJson(modelName: string): string {
  return JSON.stringify({
    title: "Proposal title",
    content:
      "This is a long enough proposal body to satisfy the schema validation rules and prove the fallback path.",
    sections: [
      {
        title: "Section 1",
        content:
          "This is a long enough proposal section body to satisfy the schema validation rules.",
      },
    ],
    metrics: {
      duration: 1,
      success: true,
    },
    metadata: {
      modelName,
      tokens: 120,
      completionTime: 1,
    },
    tags: ["type:creative"],
  });
}

function createPromptManager(): PromptManager {
  return {
    get: vi.fn().mockResolvedValue("Write the proposal."),
  } as unknown as PromptManager;
}

describe("ProposalService fallback routing", () => {
  it("falls back from the primary writer to qwen and preserves the real model name", async () => {
    const primaryAdapter = {
      generate: vi.fn().mockRejectedValue(new Error("openai down")),
      parseResult: vi.fn(),
      getModelName: () => "gpt-5.5",
    } as unknown as ModelAdapter;
    const qwenAdapter = {
      generate: vi.fn().mockResolvedValue(buildProposalJson("qwen3.6-plus")),
      parseResult: vi.fn(),
      getModelName: () => "qwen3.6-plus",
    } as unknown as ModelAdapter;
    const mistralAdapter = {
      generate: vi.fn().mockResolvedValue(buildProposalJson("mistral-large-latest")),
      parseResult: vi.fn(),
      getModelName: () => "mistral-large-latest",
    } as unknown as ModelAdapter;

    const service = new ProposalService({
      modelAdapters: [primaryAdapter, qwenAdapter, mistralAdapter],
      promptManager: createPromptManager(),
    });

    const result = await service.generateCreativeProposal({
      jobTitle: "Operations Associate",
      jobDescription: "Coordinate operations across teams.",
      creativeDirection: "Warm and concise",
    });

    expect(primaryAdapter.generate).toHaveBeenCalledTimes(1);
    expect(qwenAdapter.generate).toHaveBeenCalledTimes(1);
    expect(mistralAdapter.generate).not.toHaveBeenCalled();
    expect(result.metadata.modelName).toBe("qwen3.6-plus");
  });

  it("falls back through text generation in the same adapter order", async () => {
    const primaryAdapter = {
      generate: vi.fn().mockRejectedValue(new Error("openai down")),
      parseResult: vi.fn(),
      getModelName: () => "gpt-5.5",
    } as unknown as ModelAdapter;
    const qwenAdapter = {
      generate: vi.fn().mockResolvedValue("qwen text"),
      parseResult: vi.fn(),
      getModelName: () => "qwen3.6-plus",
    } as unknown as ModelAdapter;

    const service = new ProposalService({
      modelAdapters: [primaryAdapter, qwenAdapter],
      promptManager: createPromptManager(),
    });

    const result = await service.generateTextWithFallbacks(
      [
        { _getType: () => "user", content: "Please write this." } as BaseMessage,
      ],
      {},
    );

    expect(primaryAdapter.generate).toHaveBeenCalledTimes(1);
    expect(qwenAdapter.generate).toHaveBeenCalledTimes(1);
    expect(result.text).toBe("qwen text");
    expect(result.modelName).toBe("qwen3.6-plus");
  });
});
