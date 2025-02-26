# Refactoring Plan: Dark/Light Mode and Modularity

This document outlines the plan to refactor the application, implement a dark/light mode toggle, and improve modularity.

## 1. Component Structure

The application will be structured into the following components:

*   **`app/page.tsx` (Layout):**
    *   Serves as the main page and layout container.
    *   Imports and arranges `Header`, `ProposalInputForm`, and `ProposalDisplay` using Radix UI's `Flex`.
    *   Manages proposal data state with `useState`.
    *   Passes data and handlers to child components via props.
    *   Wrapped with Radix UI's `Theme` for dark/light mode.
    *   Designed for modularity, allowing easy addition of columns/sections.
*   **`components/Header.tsx`:**
    *   Contains a heading (Radix UI `Heading`).
    *   Includes the `DarkModeToggle` component.
*   **`components/ProposalInputForm.tsx`:**
    *   The form for user input.
*   **`components/ProposalDisplay.tsx`:**
    *   Displays the generated proposal.
*   **`components/DarkModeToggle.tsx`:**
    *   Manages the dark/light mode toggle using Radix UI's `Switch` and `localStorage`.

## 2. Styling

Styling will be achieved using a combination of Radix UI and Tailwind CSS:

*   Radix UI `Theme` for overall theming (dark/light).
*   Tailwind CSS for utility classes (spacing, alignment).
*   Radix UI components (`Flex`, `Container`, `Box`, `Heading`, `Text`) for layout and typography.

## 3. Dark/Light Mode

The dark/light mode implementation will involve:

*   Radix UI's `Theme` component wrapping the application in `app/page.tsx`.
*   `DarkModeToggle.tsx` handles toggle logic and `localStorage` persistence.
*   Tailwind CSS configuration (`tailwind.config.js`) will use the `class` strategy for dark/light styles.

## 4. Modularity

Modularity will be achieved by:

*   Using the `Flex` component in `app/page.tsx` and configuring it for easy column addition (e.g., `flex-col` for mobile, `flex-row` for larger screens).

## 5. Files

The following files will be created or modified:

*   **Create:**
    *   `components/DarkModeToggle.tsx`
    *   `components/Header.tsx`
*   **Modify:**
    *   `app/page.tsx`
    *   `components/ProposalInputForm.tsx`
    *   `components/ProposalDisplay.tsx`
    *   `tailwind.config.js` (if needed)
    *   `index.css` (if needed)

## Implementation Steps (in Act Mode)

1.  **Create `DarkModeToggle.tsx`:** Implement the toggle logic with Radix UI `Switch` and `localStorage`.
2.  **Create `Header.tsx`:** Create the header with a heading and include the `DarkModeToggle`.
3.  **Modify `app/page.tsx`:** Import components, use `Flex` for layout, manage state, wrap with `Theme`.
4.  **Modify `ProposalInputForm.tsx` and `ProposalDisplay.tsx`:** Refactor styling.
5.  **Configure Tailwind CSS:** Ensure the `class` strategy is enabled for dark mode in `tailwind.config.js`.
6.  **Create/Modify `index.css`:** Update global styles as needed.
