# ADR 0005: Frontend = Vite + React + Tailwind v4 + TanStack Query + shadcn/ui

## Status

accepted — 2026-06-23

## Context

Given the split in [ADR 0003](0003-split-frontend-and-backend.md), the frontend is a standalone SPA that talks to the API over HTTPS. Four sub-decisions to make: build tooling, styling, server-state management, and component library.

### Build tooling

- **Vite** — fast dev server (esbuild + HMR), conventional config, tree-shakes well at build time. The default modern choice for React SPAs.
- **Create React App** — deprecated and unmaintained. Out.
- **Webpack hand-rolled** — full control but a lot of config we wouldn't otherwise write.

### Styling

- **Tailwind CSS v4** — utility-first, design-token-driven via `@theme` blocks in CSS, no PostCSS config needed, no `tailwind.config.js` for the common cases. Composes well with shadcn.
- **CSS Modules / vanilla CSS** — fine but more code per component, harder to enforce a consistent design language.
- **Styled-components / Emotion** — adds runtime cost (style injection) and a layer of indirection. Unnecessary when Tailwind covers the design-system needs.

### Server state

- **TanStack Query** — caches, dedupes, invalidates, retries, and refetches API data. Server state is fundamentally different from client state and benefits from a dedicated tool.
- **SWR** — close cousin, slightly smaller; TanStack has the richer mutation/invalidation story which the give-raise + CSV-import flows will use.
- **Redux / Zustand / Jotai** — these are for *client* state. Using them for server state means re-implementing caching, invalidation, and refetching by hand.
- **Plain `fetch` in `useEffect`** — workable for one screen, painful by the third. Cache invalidation after a raise mutation would have to be hand-wired.

### Component library

- **shadcn/ui** — copy-the-component-into-your-codebase model. You own the components, can edit them, can theme them. Built on Radix primitives for accessibility. Pairs naturally with Tailwind.
- **MUI / Chakra / Mantine** — quicker to start but the library *is* the design language. Customizing means fighting the library.
- **Hand-rolled** — most control, slowest to ship, accessibility done from scratch.

## Decision

- **Vite** for the dev server and bundler.
- **Tailwind v4** for styling, via `@tailwindcss/vite`. Theme tokens live in `src/styles.css` inside `@theme` blocks.
- **TanStack Query** for all API-derived state. The `QueryClient` is created in `main.tsx` and provided once. Queries live next to the components that use them or in `src/api/*` modules.
- **shadcn/ui** for primitives (Button, Dialog, Table, Select, etc.). Components are added by `npx shadcn add <name>` as features need them — they live in `src/components/ui/` and are committed to the repo.

The wire format types come from `@acme/shared` (workspace package, see [ADR 0003](0003-split-frontend-and-backend.md)). The web app does not declare its own request/response shapes.

## Consequences

**Easier:**
- The dev experience is fast (Vite HMR < 200ms on save).
- Server state is consistent across screens — invalidating `['employees', id]` after a raise updates every component that reads it.
- Tailwind v4's CSS-first config means no JS config file for the design system; tokens are visible in the same file as the imports.
- shadcn components are ours — when we need a behaviour the upstream doesn't have, we edit the file rather than wrap the library.

**Harder:**
- Tailwind v4 is recent; documentation for some patterns still shows v3 syntax. Mitigation: most v3 patterns work in v4 with minor tweaks.
- shadcn requires us to run `add` for each component we want. Tradeoff for ownership.
- TanStack Query adds ~13KB gzipped. Worth it for the API surface.

**Not chosen — and why:**
- **Next.js (as an SPA)**. Possible but heavy for a pure SPA — App Router + server components don't earn their weight when there's no SSR requirement.
- **MUI / Chakra**. The "your own components in your repo" model wins on customization and on understanding what's in the bundle.
- **Redux Toolkit Query**. Reasonable; we'd prefer TanStack because the API surface is small and we don't need a Redux store for anything else.
