# AGENTS.md — lite-reminders

Obsidian plugin integrating macOS Reminders app with a lightweight, flash-note style interface. macOS-only (`isDesktopOnly: true`).

## Layout

- `src/main.ts` — plugin entry, registers view, commands, settings tab
- `src/` — additional source modules
- `manifest.json` / `versions.json` / `styles.css` / `esbuild.config.mjs` / `eslint.config.mjs` / `tsconfig.json`
- `deploy.mjs` / `release.mjs` / `version-bump.mjs` — maintainer scripts

## Commands

```bash
npm run dev      # esbuild watch -> dist/main.js
npm run build    # lint + esbuild production + cp manifest.json styles.css dist/
npm run lint     # eslint "**/*.{ts,tsx}"
npm run deploy   # copy dist/ to author's local vaults, then delete dist/
npm run release  # gh release create from manifest.json version
npm run version  # bump version + git add manifest.json versions.json
```

`build` enforces lint before bundling. No `tsc` typecheck in the build pipeline.

## Build

- esbuild `^0.12.26` (older version), entry `src/main.ts`, format `cjs`, target `es2016`
- externals: `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`, Node builtins
- Copies `manifest.json` and `styles.css` to `dist/` (both via shell cp and in esbuild config for production)

## Build quirk

esbuild config copies `manifest.json` and `styles.css` to `dist/` in production mode, but the npm `build` script also does `cp manifest.json styles.css dist/`. The duplication is harmless but keep both in sync if adding new assets.

## Versioning

- `version-bump.mjs` bumps `manifest.json` and `versions.json` automatically
- `release.mjs` reads version from `manifest.json`
- Keep `package.json` in sync manually

## Marketplace / Scorecard

Marketplace, manifest, and release conventions live in the parent `obsidian-plugins-parent/AGENTS.md`. Read it before touching `manifest.json`, release flow, or marketplace-facing code.