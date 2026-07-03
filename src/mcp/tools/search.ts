import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { profileField, toolEnvelopeSchema, withClient } from "../handlers.ts";

export function registerSearchTools(server: McpServer): void {
  const outputSchema = toolEnvelopeSchema;

  server.registerTool(
    "trello_search",
    {
      description: "Search Trello for cards, boards, members, and actions.",
      inputSchema: {
        profile: profileField,
        query: z.string().min(1),
        modelTypes: z.string().optional(),
        cardsLimit: z.number().int().positive().optional(),
        boardsLimit: z.number().int().positive().optional(),
        cardFields: z.string().default("id,name,idList,shortUrl"),
        boardFields: z.string().default("id,name,shortUrl"),
      },
      annotations: { readOnlyHint: true },
      outputSchema,
    },
    async ({
      profile,
      query,
      modelTypes,
      cardsLimit,
      boardsLimit,
      cardFields,
      boardFields,
    }) =>
      withClient(profile, (client) =>
        client.search(query, {
          modelTypes,
          cards_limit: cardsLimit,
          boards_limit: boardsLimit,
          card_fields: cardFields,
          board_fields: boardFields,
        }),
      ),
  );
}
