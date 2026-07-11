---
name: trelly-mcp
description: >-
  Configure and use the trelly MCP stdio server (trello_boards_list,
  trello_card_create, trello_search, trello_api_get, etc.). Use when wiring Cursor/Claude
  MCP, listing or showing Trello cards/todos, linking GitHub PRs/commits, or choosing
  MCP vs CLI.
---

# trelly-mcp

MCP server for Trello (npm package **trelly**, bin **`trelly-mcp`**). Returns JSON
envelope on every tool: `{ ok, profile, data }` /
`{ ok: false, error, status?, details? }`. Never uses CLI human/Ink output.

## Routing: MCP is the agent default

Inside Cursor, Codex, Claude, or another MCP-capable agent host, use the available
`trello_*` tools for normal Trello work. Do not spawn the `trelly` CLI merely
because it is installed. Use the CLI only when the user explicitly requests
terminal commands or shell automation, MCP is unavailable, or the task requires
the interactive `trelly ui`. If an MCP call fails, report the failure before
falling back to the CLI.

> **Listing cards for a user?** Read [trelly-card-display.md](trelly-card-display.md).
> **`trello_list_cards` and `trello_board_context` with `include: ["cards"]`
> include `display` — paste it verbatim.**

Read tools default to lean fields (id, name, URL, due, …) to keep responses
token-cheap; pass the corresponding field input as `"all"` when you need more.
`trello_list_cards` and card-inclusive `trello_board_context` responses include
slim `badges`, `labels`, and pre-rendered **`display`** (markdown-v1).

## Card lists for humans

See [trelly-card-display.md](trelly-card-display.md). For **`trello_list_cards`**
and **`trello_board_context` with cards included**, paste `display` verbatim. Raw
**`trello_api_get`** responses have no `display`; use **Manual format** in that doc.

## Setup

### 1. Auth (CLI, once)

```bash
trelly auth setup
trelly auth login
trelly auth list
```

### 2. Agent plugin or standalone MCP

**Plugin (skills + MCP):** install every detected host or select one:

```bash
trelly install
trelly install --cursor       # or --claude / --codex
trelly install --all --yes    # non-interactive
trelly install --check        # read-only validation
```

The installer validates manifests, skills, and MCP launchers, repairing broken
same-version installations. Follow its reload instructions afterward.

**MCP only** — for example, `~/.cursor/mcp.json`:

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
- Read tools accept **`fresh: true`** to bypass and refresh the MCP response cache.
- Prefer **`trello_card_archive`** / **`trello_board_archive`** to close items.
- **`trello_card_delete`** is **permanent** — no MCP board-delete tool.

### Response cache

The long-lived MCP process caches up to 200 successful GET responses in memory.
Keys contain only the profile name, request path, and normalized query/field values;
credentials are never part of cache keys. Identical concurrent GETs share one
Trello request.

| Read | TTL |
|------|-----|
| Boards, lists, labels | 30s |
| Cards, board cards, list cards | 5s |
| Comments, attachments | 3s |
| Search | 7.5s |

Successful writes invalidate related card, list, board, comment, attachment, and
search entries. Errors, 429 responses, and mutation results are never cached. Set
`TRELLO_CACHE=0` in the MCP server environment to disable both caching and in-flight
deduplication. The terminal CLI is always uncached.

## Tool catalog

| Tool | Purpose |
|------|---------|
| `trello_profiles_list` | Saved profiles + default |
| `trello_member_me` | Authenticated member |
| `trello_boards_list` | Member boards (`filter`, `fields`) |
| `trello_board_create` | Create board |
| `trello_board_archive` | Close board (reversible) |
| `trello_board_context` | Board + optional lists, labels, cards, and card `display` |
| `trello_list_create` | Create list |
| `trello_list_cards` | Cards in list (**returns `display` markdown — paste for users**) |
| `trello_card_create` | Create card on list |
| `trello_card_update` | Update typed content/scheduling fields |
| `trello_card_move` | Move to another list |
| `trello_card_comment_create` | Add comment |
| `trello_card_comment_update` | Edit comment |
| `trello_card_comment_delete` | **Permanently delete comment** |
| `trello_card_archive` | Close card (reversible) |
| `trello_card_delete` | **Permanent** delete |
| `trello_card_context` | Card + optional board, list, comments, attachments, and checklists |
| `trello_card_attachment_add` | Attach a URL to a card |
| `trello_card_attachment_delete` | **Permanently delete attachment** |
| `trello_checklist_create` | Checklist on card |
| `trello_checklist_add_item` | Checklist item |
| `trello_label_create` | Board label |
| `trello_card_add_label` | Label on card |
| `trello_search` | Search Trello |
| `trello_resolve` | Resolve card/board/list name or URL to IDs |
| `trello_webhooks_list` | Token webhooks |
| `trello_webhook_create` | Create webhook |
| `trello_webhook_delete` | Delete webhook |
| `trello_api_get` | Read-only REST (`path`, `query`) |
| `trello_api_mutate` | Write REST (`method`, `path`, `query`, `body`) |

Use `trello_card_context` and `trello_board_context` for both lean single-resource
reads and related objects. Their `include` and field inputs avoid fetching unneeded data.
`trello_resolve` accepts names and Trello URLs and returns ambiguity candidates
instead of guessing.

Both context tools default to `include: []` for a lean primary-resource read. Add
only what the task needs. `trello_board_context` supports `boardFields`,
`listFilter`, `listFields`, `cardFields`, and `displayHeading`;
`trello_card_context` supports `cardFields`, `commentsLimit`, and
`attachmentFields`.

### Card comments

```
trello_card_context         cardId  include: ["comments"]
trello_card_comment_create  cardId  text: "Done"
trello_card_comment_update  cardId  commentId  text: "Updated"
trello_card_comment_delete  cardId  commentId
```

`commentId` is the action `id` in `trello_card_context` response `data.comments`.
Comment deletion is **permanent** and has `destructiveHint: true`.

## GitHub PR / commit on a card (MCP)

Boards with the **GitHub Power-Up** show rich PR UI when attached through Trello.
Agents link the same way via **`trello_card_attachment_add`** — a URL attachment,
not the Power-Up OAuth picker.

### Attach PR or commit

```
trello_card_attachment_add
  cardId: {cardId}
  url: "https://github.com/org/repo/pull/42"
  name: "#42 feature title"
```

Commit:

```
trello_card_attachment_add
  cardId: {cardId}
  url: "https://github.com/org/repo/commit/abc1234"
  name: "abc1234 message"
```

Always set **`name`** to something scannable (`#N title` or short SHA + subject).

### List or remove attachments

```
trello_card_context            cardId: {cardId}  include: ["attachments"]
trello_card_attachment_delete  cardId: {cardId}  attachmentId: {attachmentId}
```

### Comment fallback

```
trello_card_comment_create  cardId  text: "PR: https://github.com/org/repo/pull/42"
```

Comments appear in card activity; they are **not** Attachments.

### Power-Up vs MCP/API

| Feature | GitHub Power-Up (UI) | MCP URL attachment |
|--------|----------------------|--------------------|
| Link on card | Yes | Yes |
| PR title / custom name | Auto | Set `name` in the tool input |
| CI badges on card front | Yes | No |
| GitHub PR back-link comment | Yes (optional) | No |

Use the Power-Up UI when the user needs badges or GitHub-side comments. For
agent workflows (link PR after push, move card to review), attach the GitHub URL.

### Typical agent sequence

1. `trello_search` or `trello_list_cards` — find the card
2. `trello_card_attachment_add` with PR URL + name
3. `trello_card_move` — e.g. To do → Pending review
4. Optional: `trello_card_comment_create` with the same PR URL

## When to use MCP vs CLI

| Use MCP | Use CLI |
|---------|---------|
| IDE agent managing Trello in chat | Terminal, shell scripts, jq pipelines |
| Structured tool calls with schemas | `trelly ui` interactive board |
| Cursor/Codex/Claude with MCP wired | CI with `--json` |

For terminal work, invoke the **trelly** skill instead.

## Extending

New tools: `src/mcp/tools/` — zod input, envelope `outputSchema`,
`readOnlyHint` / `destructiveHint`. See [AGENTS.md](../../AGENTS.md).
