# The Grand Unified Blueprint (Final + Developer Guidance)

This is the definitive and holistic design plan. It establishes a single, proportional system that governs the entire application, from the macro page layout down to the micro-details of typography and interactive elements.

🎯 **Guiding Principles: The Five Pillars**

* **Non-Destructive by Default**
* **Sandbox by Design**
* **Harmonious & Performant**
* **Context is King**
* **Universal & Accessible**

> **Developer Guidance:** “Universal & Accessible” means all interactive elements must have keyboard navigation (Tab/Enter/Space), ARIA labels describing the action, and sufficient color contrast (WCAG AA minimum: 4.5:1 for text). Dynamic changes like dismiss or undo should be announced by screen readers.

🏗️ **The User Flows: Optimized for Focus & Control**

* **Flow A – Inline Refinement Experience (Post-Intake)**: Users edit individual fields directly (summary, skills, experience). Each field shows AI suggestions that can be accepted or discarded inline. Autosave applies changes continuously.
* **Flow B – CV Intake & Document Review (Enhanced)**: When a CV is uploaded, the AI reformats it into a complete, structured document with proper headers and section order. Users see a single scrollable view, can dismiss whole sections (trash/cross icon), make small edits inline, and then confirm once to populate the profile editor. Sticky headers remain visible while scrolling to maintain context.

🎨 **The Proportional Design System**

This unified system combines the mechanical precision of a grid with the organic harmony of the Golden Ratio at every level of the design.

* **The Foundation: 8pt Grid System**
  All spacing, padding, and component dimensions are multiples of 8px for crisp alignment and consistent scaling across devices.

* **Architectural Proportions (φ ≈ 1.618)**

  * Main & Sidebar: Main content \~61.8%, Sidebar \~38.2%.
  * Header & Footer: Heights proportionally related (e.g., 64px header, 40px footer).
  * Notifications (toasts, pills) follow the same ratio for balance.

* **Typographic Scale (φ ≈ 1.618)**

  * Base Body Size: 16px
  * Header 1: 16px \* 1.618² ≈ 42px
  * Header 2: 16px \* 1.618 ≈ 26px
  * Secondary Text: 16px / 1.618 ≈ 10px

* **Interaction Hierarchy (φ ≈ 1.618)**

  * Base (Secondary): 24px height
  * Primary: 24px \* 1.618 ≈ 40px height
  * Tertiary: 24px / 1.618 ≈ 16px height

> **Developer Guidance:** Use this scale for all buttons, icons, and interactive elements. Ensure touch targets meet a minimum 44x44px standard. Snap all calculated values to the nearest 8pt grid.

🗺️ **The Execution Roadmap**

**Phase 1: Foundation – The Proportional Canvas**

1. **Establish Design Tokens** ✅

   * Codify 8pt grid, golden ratio proportions, typographic scale, button sizes.
   * Include tokens for spacing, header/footer heights, toast dimensions, and button hierarchy.

2. **Build Components**

   * `CVDocumentReviewer.tsx`: Renders AI-formatted CV, handles sticky headers, section dismissals, and an undo stack.
   * `ProfileReviewModal.tsx`: Handles the CV intake form, autosave, per-field refinements, and integrates `CVDocumentReviewer`.
   * `ToastProvider`: Manages success/error/undo notifications via `showToast`.
   * Button/Icon Components: Adhere to the interaction hierarchy and grid.

3. **Set Performance Budgets**

   * Ensure sticky headers and scrollable document views are smooth for long CVs.
   * Undo stack limited to session scope to reduce memory/performance impact.

**Phase 2: Intelligence Layer – Resilient Data Integration**

* Build backend action `formatCompleteCV` to parse raw CVs and return structured data.
* Wire up document review flow with light inline editing and section dismiss functionality.

**Phase 3: Polish & Validation – Universal Quality Assurance**

1. **Sanitize & Optimize**

   * Ensure all rendered CVs follow typographic scale, spacing, and golden ratio rules.

2. **Cross-Platform Validation**

   * Test desktop, tablet, and mobile viewports.
   * Verify sticky headers work and don’t block content.

3. **User Validation & Metrics**

   * Observe if users feel overwhelmed by long CVs.
   * Test undo discoverability and intuitiveness.
   * Confirm smooth transition from Flow B to Flow A.
   * Measure quantitative metrics: time-to-complete, adoption, error rate.

> **Developer Guidance:** Run a small visual QA checklist:
>
> * Sticky headers remain readable while scrolling
> * Trash icons dismiss sections correctly
> * Undo notifications appear and reverse actions immediately
> * Font sizes and spacing adhere to 8pt grid + golden ratio
> * All buttons/icons have sufficient contrast and proper ARIA labels
> * Touch targets meet accessibility requirements

---

✅ **Outcome:** This blueprint is fully self-contained and ready for implementation. A new developer or an LLM can pick it up without prior context and understand both **what to build** and **why it matters**.