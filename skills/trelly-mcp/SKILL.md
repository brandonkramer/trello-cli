---
name: trelly-mcp
description: >-
  Configure and use the trelly MCP stdio server (trello_boards_list,
  trello_card_create, trello_search, etc.). Use when wiring Cursor/Claude MCP,
  calling Trello from an IDE agent, or choosing between MCP tools vs trelly CLI.
---

# trelly-mcp

MCP server for Trello (npm package **trelly**, bin **`trelly-mcp`**). Returns JSON
envelope on every tool: `{ ok, profile, data }` /
`{ ok: false, error, status?, details? }`. Never uses CLI human/Ink output.

## Setup

### 1. Auth (CLI, once)

```bash
trelly auth setup
trelly auth login
trelly auth list
```

### 2. Cursor — plugin or `~/.cursor/mcp.json`

**Plugin (skills + MCP):** after `npm install -g trelly`:

```bash
mkdir -p ~/.cursor/plugins/local
ln -sf "$(npm root -g)/trelly" ~/.cursor/plugins/local/trelly
```

**MCP only** — `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "trelly": {
      "command": "trelly-mcp",
      "env": {
        "TRELLO_PROFILE": "default"
      }
    }
  }
}
```

See [mcp.example.json](../../mcp.example.json).

### 3. Restart the IDE

Reload MCP servers after editing config.

### 4. Smoke test (optional)

```bash
cd trello-cli && bun run mcp
```

Starts stdio MCP manually (IDE normally launches `trelly-mcp` itself).

## Using tools

- Pass **`profile`** on any tool for a non-default account (or set `TRELLO_PROFILE` in env).
- Read **`ok`** before using **`data`**.
- Prefer **`trello_card_archive`** / **`trello_board_archive`** to close items.
- **`trello_card_delete`** is **permanent** — no MCP board-delete tool.

## Tool catalog

| Tool | Purpose |
|------|---------|
| `trello_profiles_list` | Saved profiles + default |
| `trello_member_me` | Authenticated member |
| `trello_boards_list` | Member boards (`filter`, `fields`) |
| `trello_board_get` | Board by id |
| `trello_board_create` | Create board |
| `trello_board_archive` | Close board (reversible) |
| `trello_board_lists` | Lists on board |
| `trello_board_cards` | All cards on board |
| `trello_list_create` | Create list |
| `trello_list_cards` | Cards in list |
| `trello_card_get` | Card (`fields` optional) |
| `trello_card_create` | Create card on list |
| `trello_card_update` | Update card fields map |
| `trello_card_move` | Move to another list |
| `trello_card_comments` | List comments |
| `trello_card_comment` | Add comment |
| `trello_card_archive` | Close card (reversible) |
| `trello_card_delete` | **Permanent** delete |
| `trello_checklist_create` | Checklist on card |
| `trello_checklist_add_item` | Checklist item |
| `trello_label_create` | Board label |
| `trello_card_add_label` | Label on card |
| `trello_search` | Search Trello |
| `trello_webhooks_list` | Token webhooks |
| `trello_webhook_create` | Create webhook |
| `trello_webhook_delete` | Delete webhook |
| `trello_api` | Raw REST (`method`, `path`, `query`, `body`) |

## When to use MCP vs CLI

| Use MCP | Use CLI |
|---------|---------|
| IDE agent managing Trello in chat | Terminal, shell scripts, jq pipelines |
| Structured tool calls with schemas | `trello ui` interactive board |
| Cursor/Codex/Claude with MCP wired | CI with `--json` |

For terminal work, invoke the **trelly** skill instead.

## Extending

New tools: `src/mcp/tools/` — zod input, envelope `outputSchema`,
`readOnlyHint` / `destructiveHint`. See [AGENTS.md](../../AGENTS.md).
