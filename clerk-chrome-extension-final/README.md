# Chrome Extension Build Workflow

This repo uses one canonical local Chrome dev build and one canonical production build.

## Canonical targets

- Local Chrome dev build: `build/chrome-mv3-dev`
- Production build: `build/chrome-mv3-prod`

Legacy folders such as `build/chrome-mv3-dev-dev` and `build/chrome-mv3-dev-prod` are obsolete. The canonical build scripts clean and then prune non-canonical outputs so the final `build/` folder contains only the target you just built.

## Local Chrome dev

Use `.env.chrome` as the local development source of truth.

```bash
npm run build:local
```

Then load this unpacked extension in Chrome:

```text
build/chrome-mv3-dev
```

If you want Plasmo watch mode during development, use:

```bash
npm run dev:local
```

For stable local testing, prefer `npm run build:local` and re-load `build/chrome-mv3-dev`.

## Production

Build the production extension with:

```bash
npm run build:prod
```

That produces:

```text
build/chrome-mv3-prod
```

To package the production build:

```bash
npm run package:prod
```

Production builds should use production Clerk/Convex environment variables, supplied through your production env setup before running the build/package command.
