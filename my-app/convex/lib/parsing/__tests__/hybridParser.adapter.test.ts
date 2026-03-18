import { describe, it, expect, vi } from "vitest";
import { parseCV } from "../hybridParser";
import * as llmAdapters from "../../../../config/llmAdapters";
import { llmConfig } from "../../../../config/llmConfig";

describe("hybridParser with mock adapter", () => {
  it("successfully repairs markdown-fenced JSON and returns an 'llm' method result", async () => {
    const mockLLMResponse = `
      Some introductory text from the LLM.
      \`\`\`json
      {
        "sections": [
          {
            "title": "Work Experience",
            "content": "Did stuff at a place",
            "fieldKey": "experience",
            "confidence": 0.95
          }
        ],
        "metadata": {
          "name": "Mocked User",
          "email": "mock@test.com"
        }
      }
      \`\`\`
      Some closing remarks.
    `;

    // Mock the adapter factory to return a mock adapter
    const getLLMAdapterSpy = vi.spyOn(llmAdapters, "getLLMAdapter").mockReturnValue({
      call: vi.fn().mockResolvedValue(mockLLMResponse),
    });

    const cvText = `This is a CV.
Did stuff at a place`;
    const result = await parseCV(cvText);

    // Verify results
    expect(result.method).toBe("llm");
    expect(result.sections[0].title).toBe("Work Experience");
    expect(result.metadata.name).toBe("Mocked User");
    expect(getLLMAdapterSpy).toHaveBeenCalledWith(llmConfig);

    // Cleanup
    getLLMAdapterSpy.mockRestore();
  });
});