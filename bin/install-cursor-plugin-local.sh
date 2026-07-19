#!/usr/bin/env bash
# Copy trelly into ~/.cursor/plugins/local/trelly for marketplace preflight testing.
# Cursor plugin symlinks are unreliable — use cp -R (see PLUGIN.md).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${HOME}/.cursor/plugins/local/trelly"

rm -rf "$DEST"
mkdir -p "${HOME}/.cursor/plugins/local"
cp -R "$ROOT" "$DEST"
chmod +x "$DEST/bin/trelly" "$DEST/bin/trelly-mcp" "$DEST/bin/run-ts" \
  "$DEST/bin/launch-cursor-mcp.mjs" 2>/dev/null || true

echo "Copied trelly plugin to: $DEST"
echo "Next: reload Cursor (Developer: Reload Window) and check MCP + skills."
