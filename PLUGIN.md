# Trelly agent plugin

Marketplace-facing overview for **Pi**, **Cursor**, **Claude Code**, and **Codex**. The
npm package root is the plugin bundle (skills + MCP + launcher scripts).

**Per-platform install (step-by-step):** [skills/README.md](skills/README.md)

## What it does

- **Skills** teach agents when to use the CLI vs MCP, card **`display`** lists, GitHub
  links, and archive vs delete safety (`skills/trelly`, `skills/trelly-mcp`,
  `skills/trelly-card-display.md`).
- **MCP** exposes 30 focused Trello tools via stdio (`trelly-mcp` →
  `src/mcp/server.ts`), including selective board/card context, attachment operations,
  name/URL resolution, and separate read/write REST escape hatches.
- **CLI** (`trelly`) is optional for humans/scripts; the plugin does not require global
  npm install if the IDE loads the plugin from this repository (MCP uses bundled
  `bin/trelly-mcp`).

Successful MCP GET requests use a bounded in-process cache with short, resource-specific
TTLs, concurrent request deduplication, and mutation-aware invalidation. Read tools accept
`fresh: true`; set `TRELLO_CACHE=0` when a guaranteed uncached process is needed.

## Prerequisites (end users)

1. **Node 22+** (or Bun) — `bin/run-ts` falls back to bundled `tsx` for MCP/CLI.
2. One-time Trello auth:
   ```bash
   trelly auth setup    # API key from https://trello.com/power-ups/admin
   trelly auth login    # browser OAuth → ~/.config/trelly/config.json
   ```
3. macOS or Linux (`package.json` `"os"`).

## Install by platform

| Platform | Doc section |
|----------|-------------|
| Pi | [skills/README.md — Pi](skills/README.md#pi) |
| Claude Code | [skills/README.md — Claude Code](skills/README.md#claude-code) |
| Cursor | [skills/README.md — Cursor](skills/README.md#cursor) |
| Codex | [skills/README.md — Codex](skills/README.md#codex) |
| Antigravity (`agy`) | [skills/README.md — Antigravity](skills/README.md#antigravity) |
| MCP only | [skills/README.md — MCP only](skills/README.md#mcp-only-all-ides) |

## Plugin layout

| Path | Purpose |
|------|---------|
| `.cursor-plugin/plugin.json` | Cursor manifest |
| `.cursor-plugin/mcp.json` | Cursor MCP (bundled `bin/trelly-mcp`) |
| `.claude-plugin/plugin.json` | Claude Code manifest + inline MCP wiring |
| `.codex-plugin/plugin.json` | Codex manifest + inline MCP (`./bin/trelly-mcp`) |
| `.antigravity-plugin/plugin.json` | Google Antigravity manifest |
| `.antigravity-plugin/mcp_config.json` | Google Antigravity MCP (bundled `bin/trelly-mcp`) |
| `skills/` | Agent skills (source of truth) |
| `assets/logo.svg` | Plugin logo |
| [PRIVACY.md](PRIVACY.md) | Data handling |

## Test locally (Cursor)

Symlinks are unreliable in Cursor plugins — **copy** the repo:

```bash
./bin/install-cursor-plugin-local.sh
```

Then **Developer: Reload Window** in Cursor. Verify MCP **trelly** is connected and skills
appear. Run `trelly auth list` in a terminal if tools return auth errors.

## Test locally (Claude Code)

```bash
claude plugin install /absolute/path/to/trelly
# or after npm install -g trelly:
claude plugin install "$(npm root -g)/trelly"
```

Reload Claude Code. Confirm MCP server **trelly** and skills load.

## MCP safety notes for reviewers

- **`trello_card_archive`** / **`trello_board_archive`** — reversible (Trello `closed=true`)
- **`trello_card_delete`** — permanent; marked `destructiveHint` in MCP registration
- **`trello_card_comment_delete`** and **`trello_card_attachment_delete`** — permanent
- No MCP board-delete tool
- Auth never appears in URLs; tokens in `Authorization` header only
- The hosted Trello Power-Up is separate from this agent plugin and does not connect to
  the CLI or MCP server.
