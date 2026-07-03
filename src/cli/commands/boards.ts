import type { Command } from "commander";
import { getClient, parseJsonFlag, parseKvPairs } from "../context.ts";
import { rootOpts, run } from "./run.ts";

export function registerBoardCommands(program: Command): void {
  const boards = program.command("boards").description("Board operations");

  boards
    .command("list")
    .description("List boards for the current member")
    .option("--fields <fields>", "Comma-separated fields")
    .option("--filter <filter>", "Board filter e.g. open")
    .action((opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.memberBoards("me", {
          fields: opts.fields,
          filter: opts.filter ?? "open",
        });
      }),
    );

  boards
    .command("get <id>")
    .description("Get a board")
    .option("--fields <fields>", "Comma-separated fields")
    .action((id, opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.boardGet(id, { fields: opts.fields });
      }),
    );

  boards
    .command("create")
    .description("Create a board")
    .requiredOption("--name <name>", "Board name")
    .option("--desc <desc>", "Description")
    .option("--org <id>", "Workspace id")
    .option("--default-lists", "Create default lists")
    .option("--params <kv...>", "Extra key=value params")
    .action((opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.boardCreate({
          name: opts.name,
          desc: opts.desc,
          idOrganization: opts.org,
          defaultLists: opts.defaultLists,
          ...parseKvPairs(opts.params),
        });
      }),
    );

  boards
    .command("update <id>")
    .description("Update a board")
    .option("--params <kv...>", "key=value params")
    .option("--json <json>", "JSON body merged with params")
    .action((id, opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        const body = {
          ...parseKvPairs(opts.params),
          ...(parseJsonFlag(opts.json, "--json") as object),
        };
        return client.boardUpdate(id, body);
      }),
    );

  boards
    .command("archive <id>")
    .description("Close (archive) a board — reversible in Trello UI")
    .action((id, _opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.boardArchive(id);
      }),
    );

  boards
    .command("delete <id>")
    .description("Permanently delete a board — irreversible")
    .action((id, _opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.boardDelete(id);
      }),
    );

  boards
    .command("lists <boardId>")
    .description("List lists on a board")
    .option("--filter <filter>", "open|closed|all", "open")
    .action((boardId, opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.boardLists(boardId, { filter: opts.filter });
      }),
    );

  boards
    .command("cards <boardId>")
    .description("List cards on a board")
    .action((boardId, _opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.boardCards(boardId);
      }),
    );

  boards
    .command("labels <boardId>")
    .description("List labels on a board")
    .action((boardId, _opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.boardLabels(boardId);
      }),
    );

  boards
    .command("members <boardId>")
    .description("List board members")
    .action((boardId, _opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.boardMembers(boardId);
      }),
    );

  boards
    .command("actions <boardId>")
    .description("Board activity feed")
    .option("--limit <n>", "Max actions", "50")
    .action((boardId, opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.boardActions(boardId, { limit: opts.limit });
      }),
    );

  boards
    .command("custom-fields <boardId>")
    .description("List custom field definitions")
    .action((boardId, _opts, cmd) =>
      run(cmd, async () => {
        const { client } = getClient(rootOpts(cmd).profile);
        return client.boardCustomFields(boardId);
      }),
    );
}
