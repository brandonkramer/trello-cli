# Trelly privacy

Trelly is a local CLI and MCP plugin for [Trello](https://trello.com). This document
describes data handling for marketplace review and end users.

## What runs locally

- **CLI (`trelly`)** and **MCP server (`trelly-mcp`)** run on your machine as child
  processes of your terminal or IDE.
- **Credentials** (API key + token) are stored only in `~/.config/trelly/config.json`
  (file mode `600`). The plugin does not upload credentials to any server operated by
  the trelly author.
- **Agent skills** are static markdown instructions bundled in the package. They contain
  no telemetry or phone-home logic.

## Hosted Trello Power-Up

- The companion Power-Up is a static site hosted at
  [`https://tr3lly.dev`](https://tr3lly.dev). It has no author-operated application
  backend or database.
- It uses Trello's Power-Up client inside Trello iframes. To render the current card
  snapshot, it handles the card ID and URL, badge counts, and up to three attachment
  names, URLs, and dates in browser memory. The Power-Up does not persist this data or
  send it to a trelly server.
- The Power-Up does not request or receive CLI/MCP API keys, tokens, or profile files and
  does not connect to a local agent.
- Cloudflare serves the static files and may process ordinary web-request metadata under
  the [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/).

## What leaves your machine

- API requests go **directly to Trello** (`https://api.trello.com`) using your token in
  the `Authorization` header. Trello’s privacy policy applies to that data:
  [Atlassian Privacy Policy](https://www.atlassian.com/legal/privacy-policy).
- The trelly package does **not** collect analytics, crash reports, or usage metrics.

## MCP and IDE plugins

- Cursor, Claude Code, and Codex plugins bundle the same `trelly-mcp` stdio server and
  skills. Enabling the plugin lets the IDE spawn `trelly-mcp`; tool calls follow the same
  Trello API path as the CLI.
- `trelly install` checks local Cursor, Claude Code, and Codex plugin inventories and
  detects whether their local MCP settings already contain a Trelly entry. It writes only
  Trelly plugin files and Trelly-specific marketplace entries; this local installation
  state is not uploaded to the trelly author.
- IDE vendors (Cursor, Anthropic, OpenAI) may log prompts or tool traffic according to
  their own product policies. That is outside trelly’s control.

## Your responsibilities

- Register your own Trello Power-Up API key at
  [power-ups/admin](https://trello.com/power-ups/admin).
- Treat `~/.config/trelly/config.json` like a password file.
- Prefer **`trello_*_archive`** MCP tools over **`trello_card_delete`** unless permanent
  deletion is intended.

## Contact

Issues and security reports: [github.com/brandonkramer/trelly/issues](https://github.com/brandonkramer/trelly/issues)

License: MIT — see [LICENSE](LICENSE).
