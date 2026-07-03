# Card list display contract (all agents)

When the user asks to **see**, **list**, or **show** Trello cards (todo, backlog,
board, column, "what's on…"), you MUST NOT reply with a plain numbered title list.

## MCP (Cursor, Claude Code, Codex with trelly-mcp)

`trello_list_cards` and `trello_board_cards` return:

- `display` — markdown-v1, ready to paste (linked titles + badges)
- `data` — slim JSON for automation

**Rule: paste `display` verbatim** (optionally add a heading via `displayHeading`).
Do not re-summarize `data` into your own format.

Example line:

```text
1. [Example card](https://trello.com/c/example123) · 💬 2 · 📎 2
```

Badge keys (omit when zero): 💬 comments · 📎 attachments · ✓ checked/total · ⏰ due.
Labels: colored dot + `` `name` `` (🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪).

## CLI / Pi (no MCP)

**Preferred:** human output (no `--json`):

```bash
trelly lists cards LIST_ID
```

**If using `--json`:** format with the jq recipe in `skills/trelly/SKILL.md` Output
contract, or call MCP when available.

## Automation only

Plain `data` / names-only output is OK when the user wants scripts, counts, or IDs —
not when they asked to **see** the board.
