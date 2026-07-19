#!/usr/bin/env node
/**
 * Cursor starts plugin MCP from the active workspace cwd, so this launcher
 * resolves the bundled trelly-mcp via Cursor plugin paths or PATH.
 */
import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const home = process.env.HOME || process.env.USERPROFILE || homedir();

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function findCachedLauncher() {
  const root = join(home, ".cursor", "plugins", "cache");
  const stack = [[root, 8]];
  while (stack.length > 0) {
    const [dir, depth] = stack.pop();
    if (depth < 0 || !existsSync(dir)) continue;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push([path, depth - 1]);
      } else if (entry.name === "trelly-mcp" && isFile(path)) {
        return path;
      }
    }
  }
  return undefined;
}

function findOnPath() {
  const extensions =
    process.platform === "win32"
      ? ["", ...(process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";")]
      : [""];
  for (const directory of (process.env.PATH || "").split(delimiter)) {
    if (!directory) continue;
    for (const extension of extensions) {
      const candidate = join(directory, `trelly-mcp${extension}`);
      if (isFile(candidate)) return candidate;
    }
  }
  return undefined;
}

function run(command, args = []) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: process.env,
    shell:
      process.platform === "win32" &&
      !command.endsWith(".exe") &&
      command !== process.execPath,
  });
  child.on("error", (error) => {
    console.error(error.message);
    process.exit(1);
  });
  child.on("exit", (code) => {
    process.exit(code ?? 1);
  });
}

const local = join(home, ".cursor", "plugins", "local", "trelly", "bin", "trelly-mcp");
const launcher = isFile(local) ? local : findCachedLauncher();
if (launcher) {
  run(process.execPath, [launcher]);
} else {
  const fromPath = findOnPath();
  if (fromPath) {
    run(fromPath);
  } else {
    console.error("trelly-mcp not found; run trelly install --cursor");
    process.exit(127);
  }
}
