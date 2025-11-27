# Repository Guidelines

## Project Structure & Module Organization
- `app.vue`, `layouts/`, and `pages/` drive the Nuxt 3 SSR flow; core views live in `pages/` (home, game detail, platform filters, favorites, history, saves).
- API contracts stay under `types/`, while `composables/useRetroApi.ts` centralizes every `/api/games/**` and `/api/user/**` call.
- Theme assets (NES fonts, panels, buttons) live in `assets/css/`, and shared UI pieces (e.g., `GameCard`, `RetroPanel`) sit in `components/`.

## Build, Test, and Development Commands
- `npm install` — install dependencies (Node 18+ recommended).
- `npm run dev` — launch Nuxt in SSR dev mode with hot reload at `http://localhost:3000`.
- `npm run build` — create production bundle (`.output/`).

## Coding Style & Naming Conventions
- Stick to TypeScript + Vue SFCs with `<script setup lang="ts">`; prefer composables and `useAsyncData` for API calls.
- Indent with two spaces, keep strings ASCII, and avoid unnecessary comments; add short context notes only for non-obvious logic.
- Component filenames use `PascalCase.vue`; composables use `useThing.ts`; CSS variables live in `assets/css/main.css`.

## Communication
- 默认使用中文进行沟通和文档说明，确保对接方阅读无障碍。

## Testing Guidelines
- No automated suite exists yet; manually verify pages by hitting the documented API endpoints via the running dev server.
- When adding tests (e.g., Vitest), place them under a `tests/` directory mirroring `pages/`/`components/` paths and name files `*.spec.ts`.

## Commit & Pull Request Guidelines
- Favor concise commits like `feat: add cloud save dashboard` or `fix: handle favorite status update`; scope each commit to a coherent change.
- Pull requests should describe affected routes/components, list new env vars, and attach UI screenshots or GIFs for visual updates.
- Reference related issues (`Fixes #123`) and call out any backend/API assumptions or required migrations.

## Security & Configuration Tips
- Treat upload forms carefully: always validate `game_id` and file type before calling `/api/user/saves`.
