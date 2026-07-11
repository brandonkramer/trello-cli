import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createAnnotations,
  profileField,
  toolEnvelopeSchemaFor,
  withClient,
} from "../handlers.ts";
import { trelloChecklistSchema } from "../schemas.ts";

export function registerChecklistTools(server: McpServer): void {
  server.registerTool(
    "trello_checklist_create",
    {
      title: "Create Trello checklist",
      description: "Create a checklist on a card.",
      inputSchema: {
        profile: profileField,
        cardId: z.string().min(1),
        name: z.string().min(1),
      },
      annotations: createAnnotations,
      outputSchema: toolEnvelopeSchemaFor(trelloChecklistSchema),
    },
    async ({ profile, cardId, name }) =>
      withClient(profile, (client) => client.checklistCreate({ idCard: cardId, name })),
  );

  server.registerTool(
    "trello_checklist_add_item",
    {
      title: "Add Trello checklist item",
      description: "Add an item to a checklist.",
      inputSchema: {
        profile: profileField,
        checklistId: z.string().min(1),
        name: z.string().min(1),
        checked: z.boolean().optional(),
      },
      annotations: createAnnotations,
      outputSchema: toolEnvelopeSchemaFor(z.looseObject({ id: z.string() })),
    },
    async ({ profile, checklistId, name, checked }) =>
      withClient(profile, (client) =>
        client.checklistAddItem(checklistId, { name, checked }),
      ),
  );
}
