# Card list display contract (all agents)

When the user asks to **see**, **list**, or **show** Trello cards (todo, backlog,
board, column, "what's on…"), you MUST NOT reply with a plain numbered title list.

## MCP (Cursor, Claude Code, Codex with trelly-mcp)

`trello_list_cards` and `trello_board_context` with `include: ["cards"]` return:

- `display` — markdown-v1, ready to paste (linked titles + badges)
- `data` — slim JSON for automation

**Rule: paste `display` verbatim** (optionally add a heading via `displayHeading`).
Do not re-summarize `data` into your own format.

MCP tool text leads with `display`, then JSON — prefer the markdown block.

## CLI / Pi (no MCP)

**Preferred:** human output (no `--json`):

```bash
trelly lists cards LIST_ID
```

Human CLI output already matches this contract — do not reformat it.

**If using `--json`:** slim with the jq recipe in `skills/trelly/SKILL.md` Output
contract, then apply **Manual format** below (or call MCP when available).

## Manual format (raw JSON only)

Use when you have card JSON but no pre-rendered markdown — e.g. MCP `trello_api_get`,
CLI `--json` after the jq slim step, or any path where `display` is missing.

Example line:

```text
1. [Example card](https://trello.com/c/example123) 🔴 `Priority: Highest` · 💬 4 · 📎 2 · ✓ 2/5 · ⏰ Jul 5
```

- Title → `[name](shortUrl)`.
- Counts from `badges` (omit when zero): 💬 comments · 📎 attachments ·
  ✓ `checkItemsChecked`/`checkItems`.
- Due: `⏰ Jul 5`, add `(overdue)` if past and not `dueComplete`; prefix `✓` if complete.
- Labels: colored dot + name in backticks. Trello color → emoji: red 🔴 · orange 🟠 ·
  yellow 🟡 · green/lime 🟢 · blue/sky 🔵 · purple/pink 🟣 · black ⚫ · none ⚪.
- Custom-field chips (e.g. `Priority: Highest`): fetch defs once via GET
  `/boards/{boardId}/customFields` (`trello_api_get` or `trelly api`), request
  `customFieldItems` on cards, match `idValue` → option text/color. Skip unless the
  user wants them — it's an extra call.

## Automation only

Plain `data` / names-only output is OK when the user wants scripts, counts, or IDs —
not when they asked to **see** the board.
