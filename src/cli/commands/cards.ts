import type { Command } from "commander";
import { getClient, parseJsonFlag, parseKvPairs } from "../context.ts";
import { rootOpts, run } from "./run.ts";

export function registerCardCommands(program: Command): void {
  const cards = program.command("cards").description("Card operations");

  cards
    .command("get <id>")
    .option("--fields <fields>", "Comma-separated fields")
    .action((id, opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.cardGet(id, { fields: opts.fields });
      }),
    );

  cards
    .command("list")
    .description("List cards on a list")
    .requiredOption("--list <listId>", "List id")
    .action((opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.listCards(opts.list);
      }),
    );

  cards
    .command("create")
    .requiredOption("--list <listId>", "Target list")
    .requiredOption("--name <name>", "Card name")
    .option("--desc <desc>", "Description")
    .option("--due <iso>", "Due date ISO8601")
    .option("--pos <pos>", "Position")
    .option("--params <kv...>", "Extra key=value params")
    .action((opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.cardCreate({
          idList: opts.list,
          name: opts.name,
          desc: opts.desc,
          due: opts.due,
          pos: opts.pos,
          ...parseKvPairs(opts.params),
        });
      }),
    );

  cards
    .command("update <id>")
    .option("--params <kv...>", "key=value params")
    .option("--json <json>", "JSON body")
    .action((id, opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.cardUpdate(id, {
          ...parseKvPairs(opts.params),
          ...(parseJsonFlag(opts.json, "--json") as object),
        });
      }),
    );

  cards
    .command("move <id>")
    .description("Move card to another list")
    .requiredOption("--list <listId>", "Destination list")
    .option("--pos <pos>", "Position")
    .action((id, opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.cardUpdate(id, { idList: opts.list, pos: opts.pos });
      }),
    );

  cards
    .command("comments <id>")
    .description("List comments on a card")
    .option("--limit <n>", "Max comments", "50")
    .action((id, opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.cardComments(id, { limit: opts.limit });
      }),
    );

  cards
    .command("comment <id>")
    .requiredOption("--text <text>", "Comment body")
    .action((id, opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.cardComment(id, opts.text);
      }),
    );

  cards
    .command("archive <id>")
    .description("Close (archive) a card — reversible in Trello UI")
    .action((id, _opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.cardArchive(id);
      }),
    );

  cards
    .command("delete <id>")
    .description("Permanently delete a card — irreversible")
    .action((id, _opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.cardDelete(id);
      }),
    );

  cards.command("members <id>").action((id, _opts, cmd) =>
    run(cmd, async () => {
      const { client } = getClient(rootOpts(cmd).profile);
      return client.cardMembers(id);
    }),
  );

  cards.command("add-member <id> <memberId>").action((id, memberId, _opts, cmd) =>
    run(cmd, async () => {
      const { client } = getClient(rootOpts(cmd).profile);
      return client.cardAddMember(id, memberId);
    }),
  );

  cards.command("remove-member <id> <memberId>").action((id, memberId, _opts, cmd) =>
    run(cmd, async () => {
      const { client } = getClient(rootOpts(cmd).profile);
      return client.cardRemoveMember(id, memberId);
    }),
  );

  cards.command("labels <id>").action((id, _opts, cmd) =>
    run(cmd, async () => {
      const { client } = getClient(rootOpts(cmd).profile);
      return client.cardLabels(id);
    }),
  );

  cards.command("add-label <id> <labelId>").action((id, labelId, _opts, cmd) =>
    run(cmd, async () => {
      const { client } = getClient(rootOpts(cmd).profile);
      return client.cardAddLabel(id, labelId);
    }),
  );

  cards.command("remove-label <id> <labelId>").action((id, labelId, _opts, cmd) =>
    run(cmd, async () => {
      const { client } = getClient(rootOpts(cmd).profile);
      return client.cardRemoveLabel(id, labelId);
    }),
  );

  cards
    .command("actions <id>")
    .option("--limit <n>", "Max actions", "50")
    .action((id, opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.cardActions(id, { limit: opts.limit });
      }),
    );

  cards.command("attachments <id>").action((id, _opts, cmd) =>
    run(cmd, async () => {
      const { client } = getClient(rootOpts(cmd).profile);
      return client.cardAttachments(id);
    }),
  );

  cards
    .command("add-attachment <id>")
    .requiredOption("--url <url>", "Attachment URL")
    .option("--name <name>", "Attachment name")
    .action((id, opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.cardAddAttachment(id, { url: opts.url, name: opts.name });
      }),
    );

  cards.command("custom-fields <id>").action((id, _opts, cmd) =>
    run(cmd, async () => {
      const { client } = getClient(rootOpts(cmd).profile);
      return client.cardCustomFieldItems(id);
    }),
  );
}
