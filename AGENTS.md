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
- `src/mcp/` — `server.ts`, `tools/` (tool registrations), `handlers.ts`
- `bin/` — bash launchers: `trelly`, `trelly-mcp`

## Commands

```bash
bun install
bun run typecheck   # tsc --noEmit
bun test
bun run lint        # biome check .
./bin/trelly --help
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
- Publishable to npm as **`trelly`** (`npm install -g trelly`); bins run TypeScript via
  `bin/run-ts` (Bun if present, else `tsx` — kept in `dependencies` for Node installs)

## Commits & PRs

- Conventional commits (`feat:`, `fix:`, `chore:`, …), imperative, subject ≤72 chars
- Branch `type/short-description` off `main`; one logical change per PR; say how
  you verified it
- Never force-push `main`
- Release: `npm version patch|minor|major && git push --follow-tags` — the `v*` tag
  runs `release.yml` (npm publish with provenance → GitHub Release → tap bump)

## Agent skills

Portable skills for Cursor, Claude Code, Pi, Codex: [`skills/`](skills/README.md)
(`trelly`, `trelly-mcp`). Cursor: symlink under `.cursor/skills/`.
