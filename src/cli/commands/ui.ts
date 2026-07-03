import type { Command } from "commander";
import { failure, getClient, printResult } from "../context.ts";
import { rootOpts } from "./run.ts";

const ENTER_ALT_SCREEN = "\u001b[?1049h\u001b[H";
const LEAVE_ALT_SCREEN = "\u001b[?1049l";

export function registerUiCommand(program: Command): void {
  program
    .command("ui <boardId>")
    .description("Interactive kanban view of a board (arrows/hjkl, ⏎ detail, r, q)")
    .action(async (boardId, _opts, cmd) => {
      const root = rootOpts(cmd);
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        printResult(failure("trello ui requires an interactive terminal"), root.pretty);
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
        printResult(
          failure(err instanceof Error ? err.message : String(err)),
          root.pretty,
        );
        process.exitCode = 1;
      }
    });
}
