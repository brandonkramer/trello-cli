import type { Command } from "commander";
import { getClient, parseKvPairs } from "../context.ts";
import { rootOpts, run } from "./run.ts";

export function registerCustomFieldCommands(program: Command): void {
  const fields = program
    .command("custom-fields")
    .description("Custom field operations");

  fields.command("get <id>").action((id, _opts, cmd) =>
    run(cmd, async () => {
      const { client } = getClient(rootOpts(cmd).profile);
      return client.customFieldGet(id);
    }),
  );

  fields
    .command("create")
    .requiredOption("--board <boardId>", "Board id")
    .requiredOption("--name <name>", "Field name")
    .requiredOption("--type <type>", "text|number|date|checkbox|list")
    .action((opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.customFieldCreate({
          idModel: opts.board,
          modelType: "board",
          name: opts.name,
          type: opts.type,
        });
      }),
    );

  fields
    .command("update <id>")
    .option("--params <kv...>", "key=value params")
    .action((id, opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.customFieldUpdate(id, parseKvPairs(opts.params));
      }),
    );

  fields.command("delete <id>").action((id, _opts, cmd) =>
    run(cmd, async () => {
      const { client } = getClient(rootOpts(cmd).profile);
      return client.customFieldDelete(id);
    }),
  );

  fields
    .command("set-item <fieldId>")
    .requiredOption("--card <cardId>", "Card id")
    .option("--text <text>", "Text value")
    .option("--number <number>", "Number value")
    .option("--date <iso>", "Date value")
    .option("--checked <bool>", "Checkbox value")
    .action((fieldId, opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.customFieldUpdateItem(opts.card, fieldId, {
          value: {
            text: opts.text,
            number: opts.number,
            date: opts.date,
            checked: opts.checked,
          },
        });
      }),
    );
}
