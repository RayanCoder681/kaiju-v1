---
name: kaiju-stack
description: Use when changing, extending, or reviewing Kaiju's application code and you need to follow its TypeScript monorepo architecture, server authority, persistence, or real-time conventions.
---

# Kaiju technical stack

Use this skill for implementation work in the Kaiju repository. Treat the checked-in source, workspace manifests, and current project docs as authoritative; verify package versions and paths there instead of relying on this summary.

## Architecture

- This is an npm workspaces monorepo: `packages/shared` (`@kaiju/shared`), `server` (`@kaiju/server`), and `client` (`@kaiju/client`). Shared builds before server and client.
- The shared package owns domain types and state/scoring logic, Zod contracts and Socket.IO event types, theme tokens, and French/English dictionaries.
- The server is Node.js + TypeScript ESM, Express REST, Socket.IO, and SQLite through `better-sqlite3`. Business modules generally separate `service.ts` from `routes.ts`; persistence is in `server/src/db`.
- The client is React + TypeScript, Vite, Tailwind, and React Router. It has distinct organizer (`/host`), participant (`/join`), and projection (`/projection`) surfaces.
- Check the root and workspace `package.json` files for the exact versions and available scripts before changing dependencies or commands.

## Decisions that constrain implementation

- The server is authoritative for session and activity states, deadlines, accepted submissions, scoring, and result visibility. Never trust a client-side decision for these rules.
- Validate REST inputs and incoming Socket.IO payloads with the shared Zod schemas where applicable. Authenticate and authorize organizer actions on the server; a session join code grants no admin rights.
- Persist accepted submissions before acknowledging them. Keep idempotence backed by database uniqueness constraints as well as application logic.
- Keep business rules in shared domain code or the server's testable real-time engine, not in UI components or transport handlers.
- Activities attached to sessions are immutable snapshots. Do not alter historical session content when editing the activity library.
- Add schema changes as new SQL migrations under `server/src/db/migrations`. Never edit a migration that may already have been applied; the migration runner checks checksums.
- Preserve the local-first, LAN-friendly deployment model: production/demo serves the built client and API from one server origin, and participant QR/join links must use a reachable LAN or configured public URL, never `localhost` for other devices.
- Follow existing ESM import conventions (`.js` extensions in TypeScript server/shared imports), shared theme tokens/CSS variables, and shared i18n keys for user-facing messages.

## Where to look

- `docs/decisions.md`: architectural decisions and rationale.
- `docs/contribution.md`: repository layout, conventions, and extension points.
- `docs/api.md`: REST and Socket.IO contracts.
- `docs/schema.md`: SQLite schema and migrations.
- `docs/completude.md`: implemented, partial, and planned feature boundaries.

Read only the references relevant to the change. Keep changes within the requested scope, and do not claim a partial feature is complete. Do not run tests or other verification commands unless the user asks for verification; when asked, use the scripts declared in the root/workspace manifests.
