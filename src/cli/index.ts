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
import { registerUiCommand } from "./commands/ui.ts";
import { registerWebhookCommands } from "./commands/webhooks.ts";

const program = new Command();

program
  .name("trello")
  .description("Fast Trello CLI with multi-profile auth")
  .version(packageVersion())
  .option("-p, --profile <name>", "Auth profile (or TRELLO_PROFILE env)")
  .option("--pretty", "Pretty-print JSON output", false);

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
