import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createAnnotations,
  freshField,
  profileField,
  readAnnotations,
  toolEnvelopeSchemaFor,
  withCardListResult,
  withClient,
} from "../handlers.ts";
import { trelloCardSchema, trelloListSchema } from "../schemas.ts";

export function registerListTools(server: McpServer): void {
  server.registerTool(
    "trello_list_create",
    {
      title: "Create Trello list",
      description: "Create a list on a board.",
      inputSchema: {
        profile: profileField,
        boardId: z.string().min(1),
        name: z.string().min(1),
        position: z.string().optional(),
      },
      annotations: createAnnotations,
      outputSchema: toolEnvelopeSchemaFor(trelloListSchema),
    },
    async ({ profile, boardId, name, position }) =>
      withClient(profile, (client) =>
        client.listCreate({ idBoard: boardId, name, pos: position }),
      ),
  );

  server.registerTool(
    "trello_list_cards",
    {
      title: "List Trello list cards",
      description:
        "List cards in a list. Response includes `display` (markdown-v1, linked titles + 💬📎✓⏰ badges) — when the user should SEE cards, paste `display` verbatim; do not reformat as a plain title list.",
      inputSchema: {
        profile: profileField,
        fresh: freshField,
        listId: z.string().min(1),
        fields: z
          .string()
          .default("id,name,idList,due,dueComplete,shortUrl,closed,badges,labels")
          .describe('comma-separated fields, "all" for everything'),
        displayHeading: z
          .string()
          .optional()
          .describe(
            'Optional markdown heading prepended to `display` (e.g. "**My Board → To do**")',
          ),
      },
      annotations: readAnnotations,
      outputSchema: toolEnvelopeSchemaFor(z.array(trelloCardSchema)),
    },
    async ({ profile, fresh, listId, fields, displayHeading }) =>
      withCardListResult(
        profile,
        (client) => client.listCards(listId, { fields }),
        displayHeading,
        fresh,
      ),
  );
}
