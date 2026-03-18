module.exports = {
  // Minimal config used only to run a focused, typed lint pass for
  // @typescript-eslint/no-floating-promises so we can auto-fix trivial cases.
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: [
      require.resolve("./tsconfig.app.json"),
      require.resolve("./convex/tsconfig.json"),
    ],
    ecmaVersion: 2020,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    // Only enable the floating-promises rule for this focused run.
    "@typescript-eslint/no-floating-promises": "error"
  },
  ignorePatterns: [
    "dist",
    "convex/_generated",
    "node_modules",
    "worker/**",
    "**/__tests__/**",
  ],
}