---
name: trelly-mcp
description: >-
  Configure and use the trelly MCP stdio server (trello_boards_list,
  trello_card_create, trello_search, trello_api, etc.). Use when wiring Cursor/Claude
  MCP, linking GitHub PRs/commits to Trello cards from an agent, or choosing MCP vs CLI.
---

# trelly-mcp

MCP server for Trello (npm package **trelly**, bin **`trelly-mcp`**). Returns JSON
envelope on every tool: `{ ok, profile, data }` /
`{ ok: false, error, status?, details? }`. Never uses CLI human/Ink output.

List/get tools default to lean `fields` (id, name, url, due, …) to keep responses
token-cheap; pass `fields: "all"` or a comma list when you need more.

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
cp -R "$(npm root -g)/trelly" ~/.cursor/plugins/local/trelly
# or from clone: ./bin/install-cursor-plugin-local.sh
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

There is **no dedicated attachment MCP tool** yet — use `trello_api` or the CLI
`cards add-attachment` (see **trelly** skill).

## GitHub PR / commit on a card (MCP)

Boards with the **GitHub Power-Up** show rich PR UI when attached through Trello.
Agents link the same way via **`trello_api`** — a URL attachment, not the Power-Up
OAuth picker.

### Attach PR or commit

```
trello_api
  method: POST
  path: /cards/{cardId}/attachments
  query: { "url": "https://github.com/org/repo/pull/42", "name": "#42 feature title" }
```

Commit:

```
query: { "url": "https://github.com/org/repo/commit/abc1234", "name": "abc1234 message" }
```

Always set **`name`** to something scannable (`#N title` or short SHA + subject).

### List or remove attachments

```
trello_api  GET   /cards/{cardId}/attachments
trello_api  DELETE /cards/{cardId}/attachments/{attachmentId}
```

### Comment fallback

```
trello_card_comment  cardId  text: "PR: https://github.com/org/repo/pull/42"
```

Comments appear in card activity; they are **not** Attachments.

### Power-Up vs MCP/API

| Feature | GitHub Power-Up (UI) | `trello_api` URL attachment |
|--------|----------------------|-----------------------------|
| Link on card | Yes | Yes |
| PR title / custom name | Auto | Set `name` in query |
| CI badges on card front | Yes | No |
| GitHub PR back-link comment | Yes (optional) | No |

Use the Power-Up UI when the user needs badges or GitHub-side comments. For
agent workflows (link PR after push, move card to review), POST the GitHub URL.

### Typical agent sequence

1. `trello_search` or `trello_list_cards` — find the card
2. `trello_api` POST `/cards/{id}/attachments` with PR URL + name
3. `trello_card_move` — e.g. To do → Pending review
4. Optional: `trello_card_comment` with the same PR URL

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
