const fs = require("node:fs");
const path = require("node:path");

const scrapingServerTsconfig = path.join(
  __dirname,
  "scraping-server/tsconfig.json",
);
const scrapingServerOverrides = fs.existsSync(scrapingServerTsconfig)
  ? [
      {
        files: ["scraping-server/**/*.ts"],
        parserOptions: {
          project: [scrapingServerTsconfig],
        },
      },
    ]
  : [];

module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    "eslint:recommended",
    "plugin:react-hooks/recommended",
  ],

  // Narrow ignore list up-front so lint runs remain focused and fast.
  ignorePatterns: [
    "dist",
    ".eslintrc.cjs",
    "convex/_generated",
    "postcss.config.js",
    "tailwind.config.js",
    "vite.config.ts",
    // shadcn components by default violate some rules
    "src/components/ui",
    // backup / legacy directories and test harnesses
    "src/components.bak.*",
    "src/components.bak.*/**",
    "**/__tests__/**",
    "convex/lib/parsing/__tests__/**",
    "docs/**",
    "worker/**",
    "vitest.config.ts",
  ],

  // Use the TypeScript parser but don't give a global `project`.
  // We'll enable typed linting only for specific source folders below.
  parser: "@typescript-eslint/parser",
  parserOptions: {
    EXPERIMENTAL_useProjectService: false,
    tsconfigRootDir: __dirname,
    ecmaVersion: 2020,
    sourceType: "module",
  },

  // Enable typed linting only for our main source code (app + convex).
  // This prevents parser errors on tool/config/test files that aren't
  // included in the main tsconfigs.
  overrides: [
    {
      files: ["convex/**/*.ts", "src/**/*.ts", "src/**/*.tsx"],
      excludedFiles: [
        "**/__tests__/**",
        "**/*.test.*",
        "**/*.spec.*",
        "**/*.bak",
        "**/prev_canonicalize*.ts",
        "src/ProposalGenerator.tsx",
        "src/pages/ProposalForgeNext.tsx",
      ],
      // Enable typed rules only for these files
      extends: ["plugin:@typescript-eslint/recommended-type-checked"],
      parserOptions: {
        EXPERIMENTAL_useProjectService: false,
        tsconfigRootDir: __dirname,
        project: [
          require.resolve("./tsconfig.app.json"),
          require.resolve("./convex/tsconfig.json"),
        ],
      },
      // Enforce no-floating-promises only in typed source so the rule can use type information.
      rules: {
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/no-unused-vars": [
          "warn",
          { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
        ],
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/require-await": "off",
      }
    },
    ...scrapingServerOverrides,
    {
      // Non-typed linting for other TS files (tests, scripts, worker, etc.)
      files: ["**/*.ts", "**/*.tsx"],
      excludedFiles: [
        "convex/**/*.ts",
        "src/**/*.ts",
        "src/**/*.tsx",
        "scraping-server/**/*.ts",
      ],
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
  ],

  plugins: ["react-refresh"],
  rules: {
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],

    // Eased rules for faster iteration (can be tightened later)
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/ban-ts-comment": "error",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/require-await": "off",
  },
};
