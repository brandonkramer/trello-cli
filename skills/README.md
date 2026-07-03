# trelly agent skills & plugins

Shipped **inside the npm package** (`npm install -g trelly`). Teaches agents the CLI,
MCP tools, card-list display contract, GitHub links, and safety — for end users, not
repo contributors.

| Skill | Use when |
|-------|----------|
| [trelly](trelly/SKILL.md) | Terminal / Pi: human card lists, auth, attachments, GitHub links, `--json` |
| [trelly-mcp](trelly-mcp/SKILL.md) | IDE + MCP: paste `display` from list tools, GitHub links, safety |
| [trelly-card-display](trelly-card-display.md) | **Required** when the user asks to see/list cards (all platforms) |

**One copy of the content:** `skills/` in the installed package. Plugins and Pi load from
there — do not maintain separate skill copies elsewhere.

---

## Before any platform (once)

Requires **Node 22+** (or Bun), **macOS or Linux**.

```bash
npm install -g trelly    # or: brew install brandonkramer/tap/trelly
trelly auth setup        # API key from https://trello.com/power-ups/admin
trelly auth login        # browser → ~/.config/trelly/config.json
trelly auth list         # verify
```

---

## Quick pick

| Platform | Recommended install | Skills | MCP | Notes |
|----------|---------------------|--------|-----|--------|
| **Pi** | `pi install npm:trelly` | ✅ | ❌ | CLI/bash only; use human `trelly lists cards` |
| **Claude Code** | `claude plugin install "$(npm root -g)/trelly"` | ✅ | ✅ | Reload after install |
| **Cursor** | Copy plugin → `~/.cursor/plugins/local/trelly` | ✅ | ✅ | **Copy**, not symlink |
| **Codex** | Local marketplace + `/plugins` install | ✅ | ✅ | See Codex section below |
| **Antigravity** | `agy plugin install "$(npm root -g)/trelly"` | ✅ | ✅ | Staged in config directory |

**MCP-only** (tools, no skills): add `trelly-mcp` to your IDE MCP config — [MCP only](#mcp-only-all-ides).

---

## Pi

Pi loads skills from the npm package manifest (`package.json` → `"pi": { "skills": ["./skills"] }`).
There is **no MCP** in Pi — agents use the **trelly** skill and shell out to the CLI.

### Install

```bash
npm install -g trelly
trelly auth setup && trelly auth login

pi install npm:trelly
```

### Verify

- Pi loads skills **trelly** and **trelly-mcp** from the package (`skills/trelly/`, `skills/trelly-mcp/`).
- Card display rules live in [trelly-card-display.md](trelly-card-display.md) (linked from those skills).
- In chat: ask the agent to run `trelly boards list` or `trelly --json boards list | jq '.data[].name'`.

### Update

```bash
npm install -g trelly@latest
pi install npm:trelly    # refresh skills from the new package version
```

### Listing cards in Pi

Prefer **human CLI** (matches the display contract):

```bash
trelly lists cards LIST_ID
```

Do not use `--json` when the user asked to *see* cards unless you format per
[trelly-card-display.md](trelly-card-display.md).

---

## Claude Code

Full **plugin** = skills + MCP (`trelly-mcp` via bundled `bin/`).

### Install (recommended)

```bash
npm install -g trelly
trelly auth setup && trelly auth login

claude plugin install "$(npm root -g)/trelly"
```

From a git clone instead of npm:

```bash
claude plugin install /absolute/path/to/trelly
```

**Reload Claude Code** after install.

### Verify

- MCP server **trelly** connected (plugin spawns `${CLAUDE_PLUGIN_ROOT}/bin/trelly-mcp`).
- Skills **trelly** and **trelly-mcp** available.
- Tool smoke test: list boards or cards; card lists should include a **`display`** field — paste that for the user.

### Update

```bash
npm install -g trelly@latest
claude plugin install "$(npm root -g)/trelly"   # re-point at updated package
# Reload Claude Code
```

Official directory (when published): `/plugin install trelly@claude-plugins-official`

### MCP only

Add to Claude MCP config (skills **not** loaded):

```json
{
  "mcpServers": {
    "trelly": {
      "command": "trelly-mcp",
      "env": { "TRELLO_PROFILE": "default" }
    }
  }
}
```

Requires `trelly-mcp` on PATH (`npm install -g trelly`). See [trelly-mcp/SKILL.md](trelly-mcp/SKILL.md).

---

## Cursor

Full **plugin** = skills + MCP. Cursor plugin **symlinks break** — always **copy** the
package directory.

### Install (recommended)

```bash
npm install -g trelly
trelly auth setup && trelly auth login

rm -rf ~/.cursor/plugins/local/trelly
cp -R "$(npm root -g)/trelly" ~/.cursor/plugins/local/trelly
```

From a repo clone:

```bash
cd /path/to/trelly && ./bin/install-cursor-plugin-local.sh
```

**Developer: Reload Window** in Cursor (or restart). Confirm MCP **trelly** is connected.

### Verify

- Settings → MCP → **trelly** running (uses plugin `bin/trelly-mcp`).
- Agent skills from `~/.cursor/plugins/local/trelly/skills/`.
- `grep "GitHub PR" ~/.cursor/plugins/local/trelly/skills/trelly/SKILL.md` — should match after upgrade.

### Update

```bash
npm install -g trelly@latest
rm -rf ~/.cursor/plugins/local/trelly
cp -R "$(npm root -g)/trelly" ~/.cursor/plugins/local/trelly
# Reload Cursor
```

Marketplace (when listed): install from [Cursor marketplace](https://cursor.com/marketplace) per publisher docs.

### MCP only

Copy [mcp.example.json](../mcp.example.json) into `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "trelly": {
      "command": "trelly-mcp",
      "env": { "TRELLO_PROFILE": "default" }
    }
  }
}
```

Reload MCP. Skills are **not** loaded — read [trelly-mcp/SKILL.md](trelly-mcp/SKILL.md) manually or add skills another way.

---

## Codex

Codex uses `.codex-plugin/plugin.json` + root `.mcp.json` (same bundle as Claude).

### Install (recommended — local marketplace)

One-time setup:

```bash
npm install -g trelly
trelly auth setup && trelly auth login

mkdir -p ~/.agents/plugins
ln -sf "$(npm root -g)/trelly" ~/.agents/plugins/trelly
```

Create or merge `~/.agents/plugins/marketplace.json`:

```json
{
  "name": "local-trelly",
  "interface": { "displayName": "Trelly" },
  "plugins": [
    {
      "name": "trelly",
      "source": {
        "source": "local",
        "path": "./trelly"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

Then:

1. **Restart Codex**
2. Run **`/plugins`**
3. Install **Trelly**
4. Confirm MCP **trelly** and skills load (`${PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_ROOT}` → `bin/trelly-mcp`)

Team distribution: [Codex plugin docs](https://developers.openai.com/codex/plugins/build) — marketplace with `git-subdir` or `codex plugin marketplace add owner/repo`.

### Verify

- `/plugins` shows Trelly enabled.
- MCP tools `trello_boards_list`, `trello_list_cards` work; card responses include **`display`**.

### Update

```bash
npm install -g trelly@latest
# symlink target updates automatically if you used ln -sf "$(npm root -g)/trelly"
# Restart Codex or reinstall plugin from /plugins if skills look stale
```

### MCP only

Wire `trelly-mcp` in Codex MCP config (same as [mcp.example.json](../mcp.example.json)). Skills not included.

---

## Antigravity

Full **plugin** = skills + MCP (`trelly-mcp` via bundled `bin/`).

### Install (recommended)

```bash
npm install -g trelly
trelly auth setup && trelly auth login

agy plugin install "$(npm root -g)/trelly/.antigravity-plugin"
```

Or install from a local repo clone:

```bash
agy plugin install /path/to/trelly/.antigravity-plugin
```

### Verify

- Run `agy plugin list` and confirm `trelly` is listed and enabled.
- Verify skills and MCP tools work as expected.

---

## MCP only (all IDEs)

When you only want Trello **tools** in chat (no bundled skills):

1. `npm install -g trelly && trelly auth setup && trelly auth login`
2. Add to your IDE’s MCP config:

```json
{
  "mcpServers": {
    "trelly": {
      "command": "trelly-mcp",
      "env": { "TRELLO_PROFILE": "default" }
    }
  }
}
```

3. Reload MCP / IDE.
4. Optionally keep a copy of [trelly-card-display.md](trelly-card-display.md) in your own rules — agents won’t auto-load it.

| IDE | Config file (typical) |
|-----|------------------------|
| Cursor | `~/.cursor/mcp.json` |
| Claude Code | Claude MCP / plugin `.mcp.json` when not using full plugin |
| Codex | Via plugin `.mcp.json` or Codex MCP settings |

---

## What each piece does

| Piece | Role |
|-------|------|
| `skills/` | Agent instructions — **source of truth** |
| `bin/trelly` | CLI (human output + `--json`) |
| `bin/trelly-mcp` | MCP stdio server |
| `.antigravity-plugin/` | Google Antigravity plugin manifest & MCP config |
| `.claude-plugin/` + `.mcp.json` | Claude Code plugin + MCP wiring |
| `.codex-plugin/` + `.mcp.json` | Codex plugin + MCP wiring |
| `.cursor-plugin/` + `.cursor-plugin/mcp.json` | Cursor plugin + MCP wiring |
| `package.json` `"pi"` | Pi skills path |

Skills teach agents *how* to use trelly. MCP config tells the IDE *how to spawn*
`trelly-mcp`. After `npm install -g trelly`, both bins are on PATH.

More: [PLUGIN.md](../PLUGIN.md) · [PRIVACY.md](../PRIVACY.md) · [README.md](../README.md)
