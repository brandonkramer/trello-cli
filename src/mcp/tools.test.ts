import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { boardContextEnvelope } from "./tools/boards.ts";
import { registerTrelloTools } from "./tools/index.ts";

describe("boardContextEnvelope", () => {
  it("adds the standard card display only when cards were requested", () => {
    const board = { id: "board-1", name: "Work" };
    const lean = boardContextEnvelope({ board });
    assert.equal(lean.display, undefined);

    const withCards = boardContextEnvelope({
      board,
      cards: [
        {
          id: "card-1",
          name: "Ship it",
          shortUrl: "https://trello.com/c/card1",
          badges: { comments: 2 },
        },
      ],
      displayHeading: "**Work**",
    });
    assert.match(withCards.display ?? "", /\*\*Work\*\*/);
    assert.match(withCards.display ?? "", /\[Ship it\]/);
    assert.match(withCards.display ?? "", /💬 2/);
  });
});

describe("trelly MCP tool schemas", () => {
  it("offers fresh on network reads without adding it to mutations", async () => {
    const server = new McpServer({ name: "trelly-test", version: "0" });
    registerTrelloTools(server);
    const client = new Client({ name: "trelly-test-client", version: "0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    try {
      const { tools } = await client.listTools();
      const byName = new Map(tools.map((tool) => [tool.name, tool]));
      const readTools = [
        "trello_member_me",
        "trello_boards_list",
        "trello_list_cards",
        "trello_card_context",
        "trello_board_context",
        "trello_search",
        "trello_resolve",
        "trello_webhooks_list",
        "trello_api_get",
      ];

      assert.equal(tools.length, 30);
      for (const name of ["trello_card_comment_create", "trello_card_comment_update"]) {
        assert.ok(byName.has(name), `${name} should be registered`);
      }
      for (const name of [
        "trello_board_get",
        "trello_board_lists",
        "trello_board_cards",
        "trello_card_get",
        "trello_card_comments_list",
        "trello_card_attachments",
        "trello_api",
        "trello_card_comments",
        "trello_card_comment",
        "trello_card_comment_edit",
      ]) {
        assert.equal(byName.has(name), false, `${name} should not be registered`);
      }
      for (const name of readTools) {
        const schema = byName.get(name)?.inputSchema as
          | { properties?: Record<string, unknown> }
          | undefined;
        assert.ok(schema?.properties?.fresh, `${name} should accept fresh`);
      }

      const mutationSchema = byName.get("trello_card_update")?.inputSchema as
        | { properties?: Record<string, unknown> }
        | undefined;
      assert.equal(mutationSchema?.properties?.fresh, undefined);

      const cardUpdateFields = (
        mutationSchema?.properties?.fields as
          | { properties?: Record<string, unknown> }
          | undefined
      )?.properties;
      assert.deepEqual(Object.keys(cardUpdateFields ?? {}).sort(), [
        "description",
        "due",
        "dueComplete",
        "name",
        "position",
      ]);
      assert.equal(cardUpdateFields?.closed, undefined);
      assert.equal(cardUpdateFields?.idList, undefined);

      const apiGet = byName.get("trello_api_get");
      assert.equal(apiGet?.annotations?.readOnlyHint, true);
      assert.equal(apiGet?.annotations?.destructiveHint, false);

      const apiMutate = byName.get("trello_api_mutate");
      assert.equal(apiMutate?.annotations?.readOnlyHint, false);
      assert.equal(apiMutate?.annotations?.destructiveHint, true);
      const apiMutateSchema = apiMutate?.inputSchema as
        | { properties?: Record<string, unknown> }
        | undefined;
      assert.equal(apiMutateSchema?.properties?.fresh, undefined);

      const boardContextSchema = byName.get("trello_board_context")?.inputSchema as
        | { properties?: Record<string, unknown> }
        | undefined;
      for (const field of [
        "boardFields",
        "listFilter",
        "listFields",
        "cardFields",
        "displayHeading",
      ]) {
        assert.ok(
          boardContextSchema?.properties?.[field],
          `trello_board_context should accept ${field}`,
        );
      }

      const cardContextSchema = byName.get("trello_card_context")?.inputSchema as
        | { properties?: Record<string, unknown> }
        | undefined;
      for (const field of ["cardFields", "commentsLimit", "attachmentFields"]) {
        assert.ok(
          cardContextSchema?.properties?.[field],
          `trello_card_context should accept ${field}`,
        );
      }

      for (const tool of tools) {
        assert.ok(tool.title, `${tool.name} should declare a human-readable title`);
        assert.notEqual(
          tool.annotations?.readOnlyHint,
          undefined,
          `${tool.name} should declare readOnlyHint`,
        );
        assert.notEqual(
          tool.annotations?.destructiveHint,
          undefined,
          `${tool.name} should declare destructiveHint`,
        );
        assert.notEqual(
          tool.annotations?.idempotentHint,
          undefined,
          `${tool.name} should declare idempotentHint`,
        );
        assert.notEqual(
          tool.annotations?.openWorldHint,
          undefined,
          `${tool.name} should declare openWorldHint`,
        );
      }
    } finally {
      await client.close();
    }
  });
});
