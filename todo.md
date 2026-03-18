# Blueprint: The Golden Ratio Hybrid Plan

## 🎯 Guiding Principles
1.  **Non-Destructive by Default:** User's draft is sacred.
2.  **Context is King:** Inline, non-disruptive interactions.
3.  **Harmonious & Performant:** 8pt grid for rhythm, Golden Ratio for proportion.
4.  **Universal & Accessible:** WCAG AA compliance baseline.

---

## 🗺️ Execution Roadmap

### **Phase 1: Foundation – The Harmonious Canvas**
*Goal: Build the core UI with our grid and proportional system.*

- [ ] **1.1. Establish Design Tokens:**
    - [ ] Codify 8pt grid units in project styling configuration (e.g., TailwindCSS config).
    - [ ] Codify Golden Ratio typographic scale (Base: 16px) in config.
    - [ ] Define color palette as CSS variables for themeable light/dark modes.

- [ ] **1.2. Build Core Components:**
    - [ ] Create `RefinementField` for inline suggestions (Flow A).
    - [ ] Create `CVReviewPane` for bulk review (Flow B).
    - [ ] Ensure all components are memoized and adhere strictly to design tokens.

- [ ] **1.3. Set Performance Budgets:**
    - [ ] Establish Lighthouse >95 as a CI/CD gate.
    - [ ] Profile initial component render performance.

- [ ] **1.4. Accessibility Audit:**
    - [ ] Implement full keyboard navigation for all interactive elements.
    - [ ] Add necessary ARIA attributes for screen reader compatibility.

### **Phase 2: Intelligence Layer – Resilient Data Integration**
*Goal: Connect the backend with a focus on speed and reliability.*

- [ ] **2.1. Build Backend Actions & Prompts:**
    - [ ] Implement `refineField` Convex action with debounce logic.
    - [ ] Implement the enhanced CV parsing workflow (schema, few-shot examples, validation, fallback).
    - [ ] Update the LLM prompt in `my-app/convex/llm.ts` to reflect the new structured parsing strategy.

- [ ] **2.2. Implement Frontend Data Flows:**
    - [ ] Wire `RefinementField` to the `refineField` action.
    - [ ] Implement virtualization for the `CVReviewPane` suggestion list.
    - [ ] Implement a client-side undo stack for the last 5 applied actions in `CVReviewPane`.

- [ ] **2.3. Add Robust Error States:**
    - [ ] Design and implement UI states for API loading, success, and failure.
    - [ ] Ensure all backend calls handle network errors gracefully.

### **Phase 3: Polish & Validation – Universal Quality Assurance**
*Goal: Harden the application through rigorous, multi-platform testing.*

- [ ] **3.1. Sanitize & Optimize:**
    - [ ] Review and remove any heavy or unnecessary dependencies.
    - [ ] Analyze and monitor the final production bundle size.

- [ ] **3.2. Cross-Platform Validation:**
    - [ ] Test end-to-end flows on Chrome, Firefox, and Safari.
    - [ ] Validate responsive behavior on a spectrum of mobile and desktop viewport sizes.

- [ ] **3.3. User Validation & Metrics:**
    - [ ] Deploy the new flow to a staging environment.
    - [ ] Gather qualitative user feedback.
    - [ ] Implement quantitative analytics to measure feature adoption and time-to-complete.