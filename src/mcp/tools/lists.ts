import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { profileField, toolEnvelopeSchema, withClient } from "../handlers.ts";

export function registerListTools(server: McpServer): void {
  const outputSchema = toolEnvelopeSchema;

  server.registerTool(
    "trello_list_create",
    {
      description: "Create a list on a board.",
      inputSchema: {
        profile: profileField,
        boardId: z.string().min(1),
        name: z.string().min(1),
        position: z.string().optional(),
      },
      outputSchema,
    },
    async ({ profile, boardId, name, position }) =>
      withClient(profile, (client) =>
        client.listCreate({ idBoard: boardId, name, pos: position }),
      ),
  );

  server.registerTool(
    "trello_list_cards",
    {
      description: "List cards in a list.",
      inputSchema: {
        profile: profileField,
        listId: z.string().min(1),
        fields: z
          .string()
          .default("id,name,idList,due,dueComplete,shortUrl,closed")
          .describe('comma-separated fields, "all" for everything'),
      },
      annotations: { readOnlyHint: true },
      outputSchema,
    },
    async ({ profile, listId, fields }) =>
      withClient(profile, (client) => client.listCards(listId, { fields })),
  );
}
