# Changelog

All notable changes to [trelly](https://www.npmjs.com/package/trelly) are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions match
[npm](https://www.npmjs.com/package/trelly) and git tags (`v0.3.1`, …).

## [Unreleased]

### Added

- Per-platform agent install guides (Pi, Claude Code, Cursor, Codex) in
  [skills/README.md](skills/README.md).

### Changed

- [README.md](README.md) and [PLUGIN.md](PLUGIN.md) point to the expanded skills install
  documentation.

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

[Unreleased]: https://github.com/brandonkramer/trelly/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/brandonkramer/trelly/releases/tag/v0.3.1
[0.3.0]: https://github.com/brandonkramer/trelly/releases/tag/v0.3.0
[0.2.1]: https://github.com/brandonkramer/trelly/releases/tag/v0.2.1
[0.2.0]: https://github.com/brandonkramer/trelly/releases/tag/v0.2.0
[0.1.1]: https://github.com/brandonkramer/trelly/releases/tag/v0.1.1
