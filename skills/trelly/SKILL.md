---
name: trelly
description: >-
  Operate the trelly Trello CLI (npm trelly; bins trelly/trello): auth setup/login,
  human vs --json output, boards/lists/cards, search, trello ui, trello api. Use when
  the user asks to run trelly/trello commands, script Trello from the terminal, or
  automate Trello with trelly.
---

# trelly

Fast Trello CLI (`npm install -g trelly`). **Human Trello-styled output by default**;
**`--json` for scripts**. Commands: **`trelly`** or **`trello`** (same binary).

## Prerequisites

```bash
npm install -g trelly
trelly auth setup    # once: API key from https://trello.com/power-ups/admin
trelly auth login    # browser Allow → saves token
```

From source: clone [brandonkramer/trello-cli](https://github.com/brandonkramer/trello-cli),
`bun install`, then `./bin/trelly auth setup`.

Auth notes (common confusion):

- Power-Up admin is **developer registration**, not installing a Power-Up on a board.
- Pick any workspace you **admin** (personal is fine) — does not limit which boards you can use.
- After login the CLI is **you** on Trello (member permissions, not board admin).

Credentials: `~/.config/trelly/config.json` (migrates from `~/.config/trello-cli/`; never read/log/commit).

## Output contract

| Goal | Flags |
|------|--------|
| Human (default) | *(none)* |
| JSON envelope | `--json` → `{ ok, profile, data }` or `{ ok: false, error, ... }` |
| Pretty JSON | `--json --pretty` |

- **Scripts:** always `--json` if parsing stdout.
- **`--pretty` alone** does not emit JSON; it only indents `--json` output.
- Errors: red `✗` in human mode; exit code `1`.

## Common commands

```bash
trelly boards list
trelly --json boards list | jq '.data[].name'
trelly boards lists BOARD_ID
trelly boards cards BOARD_ID          # or: api GET /boards/{id}/cards
trelly lists cards LIST_ID
trelly cards get CARD_ID --fields name,desc
trelly cards comments CARD_ID
trelly cards create --list LIST_ID --name "Task"
trelly cards move CARD_ID --list OTHER_LIST_ID
trelly cards comment CARD_ID --text "Done"
trelly search "query"
trelly ui BOARD_ID                    # interactive kanban (TTY required)
trelly auth list
```

Global: `-p, --profile <name>` (or `TRELLO_PROFILE`).

## Raw API escape hatch

```bash
trelly api -X GET --path /members/me
trelly api -X PUT --path /cards/CARD_ID --query idList=LIST_ID
trelly api -X POST --path /cards --body '{"idList":"LIST_ID","name":"Hi"}'
```

Request body flag is **`--body`** (not `--json` — that flag is global output).

## Custom fields (list-type)

```bash
trelly api -X PUT \
  --path "/cards/CARD_ID/customField/FIELD_ID/item" \
  --body '{"idValue":"OPTION_ID"}'
```

## Safety

| Action | CLI | Reversible? |
|--------|-----|-------------|
| Close | `cards archive`, `boards archive` | Yes (Trello UI) |
| Destroy | `cards delete`, `boards delete` | **No** |

Prefer **archive** unless the user explicitly wants permanent deletion.

## Multi-profile

```bash
trelly auth login --profile work
trelly -p work boards list
```

Env override: `TRELLO_APP_API_KEY`, `TRELLO_API_KEY`, `TRELLO_TOKEN`, `TRELLO_PROFILE`.

## MCP vs CLI

- **CLI:** human or `--json` on stdout.
- **MCP:** separate stdio server (`trelly-mcp`) — see **trelly-mcp** skill.
