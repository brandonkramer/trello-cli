import type { Command } from "commander";
import { failure, getClient, printResult } from "../context.ts";
import { rootOpts } from "./run.ts";

const ENTER_ALT_SCREEN = "\u001b[?1049h\u001b[H";
const LEAVE_ALT_SCREEN = "\u001b[?1049l";

export async function launchUi(
  boardId: string | undefined,
  cmd: Command,
): Promise<void> {
  const root = rootOpts(cmd);
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    printResult(
      failure("interactive mode requires a terminal — run trelly --help for commands"),
      root,
    );
    process.exitCode = 1;
    return;
  }
  try {
    const { profileName, client } = getClient(root.profile);
    const [{ render }, { createElement }, { App }] = await Promise.all([
      import("ink"),
      import("react"),
      import("../ui/app.tsx"),
    ]);
    process.stdout.write(ENTER_ALT_SCREEN);
    try {
      const app = render(createElement(App, { client, boardId, profileName }));
      await app.waitUntilExit();
    } finally {
      process.stdout.write(LEAVE_ALT_SCREEN);
    }
  } catch (err) {
    printResult(failure(err instanceof Error ? err.message : String(err)), root);
    process.exitCode = 1;
  }
}

export function registerUiCommand(program: Command): void {
  program
    .command("ui [boardId]")
    .description(
      "Interactive kanban — picks a board when no id is given (arrows/hjkl, ⏎, r, q)",
    )
    .action((boardId, _opts, cmd) => launchUi(boardId, cmd));
}
