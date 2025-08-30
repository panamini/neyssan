export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      /*
       * Semantic design tokens (used by Tailwind classes via token names)
       * and implemented as CSS variables at runtime to allow light/dark swapping.
       *
       * Keep these tokens small and semantic so components reference named tokens
       * (e.g. bg-[var(--background)], text-[var(--foreground)], border-[var(--accent)]).
       */
      colors: {
        // Reference CSS variables so dark mode can be toggled by swapping :root values.
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "var(--primary)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        hover: "var(--hover)",
        // Preserve a small grayscale palette for utilities where explicit shades are useful
        gray: {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
        },
      },

      /*
       * Typography scale using Golden Ratio steps (base = 1rem / 16px).
       * These sizes are exposed as Tailwind font-size utilities (text-base, text-lg, etc.)
       */
      fontSize: {
        "xs": ["0.618rem", { lineHeight: "0.9rem" }], // ~10px
        "sm": ["0.8rem", { lineHeight: "1rem" }],    // ~13px
        "base": ["1rem", { lineHeight: "1.5rem" }],  // 16px
        "lg": ["1.25rem", { lineHeight: "1.75rem" }],// 20px
        "xl": ["1.618rem", { lineHeight: "2rem" }],  // ~26px
        "2xl": ["2rem", { lineHeight: "2.25rem" }],  // 32px
        "3xl": ["2.618rem", { lineHeight: "3rem" }], // ~42px
      },

      /*
       * Spacing tokens aligned to an 8px grid.
       * We intentionally map the small integer tokens to the 8px system so
       * designers and developers can rely on consistent spacing.
       *
       * Note: This extends Tailwind's spacing scale. Be mindful that changing
       * numeric keys will affect existing classes (e.g. p-1). We choose values
       * that are intentionally aligned with our design system.
       */
      spacing: {
        '1': '0.5rem',  // 8px
        '2': '1rem',    // 16px
        '3': '1.5rem',  // 24px
        '4': '2rem',    // 32px
        '5': '2.5rem',  // 40px
        '6': '3rem',    // 48px
        '8': '4rem',    // 64px
        '10': '5rem',   // 80px
        '12': '6rem',   // 96px
        '14': '7rem',   // 112px
        '16': '8rem',   // 128px
        '20': '10rem',  // 160px
      },

      /*
       * Token-driven heights and sizes:
       * Expose token-based heights so components can use Tailwind classes like h-btn-base
       * while the concrete pixel values remain driven by CSS variables (defined at runtime).
       *
       * All values reference CSS variables so runtime theme switches or token changes
       * propagate automatically.
       */
      height: {
        // Button heights (map to CSS variables in globals.css)
        'btn-tertiary': 'var(--btn-height-tertiary)',
        'btn-base': 'var(--btn-height-base)',
        'btn-primary': 'var(--btn-height-primary)',

        // Input / textarea base heights
        'input-base': 'var(--input-base-height)',
        'textarea-base': 'var(--textarea-base-height)',

        // Header/footer heights
        'header': 'var(--header-height)',
        'footer': 'var(--footer-height)',

        // Utility container heights
        'toast': 'var(--toast-height)',
        'pill': 'var(--pill-height)',
      },

      /*
       * Widths and layout tokens (golden-ratio driven)
       */
      width: {
        // Proportional main/sidebar widths driven by CSS variables
        'layout-main': 'var(--main-width)',
        'layout-sidebar': 'var(--sidebar-width)',

        // Modal/card widths
        'modal-max': 'var(--modal-max-width)',
        'card': 'min(560px, 100%)',

        // Small utilities
        'toast': 'var(--toast-max-width)',
      },

      /*
       * Max widths and toast sizing utilities
       */
      maxWidth: {
        'toast': 'var(--toast-max-width)',
        'modal': 'var(--modal-max-width)',
      },

      /*
       * Keep borderRadius/shadows etc. unchanged below.
       */

      /*
       * Border radius, shadows, and other subtle tokens that form the basic visual language.
       */
      borderRadius: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
      },

      boxShadow: {
        subtle: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        card: '0 6px 18px rgba(16,24,40,0.08)',
      },
    },
  },

  /*
   * Use class-based dark mode so we can swap CSS variables on the .dark class at the root.
   * The actual variable values should be defined in global CSS (e.g., src/styles/globals.css)
   * or within a layout/provider component so both Radix and Tailwind consumers pick them up.
   */
  darkMode: 'class',
  plugins: [],
};
