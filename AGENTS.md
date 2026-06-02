# Agent notes

## Running things

Use the package.json scripts, never invoke `tsc` / `vitest` / `node build/index.js` directly:

- `yarn build` — compile TypeScript to `build/`
- `yarn test` — runs `yarn build` then `vitest run`
- `yarn test:watch` — `vitest` in watch mode
- `yarn start` — run the built CLI
- `yarn dev` — build + run

## Writing Style

Use "lightning" and "bitcoin" (lowercase) unless at the start of a sentence or in a heading. Use "..." instead of "…" and use "-" instead of "—".
