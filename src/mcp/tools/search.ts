import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  freshField,
  profileField,
  readAnnotations,
  toolEnvelopeSchemaFor,
  withClient,
} from "../handlers.ts";
import { trelloBoardSchema, trelloCardSchema } from "../schemas.ts";

export function registerSearchTools(server: McpServer): void {
  server.registerTool(
    "trello_search",
    {
      title: "Search Trello",
      description: "Search Trello for cards, boards, members, and actions.",
      inputSchema: {
        profile: profileField,
        fresh: freshField,
        query: z.string().min(1),
        modelTypes: z.string().optional(),
        cardsLimit: z.number().int().positive().optional(),
        boardsLimit: z.number().int().positive().optional(),
        cardFields: z.string().default("id,name,idList,shortUrl"),
        boardFields: z.string().default("id,name,shortUrl"),
      },
      annotations: readAnnotations,
      outputSchema: toolEnvelopeSchemaFor(
        z.looseObject({
          cards: z.array(trelloCardSchema).optional(),
          boards: z.array(trelloBoardSchema).optional(),
        }),
      ),
    },
    async ({
      profile,
      fresh,
      query,
      modelTypes,
      cardsLimit,
      boardsLimit,
      cardFields,
      boardFields,
    }) =>
      withClient(
        profile,
        (client) =>
          client.search(query, {
            modelTypes,
            cards_limit: cardsLimit,
            boards_limit: boardsLimit,
            card_fields: cardFields,
            board_fields: boardFields,
          }),
        fresh,
      ),
  );
}
