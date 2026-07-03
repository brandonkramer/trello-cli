# trello-cli

Trello CLI + MCP server. **Human, Trello-styled output by default**; add `--json` for scripts and automation.

![trello-cli interactive UI](cli.gif)

Boards, lists, cards, checklists, labels, custom fields, search, webhooks, multi-profile
auth, interactive `trello ui`, raw `trello api` escape hatch.

## Quick start

```bash
cd ~/dev/trello-cli
bun install
./bin/trello auth setup    # once: API key from power-ups/admin
./bin/trello auth login    # browser → Allow
./bin/trello boards list
```

No Bun? `npm install` — tsx is the fallback runtime.

Optional: `bun link` or add `bin/` to `PATH`.

## Output

| Mode | Command | stdout |
|------|---------|--------|
| Default | `trello boards list` | Styled rows (labels, due badges, etc.) |
| JSON | `trello --json boards list` | `{ ok, profile, data }` |
| Pretty JSON | `trello --json --pretty boards list` | Indented envelope |

- **Errors:** red `✗ message` in human mode, exit code `1` (use `--json` for `{ ok: false, ... }`).
- **Pipes:** colors auto-disable when stdout is not a TTY.
- **Scripts:** always pass `--json` if you parse stdout. The MCP server is unchanged (never uses CLI output).

## Auth

Two steps: **API key** (app identity, once) → **token** (your account, per profile).

Register a throwaway app at [power-ups/admin](https://trello.com/power-ups/admin) — you are **not** installing a Power-Up on your boards. Pick any workspace you **admin** (personal is fine); that choice does not limit which boards you can use. Iframe URL can be any `https://` placeholder (e.g. `https://example.com`). Add `http://127.0.0.1:14189` to **Allowed Origins** for automatic browser login.

After login the CLI is **you** on Trello — same boards and permissions as the website.

```bash
trello auth setup
trello auth login
trello auth login --profile work
trello auth login --manual              # paste token if redirect blocked
trello auth login --full-access         # never-expiring token
trello auth list
trello auth use work
trello auth logout --profile work
trello auth url
```

Non-interactive: `trello auth setup --api-key KEY` then `trello auth login --api-key KEY --token TOKEN`.

Environment override: `TRELLO_APP_API_KEY`, `TRELLO_API_KEY`, `TRELLO_TOKEN`, `TRELLO_PROFILE`.

Credentials: `~/.config/trello-cli/config.json` (mode `600`).

## Usage

```bash
trello boards list
trello --json --pretty boards list | jq '.data[].name'
trello --profile work boards lists BOARD_ID
trello cards create --list LIST_ID --name "Ship feature"
trello cards comments CARD_ID
trello ui BOARD_ID                      # interactive kanban (terminal UI)
trello search "customer onboarding"
trello api -X PUT --path /cards/CARD_ID --query idList=LIST_ID
trello api -X POST --path /cards --body '{"idList":"LIST_ID","name":"Hi"}'
```

Flags: `-p, --profile <name>`, `--json`, `--pretty` (with `--json` only).

**Archive** (reversible) vs **delete** (permanent): prefer `cards archive` / `boards archive` over `cards delete` / `boards delete`.

## MCP

Add to `~/.cursor/mcp.json` (see `mcp.example.json`):

```json
"trello-cli": {
  "command": "$HOME/dev/trello-cli/bin/trello-mcp",
  "env": { "TRELLO_PROFILE": "default" }
}
```

Tools mirror the CLI (`trello_boards_list`, `trello_card_create`, `trello_search`, `trello_api`, …). Agents: prefer `*_archive` over `trello_card_delete` (permanent).

## Development

```bash
bun run typecheck && bun test && bun run lint
```

CI runs the same via `bun install --frozen-lockfile`. See `AGENTS.md` for conventions.

**Agent skills:** [skills/](skills/README.md) — portable `SKILL.md` files for Cursor, Claude, Pi, Codex (`trello-cli`, `trello-mcp`).

## License

MIT
