# trelly agent skills & plugins

These ship **inside the npm package** (`npm install -g trelly`). They teach your AI agent
how to use the CLI and MCP — for anyone using trelly on their machine, not for people
developing this repo.

| Skill | Use when |
|-------|----------|
| [trelly](trelly/SKILL.md) | Terminal / bash: human card lists, auth, attachments, GitHub links, `--json` |
| [trelly-mcp](trelly-mcp/SKILL.md) | IDE + MCP: paste `display` from list tools, GitHub links, safety |
| [trelly-card-display](trelly-card-display.md) | **Required** when user asks to see/list cards (all platforms) |

**One copy of the content:** `skills/trelly/` and `skills/trelly-mcp/` in the installed
package. Plugins and Pi load from there — you don't maintain separate copies.

## Prerequisite

```bash
npm install -g trelly    # or: brew install brandonkramer/tap/trelly
trelly auth setup
trelly auth login
```

## Pi

```bash
pi install npm:trelly
```

Loads both skills from the package manifest (`package.json` → `"pi": { "skills": ["./skills"] }`).
Pi has no built-in MCP — use the **trelly** skill for CLI/bash, or wire MCP in Cursor/Claude
below.

## Claude Code

Install the plugin from your global npm package (skills + MCP in one step):

```bash
claude plugin install "$(npm root -g)/trelly"
```

Reload Claude Code. The plugin starts `trelly-mcp` and loads `skills/trelly` +
`skills/trelly-mcp`.

**MCP only** (no plugin skills): add to your Claude MCP config using `trelly-mcp` on PATH
(see [trelly-mcp/SKILL.md](trelly-mcp/SKILL.md)).

## Codex

Codex uses `.codex-plugin/plugin.json` (same layout as Claude: skills + `.mcp.json` at
package root). Install via a **marketplace** — see
[Codex plugin docs](https://developers.openai.com/codex/plugins/build).

After `npm install -g trelly`:

```bash
mkdir -p ~/.agents/plugins
ln -sf "$(npm root -g)/trelly" ~/.agents/plugins/trelly
```

`~/.agents/plugins/marketplace.json`:

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

Restart Codex, run `/plugins`, install **Trelly**, then `trelly auth setup && trelly auth login`
once. Codex sets `${PLUGIN_ROOT}` (and `${CLAUDE_PLUGIN_ROOT}`) so bundled MCP finds
`bin/trelly-mcp`.

For team/repo distribution, publish a marketplace with a `git-subdir` entry pointing at
this package, or use `codex plugin marketplace add owner/repo`.

## Cursor

**Plugin (skills + MCP):**

```bash
./bin/install-cursor-plugin-local.sh   # from repo clone (copy — symlinks break in Cursor)
# or after npm install -g trelly:
cp -R "$(npm root -g)/trelly" ~/.cursor/plugins/local/trelly
```

Restart Cursor / reload MCP.

**MCP only:** copy [mcp.example.json](../mcp.example.json) into `~/.cursor/mcp.json`.

## What each piece does

| Piece | Role |
|-------|------|
| `skills/` | Agent instructions (CLI vs MCP, auth, safety) — **the content** |
| `.claude-plugin/` + `.mcp.json` | Claude Code plugin manifest + MCP wiring |
| `.codex-plugin/` + `.mcp.json` | Codex plugin manifest + MCP wiring |
| `.cursor-plugin/` | Cursor plugin manifest + MCP wiring |
| `package.json` `"pi"` | Pi package manifest (skills path) |

Skills tell the agent *how* to use trelly. MCP config tells the IDE *how to spawn*
`trelly-mcp`. After `npm install -g trelly`, both bins are on PATH.
