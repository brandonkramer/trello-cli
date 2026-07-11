# Changelog

All notable changes to [trelly](https://www.npmjs.com/package/trelly) are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions match
[npm](https://www.npmjs.com/package/trelly) and git tags (`v0.3.1`, …).

## [Unreleased]

### Fixed

- Codex plugin MCP startup now uses a host-compatible inline relative command instead of
  relying on Claude's `${CLAUDE_PLUGIN_ROOT}` expansion.
- Claude plugin MCP startup is defined inline in its manifest, removing the redundant
  root `.mcp.json` and keeping platform launch configuration isolated.
- Agent skill documentation no longer advertises the removed `trello` CLI alias and now
  documents the working Codex marketplace path, install command, and reload flow.

## [0.3.3] - 2026-07-11

### Added

- Selective `trello_board_context` and `trello_card_context` reads with field controls;
  board card context includes the standard pre-rendered `display`.
- Dedicated MCP attachment tools, name/URL resolution, typed output schemas, complete
  safety annotations, and separate read/write raw REST tools.
- Bounded MCP caching for successful GET requests with route-specific TTLs, in-flight
  request deduplication, mutation-aware invalidation, `fresh: true` reads, and a
  `TRELLO_CACHE=0` troubleshooting switch.
- A standalone Power-Up card snapshot with badge counts, recent attachments, and actions
  to copy the current card ID or URL.

### Changed

- MCP surface reduced to 30 focused tools. Board/card context replaces six overlapping
  atomic read tools; the legacy combined `trello_api` tool was removed.
- Comment mutations use consistent create/update/delete naming; comment reads moved into
  `trello_card_context`.
- Power-Up hosting moved to `tr3lly.dev`; the external AI-agent onboarding was removed so
  the Power-Up works entirely inside Trello without CLI or MCP dependencies.

### Fixed

- Cloudflare Pages deployment uses an available package manager and serves HSTS, CSP,
  content-type, referrer, and permissions-policy security headers.

## [0.3.2] - 2026-07-04

### Added

- **Google Antigravity plugin** (`.antigravity-plugin/`) — skills + MCP via `trelly-mcp`.
- New **logo** (`assets/logo.svg`); README badge updated.
- Power-Up **dark theme** from Trello context; hosted **privacy page** for Power-Up review.
- Per-platform agent install guides (Pi, Claude Code, Cursor, Codex, Antigravity) in
  [skills/README.md](skills/README.md).
- [CHANGELOG.md](CHANGELOG.md) for release notes.

### Changed

- [README.md](README.md): step-by-step auth setup (API key → token, common pitfalls).
- [README.md](README.md) and [PLUGIN.md](PLUGIN.md): MCP config paths for Claude, Codex,
  and Antigravity; point to expanded skills install docs.
- [skills/trelly-card-display.md](skills/trelly-card-display.md): full **Manual format**
  spec (badges, labels, due, custom fields) for raw JSON paths (MCP `trello_api`, CLI
  `--json`).
- [skills/trelly-mcp/SKILL.md](skills/trelly-mcp/SKILL.md) and
  [skills/trelly/SKILL.md](skills/trelly/SKILL.md): link to card-display contract instead
  of duplicating format rules.
- Skill/docs examples use generic placeholders (`org/repo`, `Example card`).

### Fixed

- API: correct checklist and custom-field **item update** routes.
- Power-Up card-back section: resilient badges fallback, signed-URL card data (new card
  backs), `t.cards` board fallback, theme check hoisted out of `try`.
- Biome: exclude SVGs from lint/format checks.

## [0.3.1] - 2026-07-03

### Added

- MCP **`display`** field on `trello_list_cards` and `trello_board_cards` — pre-rendered
  markdown-v1 card lists (linked titles, 💬/📎/✓/⏰ badges, label dots) so agents paste
  formatted output instead of plain title lists.
- Shared formatter: `src/util/card-display.ts`.
- Agent skill contract: [skills/trelly-card-display.md](skills/trelly-card-display.md).
- Optional `displayHeading` on list/board card MCP tools.
- Tests for card display markdown.

### Changed

- MCP tool descriptions instruct agents to paste `display` verbatim when showing cards to
  users.
- MCP tool text leads with `display`, then JSON envelope.
- [skills/trelly/SKILL.md](skills/trelly/SKILL.md) and
  [skills/trelly-mcp/SKILL.md](skills/trelly-mcp/SKILL.md) link to the card-display
  contract; expanded skill description triggers for list/show cards.
- [AGENTS.md](AGENTS.md) documents the display contract for contributors.

## [0.3.0] - 2026-07-03

### Added

- Trello **companion Power-Up** (GitHub Pages): card activity section, agent copy actions,
  onboarding.
- MCP: slim **`badges`** and **`labels`** on card reads for token-cheap rich lists.
- Agent skill **render templates** (linked titles, badge emoji, label dots) in Output
  contract.

### Changed

- MCP read tools default to **lean `fields`** (~38× smaller responses); pass `fields: "all"`
  or add `badges,labels` when needed.
- `trello_board_cards` documents adding `badges,labels` for rich lists.
- CI: split GitHub Pages build/deploy jobs so reruns do not duplicate artifacts.
- Docs: agent skills & plugins install steps in README/skills.

### Fixed

- Power-Up pages: a11y (`lang`, button types), Biome formatting.

## [0.2.1] - 2026-07-03

### Added

- Skills: **GitHub PR/commit** attachment guidance (CLI `cards add-attachment`, MCP
  `trello_api`, Power-Up vs URL attachment comparison, agent workflows).

## [0.2.0] - 2026-07-02

### Added

- **Card attachments**: CLI `cards add-attachment` (`--url` / `--file`),
  `cards delete-attachment`; TUI attach prompt (**a** on card detail).
- Interactive **card detail** in TUI: navigate attachments/comments, open links, comment,
  reply.
- **Agent plugins**: Cursor, Claude Code, Codex manifests; skills (`trelly`, `trelly-mcp`).
- Codex plugin manifest and install docs.

### Fixed

- TUI: paste-on-enter for card comments and attachments.
- Boards command fixes.

## [0.1.1] - 2026-07-01

Early public releases — CLI + MCP foundation, multi-profile auth, kanban TUI, search,
webhooks, `trelly api` escape hatch. See git history before `v0.2.0` for details.

[Unreleased]: https://github.com/brandonkramer/trelly/compare/v0.3.3...HEAD
[0.3.3]: https://github.com/brandonkramer/trelly/releases/tag/v0.3.3
[0.3.2]: https://github.com/brandonkramer/trelly/releases/tag/v0.3.2
[0.3.1]: https://github.com/brandonkramer/trelly/releases/tag/v0.3.1
[0.3.0]: https://github.com/brandonkramer/trelly/releases/tag/v0.3.0
[0.2.1]: https://github.com/brandonkramer/trelly/releases/tag/v0.2.1
[0.2.0]: https://github.com/brandonkramer/trelly/releases/tag/v0.2.0
[0.1.1]: https://github.com/brandonkramer/trelly/releases/tag/v0.1.1
