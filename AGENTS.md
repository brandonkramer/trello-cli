# AGENTS.md

**trelly** — Trello CLI + MCP stdio server (npm package `trelly`, bins `trelly` /
`trelly-mcp`). TypeScript, run with **Bun** (`bin/run-ts` falls back to
tsx/Node; CI runs the same checks on Bun). Output is human/Trello-styled by default
(ink, `src/cli/ui/static.tsx`); the `--json` flag prints the envelope
`{ ok, profile, data }` / `{ ok: false, error, status?, details? }` (`--pretty`
indents it).

## Layout

- `src/api/` — `http.ts` (30s timeout, 429 retry), `client.ts` (one method per endpoint)
- `src/auth/` — profiles in `~/.config/trelly/config.json` (migrates from
  `~/.config/trello-cli/`), loopback browser flow
- `src/cli/` — commander program: `index.ts`, `context.ts`, `commands/`, `ui/` (ink kanban TUI)
- `src/install.ts`, `src/update.ts` — agent plugin installation and CLI/plugin updates
- `src/mcp/` — `server.ts`, `tools/` (tool registrations), `handlers.ts`, in-process
  GET cache in `cache.ts`
- `powerup/` — standalone Trello Power-Up iframe assets deployed to `tr3lly.dev`
- `bin/` — Node launchers: `trelly`, `trelly-mcp`, `run-ts` (Bun preferred, else tsx);
  `launch-cursor-mcp.mjs` resolves Cursor plugin MCP outside the workspace cwd

## Commands

```bash
bun install
bun run typecheck   # tsc --noEmit
bun test
bun run lint        # biome check .
node bin/trelly --help
```

Run all three checks before committing.

## Rules

- Biome style (double quotes, 2-space indent, 88 cols); TS strict; `import type`
  for types; explicit `.ts` import extensions; named exports only
- CLI: results on stdout (human by default, `--json` for the envelope),
  logs/prompts on stderr, `process.exitCode = 1` on failure.
  MCP server: never write to stdout (stdio transport)
- New MCP tools go in `src/mcp/tools/` (by resource): zod input schema, envelope
  `outputSchema`, `readOnlyHint`/`destructiveHint` annotations
- `*_archive` = `PUT closed=true` (reversible); `*_delete` = permanent —
  descriptions must say which
- Never read, log, or commit credentials (`~/.config/trelly/config.json`);
  auth goes in the `Authorization` header, never in URLs
- No live Trello API calls in tests
- Update logic must spawn package managers and plugin CLIs with argument arrays, never shell
  command strings. Tests must mock registry/process calls and must never mutate real installs;
  source updates must refuse dirty worktrees.
- The Power-Up must work inside Trello without the CLI, MCP, browser extensions, or local
  agents. Never request or pass CLI/MCP credentials from a Power-Up iframe; keep security
  headers in `powerup/_headers` aligned with every hosted iframe.
- Publishable to npm as **`trelly`** (`npm install -g trelly`); bins run TypeScript via
  `bin/run-ts` (Bun if present, else `tsx` — kept in `dependencies` for Node installs)

## Commits & PRs

- Conventional commits (`feat:`, `fix:`, `chore:`, …), imperative, subject ≤72 chars
- Branch `type/short-description` off `main`; one logical change per PR; say how
  you verified it
- Never force-push `main`
- Release: first move all shipped notes from `[Unreleased]` into a dated version section
  in `CHANGELOG.md` and update its comparison links. Run all three checks; bump
  `package.json` and every platform `plugin.json` manifest to the same version; commit
  `chore(release): vX.Y.Z`; create an annotated `vX.Y.Z` tag; and push the commit and tag.
  The tag runs `release.yml` (npm publish with provenance → GitHub Release → tap bump).

## Agent skills

End-user skills/plugins ship in the npm tarball — see [`skills/README.md`](skills/README.md).
Repo contributors: edit `skills/`; manifests at `.claude-plugin/`, `.codex-plugin/`,
`.cursor-plugin/`, `package.json` `"pi"`.

**Card list display:** shared contract in `skills/trelly-card-display.md`. MCP list
tools must populate envelope `display` via `src/util/card-display.ts` — update tool
descriptions when changing format. Agents should paste `display`, not reformat `data`.
