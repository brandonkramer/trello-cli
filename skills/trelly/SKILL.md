---
name: trelly
description: >-
  Operate the trelly Trello CLI (npm trelly; bins trelly/trello): auth setup/login,
  human vs --json output, boards/lists/cards, search, attachments, GitHub PR/commit
  links on cards, trello ui, trello api. Use when the user asks to run trelly/trello
  commands, list or show Trello cards/todos, link a GitHub PR or commit to a card, or
  automate Trello with trelly.
---

# trelly

Fast Trello CLI (`npm install -g trelly`). **Human Trello-styled output by default**;
**`--json` for scripts**. Commands: **`trelly`** or **`trello`** (same binary).

> **Showing cards to a user?** Read [trelly-card-display.md](trelly-card-display.md).
> Pi has no MCP — use **human CLI** (`trelly lists cards LIST_ID` without `--json`)
> or format per that contract. Never reply with titles-only.

## Prerequisites

```bash
npm install -g trelly
trelly auth setup    # once: API key from https://trello.com/power-ups/admin
trelly auth login    # browser Allow → saves token
```

From source: clone [brandonkramer/trelly](https://github.com/brandonkramer/trelly),
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
- **Token cost:** raw `--json` returns full Trello objects (a board list ≈ 10k tokens) — trim with `jq` (e.g. `| jq '.data[] | {id,name}'`) or request fewer fields (`--fields`, `--query "fields=id,name"`).
- **Showing cards to a human?** See [trelly-card-display.md](trelly-card-display.md).
  Prefer human CLI (`trelly lists cards LIST_ID`). With `--json`, slim first, then
  apply **Manual format** in that doc:
  `jq '.data[] | {name, shortUrl, labels: [.labels[] | {name, color}], badges: {comments: .badges.comments, attachments: .badges.attachments, checkItems: .badges.checkItems, checkItemsChecked: .badges.checkItemsChecked}, due, dueComplete}'`.
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
trelly cards attachments CARD_ID
trelly cards add-attachment CARD_ID --url "https://github.com/org/repo/pull/42"
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

## Card attachments

```bash
trelly cards attachments CARD_ID
trelly cards add-attachment CARD_ID --url "https://…" [--name "label"]
trelly cards add-attachment CARD_ID --file ./screenshot.png [--name "label"]
trelly cards delete-attachment CARD_ID ATTACHMENT_ID
```

Pass **exactly one** of `--url` or `--file`. In `trelly ui`, open a card's detail (**⏎**), then **a** opens the attach prompt (URL or local path).

## GitHub PR / commit on a card

Boards with the **GitHub Power-Up** enabled can show rich PR metadata in the Trello UI.
trelly attaches the same underlying **URL attachment** — it does **not** drive the
Power-Up picker or OAuth flow.

### Link a PR or commit (preferred)

```bash
# Pull request — set --name so the attachment is scannable in lists/UI
trelly cards add-attachment CARD_ID \
  --url "https://github.com/org/repo/pull/42" \
  --name "#42 fix authentication bug"

# Commit
trelly cards add-attachment CARD_ID \
  --url "https://github.com/org/repo/commit/abc1234" \
  --name "abc1234 Merge PR #42"

# Issue (same mechanism)
trelly cards add-attachment CARD_ID \
  --url "https://github.com/org/repo/issues/42"
```

Accepted URL shapes: `…/pull/N`, `…/commit/SHA`, `…/issues/N`, `…/tree/branch`.
Use the canonical `https://github.com/…` URL (no `/files` or `/commits` tab suffix).

### Power-Up UI vs trelly URL attachment

| Feature | GitHub Power-Up (Trello UI) | `cards add-attachment --url` |
|--------|-----------------------------|------------------------------|
| Link on card | Yes | Yes |
| Readable `--name` / PR title | Yes (auto) | Set `--name` yourself (recommended) |
| CI/check badges on card front | Yes | No |
| Pick PR from repo browser | Yes | No — pass URL |
| Comment back on GitHub PR | Yes (optional setting) | No |

If the user needs badges or GitHub-side back-links, attach via **Power-Ups → GitHub**
in Trello. For agent/CLI workflows (ship PR → link card → move list), URL attachment
is enough.

### Agent workflow patterns

**After opening or merging a PR** — attach and optionally move the card:

```bash
CARD_ID=…
PR_URL="https://github.com/org/repo/pull/42"
trelly cards add-attachment "$CARD_ID" --url "$PR_URL" --name "#42 fix scope"
trelly cards move "$CARD_ID" --list PENDING_REVIEW_LIST_ID
```

**Fallback — comment only** (visible in activity, not Attachments):

```bash
trelly cards comment CARD_ID --text "PR: https://github.com/org/repo/pull/42"
```

**Inspect what's linked:**

```bash
trelly --json cards attachments CARD_ID | jq '.data[] | {name, url}'
```

### Raw API (same as CLI)

```bash
trelly api -X POST --path "/cards/CARD_ID/attachments" \
  --query "url=https://github.com/org/repo/pull/42" \
  --query "name=#42 feature title"
```

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
