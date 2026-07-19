import { accessSync, constants, existsSync, lstatSync } from "node:fs";
import { delimiter, join } from "node:path";

/** Normalize separators so install-path classifiers work on Windows. */
export function normalizePathSeparators(path: string): string {
  return path.replaceAll("\\", "/");
}

export function isExecutableFile(path: string): boolean {
  try {
    if (lstatSync(path).isDirectory()) return false;
    // On Windows X_OK is treated like F_OK; existence of a non-directory is enough.
    accessSync(path, process.platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolve a command on PATH, honoring PATHEXT on Windows. */
export function findExecutable(command: string): string | undefined {
  if (existsSync(command) && isExecutableFile(command)) return command;

  const extensions =
    process.platform === "win32"
      ? command.includes(".")
        ? [""]
        : ["", ...(process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")]
      : [""];

  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (!directory) continue;
    for (const extension of extensions) {
      const candidate = join(directory, `${command}${extension}`);
      if (isExecutableFile(candidate)) return candidate;
    }
  }
  return undefined;
}
