# Neyssan Application Design System

This document outlines the core principles, design tokens, and architectural decisions for the Neyssan application's user interface. Its purpose is to create a consistent, scalable, and maintainable UI foundation.

## 1. Core Principles

1.  **Component Library: Radix Themes**
    *   We will use [`@radix-ui/themes`](https://www.radix-ui.com/themes) as our primary component library. This provides a set of high-quality, accessible, and themeable components out of the box.
    *   New UI elements should be built using Radix components whenever possible.

2.  **Styling Engine: Tailwind CSS**
    *   [Tailwind CSS](https://tailwindcss.com/) will be used for all layout, positioning, and custom styling needs.
    *   It should be used to apply the design tokens defined in this document and to override Radix Theme styles when necessary for specific design requirements.

3.  **Consistency is Key**
    *   All new development must adhere to the tokens and guidelines defined here.
    *   The goal is to progressively refactor existing components to align with this system, creating a unified look and feel across the entire application.

## 2. Design Tokens

Design tokens are the central, named values that define the visual style of our application. They are implemented in [`tailwind.config.js`](tailwind.config.js) and utilized by both Tailwind classes and CSS variables.

### 2.1. Color System

Our color system is designed to be semantic, supporting both light and dark modes effortlessly. It draws from the existing palette in `tailwind.config.js` but simplifies it into a clear, hierarchical structure.

| Token Name  | CSS Variable         | Light Mode Value | Dark Mode Value    | Description                               |
| :---------- | :------------------- | :--------------- | :----------------- | :---------------------------------------- |
| `background`| `var(--background)`  | `#FFFFFF`        | `#272727` (dim-200) | Main page background color.               |
| `foreground`| `var(--foreground)`  | `#050505` (carbon)| `#EEEEEE` (anti-flash) | Primary text color.                 |
| `primary`   | `var(--primary)`     | `#343434` (jet)   | `#BFBFBF` (silver) | Interactive elements, buttons, links.     |
| `muted`     | `var(--muted)`       | `#919191` (battle)| `#919191` (battle)  | Secondary text, placeholders, disabled UI.|
| `accent`    | `var(--accent)`      | `#626262` (dim)   | `#A7A7A7` (battle-600) | Subtle borders, dividers, subtle backgrounds. |
| `hover`     | `var(--hover)`       | `#000000`        | `#F8F8F8` (anti-flash-800) | Hover states for interactive elements.  |

### 2.2. Typography

We will adopt a typographic scale based on the Golden Ratio (approx. 1.618) to ensure a harmonious and readable hierarchy. The base font size is 16px.

| Name      | Size (rem) | Size (px) | Usage                                     |
| :-------- | :--------- | :-------- | :---------------------------------------- |
| `text-xs` | 0.618      | ~10px     | Legal text, fine print.                   |
| `text-sm` | 0.8        | ~13px     | Helper text, captions, secondary info.    |
| `text-base`| 1.0        | 16px      | Body text, default font size.             |
| `text-lg` | 1.25       | 20px      | Subheadings, lead paragraphs.             |
| `text-xl` | 1.618      | ~26px     |`<h3>`, minor headings.                    |
| `text-2xl`| 2.0        | 32px      | `<h2>`, major section headings.            |
| `text-3xl`| 2.618      | ~42px     | `<h1>`, page titles.                       |

### 2.3. Spacing

All layout spacing (margin, padding, gaps) will adhere to an **8-point grid system**. This creates visual consistency and rhythm.

| Token | Pixels | Rem   |
| :---- | :----- | :---- |
| `1`   | 8px    | `0.5rem`  |
| `2`   | 16px   | `1rem`    |
| `3`   | 24px   | `1.5rem`  |
| `4`   | 32px   | `2rem`    |
| `5`   | 40px   | `2.5rem`  |
| `6`   | 48px   | `3rem`    |
| `8`   | 64px   | `4rem`    |
| `10`  | 80px   | `5rem`    |
| `12`  | 96px   | `6rem`    |

## 3. Implementation Plan

The following steps will be taken to integrate this design system into the codebase.

1.  **[ ] Update `tailwind.config.js`:**
    *   Replace the extensive grayscale palette with the new semantic color tokens.
    *   Add the new spacing and typography scales to the `theme.extend` section.

2.  **[ ] Refactor Core Components:**
    *   Start with `App.tsx` and `Header.tsx`.
    *   Update their Tailwind classes to use the new design tokens (e.g., `p-4` becomes `p-2`, `space-x-4` becomes `space-x-2`).

3.  **[ ] Component Audit & Consolidation:**
    *   Analyze `ProfileEditor.tsx`, `ProfileEditors.tsx`, and `ProfileEditorUnified.tsx` to define a single, canonical `ProfileEditor` component.
    *   Audit other components (`ProposalInputForm.tsx`, etc.) and replace one-off styles with the new system.
    *   Remove CSS Modules (`.module.css`) where possible in favor of pure Tailwind and Radix styling.

4.  **[ ] Create `ui` Components:**
    *   Expand the `src/components/ui` directory with any new, generic components that emerge during the refactor (e.g., `Card`, `Input`, `Select`), ensuring they are built with Radix and styled with our tokens.

This is a living document and will be updated as the application evolves.