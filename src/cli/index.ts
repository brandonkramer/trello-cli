import { Command } from "commander";
import { packageVersion } from "../version.ts";
import { registerActionCommands } from "./commands/actions.ts";
import { registerApiCommand } from "./commands/api.ts";
import { registerAuthCommands } from "./commands/auth.ts";
import { registerBoardCommands } from "./commands/boards.ts";
import { registerCardCommands } from "./commands/cards.ts";
import { registerChecklistCommands } from "./commands/checklists.ts";
import { registerCustomFieldCommands } from "./commands/custom-fields.ts";
import { registerLabelCommands } from "./commands/labels.ts";
import { registerListCommands } from "./commands/lists.ts";
import { registerMemberCommands } from "./commands/members.ts";
import { registerOrgCommands } from "./commands/orgs.ts";
import { registerSearchCommands } from "./commands/search.ts";
import { launchUi, registerUiCommand } from "./commands/ui.ts";
import { registerWebhookCommands } from "./commands/webhooks.ts";

const program = new Command();

program
  .name("trelly")
  .description("trelly — Trello CLI; bare `trelly` opens the interactive board UI")
  .version(packageVersion())
  .option("-p, --profile <name>", "Auth profile (or TRELLO_PROFILE env)")
  .option("--json", "Output the raw JSON envelope", false)
  .option("--pretty", "Indent --json output", false)
  .action((_opts, cmd) => launchUi(undefined, cmd));

registerAuthCommands(program);
registerBoardCommands(program);
registerListCommands(program);
registerCardCommands(program);
registerChecklistCommands(program);
registerLabelCommands(program);
registerCustomFieldCommands(program);
registerSearchCommands(program);
registerWebhookCommands(program);
registerMemberCommands(program);
registerOrgCommands(program);
registerActionCommands(program);
registerApiCommand(program);
registerUiCommand(program);

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
