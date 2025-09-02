# Blueprint: Hybrid CV Parsing Engine

**Authored:** 2025-08-31
**Status:** Approved

## 1. Executive Summary

This document outlines the architecture for a production-grade, hybrid CV parsing engine. The primary goal is to create a robust, accurate, and resilient system that can intelligently parse unstructured CV text into a structured JSON format.

The architecture employs a hybrid strategy:
1.  **LLM-First:** An initial attempt is made using a Large Language Model (LLM) for its superior ability to understand context and semantic structure.
2.  **Heuristic Fallback:** If the LLM call fails, times out, or returns a low-confidence result, the system gracefully falls back to a sophisticated, deterministic heuristic-based parser.

This dual approach ensures both high accuracy and 100% availability, providing a reliable parsing result under all conditions.

---

## 2. Core Components

The new parsing logic will be encapsulated within a dedicated `my-app/convex/lib/parsing/` directory, containing the following modules:

### 2.1. `hybridParser.ts` - The Orchestrator

This is the main entry point. It orchestrates the parsing flow, manages the LLM-to-heuristic fallback logic, and aggregates the final result.

```typescript
// psuedocode
async function parseCV(rawText: string): Promise<ParseResult> {
  // 1. Attempt LLM parse with a strict timeout (e.g., 10 seconds).
  // 2. On success, validate the LLM output using llmValidator.
  // 3. If validation passes and confidence is high, return the LLM result.
  // 4. If LLM fails, times out, or validation fails, trigger the heuristic fallback.
  // 5. Return the heuristic result with appropriate warnings.
}
```

### 2.2. `llmPrompts.ts` - Prompt Engineering

Contains the meticulously crafted prompts for the LLM, designed for consistency and accuracy.

-   **`SECTION_EXTRACTION_PROMPT`**: Instructs the LLM to segment the CV into logical sections (`experience`, `education`, `skills`, etc.) and return a specific JSON structure with confidence scores. Includes few-shot examples to guide the model.
-   **`METADATA_EXTRACTION_PROMPT`**: A separate, optimized prompt to extract contact and personal information (`name`, `email`, `phone`, `linkedinUrl`).

### 2.3. `llmValidator.ts` - LLM Output Validation

A crucial component for ensuring the reliability of the LLM's output.

-   **Structural Validation**: Checks for correct JSON format and the presence of the `sections` array.
-   **Confidence Analysis**: Calculates average and minimum confidence scores from the LLM.
-   **Content Coverage**: Ensures that the combined content of all extracted sections represents a significant portion (e.g., >70%) of the original text, preventing hallucinations or omissions.
-   **Duplicate Detection**: Flags cases where the LLM creates redundant sections.

### 2.4. `enhancedParser.ts` - Heuristic Header & Section Detection

The core of the fallback mechanism.

-   **`FIELD_KEY_MAP`**: A comprehensive, internationalized dictionary mapping various header phrases (e.g., "Work History", "Berufserfahrung") to our canonical field keys (`experience`).
-   **`isPotentialHeader`**: A sophisticated function that uses a weighted scoring system to identify headers based on multiple cues:
    -   Known patterns from `FIELD_KEY_MAP`.
    -   Structural formatting (markdown, separators).
    -   Textual properties (all-caps, high capital-to-text ratio).
    -   Context (preceded by a blank line).

### 2.5. `metadataExtractor.ts` - Heuristic Metadata Extraction

Provides robust, regex- and condition-based extraction for key personal details as a reliable fallback. It uses multiple strategies to find the most likely candidate for each field.

---

## 3. Implementation Roadmap

### Phase 1: Foundational Heuristics & Structure
-   **T-01**: Create new directory at `my-app/convex/lib/parsing/`.
-   **T-02**: Implement `enhancedParser.ts` (`FIELD_KEY_MAP`, `isPotentialHeader`).
-   **T-03**: Implement `metadataExtractor.ts`.
-   **T-04**: Build a comprehensive unit test suite for all heuristic functions.

### Phase 2: LLM Integration & Validation
-   **T-05**: Implement `llmPrompts.ts`.
-   **T-06**: Implement `llmValidator.ts`.
-   **T-07**: Implement `hybridParser.ts` to orchestrate the flow.
-   **T-08**: Refactor the main `formatCompleteCV.ts` action to use the new `hybridParser`.

### Phase 3: Production Readiness & Monitoring
-   **T-09**: Integrate a user feedback mechanism in the UI.
-   **T-10**: Implement logging for key monitoring metrics.
-   **T-11**: Deploy to a staging environment for canary testing.

---

## 4. Monitoring & KPIs

To ensure ongoing quality, the following metrics will be tracked:

1.  **Parser Performance**:
    -   LLM success rate vs. heuristic fallback rate.
    -   Average confidence scores (both LLM and heuristic).
    -   p95 and p99 processing time.
2.  **Quality Metrics**:
    -   Text coverage ratio.
    -   Rate of validation issues (e.g., duplicate sections).
    -   User correction/feedback rate.
3.  **Business Metrics**:
    -   Cost per parse.
    -   User satisfaction (qualitative feedback).


